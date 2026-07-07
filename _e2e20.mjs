import { chromium } from 'playwright';
const B = 'http://localhost:4190';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','sm@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
const today = await page.inputValue('input[name="date"]');
async function session(von,bis){ await page.selectOption('#manual-kind','session'); await page.fill('input[name="start"]',von); await page.fill('input[name="end"]',bis); await page.click('#manual-submit'); await page.waitForTimeout(400); }
// 3 Sessions -> Summe Tag Zeile erwartet; Lücken = Pause
await session('08:00:00','10:00:00'); // 2h
await session('10:30:00','12:30:00'); // 2h (Pause 30min)
await session('13:00:00','16:00:00'); // 3h (Pause 30min) -> Summe 7h, Pause 60min
await page.goto(B + '/monat');
await page.waitForTimeout(500);
const totalRow = page.locator('#sheet-body tr.day-total').first();
const cnt = await page.locator('#sheet-body tr.day-total').count();
const desc = (await totalRow.locator('td.c-desc').textContent()).trim();
const stdCell = (await totalRow.locator('td.c-num.strong').nth(0).textContent()).trim();
const pauseCell = (await totalRow.locator('td.c-num.strong').nth(1).textContent()).trim();
const stdBold = await totalRow.locator('td.c-num.strong').nth(0).evaluate(el => getComputedStyle(el).fontWeight);
console.log('Summenzeilen:', cnt, '| Label:', desc);
console.log('Summe Std (fett):', stdCell, '| fontWeight:', stdBold, '(erwartet 7,00 / 800)');
console.log('Summe Pause (fett):', pauseCell, '(erwartet 60:00 min)');
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
