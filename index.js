/* ============================================================
   AIG Facility Management System — Index Page Script
   ============================================================ */

const STORE = 'aig_bms_v4';
const NOTIF_STORE = 'bms_notifs';
const DISMISSED_STORE = 'bms_notifs_dismissed';

const FLOORS = [
    { id: 'ground', label: 'Ground Floor', short: 'G' },
    { id: 1, label: 'First Floor', short: '1' },
    { id: 2, label: 'Second Floor', short: '2' },
    { id: 3, label: 'Third Floor', short: '3' },
    { id: 4, label: 'Fourth Floor', short: '4' }
];

const EXTERNALS = [
    { id: 'aivsid', label: 'Aivsid' },
    { id: 'buolching', label: 'Buolching' },
    { id: 'pump', label: 'Pump' }
];

/* ── STORAGE HELPERS ── */
function load() { return JSON.parse(localStorage.getItem(STORE) || '{}'); }
function loadNotifs() { return JSON.parse(localStorage.getItem(NOTIF_STORE) || '[]'); }
function saveNotifs(a) { localStorage.setItem(NOTIF_STORE, JSON.stringify(a)); }
function loadDismissed() { return JSON.parse(localStorage.getItem(DISMISSED_STORE) || '[]'); }
function dismissKey(key) {
    if (!key) return;
    const d = loadDismissed();
    if (!d.includes(key)) { d.push(key); localStorage.setItem(DISMISSED_STORE, JSON.stringify(d)); }
}

/* ── CLOCK ── */
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const tEl = document.getElementById('clockTime');
    const dEl = document.getElementById('clockDate');
    if (tEl) tEl.textContent = hh + ':' + mm;
    if (dEl) dEl.textContent = dd + ' ' + MONTHS[now.getMonth()];
}

updateClock();
setInterval(updateClock, 1000);

/* ── STATS ── */
function getStats(key) {
    const d = load(), fd = d[key];
    if (!fd || !fd.rooms) return { rooms: 0, total: 0, done: 0, roomsDone: 0 };
    let total = 0, done = 0, roomsDone = 0;
    fd.rooms.forEach(r => {
        const tc = r.tasks ? r.tasks.length : 0;
        const dc = r.tasks ? r.tasks.filter(t => t.status === 'done').length : 0;
        total += tc; done += dc;
        if (tc > 0 && dc === tc) roomsDone++;
    });
    return { rooms: fd.rooms.length, total, done, roomsDone };
}

function buildGlobalStats() {
    let gt = 0, gd = 0, gr = 0, grd = 0;
    FLOORS.map(f => f.id).concat(EXTERNALS.map(e => e.id)).forEach(k => {
        const s = getStats(k);
        gt += s.total; gd += s.done; gr += s.rooms; grd += s.roomsDone;
    });
    const pct = gt > 0 ? Math.round(gd / gt * 100) : 0;
    document.getElementById('gTotal').textContent = gt;
    document.getElementById('gDone').textContent = gd;
    document.getElementById('gTodo').textContent = gt - gd;
    document.getElementById('gPct').textContent = pct + '%';
    document.getElementById('gRooms').textContent = gr;
    document.getElementById('gRoomsDone').textContent = grd;
    const bar = document.getElementById('gBar');
    const bp = document.getElementById('gBarPct');
    if (bar) bar.style.width = pct + '%';
    if (bp) bp.textContent = pct + '%';
}

/* ── FLOORS PANEL ── */
function buildFloorsPanel() {
    const el = document.getElementById('floorsPanel');
    el.innerHTML = '';
    FLOORS.slice().reverse().forEach((f, i) => {
        const s = getStats(f.id);
        const pct = s.total > 0 ? Math.round(s.done / s.total * 100) : 0;
        const a = document.createElement('a');
        a.href = 'floor.html?floor=' + f.id;
        a.className = 'floor-entry';
        a.style.animationDelay = (.15 + i * .06) + 's';
        a.innerHTML = `
      <div class="fe-floor-tag">${f.short}</div>
      <div class="fe-info">
        <div class="fe-name">${f.label}</div>
        <div class="fe-meta">${s.rooms} rooms · ${s.total} tasks</div>
      </div>
      <div class="fe-stats">
        <div class="fe-pct">${pct}%</div>
        <div class="fe-mini-bar"><div class="fe-fill" style="width:${pct}%"></div></div>
        <div>${s.done}/${s.total} done</div>
      </div>
      <div class="fe-view-btn">View Floor ↗</div>`;
        el.appendChild(a);
    });
}

