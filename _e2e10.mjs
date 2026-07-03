import { chromium } from 'playwright';
const B = 'http://localhost:4070';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]', 'Manuel');
await page.fill('input[name="email"]', 'sep@test.de');
await page.fill('input[name="password"]', 'geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');

// Zwei Tage: heute Session, gestern Session
const fmt = (d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today = new Date(); const yest = new Date(); yest.setDate(today.getDate()-1);
async function addSession(dateStr, von, bis){
  await page.selectOption('#manual-kind','session');
  await page.fill('input[name="date"]', dateStr);
  await page.fill('input[name="start"]', von);
  await page.fill('input[name="end"]', bis);
  await page.click('#manual-submit');
  await page.waitForTimeout(400);
}
await addSession(fmt(today),'08:00:00','12:00:00');
await addSession(fmt(yest),'09:00:00','17:00:00');

const seps = await page.locator('#entries-body tr.day-sep td').allInnerTexts();
console.log('Trennzeilen:', seps);
console.log('Anzahl Trennzeilen:', seps.length, '(erwartet 2)');
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length ? 1 : 0);
