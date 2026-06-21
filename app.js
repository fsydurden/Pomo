// State
let timeLeft = 25 * 60;
let totalTime = 25 * 60;
let running = false;
let interval = null;
let mode = 'focus';

// Elements
const timerEl = document.getElementById('timer');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const ringProgress = document.querySelector('.timer-ring-progress');
const label = document.querySelector('.timer-text .label');
const circumference = 2 * Math.PI * 130;

ringProgress.style.strokeDasharray = circumference;

// Storage
function getSessions() {
    return JSON.parse(localStorage.getItem('pomodoro_sessions') || '[]');
}
function saveSessions(sessions) {
    localStorage.setItem('pomodoro_sessions', JSON.stringify(sessions));
}

// Timer
function updateDisplay() {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const progress = timeLeft / totalTime;
    ringProgress.style.strokeDashoffset = circumference * (1 - progress);
    document.title = `${timerEl.textContent} - Focus Timer`;
}

function start() {
    if (running) {
        running = false;
        clearInterval(interval);
        startBtn.textContent = 'Resume';
        return;
    }
    running = true;
    startBtn.textContent = 'Pause';
    interval = setInterval(() => {
        timeLeft--;
        updateDisplay();
        if (timeLeft <= 0) {
            clearInterval(interval);
            running = false;
            startBtn.textContent = 'Start';
            completeSession();
        }
    }, 1000);
}

function reset() {
    clearInterval(interval);
    running = false;
    startBtn.textContent = 'Start';
    const activeTab = document.querySelector('.mode-tab.active');
    totalTime = parseInt(activeTab.dataset.duration) * 60;
    timeLeft = totalTime;
    updateDisplay();
}

function completeSession() {
    const sessions = getSessions();
    sessions.push({
        type: mode,
        duration: totalTime / 60,
        timestamp: Date.now()
    });
    saveSessions(sessions);
    new Notification('Focus Timer', {
        body: mode === 'focus' ? '✅ Focus session complete! Take a break.' : '☕ Break over! Ready to focus?'
    });
    updateStats();
}

// Mode tabs
document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelector('.mode-tab.active').classList.remove('active');
        tab.classList.add('active');
        mode = tab.dataset.mode;
        label.textContent = mode === 'focus' ? 'focus session' : mode === 'short' ? 'short break' : 'long break';
        ringProgress.style.stroke = mode === 'focus' ? 'var(--accent)' : 'var(--success)';
        reset();
    });
});

startBtn.addEventListener('click', start);
resetBtn.addEventListener('click', reset);

// Statistics
function updateStats() {
    const sessions = getSessions();
    const focusSessions = sessions.filter(s => s.type === 'focus');
    const totalMin = focusSessions.reduce((a, s) => a + s.duration, 0);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;

    document.getElementById('totalTime').textContent = `${h}h ${m}m`;
    document.getElementById('totalSessions').textContent = `${focusSessions.length} sessions completed`;

    // Today
    const today = new Date().toDateString();
    const todayS = focusSessions.filter(s => new Date(s.timestamp).toDateString() === today);
    document.getElementById('todaySessions').textContent = todayS.length;
    document.getElementById('todayMinutes').textContent = todayS.reduce((a, s) => a + s.duration, 0);

    // Streaks
    const days = [...new Set(focusSessions.map(s => new Date(s.timestamp).toDateString()))];
    let streak = 0, bestStreak = 0, tempStreak = 0;
    const d = new Date(); d.setHours(0,0,0,0);
    while (days.includes(d.toDateString())) {
        streak++;
        d.setDate(d.getDate() - 1);
    }
    // Best streak
    const sorted = [...new Set(focusSessions.map(s => {
        const dt = new Date(s.timestamp); dt.setHours(0,0,0,0); return dt.getTime();
    }))].sort();
    tempStreak = 1;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i-1] === 86400000) { tempStreak++; bestStreak = Math.max(bestStreak, tempStreak); }
        else tempStreak = 1;
    }
    bestStreak = Math.max(bestStreak, tempStreak, streak);

    document.getElementById('streak').textContent = streak;
    document.getElementById('bestStreak').textContent = bestStreak;

    // Avg per day
    const uniqueDays = new Set(focusSessions.map(s => new Date(s.timestamp).toDateString())).size || 1;
    document.getElementById('avgDay').textContent = `${Math.round(totalMin / uniqueDays)}m`;

    // This week
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0,0,0,0);
    const weekMin = focusSessions.filter(s => s.timestamp >= weekStart.getTime()).reduce((a, s) => a + s.duration, 0);
    document.getElementById('weekTime').textContent = `${Math.round(weekMin / 60)}h`;

    // Streak bar (last 7 days)
    const streakBar = document.getElementById('streakBar');
    streakBar.innerHTML = '';
    for (let i = 6; i >= 0; i--) {
        const dd = new Date(); dd.setDate(dd.getDate() - i); dd.setHours(0,0,0,0);
        const hasSession = focusSessions.some(s => new Date(s.timestamp).toDateString() === dd.toDateString());
        const div = document.createElement('div');
        div.className = 'streak-day' + (hasSession ? ' active' : '') + (i === 0 ? ' today' : '');
        streakBar.appendChild(div);
    }

    // Hourly chart
    const hourlyChart = document.getElementById('hourlyChart');
    hourlyChart.innerHTML = '';
    const hours = Array(24).fill(0);
    focusSessions.forEach(s => { hours[new Date(s.timestamp).getHours()] += s.duration; });
    const maxH = Math.max(...hours, 1);
    hours.forEach((v, i) => {
        const bar = document.createElement('div');
        bar.className = 'hourly-bar' + (v === maxH && v > 0 ? ' peak' : '');
        bar.style.height = `${(v / maxH) * 100}%`;
        bar.title = `${i}:00 - ${v}min`;
        hourlyChart.appendChild(bar);
    });

    // Recent sessions
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    sessions.slice(-8).reverse().forEach(s => {
        const dt = new Date(s.timestamp);
        const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `<span class="tag ${s.type === 'focus' ? 'tag-focus' : 'tag-break'}">${s.type === 'focus' ? 'Focus' : 'Break'}</span><span class="hi-dur">${s.duration}min</span><span class="hi-time">${timeStr}</span>`;
        historyList.appendChild(div);
    });
}

// Init
updateDisplay();
updateStats();
if (Notification.permission === 'default') Notification.requestPermission();
