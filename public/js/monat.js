// ZeitWerk – Monatsblatt
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const SOLL_KEY = 'zeitwerk_soll';
const SOLL_FR_KEY = 'zeitwerk_soll_fr';

const $ = (id) => document.getElementById(id);
let state = { entries: [], view: null, soll: 8, sollFriday: 8, user: null };

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
function fmtPause(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')} min`;
}
function fmtSaldo(h) {
  const s = h.toFixed(2).replace('.', ',');
  return h > 0 ? '+' + s : s; // negatives Vorzeichen ist schon dabei
}

async function init() {
  try {
    const me = await getJSON('/api/auth/me');
    state.user = me.user;
  } catch { return; }

  state.soll = parseFloat(localStorage.getItem(SOLL_KEY) ?? '7.7') || 7.7;
  const frStored = localStorage.getItem(SOLL_FR_KEY);
  state.sollFriday = frStored !== null ? (parseFloat(frStored) || 0) : state.soll;
  $('soll-input').value = state.soll;
  $('soll-fr-input').value = state.sollFriday;

  // Monat aus URL (?m=YYYY-MM) oder aktueller Monat
  const p = new URLSearchParams(location.search).get('m');
  const m = p && /^\d{4}-\d{2}$/.test(p) ? p.split('-') : null;
  const now = new Date();
  state.view = m
    ? { year: +m[0], month: +m[1] - 1 }
    : { year: now.getFullYear(), month: now.getMonth() };

  const data = await getJSON('/api/entries');
  state.entries = data.entries;

  bindEvents();
  render();
  fetch('/api/version').then((r) => r.json()).then((d) => {
    const el = $('app-version');
    if (el && d.version) el.textContent = 'v' + d.version;
  }).catch(() => {});
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
  $('soll-fr-input').addEventListener('change', (e) => {
    state.sollFriday = Math.max(0, parseFloat(e.target.value) || 0);
    localStorage.setItem(SOLL_FR_KEY, String(state.sollFriday));
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

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Gearbeitete Bloecke (Intervalle + gepaarte Kommen/Gehen-Stempel) nach Tag
  const blocksByDay = new Map();
  for (const b of computeBlocks(state.entries)) {
    if (b.start.getFullYear() === year && b.start.getMonth() === month) {
      const d = b.start.getDate();
      if (!blocksByDay.has(d)) blocksByDay.set(d, []);
      blocksByDay.get(d).push(b);
    }
  }
  // Pausen nach Tag
  const pauseByDay = new Map();
  for (const p of computePauses(state.entries)) {
    if (p.start.getFullYear() === year && p.start.getMonth() === month) {
      const d = p.start.getDate();
      pauseByDay.set(d, (pauseByDay.get(d) || 0) + (p.end - p.start));
    }
  }

  // "Heute" auf Tagesgenauigkeit – Soll zählt nur bis heute (kein negatives Saldo für Zukunft)
  const now = new Date();
  const todayNum = now.getFullYear() * 10000 + now.getMonth() * 100 + now.getDate();

  const rows = [];
  let sumIst = 0, sumSoll = 0, sumPauseMs = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const wd = date.getDay();
    const isWeekend = wd === 0 || wd === 6;
    const dayNum = year * 10000 + month * 100 + d;
    const blocks = (blocksByDay.get(d) || []).sort((a, b) => a.start - b.start);

    // Ist-Stunden des Tages (Summe der Bloecke)
    const istMs = blocks.reduce((sum, b) => sum + (b.end - b.start), 0);
    const ist = istMs / 3_600_000;

    // Soll nur an Werktagen und nur bis einschließlich heute; Freitag ggf. eigenes Soll
    const sollForDay = wd === 5 ? state.sollFriday : state.soll;
    const soll = (!isWeekend && dayNum <= todayNum) ? sollForDay : 0;
    const saldo = ist - soll;

    const pauseMs = pauseByDay.get(d) || 0;
    sumIst += ist;
    sumSoll += soll;
    sumPauseMs += pauseMs;

    const cls = [isWeekend ? 'weekend' : '', dayNum === todayNum ? 'today' : ''].filter(Boolean).join(' ');
    const saldoCls = saldo > 0.004 ? 'pos' : (saldo < -0.004 ? 'neg' : '');
    const dateLabel = `${String(d).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.`;
    const sollCell = soll > 0 ? fmtNum(soll) : '';
    const saldoCell = (ist > 0 || soll > 0) ? fmtSaldo(saldo) : '';
    const pauseCell = pauseMs > 0 ? fmtPause(pauseMs) : '';

    if (blocks.length === 0) {
      // Kein Block: Wochenende/leer (nur Soll/Saldo)
      const desc = isWeekend ? 'Wochenende' : (soll ? '—' : '');
      rows.push(`<tr class="${cls}">
        <td class="c-date">${dateLabel}</td>
        <td class="c-day">${WD[wd]}</td>
        <td class="c-desc">${escapeHtml(desc)}</td>
        <td class="c-time"></td>
        <td class="c-time"></td>
        <td class="c-num"></td>
        <td class="c-num"></td>
        <td class="c-num">${sollCell}</td>
        <td class="c-num ${saldoCls}">${saldoCell}</td>
      </tr>`);
    } else if (blocks.length === 1) {
      // Genau ein Block: eine Zeile; Tagessumme (Std) und Pause fett
      const b = blocks[0];
      rows.push(`<tr class="${cls}">
        <td class="c-date">${dateLabel}</td>
        <td class="c-day">${WD[wd]}</td>
        <td class="c-desc">${escapeHtml(b.label || 'Anwesend')}</td>
        <td class="c-time">${fmtTime(b.start)}</td>
        <td class="c-time">${fmtTime(b.end)}</td>
        <td class="c-num strong">${fmtNum(ist)}</td>
        <td class="c-num strong">${pauseCell}</td>
        <td class="c-num">${sollCell}</td>
        <td class="c-num ${saldoCls}">${saldoCell}</td>
      </tr>`);
    } else {
      // Mehrere Sessions: je Session eine Zeile, danach eine fette Summenzeile
      blocks.forEach((b, i) => {
        const sessIst = (b.end - b.start) / 3_600_000;
        rows.push(`<tr class="${cls}">
          <td class="c-date">${i === 0 ? dateLabel : ''}</td>
          <td class="c-day">${i === 0 ? WD[wd] : ''}</td>
          <td class="c-desc">${escapeHtml(b.label || 'Anwesend')}</td>
          <td class="c-time">${fmtTime(b.start)}</td>
          <td class="c-time">${fmtTime(b.end)}</td>
          <td class="c-num">${fmtNum(sessIst)}</td>
          <td class="c-num"></td>
          <td class="c-num"></td>
          <td class="c-num"></td>
        </tr>`);
      });
      rows.push(`<tr class="${cls} day-total">
        <td class="c-date"></td>
        <td class="c-day"></td>
        <td class="c-desc">Summe Tag</td>
        <td class="c-time"></td>
        <td class="c-time"></td>
        <td class="c-num strong">${fmtNum(ist)}</td>
        <td class="c-num strong">${pauseCell}</td>
        <td class="c-num">${sollCell}</td>
        <td class="c-num ${saldoCls}">${saldoCell}</td>
      </tr>`);
    }
  }

  $('sheet-body').innerHTML = rows.join('');
  $('sum-ist').textContent = fmtNum(sumIst);
  $('sum-pause').textContent = fmtPause(sumPauseMs);
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
