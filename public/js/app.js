// ZeitWerk App-Logik
const api = {
  async req(path, opts = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (res.status === 401) { window.location.href = '/'; throw new Error('unauth'); }
    const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Fehler');
    return body;
  },
  get: (p) => api.req(p),
  post: (p, d) => api.req(p, { method: 'POST', body: JSON.stringify(d || {}) }),
  put: (p, d) => api.req(p, { method: 'PUT', body: JSON.stringify(d || {}) }),
  del: (p) => api.req(p, { method: 'DELETE' }),
};

let state = { entries: [], projects: [], running: null, tick: null, view: null };

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

function fmtDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
function hoursDecimal(ms) {
  return (ms / 3_600_000).toFixed(1).replace('.', ',') + ' h';
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
function toDateInput(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toTimeInput(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
function combineLocal(date, time) {
  // date=YYYY-MM-DD, time=HH:MM -> ISO in lokaler Zeit
  return new Date(`${date}T${time}`).toISOString();
}

let toastTimer;
function toast(text, isError = false) {
  const el = $('toast');
  el.textContent = text;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 2600);
}

// ---------- Init ----------
async function init() {
  let me;
  try {
    me = await api.get('/api/auth/me');
  } catch { return; }
  const u = me.user;
  $('user-name').textContent = u.name;
  $('user-mail').textContent = u.email;
  $('avatar').textContent = (u.name[0] || '?').toUpperCase();

  // Standard-Datum im Formular = heute
  $('manual-form').date.value = toDateInput(new Date().toISOString());

  await Promise.all([loadProjects(), loadEntries(), loadRunning()]);
  bindEvents();
}

// ---------- Projekte ----------
async function loadProjects() {
  const { projects } = await api.get('/api/projects');
  state.projects = projects;
  renderProjectSelects();
  renderProjectChips();
}

function projectOptions(selectedId) {
  return ['<option value="">Ohne Projekt</option>']
    .concat(state.projects.map((p) =>
      `<option value="${p.id}" ${String(p.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(p.name)}</option>`))
    .join('');
}

function renderProjectSelects() {
  ['timer-project', 'manual-project', 'edit-project'].forEach((id) => {
    const el = $(id);
    if (el) { const cur = el.value; el.innerHTML = projectOptions(cur); }
  });
}

function renderProjectChips() {
  const box = $('project-chips');
  if (!state.projects.length) { box.innerHTML = '<span class="empty" style="padding:8px">Noch keine Projekte</span>'; return; }
  box.innerHTML = state.projects.map((p) =>
    `<span class="chip"><span class="proj-dot" style="background:${p.color}"></span>${escapeHtml(p.name)}
      <button data-del-project="${p.id}" title="Löschen">×</button></span>`).join('');
}

// ---------- Einträge ----------
async function loadEntries() {
  const { entries } = await api.get('/api/entries');
  state.entries = entries;
  renderEntries();
  renderStats();
  renderOverview();
}

// ---------- Übersicht (Monat / Tage / Projekte) ----------
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function renderOverview() {
  if (!state.view) { const n = new Date(); state.view = { year: n.getFullYear(), month: n.getMonth() }; }
  const { year, month } = state.view;
  $('month-label').textContent = `${MONTHS[month]} ${year}`;

  // Nur abgeschlossene Einträge des angezeigten Monats
  const inMonth = state.entries.filter((e) => {
    if (!e.end_ts) return false;
    const s = new Date(e.start_ts);
    return s.getFullYear() === year && s.getMonth() === month;
  });

  // Kennzahlen
  const totalMs = inMonth.reduce((sum, e) => sum + (new Date(e.end_ts) - new Date(e.start_ts)), 0);

  // Nach Tag gruppieren
  const byDay = new Map();
  for (const e of inMonth) {
    const s = new Date(e.start_ts);
    const key = s.getDate();
    byDay.set(key, (byDay.get(key) || 0) + (new Date(e.end_ts) - s));
  }
  const workDays = byDay.size;

  $('ov-total').textContent = hoursDecimal(totalMs);
  $('ov-days').textContent = String(workDays);
  $('ov-avg').textContent = workDays ? hoursDecimal(totalMs / workDays) : '0,0 h';

  // Tagesliste (absteigend nach Datum)
  const dayBox = $('day-list');
  if (!byDay.size) {
    dayBox.innerHTML = '<div class="overview-empty">Keine Zeiten in diesem Monat.</div>';
  } else {
    const maxDay = Math.max(...byDay.values());
    const days = [...byDay.entries()].sort((a, b) => b[0] - a[0]);
    dayBox.innerHTML = days.map(([day, ms]) => {
      const d = new Date(year, month, day);
      const label = `${WEEKDAYS[d.getDay()]} ${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.`;
      const pct = maxDay ? Math.round((ms / maxDay) * 100) : 0;
      return `<div class="day-row">
        <span class="d-label">${label}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
        <span class="row-val">${hoursDecimal(ms)}</span>
      </div>`;
    }).join('');
  }

  // Nach Projekt gruppieren
  const byProj = new Map();
  for (const e of inMonth) {
    const key = e.project_name || '— Ohne Projekt';
    const cur = byProj.get(key) || { ms: 0, color: e.project_color || '#94a3b8' };
    cur.ms += new Date(e.end_ts) - new Date(e.start_ts);
    byProj.set(key, cur);
  }
  const projBox = $('project-breakdown');
  if (!byProj.size) {
    projBox.innerHTML = '<div class="overview-empty">Keine Zeiten in diesem Monat.</div>';
  } else {
    const rows = [...byProj.entries()].sort((a, b) => b[1].ms - a[1].ms);
    projBox.innerHTML = rows.map(([name, { ms, color }]) => {
      const pct = totalMs ? Math.round((ms / totalMs) * 100) : 0;
      return `<div class="proj-row">
        <span class="p-label"><span class="proj-dot" style="background:${color}"></span>${escapeHtml(name)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${color}"></span></span>
        <span class="row-val">${hoursDecimal(ms)}</span>
      </div>`;
    }).join('');
  }
}

function shiftMonth(delta) {
  if (!state.view) return;
  let { year, month } = state.view;
  month += delta;
  if (month < 0) { month = 11; year--; }
  if (month > 11) { month = 0; year++; }
  state.view = { year, month };
  renderOverview();
}

function renderEntries() {
  const body = $('entries-body');
  const done = state.entries.filter((e) => e.end_ts);
  if (!done.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">Noch keine Zeiten erfasst. Stemple dich ein oder trage manuell ein.</td></tr>';
    return;
  }
  body.innerHTML = done.map((e) => {
    const dur = new Date(e.end_ts) - new Date(e.start_ts);
    const proj = e.project_name
      ? `<span class="proj-tag"><span class="proj-dot" style="background:${e.project_color}"></span>${escapeHtml(e.project_name)}</span>`
      : '<span style="color:var(--muted)">–</span>';
    return `<tr>
      <td>${fmtDate(e.start_ts)}</td>
      <td>${fmtTime(e.start_ts)}–${fmtTime(e.end_ts)}</td>
      <td>${proj}</td>
      <td>${escapeHtml(e.description) || '<span style="color:var(--muted)">–</span>'}</td>
      <td class="dur">${fmtDuration(dur)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" data-edit="${e.id}" title="Bearbeiten">✏️</button>
        <button class="icon-btn" data-del="${e.id}" title="Löschen">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

function renderStats() {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (now.getDay() + 6) % 7; // Montag = 0
  const startWeek = new Date(startToday); startWeek.setDate(startToday.getDate() - day);

  let today = 0, week = 0, total = 0;
  for (const e of state.entries) {
    if (!e.end_ts) continue;
    const s = new Date(e.start_ts), dur = new Date(e.end_ts) - s;
    total += dur;
    if (s >= startWeek) week += dur;
    if (s >= startToday) today += dur;
  }
  $('stat-today').textContent = hoursDecimal(today);
  $('stat-week').textContent = hoursDecimal(week);
  $('stat-total').textContent = hoursDecimal(total);
}

// ---------- Timer ----------
async function loadRunning() {
  const { entry } = await api.get('/api/entries/running');
  state.running = entry;
  renderTimer();
}

function renderTimer() {
  const startBtn = $('start-btn'), stopBtn = $('stop-btn');
  const meta = $('timer-meta'), disp = $('timer');
  clearInterval(state.tick);

  if (state.running) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    $('timer-project').value = state.running.project_id || '';
    $('timer-desc').value = state.running.description || '';
    $('timer-project').disabled = true;
    $('timer-desc').disabled = true;
    const started = new Date(state.running.start_ts);
    const update = () => { disp.textContent = fmtDuration(new Date() - started); };
    update();
    state.tick = setInterval(update, 1000);
    const projName = state.running.project_name ? ` · ${state.running.project_name}` : '';
    meta.textContent = `Läuft seit ${fmtTime(state.running.start_ts)}${projName}`;
  } else {
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    $('timer-project').disabled = false;
    $('timer-desc').disabled = false;
    disp.textContent = '00:00:00';
    meta.textContent = 'Bereit zum Einstempeln';
  }
}

// ---------- Events ----------
function bindEvents() {
  $('logout-btn').addEventListener('click', async () => {
    await api.post('/api/auth/logout');
    window.location.href = '/';
  });

  $('start-btn').addEventListener('click', async () => {
    try {
      await api.post('/api/entries/start', {
        project_id: $('timer-project').value || null,
        description: $('timer-desc').value,
      });
      await loadRunning();
      toast('Eingestempelt – Timer läuft');
    } catch (e) { toast(e.message, true); }
  });

  $('stop-btn').addEventListener('click', async () => {
    try {
      await api.post('/api/entries/stop');
      $('timer-desc').value = '';
      await Promise.all([loadRunning(), loadEntries()]);
      toast('Ausgestempelt & gespeichert');
    } catch (e) { toast(e.message, true); }
  });

  $('manual-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    try {
      await api.post('/api/entries', {
        project_id: f.project_id.value || null,
        description: f.description.value,
        start_ts: combineLocal(f.date.value, f.start.value),
        end_ts: combineLocal(f.date.value, f.end.value),
      });
      f.description.value = '';
      await loadEntries();
      toast('Eintrag hinzugefügt');
    } catch (e) { toast(e.message, true); }
  });

  $('project-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = $('project-name').value.trim();
    if (!name) return;
    try {
      await api.post('/api/projects', { name, color: $('project-color').value });
      $('project-name').value = '';
      await loadProjects();
      toast('Projekt angelegt');
    } catch (e) { toast(e.message, true); }
  });

  // Delegation: Einträge & Projekte
  document.addEventListener('click', async (ev) => {
    const editId = ev.target.closest('[data-edit]')?.dataset.edit;
    const delId = ev.target.closest('[data-del]')?.dataset.del;
    const delProj = ev.target.closest('[data-del-project]')?.dataset.delProject;

    if (editId) openEdit(editId);
    if (delId) {
      if (!confirm('Diesen Eintrag wirklich löschen?')) return;
      try { await api.del(`/api/entries/${delId}`); await loadEntries(); toast('Eintrag gelöscht'); }
      catch (e) { toast(e.message, true); }
    }
    if (delProj) {
      if (!confirm('Projekt löschen? Zugeordnete Zeiten bleiben erhalten.')) return;
      try { await api.del(`/api/projects/${delProj}`); await Promise.all([loadProjects(), loadEntries()]); toast('Projekt gelöscht'); }
      catch (e) { toast(e.message, true); }
    }
  });

  // Monats-Navigation der Übersicht
  $('month-prev').addEventListener('click', () => shiftMonth(-1));
  $('month-next').addEventListener('click', () => shiftMonth(1));

  // Edit-Modal
  $('edit-cancel').addEventListener('click', closeEdit);
  $('edit-modal').addEventListener('click', (e) => { if (e.target === $('edit-modal')) closeEdit(); });
  $('edit-form').addEventListener('submit', saveEdit);
}

function openEdit(id) {
  const e = state.entries.find((x) => String(x.id) === String(id));
  if (!e) return;
  const f = $('edit-form');
  f.id.value = e.id;
  f.description.value = e.description || '';
  $('edit-project').innerHTML = projectOptions(e.project_id);
  f.date.value = toDateInput(e.start_ts);
  f.start.value = toTimeInput(e.start_ts);
  f.end.value = e.end_ts ? toTimeInput(e.end_ts) : '';
  $('edit-msg').className = 'form-msg';
  $('edit-modal').classList.add('open');
}
function closeEdit() { $('edit-modal').classList.remove('open'); }

async function saveEdit(ev) {
  ev.preventDefault();
  const f = ev.target;
  try {
    await api.put(`/api/entries/${f.id.value}`, {
      project_id: f.project_id.value || null,
      description: f.description.value,
      start_ts: combineLocal(f.date.value, f.start.value),
      end_ts: combineLocal(f.date.value, f.end.value),
    });
    closeEdit();
    await loadEntries();
    toast('Änderungen gespeichert');
  } catch (e) {
    const m = $('edit-msg'); m.className = 'form-msg error'; m.textContent = e.message;
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

init();
