import { chromium } from 'playwright';
const B = 'http://localhost:4150';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','pz@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');

// Session 08:00-16:00 heute
const today = await page.inputValue('input[name="date"]');
await page.selectOption('#manual-kind','session');
await page.fill('input[name="start"]','08:00:00');
await page.fill('input[name="end"]','16:00:00');
await page.click('#manual-submit');
await page.waitForTimeout(500);

// Pause 12:00-12:30
await page.selectOption('#manual-kind','pause');
await page.fill('input[name="start"]','12:00:00');
await page.fill('input[name="end"]','12:30:00');
await page.click('#manual-submit');
await page.waitForTimeout(500);

const statToday = (await page.textContent('#stat-today')).trim();
const ovPause = (await page.textContent('#ov-pause')).trim();
const bodyText = await page.locator('#entries-body').innerText();
const hasPauseBadge = await page.locator('#entries-body .badge.pause').count();
const pauseRowDur = /Pause[\s\S]*?00:30:00/.test(bodyText) || /12:00–12:30[\s\S]*?00:30:00/.test(bodyText);

// Monatsblatt
await page.goto(B + '/monat');
await page.waitForTimeout(500);
const dd = new Date().getDate(); const dds = String(dd).padStart(2,'0'); const mm = String(new Date().getMonth()+1).padStart(2,'0');
const rowSel = `tbody#sheet-body tr:has(td.c-date:text-is("${dds}.${mm}."))`;
const firstStd = (await page.locator(rowSel).first().locator('td.c-num').nth(0).textContent()).trim();
const firstPause = (await page.locator(rowSel).first().locator('td.c-num').nth(1).textContent()).trim();
const sumPause = (await page.textContent('#sum-pause')).trim();

console.log('Stat heute (Arbeit):', statToday, '(erwartet 7,5 h)');
console.log('Übersicht Pause    :', ovPause, '(erwartet 0,5 h)');
console.log('Pause-Badge Anzahl :', hasPauseBadge, '| Pause-Zeile 30min:', pauseRowDur);
console.log('Monatsblatt 1.Session Std:', firstStd, '| Pause-Spalte:', firstPause, '(erwartet 4,00 / 0,50)');
console.log('Monatsblatt Summe Pause:', sumPause, '(erwartet 0,50)');
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
