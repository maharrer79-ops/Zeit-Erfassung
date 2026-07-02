// Buchungsarten-Katalog fuer die Oberflaeche (muss zu server/booking-types.js passen).
window.DEFAULT_KIND_CODE = '0010';
window.BOOKING_TYPES = [
  { code: '0010', label: 'Kommen/Gehen' },
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
window.fillKindSelect = function (selectEl, selectedCode) {
  const sel = selectedCode || window.DEFAULT_KIND_CODE;
  selectEl.innerHTML = window.BOOKING_TYPES.map(
    (t) => `<option value="${t.code}" ${t.code === sel ? 'selected' : ''}>${t.label} (${t.code})</option>`
  ).join('');
};
