import { chromium } from 'playwright';
const B = 'http://localhost:4060';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]', 'Manuel');
await page.fill('input[name="email"]', 'pa@test.de');
await page.fill('input[name="password"]', 'geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');

// Option "Pause (Zeitraum)" vorhanden?
const opts = await page.locator('#manual-kind option').allInnerTexts();

// Ganztags-Session 08:00-16:00 (8h)
await page.selectOption('#manual-kind', 'session');
await page.fill('input[name="start"]', '08:00:00');
await page.fill('input[name="end"]', '16:00:00');
await page.click('#manual-submit');
await page.waitForTimeout(500);
const statAfterSession = (await page.textContent('#stat-today')).trim();

// Pause 12:00-12:30 eintragen
await page.selectOption('#manual-kind', 'pause');
const btnPause = (await page.textContent('#manual-submit')).trim();
const bisVisiblePause = await page.locator('#manual-bis-field').isVisible();
await page.fill('input[name="start"]', '12:00:00');
await page.fill('input[name="end"]', '12:30:00');
await page.click('#manual-submit');
await page.waitForTimeout(500);
const statAfterPause = (await page.textContent('#stat-today')).trim();

// Monatsblatt: heute sollte zwei Sessions zeigen (08-12, 12:30-16)
await page.click('a[href="/monat"]');
await page.waitForURL('**/monat**');
await page.waitForTimeout(500);
const today = new Date();
const dd = String(today.getDate()).padStart(2,'0');
const mm = String(today.getMonth()+1).padStart(2,'0');
const dateCells = await page.locator('tbody#sheet-body tr td.c-date').allInnerTexts();
const idx = dateCells.findIndex(t => t.trim() === `${dd}.${mm}.`);
const rows = page.locator('tbody#sheet-body tr');
const r1 = [ (await rows.nth(idx).locator('td.c-time').nth(0).textContent()).trim(), (await rows.nth(idx).locator('td.c-time').nth(1).textContent()).trim() ];
const r2 = [ (await rows.nth(idx+1).locator('td.c-time').nth(0).textContent()).trim(), (await rows.nth(idx+1).locator('td.c-time').nth(1).textContent()).trim() ];

console.log('Option Pause vorhanden:', opts.some(o=>/Pause/.test(o)), '|', opts.slice(0,4));
console.log('Pause: Bis sichtbar', bisVisiblePause, '| Button:', btnPause);
console.log('Stat nach Session  :', statAfterSession, '(erwartet 8,0 h)');
console.log('Stat nach Pause    :', statAfterPause, '(erwartet 7,5 h)');
console.log('Monatsblatt Sess 1 :', r1.join(' - '), '(erwartet 08:00 - 12:00)');
console.log('Monatsblatt Sess 2 :', r2.join(' - '), '(erwartet 12:30 - 16:00)');
console.log('JS-Fehler          :', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length ? 1 : 0);
