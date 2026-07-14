import { chromium } from 'playwright';
const B = 'http://localhost:4360';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','pn2@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
const today = await page.inputValue('#punch-date');
// Pause Start 12:00 nachtragen
await page.fill('#punch-time','12:00:00'); await page.click('#punch-pause-start'); await page.waitForTimeout(400);
const runningRow = /läuft/.test(await page.locator('#entries-body').innerText());
// Pause Ende 12:35 nachtragen
await page.fill('#punch-time','12:35:00'); await page.click('#punch-pause-ende'); await page.waitForTimeout(500);
const body = await page.locator('#entries-body').innerText();
const pauseRow = /12:00–12:35/.test(body);
const dur = /00:35:00/.test(body);
console.log('Nach Start: läuft-Zeile:', runningRow);
console.log('Nach Ende: Pause 12:00–12:35:', pauseRow, '| Dauer 00:35:00:', dur);
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
