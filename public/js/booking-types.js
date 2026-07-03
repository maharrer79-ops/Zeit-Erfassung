// Buchungsarten-Katalog fuer die Oberflaeche.
// "Kommen" und "Gehen" sind getrennte Stempel (erzeugen je eine eigene Position),
// die uebrigen Eintraege sind Intervall-Buchungen (Von–Bis).

// Codes der Stempel-Optionen -> Richtung
window.PUNCH_DIR_BY_CODE = { kommen: 'kommen', gehen: 'gehen' };

window.DEFAULT_KIND_CODE = 'session';

window.BOOKING_TYPES = [
  { code: 'session', label: 'Kommen + Gehen (Zeitraum)', pair: true },
  { code: 'pause', label: 'Pause (Zeitraum)', pause: true },
  { code: 'kommen', label: 'Kommen (Zeitpunkt)', punch: true },
  { code: 'gehen', label: 'Gehen (Zeitpunkt)', punch: true },
  // range: true  -> Datumsbereich (mehrtägig, Stunden/Tag), wie Urlaub
  // ohne range    -> Uhrzeit-Auswahl (Von–Bis an einem Tag), wie mobiles Arbeiten
  { code: '0105', label: 'Behindertenurlaub', range: true },
  { code: '0405', label: 'Bereitschaft' },
  { code: '0412', label: 'Betriebsratsausbildung', range: true },
  { code: '0411', label: 'Betriebsratstätigkeit' },
  { code: '0800', label: 'Dienstreise' },
  { code: '9810', label: 'Geschäftsessen' },
  { code: '0900', label: 'Gleittag', range: true },
  { code: '0901', label: 'Gleittag Individuell', range: true },
  { code: '0902', label: 'Gleittag Vorsorgekonto', range: true },
  { code: '0410', label: 'Lehrgang', range: true },
  { code: '0810', label: 'Lenkzeit' },
  { code: '0406', label: 'mobiles Arbeiten' },
  { code: '9800', label: 'Passive Reisezeit' },
  { code: '0400', label: 'Schule', range: true },
  { code: '0100', label: 'Tarifurlaub', range: true },
];

// Farbe je Buchungsart (Hintergrund + Schrift) fuer die farbliche Trennung in der Liste
window.KIND_COLORS = {
  '0010': { bg: '#e2e8f0', fg: '#334155' }, // Kommen/Gehen (neutral)
  '0100': { bg: '#dbeafe', fg: '#1e40af' }, // Tarifurlaub
  '0105': { bg: '#e0e7ff', fg: '#3730a3' }, // Behindertenurlaub
  '0405': { bg: '#f1f5f9', fg: '#475569' }, // Bereitschaft
  '0410': { bg: '#f3e8ff', fg: '#6b21a8' }, // Lehrgang
  '0411': { bg: '#fef9c3', fg: '#854d0e' }, // Betriebsratstätigkeit
  '0412': { bg: '#ede9fe', fg: '#5b21b6' }, // Betriebsratsausbildung
  '0400': { bg: '#fae8ff', fg: '#86198f' }, // Schule
  '0406': { bg: '#dcfce7', fg: '#166534' }, // mobiles Arbeiten
  '0800': { bg: '#cffafe', fg: '#155e75' }, // Dienstreise
  '0810': { bg: '#ccfbf1', fg: '#115e59' }, // Lenkzeit
  '0900': { bg: '#ffedd5', fg: '#9a3412' }, // Gleittag
  '0901': { bg: '#fed7aa', fg: '#9a3412' }, // Gleittag Individuell
  '0902': { bg: '#fde68a', fg: '#92400e' }, // Gleittag Vorsorgekonto
  '9800': { bg: '#e0f2fe', fg: '#075985' }, // Passive Reisezeit
  '9810': { bg: '#fce7f3', fg: '#9d174d' }, // Geschäftsessen
};

// Liefert ein farbiges Badge (HTML) fuer eine Buchungsart. label sollte bereits escaped sein.
window.kindBadge = function (code, labelHtml) {
  const c = window.KIND_COLORS[code] || { bg: '#e2e8f0', fg: '#334155' };
  return `<span class="badge" style="background:${c.bg};color:${c.fg}">${labelHtml}</span>`;
};

// Fuellt ein <select> mit den Buchungsarten und waehlt selectedCode aus.
// opts.excludePunch = true blendet Kommen/Gehen und Zeitraum aus (z.B. beim Bearbeiten eines Intervalls).
window.fillKindSelect = function (selectEl, selectedCode, opts = {}) {
  let list = opts.excludePunch
    ? window.BOOKING_TYPES.filter((t) => !t.punch && !t.pair && !t.pause)
    : window.BOOKING_TYPES;
  const sel = selectedCode || (list[0] && list[0].code);
  // Unbekannten (z.B. alten) Code voranstellen, damit er erhalten bleibt
  if (sel && !list.some((t) => t.code === sel)) {
    list = [{ code: sel, label: opts.currentLabel || sel }, ...list];
  }
  selectEl.innerHTML = list
    .map((t) => {
      const text = t.punch || t.pair || t.pause ? t.label : `${t.label} (${t.code})`;
      return `<option value="${t.code}" ${t.code === sel ? 'selected' : ''}>${text}</option>`;
    })
    .join('');
};
