/* ============================================================
   AIG Facility Management System — Floor Page Script
   ============================================================ */

const params = new URLSearchParams(location.search);
const FLOOR = params.get('floor');
if (!FLOOR) location.href = 'index.html';

const STORE = 'aig_bms_v4';
const NOTIF_STORE = 'bms_notifs';
const DISMISSED_STORE = 'bms_notifs_dismissed';
const PHASE_TRACK_STORE = 'bms_phase_track';

const META = {
    ground: { label: 'Ground Floor', icon: '🚪' },
    1: { label: 'First Floor', icon: '1️⃣' },
    2: { label: 'Second Floor', icon: '2️⃣' },
    3: { label: 'Third Floor', icon: '3️⃣' },
    4: { label: 'Fourth Floor', icon: '4️⃣' },
    aivsid: { label: 'Aivsid', icon: '🏭' },
    buolching: { label: 'Buolching', icon: '🏗️' },
    pump: { label: 'Pump', icon: '⚙️' }
};

const m = META[FLOOR] || { label: `Floor ${FLOOR}`, icon: '🏢' };
document.getElementById('navLabel').textContent = m.label.toUpperCase();
const fpEl = document.getElementById('fdsFloorPill');
if (fpEl) fpEl.textContent = m.label.toUpperCase();
document.title = `${m.label} — AIG`;

/* ── STORAGE HELPERS ── */
function load() { return JSON.parse(localStorage.getItem(STORE) || '{}'); }
function save(d) {
    const dot = document.getElementById('asDot');
    const span = document.querySelector('#saveIndicator span');
    dot.className = 'as-dot saving';
    if (span) span.textContent = 'SAVING…';
    localStorage.setItem(STORE, JSON.stringify(d));
    setTimeout(() => { dot.className = 'as-dot'; if (span) span.textContent = 'AUTO SAVED'; }, 700);
}
function getData() { const d = load(); if (!d[FLOOR]) d[FLOOR] = { rooms: [] }; return d; }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* ── NOTIFICATION HELPERS ── */
function loadNotifs() { return JSON.parse(localStorage.getItem(NOTIF_STORE) || '[]'); }
function saveNotifs(a) { localStorage.setItem(NOTIF_STORE, JSON.stringify(a)); }
function loadDismissed() { return JSON.parse(localStorage.getItem(DISMISSED_STORE) || '[]'); }
function dismissKey(key) {
    if (!key) return;
    const dismissed = loadDismissed();
    if (!dismissed.includes(key)) { dismissed.push(key); localStorage.setItem(DISMISSED_STORE, JSON.stringify(dismissed)); }
}
function pushNotification(msg, icon, key) {
    if (!msg) return;
    if (key && loadDismissed().includes(key)) return;
    const notifs = loadNotifs();
    if (key && notifs.some(n => n.key === key)) return;
    notifs.unshift({
        msg, icon: icon || '🔔', key: key || '',
        time: new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
    });
    saveNotifs(notifs);
    if (window.FMSUI && window.FMSUI.refreshHeader) window.FMSUI.refreshHeader();
}

/* ── PHASE TRACKING ── */
function loadPhaseTrack() { return JSON.parse(localStorage.getItem(PHASE_TRACK_STORE) || '{}'); }
function savePhaseTrack(obj) { localStorage.setItem(PHASE_TRACK_STORE, JSON.stringify(obj)); }

/* ── AUTO-SWITCH CONFIG ── */
const PHASE_LABELS = ['Phase 1', 'Phase 2', 'Phase 3'];
const DUR_OPTIONS = [
    { val: 1, label: '1 min' },
    { val: 10080, label: '7 days' },
    { val: 20160, label: '14 days' },
    { val: 43200, label: '30 days' },
    { val: 86400, label: '60 days' },
    { val: 129600, label: '90 days' }
];

let autoPhases = [
    { type: 'inspection', duration: 43200 },
    { type: 'test', duration: 43200 },
    { type: 'inspection', duration: 43200 }
];

