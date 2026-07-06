// ============================================================
// SESSION TRACKER – Auto‑links to today's schedule
// ============================================================

(function() {
    'use strict';

    // ----- DOM refs -----
    const taskSelector = document.getElementById('taskSelector');
    const scheduledInput = document.getElementById('trackerScheduled');
    const focusDisplay = document.getElementById('focusTimeDisplay');
    const breakDisplay = document.getElementById('breakTimeDisplay');
    const idleDisplay = document.getElementById('idleTimeDisplay');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const scheduledDisplay = document.getElementById('scheduledDisplay');
    const resetTrackerBtn = document.getElementById('resetTrackerBtn');
    const endSessionBtn = document.getElementById('endSessionBtn');
    const autoLabelBadge = document.getElementById('autoLabelBadge');
    const headerFocusTime = document.getElementById('headerFocusTime');
    const headerBreakTime = document.getElementById('headerBreakTime');
    const headerIdleTime = document.getElementById('headerIdleTime');

    // ----- State -----
    let focusSeconds = 0;
    let breakSeconds = 0;
    let idleSeconds = 0;
    let isBreak = false;
    let trackerInterval = null;
    let isRunning = false;
    let currentTaskId = null;
    let lastCheckedDate = new Date().toDateString();

    // Timestamp-based timing to prevent browser throttling issues
    let focusStartTime = null;
    let breakStartTime = null;
    let idleStartTime = null;
    let focusTimeAtStart = 0;
    let breakTimeAtStart = 0;
    let idleTimeAtStart = 0;

    // ----- Load accumulated time from localStorage -----
    function loadAccumulatedTime() {
        try {
            const saved = localStorage.getItem('accumulatedFocusTime');
            if (saved) {
                const data = JSON.parse(saved);
                const savedDate = new Date(data.timestamp).toDateString();
                const today = new Date().toDateString();

                // If it's a new day, reset the times
                if (savedDate !== today) {
                    focusSeconds = 0;
                    breakSeconds = 0;
                    idleSeconds = 0;
                    saveAccumulatedTime(); // Save the reset state
                } else {
                    // Same day, load the accumulated times
                    focusSeconds = data.focusSeconds || 0;
                    breakSeconds = data.breakSeconds || 0;
                    idleSeconds = data.idleSeconds || 0;
                }
            }
        } catch (e) {
            console.warn('Could not load accumulated time:', e);
        }
    }

    // ----- Save accumulated time to localStorage -----
    function saveAccumulatedTime() {
        try {
            const data = {
                focusSeconds: focusSeconds,
                breakSeconds: breakSeconds,
                idleSeconds: idleSeconds,
                timestamp: Date.now()
            };
            localStorage.setItem('accumulatedFocusTime', JSON.stringify(data));
        } catch (e) {
            console.warn('Could not save accumulated time:', e);
        }
    }

    // ----- Helpers -----
    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function formatTimeDetailed(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) {
            return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
        }
        return `${m}m ${String(s).padStart(2, '0')}s`;
    }

    function getTodayName() {
        return new Date().toLocaleDateString('en-US', { weekday: 'long' });
    }

    function getCurrentHHMM() {
        const now = new Date();
        return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }

    function timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    // ----- Get today's tasks from the global `events` array -----
    function getTodayTasks() {
        const today = getTodayName();
        if (typeof events === 'undefined' || !Array.isArray(events)) return [];
        return events
            .filter(e => e.day === today)
            .sort((a, b) => a.start.localeCompare(b.start));
    }

    // ----- Populate the task dropdown -----
    function populateTaskDropdown() {
        const tasks = getTodayTasks();
        taskSelector.innerHTML = '<option value="">— Select a task —</option>';

        if (tasks.length === 0) {
            taskSelector.innerHTML += '<option value="" disabled>No tasks scheduled for today</option>';
            autoLabelBadge.textContent = '📭 No tasks';
            autoLabelBadge.style.color = '#888';
            return;
        }

        const nowHHMM = getCurrentHHMM();
        const nowMinutes = timeToMinutes(nowHHMM);
        let autoSelectId = null;
        let autoSelectIndex = 0;

        tasks.forEach((task, index) => {
            const startM = timeToMinutes(task.start);
            const endM = timeToMinutes(task.end);
            const isActive = (nowMinutes >= startM && nowMinutes < endM);
            const isUpcoming = (nowMinutes < startM);
            const label = `${task.title} (${task.start}–${task.end})${isActive ? ' 🔴' : ''}${isUpcoming ? ' ⏳' : ''}`;
            const opt = document.createElement('option');
            opt.value = task.id || 'task-' + index;
            opt.textContent = label;
            opt.dataset.start = task.start;
            opt.dataset.end = task.end;
            opt.dataset.title = task.title;
            opt.dataset.duration = endM - startM;
            taskSelector.appendChild(opt);

            // Auto‑select the active task, or the first upcoming, or the first task
            if (isActive && autoSelectId === null) {
                autoSelectId = opt.value;
                autoSelectIndex = index;
            } else if (isUpcoming && autoSelectId === null) {
                autoSelectId = opt.value;
                autoSelectIndex = index;
            }
        });

        // If no task is active/upcoming, pick the first one
        if (autoSelectId === null && tasks.length > 0) {
            autoSelectId = taskSelector.options[1]?.value || null;
            autoSelectIndex = 0;
        }

        if (autoSelectId) {
            taskSelector.value = autoSelectId;
            // Also sync the scheduled time
            const selectedOpt = taskSelector.querySelector(`option[value="${autoSelectId}"]`);
            if (selectedOpt) {
                const dur = parseInt(selectedOpt.dataset.duration);
                if (dur > 0) scheduledInput.value = dur;
                autoLabelBadge.textContent = '✅ Auto‑linked';
                autoLabelBadge.style.color = '#2ecc71';
            }
        } else {
            autoLabelBadge.textContent = 'No matching task';
            autoLabelBadge.style.color = '#888';
        }
    }

    // ----- Update UI -----
    function updateUI() {
        focusDisplay.textContent = formatTime(focusSeconds);
        breakDisplay.textContent = formatTime(breakSeconds);
        if (idleDisplay) idleDisplay.textContent = formatTime(idleSeconds);

        const scheduled = parseInt(scheduledInput.value) || 120;
        const scheduledSecs = scheduled * 60;
        const total = focusSeconds + breakSeconds;
        const pct = scheduledSecs > 0 ? Math.min((total / scheduledSecs) * 100, 100) : 0;
        progressFill.style.width = pct + '%';
        progressPercent.textContent = Math.round(pct) + '%';
        scheduledDisplay.textContent = scheduled;

        // Update header stats
        if (headerFocusTime) headerFocusTime.textContent = formatTime(focusSeconds);
        if (headerBreakTime) headerBreakTime.textContent = formatTime(breakSeconds);
        if (headerIdleTime) headerIdleTime.textContent = formatTime(idleSeconds);

        // Update session tracker visual state
        updateSessionTrackerState();
    }

    // ----- Update session tracker visual state -----
    function updateSessionTrackerState() {
        const tracker = document.getElementById('sessionTracker');
        if (!tracker) return;

        // Remove existing state classes
        tracker.classList.remove('focus-mode-active', 'break-mode-active');

        // Add appropriate class based on current state
        if (isRunning && !isBreak) {
            tracker.classList.add('focus-mode-active');
        } else if (isRunning && isBreak) {
            tracker.classList.add('break-mode-active');
        }
    }

    // ----- Check for day change and reset if needed -----
    function checkDayChange() {
        const currentDate = new Date().toDateString();
        if (currentDate !== lastCheckedDate) {
            // New day detected, reset the timers
            lastCheckedDate = currentDate;
            focusSeconds = 0;
            breakSeconds = 0;
            idleSeconds = 0;
            isBreak = false;
            isRunning = false;
            stopAccumulation();
            saveAccumulatedTime();
            updateUI();
            console.log('🕛 Daily reset at midnight - timers cleared');
        }
    }

    // ----- Auto-advance to next task when current task expires -----
    function autoAdvanceTask() {
        if (!taskSelector || taskSelector.options.length <= 1) return;

        const nowHHMM = getCurrentHHMM();
        const nowMinutes = timeToMinutes(nowHHMM);
        const currentIndex = taskSelector.selectedIndex;

        // Find the current selected option
        const currentOpt = taskSelector.options[currentIndex];
        if (!currentOpt || !currentOpt.dataset.end) return;

        const currentEndMinutes = timeToMinutes(currentOpt.dataset.end);

        // If current time has passed the current task's end time
        if (nowMinutes >= currentEndMinutes) {
            // Look for the next task
            let nextIndex = currentIndex + 1;

            // Skip disabled options and find the next valid task
            while (nextIndex < taskSelector.options.length) {
                const nextOpt = taskSelector.options[nextIndex];
                if (nextOpt.value && !nextOpt.disabled) {
                    // Select the next task
                    taskSelector.selectedIndex = nextIndex;

                    // Trigger the change event to update scheduled time
                    const event = new Event('change');
                    taskSelector.dispatchEvent(event);

                    console.log('⏭ Auto-advanced to next task:', nextOpt.textContent);
                    break;
                }
                nextIndex++;
            }
        }
    }

    // ----- Start periodic day change check -----
    function startDayChangeMonitor() {
        // Check immediately on load
        checkDayChange();

        // Then check every minute
        if (!window.dayCheckInterval) {
            window.dayCheckInterval = setInterval(checkDayChange, 60000); // Check every minute
        }

        // Also check for task auto-advance every minute
        if (!window.taskAdvanceInterval) {
            window.taskAdvanceInterval = setInterval(autoAdvanceTask, 60000); // Check every minute
        }
    }

    // ----- Accumulation -----
    function startAccumulation() {
        if (trackerInterval) return;

        // Initialize timestamps
        if (isRunning && !isBreak && !focusStartTime) {
            // Starting focus mode - stop idle tracking
            if (idleStartTime) {
                const idleElapsed = Math.floor((Date.now() - idleStartTime) / 1000);
                idleSeconds = idleTimeAtStart + idleElapsed;
                idleStartTime = null;
            }
            focusStartTime = Date.now();
            focusTimeAtStart = focusSeconds;
        } else if (isRunning && isBreak && !breakStartTime) {
            // Starting break mode - stop idle tracking
            if (idleStartTime) {
                const idleElapsed = Math.floor((Date.now() - idleStartTime) / 1000);
                idleSeconds = idleTimeAtStart + idleElapsed;
                idleStartTime = null;
            }
            breakStartTime = Date.now();
            breakTimeAtStart = breakSeconds;
        } else if (!isRunning && !idleStartTime) {
            // Timer is stopped - start tracking idle time
            idleStartTime = Date.now();
            idleTimeAtStart = idleSeconds;
        }

        trackerInterval = setInterval(function() {
            // Use timestamp-based calculation to prevent throttling issues
            if (isRunning && !isBreak && focusStartTime) {
                const elapsed = Math.floor((Date.now() - focusStartTime) / 1000);
                focusSeconds = focusTimeAtStart + elapsed;
            } else if (isRunning && isBreak && breakStartTime) {
                const elapsed = Math.floor((Date.now() - breakStartTime) / 1000);
                breakSeconds = breakTimeAtStart + elapsed;
            } else if (!isRunning && idleStartTime) {
                const elapsed = Math.floor((Date.now() - idleStartTime) / 1000);
                idleSeconds = idleTimeAtStart + elapsed;
            }
            updateUI();
        }, 100);

        // Save accumulated time every 5 seconds
        if (!window.saveInterval) {
            window.saveInterval = setInterval(saveAccumulatedTime, 5000);
        }

        // Also start a check for day change every minute
        if (!window.dayCheckInterval) {
            window.dayCheckInterval = setInterval(checkDayChange, 60000); // Check every minute
        }
    }

    function stopAccumulation() {
        if (trackerInterval) {
            clearInterval(trackerInterval);
            trackerInterval = null;
        }
    }

    // ----- Reset -----
    function resetTracker() {
        stopAccumulation();
        isBreak = false;
        isRunning = false;
        focusStartTime = null;
        breakStartTime = null;
        idleStartTime = null;
        focusTimeAtStart = 0;
        breakTimeAtStart = 0;
        idleTimeAtStart = 0;
        // Note: We do NOT reset focusSeconds, breakSeconds, and idleSeconds here
        // They keep accumulating throughout the day
        updateUI();
    }

    // ----- End Session -----
    function endSession() {
        const selectedOpt = taskSelector.options[taskSelector.selectedIndex];
        const label = selectedOpt?.dataset?.title || taskSelector.value || 'Untitled';
        const scheduled = parseInt(scheduledInput.value) || 0;
        const focusMins = Math.floor(focusSeconds / 60);
        const focusSecs = focusSeconds % 60;
        const breakMins = Math.floor(breakSeconds / 60);
        const breakSecs = breakSeconds % 60;
        const idleMins = Math.floor(idleSeconds / 60);
        const idleSecs = idleSeconds % 60;
        const scheduledSecs = scheduled * 60;
        const totalSecs = focusSeconds + breakSeconds + idleSeconds;
        const efficiency = scheduledSecs > 0 ? Math.round((focusSeconds / scheduledSecs) * 100) : 0;
        const focusPercentage = totalSecs > 0 ? Math.round((focusSeconds / totalSecs) * 100) : 0;

        const summary = `📊 SESSION COMPLETE: ${label}\n` +
                        `📅 Scheduled: ${scheduled} min\n` +
                        `⏱ Focus: ${focusMins}m ${focusSecs}s (${focusPercentage}%)\n` +
                        `☕ Break: ${breakMins}m ${breakSecs}s\n` +
                        `⏸ Idle: ${idleMins}m ${idleSecs}s\n` +
                        `🎯 Efficiency: ${efficiency}%`;

        alert(summary);

        const history = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
        history.push({
            label,
            scheduled,
            focusSeconds,
            breakSeconds,
            idleSeconds,
            efficiency,
            timestamp: Date.now()
        });
        localStorage.setItem('sessionHistory', JSON.stringify(history));

        resetTracker();
    }

    // ----- Hook into simple timer buttons -----
    function initTracker() {
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');

        if (startBtn) {
            startBtn.addEventListener('click', function() {
                if (isRunning && isBreak) {
                    // Switching from break to focus
                    isBreak = false;
                    breakStartTime = null;
                    focusStartTime = Date.now();
                    focusTimeAtStart = focusSeconds;
                } else if (!isRunning) {
                    // Starting fresh
                    isRunning = true;
                    isBreak = false;
                    focusStartTime = Date.now();
                    focusTimeAtStart = focusSeconds;
                    startAccumulation();
                }
            });
        }

        if (pauseBtn) {
            pauseBtn.addEventListener('click', function() {
                if (isRunning && !isBreak) {
                    // Switching from focus to break
                    isBreak = true;
                    focusStartTime = null;
                    breakStartTime = Date.now();
                    breakTimeAtStart = breakSeconds;
                }
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', resetTracker);
        }

        if (resetTrackerBtn) {
            resetTrackerBtn.addEventListener('click', resetTracker);
        }

        if (endSessionBtn) {
            endSessionBtn.addEventListener('click', endSession);
        }

        if (scheduledInput) {
            scheduledInput.addEventListener('input', updateUI);
        }

        // When task selector changes, update scheduled time
        taskSelector.addEventListener('change', function() {
            const opt = this.options[this.selectedIndex];
            if (opt && opt.dataset.duration) {
                const dur = parseInt(opt.dataset.duration);
                if (dur > 0) scheduledInput.value = dur;
                autoLabelBadge.textContent = '✅ Linked to task';
                autoLabelBadge.style.color = '#2ecc71';
            }
            updateUI();
        });

        // Load accumulated time from localStorage
        loadAccumulatedTime();

        // Start monitoring for day changes
        startDayChangeMonitor();

        // Initial population and UI
        populateTaskDropdown();
        updateUI();

        // Also refresh when switching to timer view
        document.addEventListener('viewChanged', function(e) {
            if (e.detail.viewId === 'timer-view') {
                populateTaskDropdown();
                updateUI();
            }
        });

        // Listen for schedule changes (e.g., after adding a task)
        // We'll just re-populate periodically or on demand
        // You can also expose a manual refresh function

        console.log('✅ Session Tracker (linked to schedule) initialized');
    }

    // Run when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracker);
    } else {
        initTracker();
    }
})();
