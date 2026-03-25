/* ============================================================
   AIG Facility Management System — Room Page Script
   ============================================================ */

const STORE = 'aig_bms_v4';
const NOTIF_STORE = 'bms_notifs';
const DISMISSED_STORE = 'bms_notifs_dismissed';

const params = new URLSearchParams(location.search);
const ROOM_ID = params.get('id');
const root = document.getElementById('root');

/* ── STORAGE HELPERS ── */
function load() { return JSON.parse(localStorage.getItem(STORE) || '{}'); }
function save(d) { localStorage.setItem(STORE, JSON.stringify(d)); }
function loadNotifs() { return JSON.parse(localStorage.getItem(NOTIF_STORE) || '[]'); }
function saveNotifs(a) { localStorage.setItem(NOTIF_STORE, JSON.stringify(a)); }
function loadDismissed() { return JSON.parse(localStorage.getItem(DISMISSED_STORE) || '[]'); }

function pushRoomNotification(msg, icon = '✅', key = '') {
    if (!msg) return;
    if (key && loadDismissed().includes(key)) return;
    const notifs = loadNotifs();
    if (key && notifs.some(n => n.key === key)) return;
    notifs.unshift({
        msg, icon, key: key || '',
        time: new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
    });
    saveNotifs(notifs);
    if (window.FMSUI && typeof window.FMSUI.refreshHeader === 'function') window.FMSUI.refreshHeader();
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escA(s) { return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

/* ── ROOM CONTEXT ── */
function getRoomCtx() {
    const d = load();
    for (const [fk, f] of Object.entries(d)) {
        if (!f.rooms) continue;
        const idx = f.rooms.findIndex(r => r.id === ROOM_ID);
        if (idx !== -1) return { d, fk, idx, room: f.rooms[idx] };
    }
    return null;
}

/* ── SAVE HELPERS ── */
function flashAutoSave() {
    const btn = document.getElementById('saveBtn');
    if (!btn) return;
    btn.classList.add('saving');
    btn.textContent = '✓ Saved';
    setTimeout(() => { btn.classList.remove('saving'); btn.innerHTML = '💾 Save'; }, 900);
}

function saveRoomData() { const x = getRoomCtx(); if (!x) return; flashAutoSave(); }

function saveRoom(room) {
    const x = getRoomCtx(); if (!x) return;
    x.d[x.fk].rooms[x.idx] = room;
    save(x.d);
    flashAutoSave();
}

/* ── FORMAT DATE ── */
function fmtDate(ts) {
    if (!ts) return null;
    const d = new Date(ts);
    return {
        date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
}

/* ── AUTO SWITCH STATE ── */
function getAutoSwitchState(room) {
    if (!room.autoSwitch || !room.autoPhases || !room.durationStart) return null;
    const phases = room.autoPhases;
    const totalCycle = phases.reduce((s, p) => s + p.duration, 0);
    const elapsed = Math.floor((Date.now() - room.durationStart) / 60000);
    const posInCycle = elapsed % totalCycle;
    let sum = 0;
    for (let i = 0; i < phases.length; i++) {
        sum += phases[i].duration;
        if (posInCycle < sum) return { phase: i + 1, ...phases[i] };
    }
    return { phase: 1, ...phases[0] };
}

/* ── FLOOR LABEL MAP ── */
const META = {
    ground: 'Ground Floor', 1: 'First Floor', 2: 'Second Floor',
    3: 'Third Floor', 4: 'Fourth Floor',
    aivsid: 'Aivsid', buolching: 'Buolching', pump: 'Pump'
};

/* ── BUILD PAGE ── */
function buildPage() {
    const x = getRoomCtx();
    if (!x) {
        root.innerHTML = `
      <div class="not-found">
        <div class="nf-code">404</div>
        <div class="nf-title">Room Not Found</div>
        <div class="nf-sub">NO ROOM WITH THIS ID EXISTS</div>
        <a href="index.html" class="nf-link">← Return Home</a>
      </div>`;
        return;
    }

    const { fk, room } = x;
    const roomUrl = room.qrUrl || location.href;
    document.title = `${room.name} — AIG`;
    const floorLabel = META[fk] || `Floor ${fk}`;

    /* Auto switch badge */
    const autoState = getAutoSwitchState(room);
    let autoBadgeHtml;
    if (autoState) {
        const t = autoState.type;
        const phases = room.autoPhases;
        const totalCycle = phases.reduce((s, p) => s + p.duration, 0);
        const elapsed = Math.floor((Date.now() - room.durationStart) / 60000);
        const posInCycle = elapsed % totalCycle;
        let sum = 0;
        for (let i = 0; i < phases.length; i++) { sum += phases[i].duration; if (posInCycle < sum) break; }
        const remMin = Math.max(0, sum - posInCycle);
        const remDisplay = remMin < 60 ? remMin + ' min' : remMin < 1440 ? Math.ceil(remMin / 60) + ' hrs' : Math.ceil(remMin / 1440) + ' days';
        autoBadgeHtml = `<div class="ds-auto-badge ${t}">${t === 'inspection' ? '🔍 Inspection' : '🧪 Test'}</div><div class="ds-auto-badge time-left">⏱ ${remDisplay} left</div>`;
    } else {
        autoBadgeHtml = `<div class="ds-auto-badge null-state">⚡ AUTO </div>`;
    }

    /* Stats */
    const tasks = room.tasks || [];
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const r = 42, c = 2 * Math.PI * r;
    const dash = Math.round(c * pct / 100);
    const ringColor = pct === 100 ? '#72c28b' : pct > 50 ? '#79d4cf' : '#f0cd75';

    root.innerHTML = `
    <div class="topnav">
      <a href="floor.html?floor=${fk}" class="back-btn">← ${floorLabel}</a>
      <a href="index.html" class="back-btn">〈 Home</a>
    </div>

    <div class="display-screen">
      <div class="ds-left">
        <div class="ds-live-row" style="display:none"></div>
        <div class="ds-room-name">${esc(room.name)}</div>
        <div class="ds-info-badges">
          ${autoBadgeHtml}
          <button class="ds-toggle-btn mode-btn" id="modToggleBtn" onclick="cycleMode()">Normal</button>
        </div>
        <div class="ds-stats-row">
          <div class="ds-stat-box"><div class="ds-stat-val" id="dsTotal">${total}</div><div class="ds-stat-lbl">Total</div></div>
          <div class="ds-stat-box"><div class="ds-stat-val" id="dsDone">${done}</div><div class="ds-stat-lbl">Done</div></div>
          <div class="ds-stat-box"><div class="ds-stat-val" id="dsPend">${total - done}</div><div class="ds-stat-lbl">Pending</div></div>
          <div class="ds-stat-box"><div class="ds-stat-val" id="dsPct">${pct}%</div><div class="ds-stat-lbl">Rate</div></div>
        </div>
        <div class="ds-bar-wrap"><div class="ds-bar-fill" id="dsBar" style="width:${pct}%"></div></div>
      </div>

      <div class="ds-center">
        <div class="ds-pct-ring">
          <svg viewBox="0 0 108 108">
            <circle cx="54" cy="54" r="${r}" fill="none" stroke="rgba(201,168,112,0.12)" stroke-width="8"></circle>
            <circle cx="54" cy="54" r="${r}" fill="none" stroke="${ringColor}" stroke-width="8"
              stroke-dasharray="${dash} ${c}" stroke-linecap="round"
              style="filter:drop-shadow(0 0 6px ${ringColor})"></circle>
          </svg>
          <div class="ds-pct-text" id="dsRingPct">${pct}%</div>
        </div>
        <div class="ds-pct-lbl">Completion</div>
      </div>

      <div class="ds-right">
        <div class="ds-qr-lbl">Room QR</div>
        <div class="ds-qr-inner" id="qrCode"></div>
        <div class="ds-floor-pill">${floorLabel.toUpperCase()}</div>
      </div>
      <div class="aig-brand">AIG</div>
    </div>

    <div class="table-section">
      <div class="table-header">
        <div class="th-left">
          <div class="th-title">Task Table</div>
          <div class="row-badge" id="rowBadge">${total} rows</div>
        </div>
        <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
          <button class="btn-save-room" onclick="saveRoomData()" id="saveBtn">💾 Save</button>
          <button class="btn-name-tbl" id="nameBtn1" onclick="cycleName(1)">Name</button>
          <button class="btn-name-tbl" id="nameBtn2" onclick="cycleName(2)">Name</button>
          <button class="btn-add-row"  onclick="addRow()">+ Add Row</button>
        </div>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Task Description</th>
              <th>Status</th>
              <th>Completion Time</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="taskBody"></tbody>
        </table>
      </div>
    </div>`;

    try {
        new QRCode(document.getElementById('qrCode'), {
            text: roomUrl, width: 155, height: 155,
            colorDark: '#101827', colorLight: '#f8f4ed',
            correctLevel: QRCode.CorrectLevel.M
        });
    } catch (e) { /* QR library not loaded or blocked */ }

    renderTable();
}

/* ── UPDATE DISPLAY STATS (without full rebuild) ── */
function updateDisplayScreen() {
    const x = getRoomCtx(); if (!x) return;
    const tasks = x.room.tasks || [];
    const total = tasks.length, done = tasks.filter(t => t.status === 'done').length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const r = 42, c = 2 * Math.PI * r, dash = Math.round(c * pct / 100);
    const g = id => document.getElementById(id);
    if (g('dsTotal')) g('dsTotal').textContent = total;
    if (g('dsDone')) g('dsDone').textContent = done;
    if (g('dsPend')) g('dsPend').textContent = total - done;
    if (g('dsPct')) g('dsPct').textContent = pct + '%';
    if (g('dsBar')) g('dsBar').style.width = pct + '%';
    if (g('dsRingPct')) g('dsRingPct').textContent = pct + '%';
    if (g('rowBadge')) g('rowBadge').textContent = total + ' rows';
    const circles = document.querySelectorAll('.display-screen circle');
    if (circles[1]) {
        const color = pct === 100 ? '#72c28b' : pct > 50 ? '#79d4cf' : '#f0cd75';
        circles[1].setAttribute('stroke-dasharray', `${dash} ${c}`);
        circles[1].setAttribute('stroke', color);
        circles[1].style.filter = `drop-shadow(0 0 6px ${color})`;
    }
}

/* ── RENDER TABLE ── */
function renderTable() {
    const x = getRoomCtx(); if (!x) return;
    const room = x.room;
    const tbody = document.getElementById('taskBody');
    const badge = document.getElementById('rowBadge');
    if (!tbody) return;
    tbody.innerHTML = '';
    (room.tasks || []).forEach((task, i) => {
        const isDone = task.status === 'done';
        const ft = fmtDate(task.completedAt);
        const timeHtml = isDone && ft
            ? `<div class="time-stamp"><div class="ts-date">🗓 ${ft.date}</div><div class="ts-time">◔ ${ft.time}</div></div>`
            : `<span class="ts-empty">— pending</span>`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td><div class="row-n">${i + 1}</div></td>
      <td><input type="text" placeholder="Describe task…" value="${escA(task.desc || '')}" onchange="updateField('${task.id}','desc',this.value)"></td>
      <td><button class="status-btn ${isDone ? 'complete' : 'incomplete'}" onclick="toggleStatus('${task.id}')">${isDone ? '✅ 🥳 Done ' : '❌ 😣 Pending '}</button></td>
      <td class="td-time">${timeHtml}</td>
      <td><input type="text" placeholder="Notes…" value="${escA(task.notes || '')}" onchange="updateField('${task.id}','notes',this.value)"></td>
      <td><button class="del-btn" onclick="deleteRow('${task.id}')">×</button></td>`;
        tbody.appendChild(tr);
    });
    if (badge) badge.textContent = (room.tasks || []).length + ' rows';
}

/* ── ROW ACTIONS ── */
function addRow() {
    const x = getRoomCtx(); if (!x) return;
    if (!x.room.tasks) x.room.tasks = [];
    x.room.tasks.push({ id: genId(), desc: '', name: '', notes: '', status: 'incomplete', completedAt: null });
    saveRoom(x.room); renderTable(); updateDisplayScreen();
}

function deleteRow(taskId) {
    const x = getRoomCtx(); if (!x) return;
    x.room.tasks = (x.room.tasks || []).filter(t => t.id !== taskId);
    saveRoom(x.room); renderTable(); updateDisplayScreen();
    if (window.FMSUI && window.FMSUI.refreshHeader) window.FMSUI.refreshHeader();
}

function updateField(taskId, field, value) {
    const x = getRoomCtx(); if (!x) return;
    const task = (x.room.tasks || []).find(t => t.id === taskId);
    if (task) task[field] = value;
    saveRoom(x.room);
}

function toggleStatus(taskId) {
    const x = getRoomCtx(); if (!x) return;
    const task = (x.room.tasks || []).find(t => t.id === taskId); if (!task) return;
    const wasDone = task.status === 'done';
    if (wasDone) { task.status = 'incomplete'; task.completedAt = null; }
    else { task.status = 'done'; task.completedAt = Date.now(); }
    saveRoom(x.room);
    const roomTasks = x.room.tasks || [];
    const doneCount = roomTasks.filter(t => t.status === 'done').length;
    showToast(wasDone ? '↩️ Task marked incomplete' : '✅ Task completed');
    if (roomTasks.length > 0 && doneCount === roomTasks.length) {
        pushRoomNotification(
            `🏁 Room "${x.room.name}" is fully completed — all ${roomTasks.length} tasks done.`,
            '🏁', `${x.room.id}:room-complete:${roomTasks.length}`
        );
        showToast('🎉 All tasks completed!');
    }
    renderTable(); updateDisplayScreen();
    if (window.FMSUI && window.FMSUI.refreshHeader) window.FMSUI.refreshHeader();
}

/* ── TOAST ── */
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
}

/* ── EXCEL EXPORT ── */
function exportRoomExcel(room) {
    const ws_data = [['#', 'Task Description', 'Assigned Name', 'Status', 'Completion Date', 'Completion Time', 'Notes']];
    (room.tasks || []).forEach((task, i) => {
        const ft = fmtDate(task.completedAt);
        ws_data.push([i + 1, task.desc || '', task.name || '',
        task.status === 'done' ? 'Completed' : 'Incomplete',
        ft ? ft.date : '', ft ? ft.time : '', task.notes || '']);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = [{ wch: 4 }, { wch: 35 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, `${(room.name || 'room').replace(/[^a-z0-9]/gi, '_')}_table.xlsx`);
}

/* ── MODE TOGGLE (Normal / PM / CM) ── */
const MODE_STATES = ['Normal', 'PM', 'CM'];
let modeIndex = 0;

function cycleMode() {
    modeIndex = (modeIndex + 1) % MODE_STATES.length;
    const btn = document.getElementById('modToggleBtn');
    if (!btn) return;
    btn.textContent = MODE_STATES[modeIndex];
    btn.style.color = '#c9a870';
    btn.style.background = 'rgba(201,168,112,0.10)';
    btn.style.borderColor = 'rgba(201,168,112,0.28)';
}

/* ── NAME TOGGLE ── */
const NAME_STATES = ['Name', 'Yousaf', 'Bdran', 'Fadi Con', 'Jetee Con'];
const nameIndexes = { 1: 0, 2: 0 };

function cycleName(btnNum) {
    nameIndexes[btnNum] = (nameIndexes[btnNum] + 1) % NAME_STATES.length;
    const btn = document.getElementById('nameBtn' + btnNum);
    if (!btn) return;
    btn.textContent = NAME_STATES[nameIndexes[btnNum]];
}

/* ── INIT ── */
buildPage();

window.addEventListener('storage', e => {
    if (e.key === STORE) buildPage();
    if (e.key === NOTIF_STORE && window.FMSUI && window.FMSUI.refreshHeader) window.FMSUI.refreshHeader();
});

window.addEventListener('DOMContentLoaded', () => {
    if (window.FMSUI && window.FMSUI.refreshHeader) window.FMSUI.refreshHeader();
});