/* ── SCHEDULE ROW BUILDER (shared helper) ── */
function buildScheduleRowsInto(containerId, phases, setTypeFn, setDurFn) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    cont.innerHTML = '';
    phases.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'schedule-row';
        row.innerHTML = `
      <span class="schedule-month">${PHASE_LABELS[i]}</span>
      <div class="schedule-type-btns">
        <button class="sch-btn ${p.type === 'inspection' ? 'active-insp' : ''}" onclick="${setTypeFn}(${i},'inspection')">🔍 Insp</button>
        <button class="sch-btn ${p.type === 'test' ? 'active-test' : ''}" onclick="${setTypeFn}(${i},'test')">🧪 Test</button>
      </div>
      <select class="schedule-dur-sel" onchange="${setDurFn}(${i},parseInt(this.value))">
        ${DUR_OPTIONS.map(o => `<option value="${o.val}" ${p.duration === o.val ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>`;
        cont.appendChild(row);
    });
}

function buildScheduleRows() { buildScheduleRowsInto('scheduleRows', autoPhases, 'setPhaseType', 'setPhaseDur'); }
function buildEditScheduleRows() { buildScheduleRowsInto('editScheduleRows', _editPhases, 'setEditPhaseType', 'setEditPhaseDur'); }

/* ── ADD ROOM PHASE CONTROLS ── */
function setPhaseType(i, t) { autoPhases[i].type = t; buildScheduleRows(); }
function setPhaseDur(i, d) { autoPhases[i].duration = d; }

function toggleAutoSwitch() {
    const on = document.getElementById('autoSwitchToggle').checked;
    const grid = document.getElementById('autoScheduleGrid');
    if (on) { grid.classList.add('visible'); buildScheduleRows(); }
    else grid.classList.remove('visible');
}

/* ── ELAPSED / PHASE STATE ── */
function elapsedMinutes(room) {
    if (!room.durationStart) return 0;
    return Math.floor((Date.now() - room.durationStart) / 60000);
}

function getAutoSwitchState(room) {
    if (!room.autoSwitch || !room.autoPhases || !room.durationStart) return null;
    const phases = room.autoPhases;
    const totalCycle = phases.reduce((s, p) => s + p.duration, 0);
    const posInCycle = elapsedMinutes(room) % totalCycle;
    let sum = 0;
    for (let i = 0; i < phases.length; i++) {
        sum += phases[i].duration;
        if (posInCycle < sum) return { phase: i + 1, ...phases[i] };
    }
    return { phase: 1, ...phases[0] };
}

function checkPhaseSwitched(room) {
    if (!room.autoSwitch || !room.autoPhases || !room.durationStart) return;
    const phases = room.autoPhases;
    const totalCycle = phases.reduce((s, p) => s + p.duration, 0);
    const elapsed = elapsedMinutes(room);
    const cycleNumber = Math.floor(elapsed / totalCycle);
    const state = getAutoSwitchState(room);
    if (!state) return;
    const track = loadPhaseTrack();
    const currentPhaseKey = state.type + ':' + state.phase + ':cycle' + cycleNumber;
    const lastPhaseKey = track[room.id];
    if (lastPhaseKey === undefined) {
        track[room.id] = currentPhaseKey;
        savePhaseTrack(track);
        return;
    }
    if (lastPhaseKey !== currentPhaseKey) {
        const typeLabel = state.type === 'test' ? 'TEST' : 'INSPECTION';
        const icon = state.type === 'test' ? '🧪' : '🔍';
        const notifKey = `${room.id}:switched-to:${currentPhaseKey}`;
        pushNotification(
            `${icon} Room "${room.name}" switched to ${typeLabel} (Phase ${state.phase} · Cycle ${cycleNumber + 1})`,
            icon, notifKey
        );
        track[room.id] = currentPhaseKey;
        savePhaseTrack(track);
    }
}

function checkRoomCompletion(room) {
    const tasks = room.tasks || [];
    if (!tasks.length) return;
    if (tasks.every(t => t.status === 'done')) {
        const key = `${room.id}:room-complete:${tasks.length}`;
        pushNotification(`🏁 Room "${room.name}" is fully completed (${tasks.length}/${tasks.length} tasks done).`, '🏁', key);
    }
}

/* ── ADD ROOM ── */
document.getElementById('roomInput').addEventListener('keydown', e => { if (e.key === 'Enter') addRoom(); });

function addRoom() {
    const inp = document.getElementById('roomInput');
    const name = inp.value.trim();
    if (!name) { showErr('Please enter a room name.'); return; }
    const d = getData();
    if (d[FLOOR].rooms.some(r => r.name.toLowerCase() === name.toLowerCase())) {
        showErr('A room with this name already exists.'); return;
    }
    const rows = 4;
    const autoOn = document.getElementById('autoSwitchToggle').checked;
    const id = genId();
    const roomUrl = location.origin + location.pathname.replace('floor.html', 'room.html') + '?id=' + id;
    const tasks = [];
    for (let i = 0; i < rows; i++)
        tasks.push({ id: genId(), desc: '', name: '', notes: '', status: 'incomplete', completedAt: null });
    const newRoom = {
        id, name, tasks, qrUrl: roomUrl,
        type: autoOn ? autoPhases[0].type : null,
        duration: autoOn ? autoPhases[0].duration : null,
        durationStart: Date.now(),
        initialRows: rows
    };
    if (autoOn) { newRoom.autoSwitch = true; newRoom.autoPhases = JSON.parse(JSON.stringify(autoPhases)); }
    d[FLOOR].rooms.push(newRoom);
    save(d);
    inp.value = '';
    document.getElementById('errMsg').style.display = 'none';
    document.getElementById('autoSwitchToggle').checked = false;
    document.getElementById('autoScheduleGrid').classList.remove('visible');
    autoPhases = [
        { type: 'inspection', duration: 43200 },
        { type: 'test', duration: 43200 },
        { type: 'inspection', duration: 43200 }
    ];
    renderRooms(); updateDashboard();
    if (window.FMSUI) window.FMSUI.addNotification('Room ' + name + ' added to ' + m.label, '🏢', FLOOR + ':' + name + ':created');
    showToast('✅ Room "' + name + '" added');
}

/* ── EDIT MODAL ── */
let _editId = null;
let _editPhases = [
    { type: 'inspection', duration: 43200 },
    { type: 'test', duration: 43200 },
    { type: 'inspection', duration: 43200 }
];

function setEditPhaseType(i, t) { _editPhases[i].type = t; buildEditScheduleRows(); }
function setEditPhaseDur(i, d) { _editPhases[i].duration = d; }

function toggleEditAutoSwitch() {
    const on = document.getElementById('editAutoToggle').checked;
    const grid = document.getElementById('editAutoGrid');
    if (on) { grid.classList.add('visible'); buildEditScheduleRows(); }
    else grid.classList.remove('visible');
}

function openEditModal(id, e) {
    e.preventDefault(); e.stopPropagation();
    const d = getData(), room = d[FLOOR].rooms.find(r => r.id === id);
    if (!room) return;
    _editId = id;
    _editPhases = room.autoPhases
        ? JSON.parse(JSON.stringify(room.autoPhases))
        : [{ type: 'inspection', duration: 43200 }, { type: 'test', duration: 43200 }, { type: 'inspection', duration: 43200 }];
    document.getElementById('editName').value = room.name;
    const hasAuto = !!room.autoSwitch;
    document.getElementById('editAutoToggle').checked = hasAuto;
    const grid = document.getElementById('editAutoGrid');
    if (hasAuto) { grid.classList.add('visible'); buildEditScheduleRows(); }
    else grid.classList.remove('visible');
    document.getElementById('editModal').classList.add('open');
    setTimeout(() => document.getElementById('editName').focus(), 100);
}

function closeEditModal() { document.getElementById('editModal').classList.remove('open'); _editId = null; }

function saveEdit() {
    if (!_editId) return;
    const newName = document.getElementById('editName').value.trim();
    if (!newName) { showToast('⚠️ Room name cannot be empty'); return; }
    const d = getData();
    if (d[FLOOR].rooms.some(r => r.id !== _editId && r.name.toLowerCase() === newName.toLowerCase())) {
        showToast('⚠️ Another room with this name already exists'); return;
    }
    const room = d[FLOOR].rooms.find(r => r.id === _editId);
    if (!room) return;
    const oldName = room.name;
    const autoOn = document.getElementById('editAutoToggle').checked;
    room.name = newName;
    if (autoOn) {
        room.autoSwitch = true;
        room.autoPhases = JSON.parse(JSON.stringify(_editPhases));
        room.type = _editPhases[0].type;
        room.duration = _editPhases[0].duration;
        room.durationStart = Date.now();
    } else {
        room.autoSwitch = false; room.autoPhases = null;
        room.type = null; room.duration = null; room.durationStart = null;
    }
    save(d); closeEditModal(); renderRooms(); updateDashboard();
    showToast(`✅ "${oldName}" updated`);
}

/* ── DELETE MODAL ── */
let _deleteId = null;

function openDeleteModal(id, e) {
    e.preventDefault(); e.stopPropagation();
    const d = getData(), room = d[FLOOR].rooms.find(r => r.id === id);
    if (!room) return;
    _deleteId = id;
    document.getElementById('deleteRoomName').textContent = '"' + room.name + '"';
    document.getElementById('deleteModal').classList.add('open');
}

function closeDeleteModal() { document.getElementById('deleteModal').classList.remove('open'); _deleteId = null; }

function confirmDelete() {
    if (!_deleteId) return;
    const d = getData();
    const room = d[FLOOR].rooms.find(r => r.id === _deleteId);
    const name = room ? room.name : '';
    d[FLOOR].rooms = d[FLOOR].rooms.filter(r => r.id !== _deleteId);
    const track = loadPhaseTrack();
    delete track[_deleteId];
    savePhaseTrack(track);
    save(d); closeDeleteModal(); renderRooms(); updateDashboard();
    if (window.FMSUI) window.FMSUI.addNotification('Room deleted: ' + name, '🗑️', _deleteId + ':deleted');
    showToast(`🗑️ Room "${name}" deleted`);
}

/* ── DUPLICATE ROOM ── */
function duplicateRoom(id, e) {
    e.preventDefault(); e.stopPropagation();
    const d = getData(), room = d[FLOOR].rooms.find(r => r.id === id);
    if (!room) return;
    let baseName = room.name + ' (Copy)', n = 2;
    while (d[FLOOR].rooms.some(r => r.name.toLowerCase() === baseName.toLowerCase()))
        baseName = room.name + ' (Copy ' + (n++) + ')';
    const newId = genId();
    const roomUrl = location.origin + location.pathname.replace('floor.html', 'room.html') + '?id=' + newId;
    const newTasks = (room.tasks || []).map(t => ({
        id: genId(), desc: t.desc || '', name: t.name || '',
        notes: t.notes || '', status: 'incomplete', completedAt: null
    }));
    d[FLOOR].rooms.push({
        id: newId, name: baseName, tasks: newTasks, qrUrl: roomUrl,
        type: room.type, duration: room.duration,
        durationStart: Date.now(), initialRows: room.initialRows || newTasks.length
    });
    save(d); renderRooms(); updateDashboard();
    if (window.FMSUI) window.FMSUI.addNotification('Room duplicated: ' + baseName, '📋', newId + ':duplicated');
    showToast(`📋 Duplicated as "${baseName}"`);
}

/* ── RESET MODAL ── */
function openResetModal() {
    const d = getData(), rooms = d[FLOOR].rooms;
    if (!rooms.length) { showToast('⚠️ No rooms on this floor'); return; }
    const list = document.getElementById('resetRoomsList');
    list.innerHTML = `<label class="reset-select-all"><input type="checkbox" id="selectAllRooms" onchange="toggleSelectAll()" /> SELECT ALL</label>`;
    rooms.forEach(room => {
        const item = document.createElement('label');
        item.className = 'reset-room-item';
        item.innerHTML = `<input type="checkbox" class="reset-room-cb" value="${room.id}" /> <label>${esc(room.name)}</label>`;
        list.appendChild(item);
    });
    document.getElementById('resetModal').classList.add('open');
}

function closeResetModal() { document.getElementById('resetModal').classList.remove('open'); }

function toggleSelectAll() {
    const all = document.getElementById('selectAllRooms').checked;
    document.querySelectorAll('.reset-room-cb').forEach(cb => cb.checked = all);
}

function confirmReset() {
    const selected = [...document.querySelectorAll('.reset-room-cb:checked')].map(cb => cb.value);
    if (!selected.length) { showToast('⚠️ Please select at least one room'); return; }
    const d = getData();
    const notifs = JSON.parse(localStorage.getItem(NOTIF_STORE) || '[]');
    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_STORE) || '[]');

    selected.forEach(id => {
        const room = d[FLOOR].rooms.find(r => r.id === id);
        if (!room || !room.tasks) return;

        room.tasks = room.tasks.map(t => ({ ...t, name: '', notes: '', status: 'incomplete', completedAt: null }));

        const roomCompletePrefix = `${id}:room-complete:`;
        for (let i = notifs.length - 1; i >= 0; i--) {
            if ((notifs[i] && notifs[i].key || '').startsWith(roomCompletePrefix)) notifs.splice(i, 1);
        }
        for (let i = dismissed.length - 1; i >= 0; i--) {
            if ((dismissed[i] || '').startsWith(roomCompletePrefix)) dismissed.splice(i, 1);
        }
    });

    localStorage.setItem(NOTIF_STORE, JSON.stringify(notifs));
    localStorage.setItem(DISMISSED_STORE, JSON.stringify(dismissed));
    save(d); closeResetModal(); renderRooms(); updateDashboard();
    showToast(`🔄 Reset ${selected.length} room(s) — descriptions preserved`);
    if (window.FMSUI && window.FMSUI.refreshHeader) window.FMSUI.refreshHeader();
}

/* ── REMAINING TIME ── */
function getRemainingDays(room) {
    if (!room.duration || !room.durationStart) return null;
    if (room.autoSwitch) {
        const remMin = Math.max(0, room.duration - elapsedMinutes(room));
        return { minutes: remMin, display: remMin < 60 ? remMin + 'm' : Math.ceil(remMin / 1440) + 'd', urgent: remMin <= 60 };
    }
    const elapsed = Math.floor((Date.now() - room.durationStart) / (1000 * 60 * 60 * 24));
    const rem = Math.max(0, room.duration - elapsed);
    return { minutes: rem * 1440, display: rem + 'd', urgent: rem <= 3 };
}

/* ── RENDER ROOMS ── */
function renderRooms() {
    const d = getData(), rooms = d[FLOOR].rooms;
    const list = document.getElementById('roomsList');
    const badge = document.getElementById('roomBadge');
    const query = (document.getElementById('searchInput').value || '').toLowerCase().trim();
    badge.textContent = rooms.length;
    list.innerHTML = '';
    if (!rooms.length) { list.innerHTML = '<div class="empty-rooms">No rooms yet — add one above</div>'; return; }
    const filtered = query ? rooms.filter(r => r.name.toLowerCase().includes(query)) : rooms;
    if (!filtered.length) { list.innerHTML = `<div class="no-results">No rooms match "<strong>${query}</strong>"</div>`; return; }

    rooms.forEach(r => { checkRoomCompletion(r); checkPhaseSwitched(r); });

    filtered.forEach((room, i) => {
        const autoState = getAutoSwitchState(room);
        const displayType = autoState ? autoState.type : (room.type || null);
        const phaseLabel = autoState ? `Phase ${autoState.phase}` : '';
        const tc = room.tasks ? room.tasks.length : 0;
        const dc = room.tasks ? room.tasks.filter(t => t.status === 'done').length : 0;
        const pct = tc > 0 ? Math.round(dc / tc * 100) : 0;
        const init = room.name.slice(0, 2).toUpperCase();
        const rem = getRemainingDays(room);
        const isUrgent = rem && rem.urgent;
        const durHtml = rem !== null ? `<div class="room-duration${isUrgent ? ' urgent' : ''}"><span class="dur-days">${rem.display}</span>remaining</div>` : '';
        const phaseIndicator = displayType ? `<div class="phase-badge ${displayType}">${displayType === 'inspection' ? 'INSPECTION' : 'TEST'}</div>` : '';
        const autoBadge = room.autoSwitch ? `<div class="auto-badge">⚡ AUTO${phaseLabel ? ' · ' + phaseLabel : ''}</div>` : '';
        const a = document.createElement('a');
        a.className = 'room-row';
        a.href = `room.html?id=${room.id}`;
        a.style.animationDelay = `${i * .04}s`;
        a.innerHTML = `
      <div class="room-avatar">${init}</div>
      <div class="room-info">
        <div class="room-name">${esc(room.name)}</div>
        <div class="room-meta">${tc} tasks · ${dc} done · ${tc - dc} pending</div>
      </div>
      ${phaseIndicator}${autoBadge}${durHtml}
      <div class="room-right">
        <div class="room-pct">${pct}%</div>
        <div class="room-bar"><div class="room-bar-fill" style="width:${pct}%"></div></div>
        <div style="font-family:var(--mono);font-size:.52rem;color:var(--text-3)">${dc}/${tc}</div>
      </div>
      <div class="room-actions">
        <button class="room-act-btn save-btn" onclick="saveRoomExcel('${room.id}',event)" title="Save Excel">💾</button>
        <button class="room-act-btn qr-btn"   onclick="saveRoomQR('${room.id}',event)"   title="Save QR">📩</button>
        <button class="room-act-btn edit-btn" onclick="openEditModal('${room.id}',event)" title="Edit">✏️</button>
        <button class="room-act-btn dup-btn"  onclick="duplicateRoom('${room.id}',event)" title="Duplicate">📋</button>
        <button class="room-act-btn del-btn"  onclick="openDeleteModal('${room.id}',event)" title="Delete">🗑️</button>
      </div>
      <div class="room-arrow">↗</div>`;
        list.appendChild(a);
    });
}

/* ── DASHBOARD STATS ── */
function updateDashboard() {
    const d = getData();
    let total = 0, done = 0, rooms = 0, roomsDone = 0;
    d[FLOOR].rooms.forEach(r => {
        rooms++;
        const tc = r.tasks ? r.tasks.length : 0;
        const dc = r.tasks ? r.tasks.filter(t => t.status === 'done').length : 0;
        total += tc; done += dc;
        if (tc > 0 && dc === tc) roomsDone++;
    });
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    document.getElementById('dTotal').textContent = total;
    document.getElementById('dDone').textContent = done;
    document.getElementById('dTodo').textContent = total - done;
    document.getElementById('dPct').textContent = pct + '%';
    document.getElementById('dBar').style.width = pct + '%';
    document.getElementById('dRooms').textContent = rooms;
    document.getElementById('dRoomsDone').textContent = roomsDone;
    const bp = document.getElementById('dBarPct');
    if (bp) bp.textContent = pct + '%';
}

/* ── EXCEL EXPORT ── */
function fmtDate(ts) {
    const d = new Date(ts);
    return {
        date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
}

function saveRoomExcel(id, e) {
    e.preventDefault(); e.stopPropagation();
    const d = getData(), room = d[FLOOR].rooms.find(r => r.id === id);
    if (!room) return;
    const ws_data = [['#', 'Task Description', 'Assigned Name', 'Status', 'Completion Date', 'Completion Time', 'Notes']];
    (room.tasks || []).forEach((task, i) => {
        const ft = task.completedAt ? fmtDate(task.completedAt) : null;
        ws_data.push([i + 1, task.desc || '', task.name || '',
        task.status === 'done' ? 'Completed' : 'Incomplete',
        ft ? ft.date : '', ft ? ft.time : '', task.notes || '']);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = [{ wch: 4 }, { wch: 35 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, `${(room.name || 'room').replace(/[^a-z0-9]/gi, '_')}_table.xlsx`);
    showToast(`💾 "${room.name}" exported`);
}

/* ── QR DOWNLOAD ── */
function saveRoomQR(id, e) {
    e.preventDefault(); e.stopPropagation();
    const d = getData(), room = d[FLOOR].rooms.find(r => r.id === id);
    if (!room) return;
    const qrUrl = room.qrUrl || (location.origin + location.pathname.replace('floor.html', 'room.html') + '?id=' + id);
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    document.body.appendChild(container);
    try {
        new QRCode(container, {
            text: qrUrl, width: 200, height: 200,
            colorDark: '#101827', colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
        setTimeout(() => {
            const qrCanvas = container.querySelector('canvas');
            const qrImg = container.querySelector('img');
            const border = 24, qrSize = 200, total = qrSize + border * 2;
            const out = document.createElement('canvas');
            out.width = total; out.height = total;
            const ctx = out.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, total, total);
            const drawQR = src => {
                ctx.drawImage(src, border, border, qrSize, qrSize);
                document.body.removeChild(container);
                const a = document.createElement('a');
                a.href = out.toDataURL('image/png');
                a.download = `${(room.name || 'room').replace(/[^a-z0-9]/gi, '_')}_QR.png`;
                a.click();
                showToast(`📩 QR saved for "${room.name}"`);
            };
            if (qrCanvas) drawQR(qrCanvas);
            else if (qrImg) { const tmp = new Image(); tmp.onload = () => drawQR(tmp); tmp.src = qrImg.src; }
            else { document.body.removeChild(container); showToast('⚠️ QR generation failed'); }
        }, 300);
    } catch (err) {
        document.body.removeChild(container);
        showToast('⚠️ QR generation failed');
    }
}

/* ── UTILS ── */
function showErr(msg) { const el = document.getElementById('errMsg'); el.textContent = msg; el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 2500); }
function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

/* ── MODAL BACKDROP CLOSE ── */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) { overlay.classList.remove('open'); _editId = null; _deleteId = null; }
    });
});

/* ── FLOOR NOTIFICATION PANEL ── */
(function initFloorNotifPanel() {
    const bellBtn = document.getElementById('floorNotifBellBtn');
    const panel = document.getElementById('floorNotifPanel');
    const clearBtn = document.getElementById('floorClearAllBtn');
    const closeBtn = document.getElementById('floorCloseNotifBtn');

    function positionPanel() {
        const r = bellBtn.getBoundingClientRect();
        panel.style.top = (r.bottom + 8) + 'px';
        panel.style.right = (window.innerWidth - r.right) + 'px';
        panel.style.left = 'auto';
    }

    function renderFloorNotifs() {
        const notifs = loadNotifs();
        const container = document.getElementById('floorNotifItems');
        const countEl = document.getElementById('floorNotifCount');
        countEl.textContent = notifs.length;
        if (!notifs.length) { container.innerHTML = '<div class="notif-empty">NO NOTIFICATIONS YET</div>'; return; }
        container.innerHTML = notifs.map((n, i) => {
            const uid = n.key ? encodeURIComponent(n.key) : String(i);
            return `<div class="notif-item" id="fni-${i}">
        <div class="ni-icon">${n.icon || '🔔'}</div>
        <div class="ni-body">
          <div class="ni-msg">${n.msg || ''}</div>
          <div class="ni-time">${n.time || ''}</div>
        </div>
        <button class="ni-delete-btn" data-key="${uid}" data-index="${i}" title="Delete">✕</button>
      </div>`;
        }).join('');
        container.querySelectorAll('.ni-delete-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const idx = parseInt(this.getAttribute('data-index'));
                const item = document.getElementById('fni-' + idx);
                if (!item) return;
                item.classList.add('removing');
                const keyToDelete = decodeURIComponent(this.getAttribute('data-key'));
                setTimeout(() => {
                    const arr = loadNotifs();
                    const pos = arr.findIndex(n => n.key === keyToDelete);
                    if (pos !== -1) { dismissKey(arr[pos].key); arr.splice(pos, 1); }
                    else if (idx < arr.length) { dismissKey(arr[idx].key); arr.splice(idx, 1); }
                    saveNotifs(arr);
                    renderFloorNotifs();
                }, 260);
            });
        });
    }

    function openPanel() { positionPanel(); panel.classList.add('open'); renderFloorNotifs(); }
    function closePanel() { panel.classList.remove('open'); }

    bellBtn.addEventListener('click', e => { e.stopPropagation(); panel.classList.contains('open') ? closePanel() : openPanel(); });
    closeBtn.addEventListener('click', e => { e.stopPropagation(); closePanel(); });
    clearBtn.addEventListener('click', e => { e.stopPropagation(); loadNotifs().forEach(n => dismissKey(n.key)); saveNotifs([]); renderFloorNotifs(); });
    panel.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => closePanel());
    window.addEventListener('resize', () => { if (panel.classList.contains('open')) positionPanel(); });

    window._renderFloorNotifs = renderFloorNotifs;
})();

/* ── INIT ── */
renderRooms();
updateDashboard();
if (window._renderFloorNotifs) window._renderFloorNotifs();

window.addEventListener('storage', e => {
    if (e.key === STORE) { renderRooms(); updateDashboard(); }
    if (e.key === NOTIF_STORE) {
        if (window._renderFloorNotifs) window._renderFloorNotifs();
        if (window.FMSUI && window.FMSUI.refreshHeader) window.FMSUI.refreshHeader();
    }
});