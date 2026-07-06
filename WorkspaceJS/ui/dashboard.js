const DEFAULT_DASH_TODOS = [
    { id: "todo_1", text: "Open today's lesson page", done: false },
    { id: "todo_2", text: "Add one study block", done: false },
    { id: "todo_3", text: "Check off completed tasks", done: false }
];
let dashTodos = JSON.parse(localStorage.getItem("dashTodos") || "null") || DEFAULT_DASH_TODOS;

function saveDashTodos() { localStorage.setItem("dashTodos", JSON.stringify(dashTodos)); }

function renderDashTodos() {
    document.querySelectorAll("#dashStrikeList, #todoStrikeList").forEach(container => {
        if (!container) return;
        container.innerHTML = dashTodos.map(todo => `
            <li>
                <label class="strike-item">
                    <input type="checkbox" data-todo-id="${todo.id}" ${todo.done ? "checked" : ""} onchange="toggleDashTodo('${todo.id}')">
                    <span class="checkmark"></span>
                    <span class="task-text">${escapeHtml(todo.text)}</span>
                </label>
            </li>
        `).join("");
    });
}

function toggleDashTodo(id) {
    dashTodos = dashTodos.map(t => t.id === id ? { ...t, done: !t.done } : t);
    saveDashTodos();
    updateDashProgress();
}

function addDashTodo() {
    const text = prompt("New dashboard task:");
    if (!text?.trim()) return;
    dashTodos.push({ id: `todo_${Date.now()}`, text: text.trim(), done: false });
    saveDashTodos();
    renderDashTodos();
    updateDashProgress();
}

function updateDashProgress(saveFromDom = true) {
    if (saveFromDom) {
        document.querySelectorAll("input[type='checkbox'][data-todo-id]").forEach(box => {
            const id = box.dataset.todoId;
            const todo = dashTodos.find(t => t.id === id);
            if (todo) todo.done = box.checked;
        });
        saveDashTodos();
    }
    const todayEvents = (events || []).filter(e => e.day === getTimeMetrics().todayName);
    const done = dashTodos.filter(t => t.done).length;
    const total = dashTodos.length;
    let pct = 0, label = `${done} / ${total}`;
    if (todayEvents.length > 0) {
        const sd = todayEvents.filter(e => e.completed).length;
        pct = Math.round((sd / todayEvents.length) * 100);
        label = `${sd} / ${todayEvents.length} today`;
    } else if (total > 0) {
        pct = Math.round((done / total) * 100);
    }
    const fill = document.getElementById("dashProgressBar");
    const pctLabel = document.getElementById("dashProgressPercent");
    const stat = document.getElementById("statTasksDone");
    const count = document.getElementById("todoCount");
    const doneCount = document.getElementById("todoDoneCount");
    const pctEl = document.getElementById("todoPercent");
    if (fill) fill.style.width = `${pct}%`;
    if (pctLabel) pctLabel.textContent = `${pct}%`;
    if (stat) stat.textContent = label;
    if (count) count.textContent = String(total);
    if (doneCount) doneCount.textContent = String(done);
    if (pctEl) pctEl.textContent = `${pct}%`;

    // Update streak display whenever progress is recalculated
    if (typeof updateStreakDisplay === 'function') {
        setTimeout(updateStreakDisplay, 50);
    }
}

