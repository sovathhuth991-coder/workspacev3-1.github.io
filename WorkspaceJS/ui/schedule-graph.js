// ============================================================
// SCHEDULE GRAPH / TIMELINE VIEW + PERSISTENT COUNTDOWN
// ============================================================

const GRAPH_HOURS_START = 6;
const GRAPH_HOURS_END = 23;

function getGraphHours() {
    const hours = [];
    for (let h = GRAPH_HOURS_START; h <= GRAPH_HOURS_END; h++) {
        hours.push(h);
    }
    return hours;
}

function getGraphDayNames() {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
}

function getGraphDayFull(short) {
    const map = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
    return map[short] || short;
}

function getTodayShort() {
    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[now.getDay()];
}

function timeToGraphPosition(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return (h - GRAPH_HOURS_START) + (m / 60);
}

function durationInHours(start, end) {
    const s = timeToGraphPosition(start);
    const e = timeToGraphPosition(end);
    return Math.max(e - s, 0.15);
}

function renderScheduleGraph() {
    const container = document.getElementById('scheduleGraphContainer');
    if (!container) return;

    const hours = getGraphHours();
    const dayShorts = getGraphDayNames();
    const today = getTodayShort();

    const eventsByDay = {};
    dayShorts.forEach(d => eventsByDay[d] = []);

    events.forEach(ev => {
        const dayFull = ev.day;
        const short = dayShorts.find(s => getGraphDayFull(s) === dayFull);
        if (short) {
            eventsByDay[short].push(ev);
        }
    });

    Object.keys(eventsByDay).forEach(d => {
        eventsByDay[d].sort((a, b) => a.start.localeCompare(b.start));
    });

    let html = '';
    html += `<div class="graph-header" style="border-bottom:1px solid var(--border-color);background:rgba(255,255,255,0.02);">Time</div>`;
    dayShorts.forEach(d => {
        const isToday = d === today;
        const isSelected = d === selectedGraphDay;
        html += `<div class="graph-header ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" onclick="selectGraphDay('${d}')">${d} <span class="day-number">${getDayNumber(d)}</span></div>`;
    });

    hours.forEach(h => {
        const hourLabel = `${String(h).padStart(2, '0')}:00`;
        html += `<div class="graph-time-label">${hourLabel}</div>`;

        dayShorts.forEach(dayShort => {
            const isSelectedDay = dayShort === selectedGraphDay;
            const dayEvents = eventsByDay[dayShort] || [];
            const eventsInHour = dayEvents.filter(ev => {
                const startPos = timeToGraphPosition(ev.start);
                const endPos = timeToGraphPosition(ev.end);
                const hourPos = h - GRAPH_HOURS_START;
                return startPos <= hourPos + 1 && endPos > hourPos;
            });

            html += `<div class="graph-cell ${isSelectedDay ? 'selected-day' : ''} ${selectedGraphDay && !isSelectedDay ? 'dimmed' : ''}" data-day="${dayShort}" data-hour="${h}" onclick="openDayDiagram('${getGraphDayFull(dayShort)}')">`;

            if (eventsInHour.length === 0) {
                const minute = h % 2 === 0 ? '' : '·';
                html += `<span class="cell-time-hint">${minute}</span>`;
            } else {
                eventsInHour.forEach(ev => {
                    const startPos = timeToGraphPosition(ev.start);
                    const endPos = timeToGraphPosition(ev.end);
                    const cellHour = h - GRAPH_HOURS_START;
                    const topOffset = Math.max(0, startPos - cellHour) * 100;
                    const height = durationInHours(ev.start, ev.end) * 100;
                    const clampedHeight = Math.min(height, 100 - topOffset);

                    const cat = ev.category || 'study';
                    const completed = ev.completed ? 'completed' : '';
                    const hasOverlap = dayEvents.some(other =>
                        other.id !== ev.id && eventsOverlap(ev, other)
                    );

                    const tooltip = `${ev.title} (${ev.start}-${ev.end})`;
                    // Escape title for safety
                    const escapedTitle = escapeHtml(ev.title);
                    html += `<div class="graph-event-bar cat-${cat} ${completed} ${hasOverlap ? 'overlap' : ''}"
                               style="top: ${topOffset}%; height: ${clampedHeight}%; min-height: 12px;"
                               title="${escapeHtml(tooltip)}"
                               onclick="event.stopPropagation(); openDayDiagram('${getGraphDayFull(dayShort)}')"
                               data-event-id="${ev.id}">
                                <span class="bar-time">${ev.start}</span>
                                ${escapedTitle}
                           </div>`;
                });
            }

            html += `</div>`;
        });
    });

    const totalEvents = Object.values(eventsByDay).reduce((sum, arr) => sum + arr.length, 0);
    if (totalEvents === 0) {
        html = `<div class="graph-empty">No events scheduled yet. Add your first task!</div>`;
    }

    container.innerHTML = html;
}

