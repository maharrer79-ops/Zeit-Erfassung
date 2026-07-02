// ZeitWerk – Monatsblatt
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const SOLL_KEY = 'zeitwerk_soll';

const $ = (id) => document.getElementById(id);
let state = { entries: [], view: null, soll: 8, user: null };

async function getJSON(path) {
  const res = await fetch(path);
  if (res.status === 401) { window.location.href = '/'; throw new Error('unauth'); }
  if (!res.ok) throw new Error('Fehler beim Laden');
  return res.json();
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
function fmtNum(h) { return h.toFixed(2).replace('.', ','); }
function fmtSaldo(h) {
  const s = h.toFixed(2).replace('.', ',');
  return h > 0 ? '+' + s : s; // negatives Vorzeichen ist schon dabei
}

async function init() {
  try {
    const me = await getJSON('/api/auth/me');
    state.user = me.user;
  } catch { return; }

  state.soll = parseFloat(localStorage.getItem(SOLL_KEY) ?? '8') || 8;
  $('soll-input').value = state.soll;

  // Monat aus URL (?m=YYYY-MM) oder aktueller Monat
  const p = new URLSearchParams(location.search).get('m');
  const m = p && /^\d{4}-\d{2}$/.test(p) ? p.split('-') : null;
  const now = new Date();
  state.view = m
    ? { year: +m[0], month: +m[1] - 1 }
    : { year: now.getFullYear(), month: now.getMonth() };

  const data = await getJSON('/api/entries');
  state.entries = data.entries.filter((e) => e.end_ts);

  bindEvents();
  render();
}

function bindEvents() {
  $('logout-btn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  });
  $('month-prev').addEventListener('click', () => shiftMonth(-1));
  $('month-next').addEventListener('click', () => shiftMonth(1));
  $('print-btn').addEventListener('click', () => window.print());
  $('soll-input').addEventListener('change', (e) => {
    state.soll = Math.max(0, parseFloat(e.target.value) || 0);
    localStorage.setItem(SOLL_KEY, String(state.soll));
    render();
  });
}

function shiftMonth(delta) {
  let { year, month } = state.view;
  month += delta;
  if (month < 0) { month = 11; year--; }
  if (month > 11) { month = 0; year++; }
  state.view = { year, month };
  updateUrl();
  render();
}
function updateUrl() {
  const { year, month } = state.view;
  const m = `${year}-${String(month + 1).padStart(2, '0')}`;
  history.replaceState(null, '', `?m=${m}`);
}

function render() {
  const { year, month } = state.view;
  $('month-label').textContent = `${MONTHS[month]} ${year}`;
  $('sheet-title').textContent = `Monatsübersicht – ${MONTHS[month]} ${year}`;
  $('sheet-sub').textContent = state.user ? `${state.user.name} · ${state.user.email}` : '';

  // Einträge des Monats nach Tag gruppieren
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = new Map();
  for (const e of state.entries) {
    const s = new Date(e.start_ts);
    if (s.getFullYear() === year && s.getMonth() === month) {
      const d = s.getDate();
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(e);
    }
  }

  // "Heute" auf Tagesgenauigkeit – Soll zählt nur bis heute (kein negatives Saldo für Zukunft)
  const now = new Date();
  const todayNum = now.getFullYear() * 10000 + now.getMonth() * 100 + now.getDate();

  const rows = [];
  let sumIst = 0, sumSoll = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const wd = date.getDay();
    const isWeekend = wd === 0 || wd === 6;
    const dayNum = year * 10000 + month * 100 + d;
    const entries = (byDay.get(d) || []).sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts));

    // Ist-Stunden des Tages
    const istMs = entries.reduce((sum, e) => sum + (new Date(e.end_ts) - new Date(e.start_ts)), 0);
    const ist = istMs / 3_600_000;

    // Soll nur an Werktagen und nur bis einschließlich heute
    const soll = (!isWeekend && dayNum <= todayNum) ? state.soll : 0;
    const saldo = ist - soll;

    sumIst += ist;
    sumSoll += soll;

    const von = entries.length ? fmtTime(entries[0].start_ts) : '';
    const bis = entries.length ? fmtTime(entries[entries.length - 1].end_ts) : '';
    const desc = entries.length
      ? [...new Set(entries.map((e) => e.description || e.kind_label || e.project_name).filter(Boolean))].join(', ')
      : (isWeekend ? 'Wochenende' : (soll ? '—' : ''));

    const cls = [isWeekend ? 'weekend' : '', dayNum === todayNum ? 'today' : ''].filter(Boolean).join(' ');
    const saldoCls = saldo > 0.004 ? 'pos' : (saldo < -0.004 ? 'neg' : '');

    rows.push(`<tr class="${cls}">
      <td class="c-date">${String(d).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.</td>
      <td class="c-day">${WD[wd]}</td>
      <td class="c-desc">${escapeHtml(desc)}</td>
      <td class="c-time">${von}</td>
      <td class="c-time">${bis}</td>
      <td class="c-num">${ist > 0 ? fmtNum(ist) : ''}</td>
      <td class="c-num">${soll > 0 ? fmtNum(soll) : ''}</td>
      <td class="c-num ${saldoCls}">${(ist > 0 || soll > 0) ? fmtSaldo(saldo) : ''}</td>
    </tr>`);
  }

  $('sheet-body').innerHTML = rows.join('');
  $('sum-ist').textContent = fmtNum(sumIst);
  $('sum-soll').textContent = fmtNum(sumSoll);
  const sumSaldo = sumIst - sumSoll;
  const el = $('sum-saldo');
  el.textContent = fmtSaldo(sumSaldo);
  el.className = 'c-num ' + (sumSaldo > 0.004 ? 'pos' : (sumSaldo < -0.004 ? 'neg' : ''));

  // CSV-Link bleibt gesamter Export
  $('csv-btn').href = '/api/entries/export.csv';
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

init();
