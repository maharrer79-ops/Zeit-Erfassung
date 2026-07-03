// Buchungsarten-Katalog fuer die Oberflaeche.
// "Kommen" und "Gehen" sind getrennte Stempel (erzeugen je eine eigene Position),
// die uebrigen Eintraege sind Intervall-Buchungen (Von–Bis).

// Codes der Stempel-Optionen -> Richtung
window.PUNCH_DIR_BY_CODE = { kommen: 'kommen', gehen: 'gehen' };

window.DEFAULT_KIND_CODE = 'session';

window.BOOKING_TYPES = [
  { code: 'session', label: 'Kommen + Gehen (Zeitraum)', pair: true },
  { code: 'kommen', label: 'Kommen (Zeitpunkt)', punch: true },
  { code: 'gehen', label: 'Gehen (Zeitpunkt)', punch: true },
  { code: '0105', label: 'Behindertenurlaub' },
  { code: '0405', label: 'Bereitschaft' },
  { code: '0412', label: 'Betriebsratsausbildung' },
  { code: '0411', label: 'Betriebsratstätigkeit' },
  { code: '0800', label: 'Dienstreise' },
  { code: '9810', label: 'Geschäftsessen' },
  { code: '0900', label: 'Gleittag' },
  { code: '0901', label: 'Gleittag Individuell' },
  { code: '0902', label: 'Gleittag Vorsorgekonto' },
  { code: '0410', label: 'Lehrgang' },
  { code: '0810', label: 'Lenkzeit' },
  { code: '0406', label: 'mobiles Arbeiten' },
  { code: '9800', label: 'Passive Reisezeit' },
  { code: '0400', label: 'Schule' },
  { code: '0100', label: 'Tarifurlaub' },
];

// Fuellt ein <select> mit den Buchungsarten und waehlt selectedCode aus.
// opts.excludePunch = true blendet Kommen/Gehen und Zeitraum aus (z.B. beim Bearbeiten eines Intervalls).
window.fillKindSelect = function (selectEl, selectedCode, opts = {}) {
  let list = opts.excludePunch
    ? window.BOOKING_TYPES.filter((t) => !t.punch && !t.pair)
    : window.BOOKING_TYPES;
  const sel = selectedCode || (list[0] && list[0].code);
  // Unbekannten (z.B. alten) Code voranstellen, damit er erhalten bleibt
  if (sel && !list.some((t) => t.code === sel)) {
    list = [{ code: sel, label: opts.currentLabel || sel }, ...list];
  }
  selectEl.innerHTML = list
    .map((t) => {
      const text = t.punch || t.pair ? t.label : `${t.label} (${t.code})`;
      return `<option value="${t.code}" ${t.code === sel ? 'selected' : ''}>${text}</option>`;
    })
    .join('');
};
