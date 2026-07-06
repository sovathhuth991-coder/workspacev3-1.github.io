// drag-drop.js — Enhanced drag & drop with time-based rescheduling

let draggedEventId = null;
let dragSourceDay = null;
let dragGhost = null;

function initDragAndDrop() {
    // Create drag ghost element for visual feedback
    dragGhost = document.createElement('div');
    dragGhost.id = 'dragGhost';
    dragGhost.style.cssText = `
        position: fixed;
        pointer-events: none;
        background: var(--accent-gradient);
        color: #fff;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        opacity: 0.9;
        z-index: 9999;
        box-shadow: 0 4px 16px rgba(124, 109, 240, 0.4);
        display: none;
    `;
    document.body.appendChild(dragGhost);

    // Track mouse for ghost positioning
    document.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.timeline-item');
        if (!item) return;

        draggedEventId = item.dataset.eventId;
        dragSourceDay = currentOpenDay;

        // Add dragging class for styling
        item.classList.add('dragging');

        // Show ghost with task title
        const event = events.find(ev => ev.id == draggedEventId);
        if (event) {
            dragGhost.textContent = event.title;
            dragGhost.style.display = 'block';
        }

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedEventId);

        // Prevent default drag image
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
    });

    document.addEventListener('drag', (e) => {
        if (dragGhost) {
            dragGhost.style.left = (e.clientX + 15) + 'px';
            dragGhost.style.top = (e.clientY + 15) + 'px';
        }
    });

    document.addEventListener('dragend', (e) => {
        const item = e.target.closest('.timeline-item');
        if (item) item.classList.remove('dragging');
        if (dragGhost) dragGhost.style.display = 'none';
        draggedEventId = null;
        dragSourceDay = null;

        // Clean up all drop targets
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
        document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    });

    // Allow drop on day cards (weekly view)
    document.addEventListener('dragover', (e) => {
        const dayBox = e.target.closest('.day');
        if (dayBox) {
            e.preventDefault();
            dayBox.classList.add('drop-target');
        }

        // Allow drop on timeline items for reordering
        const timelineItem = e.target.closest('.timeline-item');
        if (timelineItem && timelineItem.dataset.eventId != draggedEventId) {
            e.preventDefault();
            timelineItem.classList.add('drop-target');
        }

        // Allow drop on graph cells for time-based rescheduling
        const graphCell = e.target.closest('.graph-cell');
        if (graphCell) {
            e.preventDefault();
            graphCell.classList.add('drop-target');

            // Show time indicator
            showGraphTimeIndicator(e, graphCell);
        }
    });

    document.addEventListener('dragleave', (e) => {
        const dayBox = e.target.closest('.day');
        if (dayBox) dayBox.classList.remove('drop-target');
        const timelineItem = e.target.closest('.timeline-item');
        if (timelineItem) timelineItem.classList.remove('drop-target');
        const graphCell = e.target.closest('.graph-cell');
        if (graphCell) graphCell.classList.remove('drop-target');

        // Remove time indicator when leaving
        const indicator = document.getElementById('graphTimeIndicator');
        if (indicator) indicator.remove();
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();

        // Clean up visual indicators
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
        const indicator = document.getElementById('graphTimeIndicator');
        if (indicator) indicator.remove();

        if (!draggedEventId) return;

        // --- Drop onto a day card (change day) ---
        const dayBox = e.target.closest('.day');
        if (dayBox) {
            const newDay = dayBox.querySelector('h3').textContent.replace('⭐️', '').trim();
            const event = events.find(ev => ev.id == draggedEventId);
            if (!event) return;

            saveStateForUndo();
            event.day = newDay;
            saveEvents();
            renderSchedule();
            if (typeof renderScheduleGraph === 'function') renderScheduleGraph();
            showToast(`Moved to ${newDay}`, 'success');
            return;
        }

        // --- Drop onto a graph cell (time-based rescheduling) ---
        const graphCell = e.target.closest('.graph-cell');
        if (graphCell) {
            const dayShort = graphCell.dataset.day;
            const hour = parseInt(graphCell.dataset.hour);
            const dayMap = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
            const newDay = dayMap[dayShort];

            if (newDay) {
                const event = events.find(ev => ev.id == draggedEventId);
                if (!event) return;

                saveStateForUndo();

                // Calculate new time (start at the hour, end 1 hour later)
                const newStart = String(hour).padStart(2, '0') + ':00';
                const newEndHour = (hour + 1) % 24;
                const newEnd = String(newEndHour).padStart(2, '0') + ':00';

                event.day = newDay;
                event.start = newStart;
                event.end = newEnd;

                saveEvents();
                renderSchedule();
                if (typeof renderScheduleGraph === 'function') renderScheduleGraph();
                showToast(`Rescheduled to ${newDay} at ${newStart}`, 'success');
            }
            return;
        }

        // --- Drop onto a timeline item (reorder within same day) ---
        const timelineItem = e.target.closest('.timeline-item');
        if (timelineItem) {
            const targetId = timelineItem.dataset.eventId;
            if (targetId === draggedEventId) return;

            const day = currentOpenDay;
            if (!day) return;

            const dayEvents = events.filter(e => e.day === day).sort((a, b) => a.start.localeCompare(b.start));
            const draggedIndex = dayEvents.findIndex(e => e.id == draggedEventId);
            const targetIndex = dayEvents.findIndex(e => e.id == targetId);

            if (draggedIndex === -1 || targetIndex === -1) return;

            saveStateForUndo();
            const draggedEventObj = events.find(e => e.id == draggedEventId);
            const targetEventObj = events.find(e => e.id == targetId);

            // Remove dragged, insert before target
            const dragIndexGlobal = events.indexOf(draggedEventObj);
            const targetIndexGlobal = events.indexOf(targetEventObj);
            events.splice(dragIndexGlobal, 1);
            const newIndex = dragIndexGlobal < targetIndexGlobal ? targetIndexGlobal - 1 : targetIndexGlobal;
            events.splice(newIndex, 0, draggedEventObj);

            saveEvents();
            renderSchedule();
            openDayDiagram(day);
            showToast('Task reordered', 'info');
        }
    });
}