function getDayNumber(short) {
    const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    return map[short] || '';
}

let selectedGraphDay = null;

function selectGraphDay(dayShort) {
    selectedGraphDay = selectedGraphDay === dayShort ? null : dayShort;
    renderScheduleGraph();
}

// ============================================================
// PERSISTENT COUNTDOWN ENGINE (moved to global scope)
// ============================================================
let countdownTargetDate = null;
let countdownInterval = null;
let scheduleViewMode = 'graph';

// Restore target from localStorage on load
(function restoreCountdown() {
    try {
        const stored = localStorage.getItem('countdownTargetDate');
        if (stored) {
            const date = new Date(parseInt(stored));
            if (!isNaN(date)) {
                countdownTargetDate = date;
                if (date > new Date()) {
                    startCountdownTick();
                } else {
                    localStorage.removeItem('countdownTargetDate');
                    countdownTargetDate = null;
                }
            }
        }
    } catch (_) { /* ignore */ }
})();

// Now define startCountdown globally so calendar.js can call it
window.startCountdown = function(targetDate) {
    if (!targetDate || !(targetDate instanceof Date) || isNaN(targetDate)) return;
    countdownTargetDate = targetDate;
    localStorage.setItem('countdownTargetDate', String(targetDate.getTime()));
    updateCountdownLabel();
    startCountdownTick();
    if (scheduleViewMode !== 'countdown') {
        toggleScheduleView('countdown');
    }
};

function startCountdownTick() {
    stopCountdownTick();
    if (!countdownTargetDate) return;
    updateCountdownDisplay();
    countdownInterval = setInterval(updateCountdownDisplay, 1000);
}

function stopCountdownTick() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

function updateCountdownDisplay() {
    if (!countdownTargetDate) {
        const els = ['cdDays', 'cdHours', 'cdMinutes', 'cdSeconds'];
        els.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '00';
        });
        return;
    }
    const now = new Date();
    const diffMs = countdownTargetDate - now;
    if (diffMs <= 0) {
        document.getElementById('cdDays').textContent = '00';
        document.getElementById('cdHours').textContent = '00';
        document.getElementById('cdMinutes').textContent = '00';
        document.getElementById('cdSeconds').textContent = '00';
        stopCountdownTick();
        localStorage.removeItem('countdownTargetDate');
        countdownTargetDate = null;
        return;
    }
    const diffSec = Math.floor(diffMs / 1000);
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const seconds = diffSec % 60;
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val).padStart(2, '0');
    };
    setText('cdDays', days);
    setText('cdHours', hours);
    setText('cdMinutes', minutes);
    setText('cdSeconds', seconds);
}

function updateCountdownLabel() {
    const label = document.getElementById('countdownTargetLabel');
    if (label && countdownTargetDate) {
        label.textContent = `Counting down to ${countdownTargetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`;
    }
}

// ============================================================
// VIEW TOGGLE (no switchView override – uses event-based)
// ============================================================
function toggleScheduleView(mode) {
    scheduleViewMode = mode;
    const listView = document.getElementById('calendar');
    const graphView = document.getElementById('scheduleGraphContainer');
    const countdownPanel = document.getElementById('countdownPanel');
    const toggleBtns = document.querySelectorAll('.schedule-view-toggle button');

    toggleBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === mode);
    });

    if (mode === 'countdown') {
        if (listView) listView.style.display = 'none';
        if (graphView) graphView.style.display = 'none';
        if (countdownPanel) {
            countdownPanel.style.display = 'block';
            if (countdownTargetDate) {
                updateCountdownLabel();
                startCountdownTick();
                updateCountdownDisplay();
            } else if (typeof calendarSelectedDate !== 'undefined' && calendarSelectedDate) {
                const parts = calendarSelectedDate.split('-');
                if (parts.length === 3) {
                    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    window.startCountdown(date);
                }
            }
        }
    } else if (mode === 'graph') {
        if (listView) listView.style.display = 'none';
        if (graphView) {
            graphView.style.display = 'block';
            setTimeout(renderScheduleGraph, 20);
        }
        if (countdownPanel) countdownPanel.style.display = 'none';
    } else {
        if (listView) listView.style.display = 'grid';
        if (graphView) graphView.style.display = 'none';
        if (countdownPanel) countdownPanel.style.display = 'none';
        renderSchedule();
    }
}