function updateDashboardLiveSession() {
    const { current, next, todayEvents } = getSessionSnapshot();
    const st = document.getElementById("dashSessionTime");
    const title = document.getElementById("dashSessionTitle");
    const tag = document.getElementById("dashSessionTag");
    const nextEl = document.getElementById("dashNextSession");
    // Show linked lesson button if current event has a linkedPageId
    const lessonLinkContainer = document.getElementById("dashLessonLink");
    if (current && current.linkedPageId && hubState?.pages?.[current.linkedPageId]) {
        const linkedPage = hubState.pages[current.linkedPageId];
        if (lessonLinkContainer) {
            lessonLinkContainer.innerHTML = `<button class="timeline-btn lesson-link" onclick="openLinkedLesson('${current.linkedPageId}')" title="Open linked lesson: ${linkedPage.title}" style="margin-top:6px;">📄 ${linkedPage.title}</button>`;
            lessonLinkContainer.style.display = 'block';
        }
    } else if (lessonLinkContainer) {
        lessonLinkContainer.style.display = 'none';
    }
    if (current) {
        if (st) st.textContent = `${current.start} – ${current.end}`;
        if (title) title.textContent = current.title;
        if (tag) { tag.textContent = (current.category || "study").toUpperCase(); tag.className = `session-tag badge-${current.category || "study"}`; }
    } else if (todayEvents.length === 0) {
        if (st) st.textContent = "Today";
        if (title) title.textContent = "No tasks scheduled yet";
        if (tag) { tag.textContent = "Add a block"; tag.className = "session-tag"; }
    } else if (next) {
        if (st) st.textContent = "Now";
        if (title) title.textContent = "Between sessions";
        if (tag) { tag.textContent = "Free time"; tag.className = "session-tag"; }
    } else {
        if (st) st.textContent = "Done";
        if (title) title.textContent = "All tasks complete for today";
        if (tag) { tag.textContent = "Great work"; tag.className = "session-tag"; }
    }
    if (nextEl) {
        if (next) nextEl.textContent = `${next.start} — ${next.title}`;
        else if (current) nextEl.textContent = "Nothing else queued after this block";
        else if (todayEvents.length === 0) nextEl.textContent = "Open Weekly Schedule to plan your day";
        else nextEl.textContent = "Enjoy the rest of your day";
    }
    updateQuickJumpLinks();
    if (typeof updateFocusTimerTaskLink === 'function') {
        updateFocusTimerTaskLink();
    }
    updateDashboardStats();
    updateDashProgress(false);
    if (typeof updateDailyStats === 'function') {
        updateDailyStats();
    }
}

function updateQuickJumpLinks() {
    const recentLessons = document.getElementById("dashRecentLessons");
    const recentLibs = document.getElementById("dashRecentLibs");
    // SAFETY: hubState may not be defined yet
    const activePage = (typeof hubState !== 'undefined' && hubState?.pages)
        ? hubState.pages[hubState.activePageId]
        : null;
    if (recentLessons && activePage) recentLessons.innerHTML = `<span style="color:#e2e8f0;">📄 ${escapeHtml(activePage.title)}</span>`;
    else if (recentLessons) recentLessons.innerHTML = `<span style="color:#475569;">No open lesson</span>`;
    if (recentLibs && libraryItems.length > 0) {
        const recent = libraryItems.slice(-3).reverse();
        recentLibs.innerHTML = recent.map(item => `<a href="${escapeHtml(item.url)}" target="_blank" style="color:#38bdf8;display:block;padding:2px 0;">🔗 ${escapeHtml(item.title)}</a>`).join('');
    } else if (recentLibs) {
        recentLibs.innerHTML = `<span style="color:#475569;">No bookmarks yet</span>`;
    }
}

function updateDashboardStats() {
    const folderStat = document.getElementById("statLessonFolders");
    const todayStat = document.getElementById("statTodayTasks");
    const libStat = document.getElementById("statLibraryItems");
    const todayEvents = (events || []).filter(e => e.day === getTimeMetrics().todayName);
    if (folderStat && typeof hubState !== 'undefined') folderStat.textContent = String(hubState.folders.length);
    if (todayStat) todayStat.textContent = String(todayEvents.length);
    if (libStat) libStat.textContent = String(libraryItems.length);
}

