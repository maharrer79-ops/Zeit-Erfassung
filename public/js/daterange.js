// Kompakter Datumsbereich-Kalender (von–bis in einem).
// Schreibt Start in das Feld name="date" und Ende in #manual-enddate.
window.initDateRange = function () {
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const trigger = document.getElementById('daterange-trigger');
  const pop = document.getElementById('daterange-pop');
  const grid = document.getElementById('dr-grid');
  const title = document.getElementById('dr-title');
  const dateInput = document.querySelector('#manual-form [name="date"]');
  const endInput = document.getElementById('manual-enddate');
  if (!trigger) return;

  let view = new Date(); view.setDate(1);
  let start = null, end = null;

  const parse = (v) => (v ? new Date(v + 'T00:00:00') : null);
  const toInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const toLabel = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const inRange = (d) => start && end && d >= start && d <= end;

  function updateLabel() {
    trigger.textContent = start ? `${toLabel(start)} – ${end ? toLabel(end) : '…'}` : 'Zeitraum wählen';
  }
  function writeInputs() {
    if (start) dateInput.value = toInput(start);
    if (end) endInput.value = toInput(end);
  }
  function syncFromInputs() {
    start = parse(dateInput.value);
    end = parse(endInput.value) || (start ? new Date(start) : null);
    if (start) { view = new Date(start.getFullYear(), start.getMonth(), 1); }
    updateLabel();
  }

  function render() {
    const year = view.getFullYear(), month = view.getMonth();
    title.textContent = `${MONTHS[month]} ${year}`;
    const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Montag = 0
    const days = new Date(year, month + 1, 0).getDate();
    let html = WD.map((w) => `<span class="dr-wd">${w}</span>`).join('');
    for (let i = 0; i < lead; i++) html += '<span class="dr-empty"></span>';
    for (let d = 1; d <= days; d++) {
      const dt = new Date(year, month, d);
      const cls = ['dr-day'];
      if (sameDay(dt, start) || sameDay(dt, end)) cls.push('sel');
      else if (inRange(dt)) cls.push('in-range');
      html += `<button type="button" class="${cls.join(' ')}" data-d="${d}">${d}</button>`;
    }
    grid.innerHTML = html;
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    syncFromInputs();
    render();
    pop.hidden = !pop.hidden;
  });
  pop.addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('dr-prev').addEventListener('click', () => { view.setMonth(view.getMonth() - 1); render(); });
  document.getElementById('dr-next').addEventListener('click', () => { view.setMonth(view.getMonth() + 1); render(); });

  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]');
    if (!b) return;
    const d = new Date(view.getFullYear(), view.getMonth(), +b.dataset.d);
    if (!start || (start && end)) { start = d; end = null; }
    else if (d >= start) { end = d; }
    else { start = d; end = null; }
    writeInputs();
    updateLabel();
    render();
    if (start && end) pop.hidden = true;
  });

  document.addEventListener('click', (e) => {
    if (!pop.hidden && !pop.contains(e.target) && e.target !== trigger) pop.hidden = true;
  });

  // Von aussen aufrufbar, um Label/Ansicht mit den aktuellen Feldwerten zu synchronisieren
  window.dateRangeSync = syncFromInputs;
};