function initScheduleGraphView() {
    const scheduleSection = document.querySelector('#schedule-view');
    if (!scheduleSection) return;

    if (!document.querySelector('.schedule-view-toggle')) {
        const calendarWrapper = scheduleSection.querySelector('.calendar-section-wrapper');
        if (!calendarWrapper) return;

        const toggleHTML = `
            <div class="schedule-view-toggle">
                <button class="active" data-view="graph" onclick="toggleScheduleView('graph')">📊 Graph View</button>
                <button data-view="list" onclick="toggleScheduleView('list')">📋 List View</button>
                <button data-view="countdown" onclick="toggleScheduleView('countdown')">⏱ Countdown</button>
            </div>
        `;
        calendarWrapper.insertAdjacentHTML('beforebegin', toggleHTML);

        if (!document.getElementById('scheduleGraphContainer')) {
            const graphContainer = document.createElement('div');
            graphContainer.id = 'scheduleGraphContainer';
            graphContainer.className = 'schedule-graph-wrapper';
            graphContainer.style.display = 'block';
            calendarWrapper.parentNode.insertBefore(graphContainer, calendarWrapper);
        }

        const listView = document.getElementById('calendar');
        if (listView) listView.style.display = 'none';
    }

    if (!document.getElementById('countdownPanel')) {
        const calendarWrapper = scheduleSection.querySelector('.calendar-section-wrapper');
        if (!calendarWrapper) return;

        const countdownPanel = document.createElement('div');
        countdownPanel.id = 'countdownPanel';
        countdownPanel.className = 'countdown-panel';
        countdownPanel.style.display = 'none';
        countdownPanel.innerHTML = `
            <div class="countdown-header">
                <h3>⏱ Countdown</h3>
                <p id="countdownTargetLabel">Select a date from the calendar below to start counting down</p>
            </div>
            <div class="countdown-display">
                <div class="countdown-unit">
                    <span class="countdown-value" id="cdDays">00</span>
                    <span class="countdown-label">Days</span>
                </div>
                <div class="countdown-unit">
                    <span class="countdown-value" id="cdHours">00</span>
                    <span class="countdown-label">Hours</span>
                </div>
                <div class="countdown-unit">
                    <span class="countdown-value" id="cdMinutes">00</span>
                    <span class="countdown-label">Minutes</span>
                </div>
                <div class="countdown-unit">
                    <span class="countdown-value" id="cdSeconds">00</span>
                    <span class="countdown-label">Seconds</span>
                </div>
            </div>
        `;
        const graphContainer = document.getElementById('scheduleGraphContainer');
        if (graphContainer) {
            graphContainer.parentNode.insertBefore(countdownPanel, graphContainer.nextSibling);
        } else {
            calendarWrapper.parentNode.insertBefore(countdownPanel, calendarWrapper);
        }
    }

    if (scheduleViewMode === 'graph' || !scheduleViewMode) {
        renderScheduleGraph();
    } else if (scheduleViewMode === 'countdown') {
        const panel = document.getElementById('countdownPanel');
        if (panel) panel.style.display = 'block';
        if (countdownTargetDate) {
            updateCountdownLabel();
            startCountdownTick();
            updateCountdownDisplay();
        }
    }
}

function ensureScheduleGraphInit() {
    const scheduleView = document.getElementById('schedule-view');
    if (!scheduleView || !scheduleView.classList.contains('active')) return;
    if (!document.getElementById('scheduleGraphContainer')) {
        initScheduleGraphView();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initScheduleGraphView();
});

// ---- Patch renderSchedule to keep graph in sync ----
const originalRenderSchedule = window.renderSchedule;
if (typeof originalRenderSchedule === 'function') {
    window.renderSchedule = function() {
        originalRenderSchedule();
        if (scheduleViewMode === 'graph' && document.getElementById('scheduleGraphContainer')) {
            renderScheduleGraph();
        }
    };
}

// ---- NO switchView override – instead we listen to view changes via event ----
// We'll use a custom event that app.js can dispatch
document.addEventListener('viewChanged', function(e) {
    if (e.detail.viewId === 'schedule-view') {
        const panel = document.getElementById('countdownPanel');
        if (panel && panel.style.display !== 'none') {
            if (countdownTargetDate) {
                updateCountdownLabel();
                startCountdownTick();
                updateCountdownDisplay();
            }
        }
    }
});

// Expose functions globally
window.toggleScheduleView = toggleScheduleView;
window.renderScheduleGraph = renderScheduleGraph;
window.initScheduleGraphView = initScheduleGraphView;
window.ensureScheduleGraphInit = ensureScheduleGraphInit;
// startCountdown is already exposed above

console.log('📊 Schedule Graph module loaded (persistent countdown, no switchView override)');
