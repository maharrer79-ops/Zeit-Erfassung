import { chromium } from 'playwright';
const B = 'http://localhost:4230';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','iv@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
const today = await page.inputValue('input[name="date"]');
// ALTE Art: mobiles Arbeiten Intervalle mit Lücken (kein Stempel)
async function mob(von,bis){ await page.selectOption('#manual-kind','0406'); await page.fill('input[name="date"]',today); await page.fill('input[name="start"]',von); await page.fill('input[name="end"]',bis); await page.click('#manual-submit'); await page.waitForTimeout(400); }
await mob('06:30:00','10:20:00'); // 3:50
await mob('10:24:00','11:43:00'); // 1:19 (Lücke 4min)
await mob('12:03:00','13:30:00'); // 1:27 (Lücke 20min)
await mob('13:45:00','17:00:00'); // 3:15 (Lücke 15min)
await page.waitForTimeout(400);
// Pause heute = 4+20+15 = 39 min
const pauseToday = (await page.locator('#mini-stats .l:has-text("Pause")').locator('xpath=preceding-sibling::div').textContent()).trim();
const sepTotals = (await page.locator('#entries-body tr.day-sep .day-sep-totals').first().textContent()).trim();

// Monatsblatt Summe-Pause für den Tag
await page.goto(B + '/monat'); await page.waitForTimeout(500);
const sumPause = (await page.textContent('#sum-pause')).trim();

console.log('Pause heute (Kachel):', pauseToday, '(erwartet 39:00 min)');
console.log('Tages-Überschrift   :', sepTotals);
console.log('Monatsblatt Summe Pause:', sumPause, '(erwartet 39:00 min)');
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