// Show time indicator on graph during drag
function showGraphTimeIndicator(e, cell) {
    // Remove existing indicator
    const existing = document.getElementById('graphTimeIndicator');
    if (existing) existing.remove();

    const dayShort = cell.dataset.day;
    const hour = parseInt(cell.dataset.hour);
    const dayMap = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

    const indicator = document.createElement('div');
    indicator.id = 'graphTimeIndicator';
    indicator.style.cssText = `
        position: fixed;
        background: rgba(124, 109, 240, 0.9);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        z-index: 9998;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;
    indicator.textContent = `${dayMap[dayShort]} ${String(hour).padStart(2, '0')}:00`;
    indicator.style.left = (e.clientX + 20) + 'px';
    indicator.style.top = (e.clientY - 25) + 'px';
    document.body.appendChild(indicator);
}

// Add drag handle to timeline items (called after render)
function addDragHandlesToTimeline() {
    document.querySelectorAll('.timeline-item').forEach(item => {
        if (item.querySelector('.drag-handle')) return;

        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.setAttribute('draggable', 'true');
        dragHandle.innerHTML = '&#x22EE;&#x22EE;';
        dragHandle.style.cssText = `
            cursor: grab;
            color: var(--text-muted);
            font-size: 1.2rem;
            padding: 0 6px;
            user-select: none;
            opacity: 0.5;
            transition: opacity 0.2s;
            line-height: 1;
        `;
        dragHandle.title = 'Drag to reschedule';

        // Insert at the beginning of the item
        item.insertBefore(dragHandle, item.firstChild);

        // Hover effect
        item.addEventListener('mouseenter', () => {
            dragHandle.style.opacity = '1';
        });
        item.addEventListener('mouseleave', () => {
            dragHandle.style.opacity = '0.5';
        });
    });
}

// Patch renderSchedule to add drag handles
const originalRenderSchedule = window.renderSchedule;
if (typeof originalRenderSchedule === 'function') {
    window.renderSchedule = function() {
        originalRenderSchedule();
        setTimeout(addDragHandlesToTimeline, 50);
    };
}

// Patch renderScheduleGraph to add drag handles
const originalRenderScheduleGraph = window.renderScheduleGraph;
if (typeof originalRenderScheduleGraph === 'function') {
    window.renderScheduleGraph = function() {
        originalRenderScheduleGraph();
        setTimeout(addDragHandlesToTimeline, 50);
    };
}

console.log('🖱️ Enhanced Drag & Drop module loaded');
