// Buchungsarten-Katalog fuer die Oberflaeche.
// "Kommen"/"Gehen"/"Zeitraum"/"Pause" sind Stempel-Aktionen,
// die uebrigen Eintraege sind Buchungsarten (Uhrzeit oder Datumsbereich).
//   punch  -> einzelner Zeitstempel
//   pair   -> Kommen + Gehen (Zeitraum an einem Tag)
//   pause  -> Pause (Zeitraum an einem Tag)
//   range  -> mehrtaegige Absenz (Datumsbereich, Stunden/Tag), z.B. Urlaub
//   top    -> haeufige Buchungsart (oben, vor der Trennlinie)

window.PUNCH_DIR_BY_CODE = { kommen: 'kommen', gehen: 'gehen' };
window.DEFAULT_KIND_CODE = 'session';

window.BOOKING_TYPES = [
  // Stempel-Aktionen (immer oben)
  { code: 'session', label: 'Kommen + Gehen (Zeitraum)', pair: true },
  { code: 'pause', label: 'Pause (Zeitraum)', pause: true },
  { code: 'kommen', label: 'Kommen (Zeitpunkt)', punch: true },
  { code: 'gehen', label: 'Gehen (Zeitpunkt)', punch: true },
  // Haeufige Buchungsarten (oben, vor der Trennlinie)
  { code: '0406', label: 'mobiles Arbeiten', top: true },
  { code: '0700', label: 'Arztbesuch', top: true },
  { code: '0800', label: 'Dienstreise', top: true },
  { code: '0810', label: 'Lenkzeit', top: true },
  { code: '9800', label: 'Passive Reisezeit', top: true },
  { code: '0900', label: 'Gleittag', range: true, top: true },
  { code: '0901', label: 'Gleittag Individuell', range: true, top: true },
  { code: '0902', label: 'Gleittag Vorsorgekonto', range: true, top: true },
  { code: '0100', label: 'Tarifurlaub', range: true, top: true },
  // Weitere Buchungsarten (unter der Trennlinie)
  { code: '0105', label: 'Behindertenurlaub', range: true },
  { code: '0405', label: 'Bereitschaft' },
  { code: '0412', label: 'Betriebsratsausbildung', range: true },
  { code: '0411', label: 'Betriebsratstätigkeit' },
  { code: '9810', label: 'Geschäftsessen' },
  { code: '0410', label: 'Lehrgang', range: true },
  { code: '0400', label: 'Schule', range: true },
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
  '0700': { bg: '#fee2e2', fg: '#b91c1c' }, // Arztbesuch
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
// opts.excludePunch = true blendet Kommen/Gehen/Zeitraum/Pause aus (z.B. beim Bearbeiten eines Intervalls).
window.fillKindSelect = function (selectEl, selectedCode, opts = {}) {
  let list = opts.excludePunch
    ? window.BOOKING_TYPES.filter((t) => !t.punch && !t.pair && !t.pause)
    : window.BOOKING_TYPES;
  const sel = selectedCode || (list[0] && list[0].code);
  // Unbekannten (z.B. alten) Code voranstellen, damit er erhalten bleibt
  if (sel && !list.some((t) => t.code === sel)) {
    list = [{ code: sel, label: opts.currentLabel || sel, top: true }, ...list];
  }

  const parts = [];
  let dividerAdded = false;
  for (const t of list) {
    const isTop = t.punch || t.pair || t.pause || t.top;
    if (!isTop && !dividerAdded) {
      parts.push('<option disabled>──────────────</option>');
      dividerAdded = true;
    }
    parts.push(`<option value="${t.code}" ${t.code === sel ? 'selected' : ''}>${t.label}</option>`);
  }
  selectEl.innerHTML = parts.join('');
};
