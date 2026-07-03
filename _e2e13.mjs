import { chromium } from 'playwright';
const B = 'http://localhost:4110';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','c@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
// Tarifurlaub (0100) 1 Tag
await page.selectOption('#manual-kind','0100');
await page.fill('input[name="date"]','2026-07-06');
await page.fill('#manual-enddate','2026-07-06');
await page.click('#manual-submit');
await page.waitForTimeout(500);
// mobiles Arbeiten (0406) interval 08-12 am 07.07
await page.selectOption('#manual-kind','0406');
await page.fill('input[name="date"]','2026-07-07');
await page.fill('#manual-enddate','2026-07-07');
await page.click('#manual-submit');
await page.waitForTimeout(500);
// Badges auslesen
const badges = await page.locator('#entries-body td .badge').evaluateAll(els => els.map(e => ({ text: e.textContent.trim(), bg: e.style.background || getComputedStyle(e).backgroundColor })));
console.log('Badges:', JSON.stringify(badges));
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