function updateDailyStats() {
    const el = document.getElementById('daily-stats');
    if (!el) return;

    const todayEvents = (events || []).filter(e => e.day === getTimeMetrics().todayName);
    const safeEvents = Array.isArray(todayEvents) ? todayEvents : [];
    const total = safeEvents.length;
    const done = safeEvents.filter(e => e && e.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    el.style.display = 'inline-flex';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    el.style.minWidth = '180px';
    el.style.textAlign = 'center';

    if (total === 0) {
        el.textContent = 'No tasks scheduled for today';
    } else {
        el.textContent = `⭐ ${pct}% complete · ${done}/${total} today`;
    }
}

function initDashboardEngine() {
    const dateDisplay = document.getElementById("dashGreetingDate");
    if (dateDisplay) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const systemDate = new Date().toLocaleDateString('en-US', options);
        const greeting = (() => { const h = new Date().getHours(); if (h < 12) return "Good morning"; if (h < 17) return "Good afternoon"; if (h < 21) return "Good evening"; return "Good night"; })();
        dateDisplay.textContent = `${greeting}! Today is ${systemDate}.`;
    }
    renderDashTodos();
    // initTimerAI() is called in focus-timer.js DOMContentLoaded - removed duplicate
    updateDashboardLiveSession();
    renderAnalytics();
    updateSidebarProgress();
    updateDailyStats();
    if (typeof initWeather === 'function') initWeather();
}

// ============================================================
// STREAK TRACKER
// ============================================================

function calculateStreak() {
    let streak = 0;
    let d = new Date();
    // Remove time part
    d.setHours(0, 0, 0, 0);

    // Check up to 365 days back (safety limit)
    for (let i = 0; i < 365; i++) {
        const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
        const dayEvents = events.filter(e => e.day === dayName);
        const hasCompleted = dayEvents.some(e => e.completed === true);

        if (hasCompleted) {
            streak++;
        } else {
            // If today is the first day, and no tasks completed yet, streak is 0
            // But if it's today and we're checking, we break only if it's not today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (d.getTime() === today.getTime()) {
                // Today hasn't started or no tasks done yet, streak stays
                // But we break after today
                break;
            }
            // Otherwise, streak ends
            break;
        }
        // Move to previous day
        d.setDate(d.getDate() - 1);
    }

    return streak;
}

function getStreakEmoji(streak) {
    if (streak === 0) return '💤';
    if (streak < 3) return '🌱';
    if (streak < 7) return '🔥';
    if (streak < 14) return '🔥🔥';
    if (streak < 30) return '🔥🔥🔥';
    if (streak < 60) return '⚡⚡⚡';
    return '🏆🔥⚡';
}

function getStreakColor(streak) {
    if (streak === 0) return 'var(--text-muted)';
    if (streak < 3) return '#fbbf24';
    if (streak < 7) return '#fb923c';
    if (streak < 14) return '#f97316';
    if (streak < 30) return '#ef4444';
    return '#a855f7';
}

// ---- Update dashboard with streak ----
function updateStreakDisplay() {
    const streak = calculateStreak();
    const container = document.getElementById('streakDisplay');
    if (!container) return;

    const emoji = getStreakEmoji(streak);
    const color = getStreakColor(streak);
    const label = streak === 0 ? 'No streak yet' : `${streak}-day streak`;

    container.innerHTML = `
        <div class="streak-badge" style="color:${color};">
            <span class="streak-emoji">${emoji}</span>
            <span class="streak-label">${label}</span>
        </div>
    `;

    // Also update the stats card if it exists
    const statStreak = document.getElementById('statStreak');
    if (statStreak) {
        statStreak.textContent = streak;
    }
}

// ============================================================
// SIDEBAR PROGRESS RING
// ============================================================

function updateSidebarProgress() {
    const ring = document.getElementById('sidebarProgressRing');
    const text = document.getElementById('sidebarProgressText');
    if (!ring || !text) return;

    const today = getTodayName();
    const dayEvents = events.filter(e => e.day === today);
    const total = dayEvents.length;
    const done = dayEvents.filter(e => e.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    const circumference = 125.6; // 2 * PI * 20
    const offset = circumference - (pct / 100) * circumference;
    ring.style.strokeDashoffset = offset;
    text.textContent = `${pct}%`;

    // Color change based on progress
    if (pct === 0) ring.style.stroke = 'var(--text-muted)';
    else if (pct < 30) ring.style.stroke = '#f87171';
    else if (pct < 60) ring.style.stroke = '#fbbf24';
    else if (pct < 100) ring.style.stroke = '#34d399';
    else ring.style.stroke = '#a855f7';
}
