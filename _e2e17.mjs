import { chromium } from 'playwright';
const B = 'http://localhost:4160';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','gp@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');

// Zwei Sessions heute mit Lücke 12:00-12:20 (20 min Pause)
async function session(von,bis){ await page.selectOption('#manual-kind','session'); await page.fill('input[name="start"]',von); await page.fill('input[name="end"]',bis); await page.click('#manual-submit'); await page.waitForTimeout(400); }
await session('08:00:00','12:00:00');
await session('12:20:00','16:00:00');

const statToday = (await page.textContent('#stat-today')).trim();
const ovPause = (await page.textContent('#ov-pause')).trim();

// Monatsblatt
await page.goto(B + '/monat');
await page.waitForTimeout(500);
const dds = String(new Date().getDate()).padStart(2,'0'); const mm = String(new Date().getMonth()+1).padStart(2,'0');
const rowSel = `tbody#sheet-body tr:has(td.c-date:text-is("${dds}.${mm}."))`;
const firstPause = (await page.locator(rowSel).first().locator('td.c-num').nth(1).textContent()).trim();
const sumPause = (await page.textContent('#sum-pause')).trim();

console.log('Arbeit heute :', statToday, '(erwartet 7,7 h)');
console.log('Übersicht Pause (min:sec):', ovPause, '(erwartet 20:00 min)');
console.log('Monatsblatt Pause-Spalte :', firstPause, '(erwartet 20:00 min)');
console.log('Monatsblatt Summe Pause  :', sumPause, '(erwartet 20:00 min)');
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
