import { chromium } from 'playwright';
const B = 'http://localhost:4030';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
// iPhone-ähnlich
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const overflow = async (label) => {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  const ok = r.sw <= r.cw + 1;
  console.log(`${label}: scrollWidth=${r.sw} clientWidth=${r.cw} -> ${ok ? 'OK (kein H-Scroll)' : 'ÜBERLAUF!'}`);
  return ok;
};

// Landing
await page.goto(B + '/');
await page.waitForTimeout(300);
const l = await overflow('Landing ');

// Registrieren
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]', 'Manuel');
await page.fill('input[name="email"]', 'm@test.de');
await page.fill('input[name="password"]', 'geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
await page.waitForTimeout(300);

// Ein paar Daten
const today = await page.inputValue('#punch-date');
for (const [t,dir] of [['08:00:00','kommen'],['16:30:00','gehen']]){
  await page.fill('#punch-time', t); await page.click(dir==='kommen'?'#punch-kommen':'#punch-gehen'); await page.waitForTimeout(200);
}
await page.waitForTimeout(300);
const a = await overflow('App     ');

// Tabelle scrollt in sich (Container breiter als sichtbar)
const tblScroll = await page.evaluate(() => {
  const el = document.querySelector('.table-card');
  return el ? { scroll: el.scrollWidth, client: el.clientWidth } : null;
});
console.log('Tabellen-Card scrollbar:', tblScroll && tblScroll.scroll > tblScroll.client ? 'ja (in sich scrollbar)' : 'nicht nötig');

// Monatsblatt
await page.goto(B + '/monat');
await page.waitForTimeout(400);
const mo = await overflow('Monat   ');

console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit((l && a && mo && errors.length===0) ? 0 : 1);