/* ── BUILDING FLOOR OVERLAYS ── */
function buildFloorOverlays() {
    const wrap = document.getElementById('floorOverlays');
    if (!wrap) return;
    const zones = [
        { id: 4, label: '4 Floor', top: 8.5, h: 12.7 },
        { id: 3, label: '3 Floor', top: 21.2, h: 13 },
        { id: 2, label: '2 Floor', top: 34.2, h: 14.2 },
        { id: 1, label: '1 Floor', top: 48.4, h: 16 },
        { id: 'ground', label: 'Basement', top: 64.4, h: 21 }
    ];
    wrap.innerHTML = '';
    zones.forEach(z => {
        const div = document.createElement('div');
        div.className = 'fov';
        div.style.top = z.top + '%';
        div.style.height = z.h + '%';
        div.onclick = () => location.href = 'floor.html?floor=' + z.id;
        div.title = z.label;
        div.innerHTML = `<span class="fov-lbl">${z.label} ↗</span>`;
        wrap.appendChild(div);
    });
}

/* ── NOTIFICATION PANEL ── */
function renderNotifs() {
    const notifs = loadNotifs();
    const container = document.getElementById('notifItems');
    const countEl = document.getElementById('notifCount');
    countEl.textContent = notifs.length;
    if (!notifs.length) {
        container.innerHTML = '<div class="notif-empty">NO NOTIFICATIONS YET</div>';
        return;
    }
    container.innerHTML = notifs.map((n, i) => {
        const uid = n.key ? encodeURIComponent(n.key) : String(i);
        return `<div class="notif-item" id="ni-${i}">
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
            const item = document.getElementById('ni-' + idx);
            if (!item) return;
            item.classList.add('removing');
            const keyToDelete = decodeURIComponent(this.getAttribute('data-key'));
            setTimeout(() => {
                const arr = loadNotifs();
                const pos = arr.findIndex(n => n.key === keyToDelete);
                if (pos !== -1) { dismissKey(arr[pos].key); arr.splice(pos, 1); }
                else if (idx < arr.length) { dismissKey(arr[idx].key); arr.splice(idx, 1); }
                saveNotifs(arr);
                renderNotifs();
            }, 260);
        });
    });
}

(function initNotifPanel() {
    const bellBtn = document.getElementById('notifBellBtn');
    const notifPanel = document.getElementById('notifPanel');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const closeBtn = document.getElementById('closeNotifBtn');

    function positionPanel() {
        const r = bellBtn.getBoundingClientRect();
        notifPanel.style.top = (r.bottom + 8) + 'px';
        notifPanel.style.right = (window.innerWidth - r.right) + 'px';
        notifPanel.style.left = 'auto';
    }

    function openPanel() { positionPanel(); notifPanel.classList.add('open'); renderNotifs(); }
    function closePanel() { notifPanel.classList.remove('open'); }

    bellBtn.addEventListener('click', e => { e.stopPropagation(); notifPanel.classList.contains('open') ? closePanel() : openPanel(); });
    closeBtn.addEventListener('click', e => { e.stopPropagation(); closePanel(); });
    clearAllBtn.addEventListener('click', e => {
        e.stopPropagation();
        loadNotifs().forEach(n => dismissKey(n.key));
        saveNotifs([]);
        renderNotifs();
    });
    notifPanel.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => closePanel());
    window.addEventListener('resize', () => { if (notifPanel.classList.contains('open')) positionPanel(); });
})();

/* ── INIT ── */
buildGlobalStats();
buildFloorsPanel();
buildFloorOverlays();
renderNotifs();

if (window.FMSUI && window.FMSUI.refreshHeader) window.FMSUI.refreshHeader();

window.addEventListener('storage', e => {
    if (e.key === STORE) { buildGlobalStats(); buildFloorsPanel(); }
    if (e.key === NOTIF_STORE) {
        renderNotifs();
        if (window.FMSUI && window.FMSUI.refreshHeader) window.FMSUI.refreshHeader();
    }
});