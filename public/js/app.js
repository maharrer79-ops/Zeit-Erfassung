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

let state = { entries: [], projects: [], running: null, pauseRunning: null, mobileRunning: null, tick: null, view: null, ovView: 'tag', todayPauseBaseMs: 0 };

// Merkt, ob mobiles Arbeiten nach der aktuellen Pause automatisch fortgesetzt werden soll
const RESUME_MOBILE_KEY = 'zeitwerk_resume_mobile';

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
function fmtPause(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')} min`;
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

  // Standard-Datum in den Formularen = heute
  const todayStr = toDateInput(new Date().toISOString());
  $('manual-form').date.value = todayStr;
  $('punch-date').value = todayStr;

  // Buchungsart-Auswahl fuellen (Standard: Kommen)
  fillKindSelect($('manual-kind'));
  if (window.initDateRange) initDateRange();
  updateManualMode();

  await Promise.all([loadProjects(), loadEntries(), loadRunning()]);
  bindEvents();
  showVersion();
}

function showVersion() {
  fetch('/api/version').then((r) => r.json()).then((d) => {
    const el = $('app-version');
    if (el && d.version) el.textContent = 'v' + d.version;
  }).catch(() => {});
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
  ['manual-project', 'edit-project'].forEach((id) => {
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

function sollForWeekday(wd) {
  const sollBase = parseFloat(localStorage.getItem('zeitwerk_soll') ?? '7.7') || 7.7;
  const sollFrStored = localStorage.getItem('zeitwerk_soll_fr');
  const sollFr = sollFrStored !== null ? (parseFloat(sollFrStored) || 0) : sollBase;
  if (wd === 0 || wd === 6) return 0;
  return wd === 5 ? sollFr : sollBase;
}
function saldoStat(label, hours) {
  const txt = (hours >= 0 ? '+' : '') + hours.toFixed(1).replace('.', ',') + ' h';
  const color = hours > 0.02 ? 'var(--success)' : (hours < -0.02 ? 'var(--danger)' : 'var(--primary)');
  return `<div class="mini-stat"><div class="n" style="color:${color}">${txt}</div><div class="l">${label}</div></div>`;
}
function stat(label, value) {
  return `<div class="mini-stat"><div class="n">${value}</div><div class="l">${label}</div></div>`;
}

function renderOverview() {
  if (!state.view) { const n = new Date(); state.view = { year: n.getFullYear(), month: n.getMonth() }; }
  if (!state.ovView) state.ovView = 'tag';
  const { year, month } = state.view;

  // Umschalter + Monats-Navigation je nach Ansicht
  document.querySelectorAll('#ov-toggle button').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === state.ovView));
  const monatView = state.ovView === 'monat';
  $('month-prev').style.display = monatView ? '' : 'none';
  $('month-next').style.display = monatView ? '' : 'none';

  const box = $('mini-stats');
  const blocks = computeBlocks(state.entries);
  const pauses = computePauses(state.entries);
  const fmtDay = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;

  // Pro-Tag getrennt: echte Arbeit vs. Abwesenheit (Urlaub/Gleittag).
  // Abwesenheit erfuellt das Soll, erzeugt aber keine Plus-Stunden.
  const dNum = (d) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
  const workedByDay = new Map(), absenceByDay = new Map();
  for (const b of blocks) {
    const key = dNum(b.start);
    const map = window.isAbsenceBlock(b) ? absenceByDay : workedByDay;
    map.set(key, (map.get(key) || 0) + (b.end - b.start));
  }
  const nowNum = dNum(new Date());
  const workedMsOn = (d) => workedByDay.get(dNum(d)) || 0;
  // Saldo eines Tages: Arbeit + min(Abwesenheit, Soll) - Soll
  const daySaldoH = (d) => {
    const wd = d.getDay();
    const isWeekend = wd === 0 || wd === 6;
    const workedH = (workedByDay.get(dNum(d)) || 0) / 3_600_000;
    const absenceH = (absenceByDay.get(dNum(d)) || 0) / 3_600_000;
    const hasBooking = (workedByDay.get(dNum(d)) || 0) + (absenceByDay.get(dNum(d)) || 0) > 0;
    const soll = (!isWeekend && (dNum(d) <= nowNum || hasBooking)) ? sollForWeekday(wd) : 0;
    return workedH + Math.min(absenceH, soll) - soll;
  };

  if (state.ovView === 'woche') {
    // ---------- Wochenansicht (aktuelle Woche Mo–So) ----------
    const nowD = new Date();
    const dow = (nowD.getDay() + 6) % 7; // Montag = 0
    const weekStart = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() - dow);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7); // exklusiv
    const inWeek = (d) => d >= weekStart && d < weekEnd;
    // Nur echte Arbeit zaehlt als "gearbeitet" (Abwesenheit ausgenommen)
    const weekWorked = blocks.filter((b) => inWeek(b.start) && !window.isAbsenceBlock(b));
    const totalMs = weekWorked.reduce((s, b) => s + (b.end - b.start), 0);
    const pauseMs = pauses.filter((p) => inWeek(p.start)).reduce((s, p) => s + (p.end - p.start), 0);
    const workDays = new Set(weekWorked.map((b) => b.start.getDate())).size;

    let saldoH = 0;
    for (let i = 0; i < 7; i++) {
      const dt = new Date(weekStart); dt.setDate(weekStart.getDate() + i);
      saldoH += daySaldoH(dt);
    }

    const lastDay = new Date(weekEnd); lastDay.setDate(weekEnd.getDate() - 1);
    $('month-label').textContent = `${fmtDay(weekStart)}–${fmtDay(lastDay)}`;
    box.innerHTML = stat('Gesamt', hoursDecimal(totalMs))
      + stat('Arbeitstage', String(workDays))
      + stat('Pause', fmtPause(pauseMs))
      + saldoStat('Saldo', saldoH);
  } else if (!monatView) {
    // ---------- Tagesansicht (heute) ----------
    const nowD = new Date();
    const isToday = (d) => d.getFullYear() === nowD.getFullYear()
      && d.getMonth() === nowD.getMonth() && d.getDate() === nowD.getDate();
    const todayMs = workedMsOn(nowD); // nur echte Arbeit (Abwesenheit ausgenommen)
    const pauseMs = pauses.filter((p) => isToday(p.start)).reduce((s, p) => s + (p.end - p.start), 0);
    const saldoH = daySaldoH(nowD);

    state.todayPauseBaseMs = pauseMs;
    $('month-label').textContent = nowD.toLocaleDateString('de-DE',
      { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    box.innerHTML = stat('Gearbeitet', hoursDecimal(todayMs))
      + `<div class="mini-stat"><div class="n" id="ov-pause">${fmtPause(pauseMs)}</div><div class="l">Pause</div></div>`
      + saldoStat('Saldo', saldoH);
    updatePauseKachel();
  } else {
    // ---------- Monatsansicht ----------
    const inMonth = (d) => d.getFullYear() === year && d.getMonth() === month;
    // Nur echte Arbeit zaehlt als "gearbeitet" (Abwesenheit ausgenommen)
    const monthWorked = blocks.filter((b) => inMonth(b.start) && !window.isAbsenceBlock(b));
    const totalMs = monthWorked.reduce((s, b) => s + (b.end - b.start), 0);
    const pauseMs = pauses.filter((p) => inMonth(p.start)).reduce((s, p) => s + (p.end - p.start), 0);
    const workDays = new Set(monthWorked.map((b) => b.start.getDate())).size;

    // Saldo pro Tag summieren (Abwesenheit erfuellt Soll, kein Plus)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let saldoH = 0;
    for (let d = 1; d <= daysInMonth; d++) saldoH += daySaldoH(new Date(year, month, d));

    $('month-label').textContent = `${MONTHS[month]} ${year}`;
    box.innerHTML = stat('Gesamt', hoursDecimal(totalMs))
      + stat('Arbeitstage', String(workDays))
      + stat('Pause', fmtPause(pauseMs))
      + saldoStat('Saldo', saldoH);
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
  const rows = state.entries.filter((e) => e.entry_type === 'punch' || e.entry_type === 'pause' || e.entry_type === 'mobile' || e.end_ts);
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">Noch keine Zeiten erfasst. Stemple dich ein oder trage manuell ein.</td></tr>';
    return;
  }
  const muted = '<span style="color:var(--muted)">–</span>';
  const dayKey = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const dayLabel = (iso) => new Date(iso).toLocaleDateString('de-DE',
    { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  // Tagessummen: gearbeitete Zeit und Pause je Tag
  const keyOf = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const workedByDay = new Map();
  for (const b of computeBlocks(state.entries)) {
    workedByDay.set(keyOf(b.start), (workedByDay.get(keyOf(b.start)) || 0) + (b.end - b.start));
  }
  const pauseByDay = new Map();
  for (const p of computePauses(state.entries)) {
    pauseByDay.set(keyOf(p.start), (pauseByDay.get(keyOf(p.start)) || 0) + (p.end - p.start));
  }

  let lastDay = null;
  const html = [];
  for (const e of rows) {
    const k = dayKey(e.start_ts);
    if (k !== lastDay) {
      const worked = workedByDay.get(k) || 0;
      const pause = pauseByDay.get(k) || 0;
      const totals = `<span class="day-sep-totals">${hoursDecimal(worked)}${pause > 0 ? ` · Pause ${fmtPause(pause)}` : ''}</span>`;
      html.push(`<tr class="day-sep"><td colspan="7"><div class="day-sep-row"><span>${dayLabel(e.start_ts)}</span>${totals}</div></td></tr>`);
      lastDay = k;
    }
    html.push(renderEntryRow(e, muted));
  }
  body.innerHTML = html.join('');
}

function renderEntryRow(e, muted) {
  {
    // Pause: eigene Zeile mit Dauer
    if (e.entry_type === 'pause') {
      // Laufende Pause (noch kein Ende) -> "läuft"
      if (!e.end_ts) {
        return `<tr>
          <td>${fmtDate(e.start_ts)}</td>
          <td>${fmtTime(e.start_ts)} – läuft…</td>
          <td><span class="badge pause">⏸ Pause</span></td>
          <td>${muted}</td>
          <td>${escapeHtml(e.description) || muted}</td>
          <td class="dur" style="color:var(--muted)">läuft…</td>
          <td><div class="row-actions">
            <button class="icon-btn" data-del="${e.id}" title="Abbrechen">🗑️</button>
          </div></td>
        </tr>`;
      }
      const dur = new Date(e.end_ts) - new Date(e.start_ts);
      return `<tr>
        <td>${fmtDate(e.start_ts)}</td>
        <td>${fmtTime(e.start_ts)}–${fmtTime(e.end_ts)}</td>
        <td><span class="badge pause">⏸ Pause</span></td>
        <td>${muted}</td>
        <td>${escapeHtml(e.description) || muted}</td>
        <td class="dur">${fmtDuration(dur)}</td>
        <td><div class="row-actions">
          <button class="icon-btn" data-edit="${e.id}" title="Bearbeiten">✏️</button>
          <button class="icon-btn" data-del="${e.id}" title="Löschen">🗑️</button>
        </div></td>
      </tr>`;
    }
    // Laufendes mobiles Arbeiten (noch kein Ende) -> "läuft"
    if (e.entry_type === 'mobile' && !e.end_ts) {
      return `<tr>
        <td>${fmtDate(e.start_ts)}</td>
        <td>${fmtTime(e.start_ts)} – läuft…</td>
        <td>${kindBadge('0406', 'mobiles Arbeiten')}</td>
        <td>${muted}</td>
        <td>${escapeHtml(e.description) || muted}</td>
        <td class="dur" style="color:var(--muted)">läuft…</td>
        <td><div class="row-actions">
          <button class="icon-btn" data-del="${e.id}" title="Abbrechen">🗑️</button>
        </div></td>
      </tr>`;
    }
    // Kommen/Gehen-Stempel: eigene Zeile, keine Dauer
    if (e.entry_type === 'punch') {
      const badge = e.punch_dir === 'kommen'
        ? '<span class="badge kommen">▶ Kommen</span>'
        : '<span class="badge gehen">■ Gehen</span>';
      return `<tr>
        <td>${fmtDate(e.start_ts)}</td>
        <td>${fmtTime(e.start_ts)}</td>
        <td>${badge}</td>
        <td>${muted}</td>
        <td>${escapeHtml(e.description) || muted}</td>
        <td class="dur">${muted}</td>
        <td><div class="row-actions">
          <button class="icon-btn" data-edit="${e.id}" title="Bearbeiten">✏️</button>
          <button class="icon-btn" data-del="${e.id}" title="Löschen">🗑️</button>
        </div></td>
      </tr>`;
    }
    const dur = new Date(e.end_ts) - new Date(e.start_ts);
    const proj = e.project_name
      ? `<span class="proj-tag"><span class="proj-dot" style="background:${e.project_color}"></span>${escapeHtml(e.project_name)}</span>`
      : muted;
    return `<tr>
      <td>${fmtDate(e.start_ts)}</td>
      <td>${fmtTime(e.start_ts)}–${fmtTime(e.end_ts)}</td>
      <td>${kindBadge(e.kind_code, escapeHtml(e.kind_label || ''))}</td>
      <td>${proj}</td>
      <td>${escapeHtml(e.description) || muted}</td>
      <td class="dur">${fmtDuration(dur)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" data-edit="${e.id}" title="Bearbeiten">✏️</button>
        <button class="icon-btn" data-del="${e.id}" title="Löschen">🗑️</button>
      </div></td>
    </tr>`;
  }
}

function renderStats() {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (now.getDay() + 6) % 7; // Montag = 0
  const startWeek = new Date(startToday); startWeek.setDate(startToday.getDate() - day);

  let today = 0, week = 0, total = 0;
  for (const b of computeBlocks(state.entries)) {
    const dur = b.end - b.start;
    total += dur;
    if (b.start >= startWeek) week += dur;
    if (b.start >= startToday) today += dur;
  }
  $('stat-today').textContent = hoursDecimal(today);
  $('stat-week').textContent = hoursDecimal(week);
  $('stat-total').textContent = hoursDecimal(total);
}

// ---------- Timer ----------
async function loadRunning() {
  const { entry, pause, mobile } = await api.get('/api/entries/running');
  state.running = entry;
  state.pauseRunning = pause || null;
  state.mobileRunning = mobile || null;
  renderTimer();
}

function renderTimer() {
  const startBtn = $('start-btn'), stopBtn = $('stop-btn');
  const meta = $('timer-meta'), disp = $('timer');
  const pauseToggle = $('pause-toggle');
  const mobileToggle = $('mobile-toggle');
  clearInterval(state.tick);

  const inPause = !!state.pauseRunning;
  const inMobile = !!state.mobileRunning;
  const present = !!state.running;

  // Umschalt-Button fuer Pause
  if (pauseToggle) {
    pauseToggle.textContent = inPause ? '▶ Pause beenden' : '⏸ Pause starten';
    pauseToggle.classList.toggle('running', inPause);
  }
  // Umschalt-Button fuer mobiles Arbeiten (nur wenn nicht anwesend)
  if (mobileToggle) {
    mobileToggle.textContent = inMobile ? '■ mobiles Arbeiten – Gehen' : '🏠 mobiles Arbeiten – Kommen';
    mobileToggle.classList.toggle('running', inMobile);
    mobileToggle.style.display = present ? 'none' : '';
  }

  // Kommen nur wenn frei; Gehen nur wenn anwesend
  startBtn.style.display = (present || inMobile) ? 'none' : 'block';
  stopBtn.style.display = present ? 'block' : 'none';

  const tick = () => {
    if (inMobile) {
      disp.textContent = fmtDuration(new Date() - new Date(state.mobileRunning.start_ts));
    } else if (inPause) {
      disp.textContent = fmtDuration(new Date() - new Date(state.pauseRunning.start_ts));
    } else if (present) {
      disp.textContent = fmtDuration(new Date() - new Date(state.running.start_ts));
    } else {
      disp.textContent = '00:00:00';
    }
    updatePauseKachel();
  };

  if (inMobile) meta.textContent = `🏠 mobiles Arbeiten seit ${fmtTime(state.mobileRunning.start_ts)}`;
  else if (inPause) meta.textContent = `⏸ In Pause seit ${fmtTime(state.pauseRunning.start_ts)}`;
  else if (present) meta.textContent = `Anwesend seit ${fmtTime(state.running.start_ts)}`;
  else meta.textContent = 'Bereit zum Einstempeln';

  tick();
  if (inMobile || inPause || present) state.tick = setInterval(tick, 1000);
}

// Live-Aktualisierung der Pause-Kachel (Basis + laufende Pause bis jetzt)
function updatePauseKachel() {
  const el = $('ov-pause');
  if (!el || state.ovView !== 'tag') return;
  let ms = state.todayPauseBaseMs || 0;
  if (state.pauseRunning) {
    const s = new Date(state.pauseRunning.start_ts);
    const now = new Date();
    if (s.getFullYear() === now.getFullYear() && s.getMonth() === now.getMonth() && s.getDate() === now.getDate()) {
      ms += now - s;
    }
  }
  el.textContent = fmtPause(ms);
}

// ---------- Events ----------
function bindEvents() {
  $('logout-btn').addEventListener('click', async () => {
    await api.post('/api/auth/logout');
    window.location.href = '/';
  });

  $('refresh-btn').addEventListener('click', () => {
    // Echtes Neuladen der Seite (holt auch aktualisierten Code frisch)
    window.location.reload();
  });

  $('delete-account-btn').addEventListener('click', async () => {
    if (!confirm('Konto wirklich löschen?\n\nAlle deine Zeiten und Projekte werden dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.')) return;
    if (!confirm('Bist du ganz sicher? Dieser Schritt ist endgültig.')) return;
    try {
      await api.del('/api/auth/account');
      window.location.href = '/';
    } catch (e) { toast(e.message, true); }
  });

  $('start-btn').addEventListener('click', async () => {
    try {
      localStorage.removeItem(RESUME_MOBILE_KEY);
      await api.post('/api/entries/start');
      await Promise.all([loadRunning(), loadEntries()]);
      toast('Kommen gestempelt');
    } catch (e) { toast(e.message, true); }
  });

  $('stop-btn').addEventListener('click', async () => {
    try {
      // Laufende Pause beim Gehen beenden (Pausenende setzen)
      if (state.pauseRunning) await api.post('/api/entries/pause/stop');
      await api.post('/api/entries/stop');
      await Promise.all([loadRunning(), loadEntries()]);
      toast('Gehen gestempelt');
    } catch (e) { toast(e.message, true); }
  });

  // Stempel nachtragen (Kommen/Gehen zu einem gewaehlten Zeitpunkt)
  const addPunch = async (dir) => {
    const date = $('punch-date').value;
    const time = $('punch-time').value;
    if (!date || !time) { toast('Bitte Datum und Uhrzeit angeben', true); return; }
    try {
      await api.post('/api/entries/punch', { dir, ts: combineLocal(date, time) });
      await Promise.all([loadRunning(), loadEntries()]);
      toast(dir === 'kommen' ? 'Kommen nachgetragen' : 'Gehen nachgetragen');
    } catch (e) { toast(e.message, true); }
  };
  $('punch-kommen').addEventListener('click', () => addPunch('kommen'));
  $('punch-gehen').addEventListener('click', () => addPunch('gehen'));

  // Pause nachtragen (Beginn/Ende einzeln zu einem gewaehlten Zeitpunkt)
  const addPausePunch = async (which) => {
    const date = $('punch-date').value;
    const time = $('punch-time').value;
    if (!date || !time) { toast('Bitte Datum und Uhrzeit angeben', true); return; }
    const ts = combineLocal(date, time);
    try {
      await api.post(which === 'start' ? '/api/entries/pause/start' : '/api/entries/pause/stop', { ts });
      await Promise.all([loadRunning(), loadEntries()]);
      toast(which === 'start' ? 'Pausenbeginn nachgetragen' : 'Pausenende nachgetragen');
    } catch (e) { toast(e.message, true); }
  };
  $('punch-pause-start').addEventListener('click', () => addPausePunch('start'));
  $('punch-pause-ende').addEventListener('click', () => addPausePunch('ende'));

  // Mobiles Arbeiten nachtragen (Beginn/Ende einzeln zu einem gewaehlten Zeitpunkt)
  const addMobilePunch = async (which) => {
    const date = $('punch-date').value;
    const time = $('punch-time').value;
    if (!date || !time) { toast('Bitte Datum und Uhrzeit angeben', true); return; }
    const ts = combineLocal(date, time);
    try {
      await api.post(which === 'start' ? '/api/entries/mobile/start' : '/api/entries/mobile/stop', { ts });
      await Promise.all([loadRunning(), loadEntries()]);
      toast(which === 'start' ? 'Mobiles Arbeiten – Beginn nachgetragen' : 'Mobiles Arbeiten – Ende nachgetragen');
    } catch (e) { toast(e.message, true); }
  };
  $('punch-mobile-start').addEventListener('click', () => addMobilePunch('start'));
  $('punch-mobile-ende').addEventListener('click', () => addMobilePunch('ende'));

  // Pause: ein Umschalt-Button (Start/Stop) -> ergibt eine Pause-Buchung.
  // Laufendes mobiles Arbeiten wird dabei automatisch beendet (mobiles Arbeiten – Gehen).
  $('pause-toggle').addEventListener('click', async () => {
    const wasRunning = !!state.pauseRunning;
    try {
      if (!wasRunning) {
        // Pause starten. Lief mobiles Arbeiten? Dann fragen, ob es danach fortgesetzt werden soll.
        const hadMobile = !!state.mobileRunning;
        const resume = hadMobile && confirm('Möchtest du das mobile Arbeiten nach der Pause automatisch wieder starten?');
        localStorage.setItem(RESUME_MOBILE_KEY, resume ? '1' : '');
        await api.post('/api/entries/pause/start'); // beendet ein laufendes mobiles Arbeiten serverseitig
        await Promise.all([loadRunning(), loadEntries()]);
        toast(hadMobile
          ? (resume ? 'Pause gestartet · mobiles Arbeiten wird danach fortgesetzt' : 'Mobiles Arbeiten beendet · Pause gestartet')
          : 'Pause gestartet');
      } else {
        // Pause beenden – ggf. mobiles Arbeiten automatisch fortsetzen
        await api.post('/api/entries/pause/stop');
        const resume = localStorage.getItem(RESUME_MOBILE_KEY) === '1';
        localStorage.removeItem(RESUME_MOBILE_KEY);
        if (resume) await api.post('/api/entries/mobile/start');
        await Promise.all([loadRunning(), loadEntries()]);
        toast(resume ? 'Pause beendet · mobiles Arbeiten fortgesetzt' : 'Pause beendet');
      }
    } catch (e) { toast(e.message, true); }
  });

  // Mobiles Arbeiten: ein Umschalt-Button (Kommen/Gehen) -> ergibt EINEN Eintrag (Buchungsart 0406)
  $('mobile-toggle').addEventListener('click', async () => {
    const wasRunning = !!state.mobileRunning;
    try {
      localStorage.removeItem(RESUME_MOBILE_KEY); // manuelles Stempeln hebt eine geplante Auto-Fortsetzung auf
      // Laufende Pause beim Beenden des mobilen Arbeitens sauber schliessen
      if (wasRunning && state.pauseRunning) await api.post('/api/entries/pause/stop');
      await api.post(wasRunning ? '/api/entries/mobile/stop' : '/api/entries/mobile/start');
      await Promise.all([loadRunning(), loadEntries()]);
      toast(wasRunning ? 'Mobiles Arbeiten beendet' : 'Mobiles Arbeiten gestartet');
    } catch (e) { toast(e.message, true); }
  });

  $('manual-kind').addEventListener('change', updateManualMode);

  $('manual-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const t = kindMeta(f.kind_code.value);
    const dir = PUNCH_DIR_BY_CODE[f.kind_code.value];
    try {
      if (t.pause) {
        // Pause -> Gehen (Beginn) + Kommen (Ende); Pause zaehlt nicht als Arbeitszeit
        await api.post('/api/entries/pause', {
          start_ts: combineLocal(f.date.value, f.start.value),
          end_ts: combineLocal(f.date.value, f.end.value),
          description: f.description.value,
        });
        f.description.value = '';
        f.start.value = '';
        f.end.value = '';
        f.start.focus();
        await Promise.all([loadRunning(), loadEntries()]);
        toast('Pause eingetragen');
      } else if (t.pair) {
        // Kommen + Gehen als Zeitraum -> zwei getrennte Positionen
        await api.post('/api/entries/session', {
          start_ts: combineLocal(f.date.value, f.start.value),
          end_ts: combineLocal(f.date.value, f.end.value),
          description: f.description.value,
        });
        f.description.value = '';
        f.start.value = '';
        f.end.value = '';
        f.start.focus();
        await Promise.all([loadRunning(), loadEntries()]);
        toast('Kommen + Gehen hinzugefügt');
      } else if (dir) {
        // Kommen/Gehen: einzelner Stempel zum Zeitpunkt "Von"
        await api.post('/api/entries/punch', {
          dir,
          ts: combineLocal(f.date.value, f.start.value),
          description: f.description.value,
        });
        f.description.value = '';
        f.start.value = '';
        f.start.focus();
        await Promise.all([loadRunning(), loadEntries()]);
        toast(dir === 'kommen' ? 'Kommen gestempelt' : 'Gehen gestempelt');
      } else if (!t.range) {
        // Zeitgebundene Buchungsart (z.B. mobiles Arbeiten) -> Von–Bis an einem Tag
        await api.post('/api/entries', {
          project_id: f.project_id.value || null,
          description: f.description.value,
          kind_code: f.kind_code.value,
          start_ts: combineLocal(f.date.value, f.start.value),
          end_ts: combineLocal(f.date.value, f.end.value),
        });
        f.description.value = '';
        f.start.value = '';
        f.end.value = '';
        f.start.focus();
        await loadEntries();
        toast('Eintrag hinzugefügt');
      } else {
        // Absenz (Urlaub etc.) ueber einen Datumsbereich -> ein Eintrag pro Tag
        const startDate = f.date.value;
        const endDate = $('manual-enddate').value || startDate;
        const hours = Math.max(0.25, parseFloat($('manual-hours').value) || 8);
        const weekdaysOnly = $('manual-weekdays').checked;
        const cur = new Date(startDate + 'T00:00:00');
        const last = new Date(endDate + 'T00:00:00');
        if (Number.isNaN(cur.getTime()) || Number.isNaN(last.getTime())) { toast('Bitte gültige Daten wählen', true); return; }
        if (last < cur) { toast('Das Bis-Datum muss nach dem Von-Datum liegen', true); return; }

        const { start: st, end: et } = hoursToTimeRange(hours);
        const days = [];
        const c = new Date(cur);
        while (c <= last) {
          const wd = c.getDay();
          if (!weekdaysOnly || (wd !== 0 && wd !== 6)) {
            const ds = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`;
            days.push({ start_ts: combineLocal(ds, st), end_ts: combineLocal(ds, et) });
          }
          c.setDate(c.getDate() + 1);
        }
        if (!days.length) { toast('Keine Tage im Zeitraum (nur Werktage aktiv?)', true); return; }

        await api.post('/api/entries/absence', {
          kind_code: f.kind_code.value,
          description: f.description.value,
          project_id: f.project_id.value || null,
          days,
        });
        f.description.value = '';
        await loadEntries();
        toast(`${days.length} Tag(e) eingetragen`);
      }
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

  // Umschalter Tag / Monat
  $('ov-toggle').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-view]');
    if (!btn) return;
    state.ovView = btn.dataset.view;
    renderOverview();
  });

  // Edit-Modal
  $('edit-cancel').addEventListener('click', closeEdit);
  $('edit-modal').addEventListener('click', (e) => { if (e.target === $('edit-modal')) closeEdit(); });
  $('edit-form').addEventListener('submit', saveEdit);
}

// Formular-Modus je nach Buchungsart:
//  - Zeitpunkt (Kommen/Gehen einzeln): nur "Von"
//  - Zeitraum (Kommen + Gehen) und Intervall-Buchungen: "Von" und "Bis"
function kindMeta(code) {
  return (window.BOOKING_TYPES || []).find((t) => t.code === code) || {};
}
function updateManualMode() {
  const f = $('manual-form');
  const code = $('manual-kind').value;
  const t = kindMeta(code);
  const isPunch = !!t.punch;
  const isPause = !!t.pause;
  const isPair = !!t.pair;
  const isRange = !!t.range; // mehrtägige Absenz (Urlaub etc.) mit Datumsbereich
  const show = (id, on) => { $(id).style.display = on ? '' : 'none'; };

  // Uhrzeit-Felder (bei allem ausser Datumsbereich)
  show('manual-von-field', !isRange);
  show('manual-bis-field', !isRange && !isPunch);
  f.start.required = !isRange;
  f.end.required = !isRange && !isPunch;

  // Datumsbereich (ein Kalender) nur bei mehrtägiger Absenz
  show('manual-date-field', !isRange);      // einzelnes Datum nur ausserhalb Absenz
  show('manual-enddate-field', false);      // Ende steckt im Bereich-Picker (verstecktes Feld)
  show('daterange-field', isRange);
  show('manual-hours-field', isRange);
  show('manual-weekdays-field', isRange);
  if (isRange) {
    if (!$('manual-enddate').value) $('manual-enddate').value = f.date.value;
    if (window.dateRangeSync) window.dateRangeSync();
  }

  $('manual-submit').textContent = isPunch
    ? (code === 'kommen' ? '▶ Kommen stempeln' : '■ Gehen stempeln')
    : isPause ? '⏸ Pause eintragen'
      : isPair ? '＋ Kommen + Gehen hinzufügen'
        : isRange ? 'Zeitraum hinzufügen'
          : 'Eintrag hinzufügen';
}

// Aus "Stunden pro Tag" einen Von-/Bis-Zeitbereich ab 08:00 machen
function hoursToTimeRange(hours) {
  const startMin = 8 * 60;
  let endMin = startMin + Math.round(hours * 60);
  if (endMin > 24 * 60 - 1) endMin = 24 * 60 - 1;
  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
  return { start: '08:00:00', end: fmt(endMin) };
}

function openEdit(id) {
  const e = state.entries.find((x) => String(x.id) === String(id));
  if (!e) return;
  const f = $('edit-form');
  const isPunch = e.entry_type === 'punch';
  const isPause = e.entry_type === 'pause';
  const show = (elId, on) => { $(elId).style.display = on ? '' : 'none'; };

  f.id.value = e.id;
  f.dataset.type = e.entry_type;
  f.description.value = e.description || '';
  f.date.value = toDateInput(e.start_ts);
  f.start.value = toTimeInput(e.start_ts);

  // Stempel: Zeitpunkt+Richtung; Pause: nur Zeitraum+Beschreibung; Intervall: Buchungsart/Projekt/Bis
  show('edit-punchdir-field', isPunch);
  show('edit-kind-field', !isPunch && !isPause);
  show('edit-project-field', !isPunch && !isPause);
  show('edit-bis-field', !isPunch);
  f.end.required = !isPunch;

  if (isPunch) {
    $('edit-punch-dir').value = e.punch_dir || 'kommen';
  } else {
    f.end.value = e.end_ts ? toTimeInput(e.end_ts) : '';
    if (!isPause) {
      fillKindSelect($('edit-kind'), e.kind_code, { excludePunch: true, currentLabel: e.kind_label });
      $('edit-project').innerHTML = projectOptions(e.project_id);
    }
  }
  $('edit-msg').className = 'form-msg';
  $('edit-modal').classList.add('open');
}
function closeEdit() { $('edit-modal').classList.remove('open'); }

async function saveEdit(ev) {
  ev.preventDefault();
  const f = ev.target;
  try {
    let body;
    if (f.dataset.type === 'punch') {
      body = {
        punch_dir: f.punch_dir.value,
        description: f.description.value,
        start_ts: combineLocal(f.date.value, f.start.value),
      };
    } else if (f.dataset.type === 'pause') {
      body = {
        description: f.description.value,
        start_ts: combineLocal(f.date.value, f.start.value),
        end_ts: combineLocal(f.date.value, f.end.value),
      };
    } else {
      body = {
        project_id: f.project_id.value || null,
        description: f.description.value,
        kind_code: f.kind_code.value,
        start_ts: combineLocal(f.date.value, f.start.value),
        end_ts: combineLocal(f.date.value, f.end.value),
      };
    }
    await api.put(`/api/entries/${f.id.value}`, body);
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
