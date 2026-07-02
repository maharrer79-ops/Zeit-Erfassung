// Zentraler Katalog der Buchungsarten (Code + Bezeichnung).
// "Kommen/Gehen" ist die normale Anwesenheit und der Standard (auch beim Stempeln).

export const DEFAULT_KIND = { code: '0010', label: 'Kommen/Gehen' };

export const BOOKING_TYPES = [
  DEFAULT_KIND,
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

// Liefert zu einem Code die gueltige Buchungsart (oder den Standard).
export function resolveKind(code) {
  return BOOKING_TYPES.find((t) => t.code === code) || DEFAULT_KIND;
}
