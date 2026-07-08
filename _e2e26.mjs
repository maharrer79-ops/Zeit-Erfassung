import { chromium } from 'playwright';
const B = 'http://localhost:4250';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','lp@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
const today = await page.inputValue('#punch-date');
// Offenes Kommen 06:30 (nachtragen)
await page.fill('#punch-time','06:30:00'); await page.click('#punch-kommen'); await page.waitForTimeout(300);
// Echte Pause 11:43-12:18 (35 min)
await page.selectOption('#manual-kind','pause'); await page.fill('input[name="date"]',today); await page.fill('input[name="start"]','11:43:00'); await page.fill('input[name="end"]','12:18:00'); await page.click('#manual-submit'); await page.waitForTimeout(400);
const pauseToday = (await page.locator('#mini-stats .l:has-text("Pause")').locator('xpath=preceding-sibling::div').textContent()).trim();
const sepTotals = (await page.locator('#entries-body tr.day-sep .day-sep-totals').first().textContent()).trim();
console.log('Pause heute (Kachel):', pauseToday, '(erwartet 35:00 min)');
console.log('Tages-Überschrift   :', sepTotals);
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
