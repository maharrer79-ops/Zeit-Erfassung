import { chromium } from 'playwright';
const B = 'http://localhost:4220';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','op@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
const today = await page.inputValue('#punch-date');
// Heute nachtragen: Kommen 06:26, Gehen 11:41, Kommen 12:11 (offen, kein Gehen)
async function punch(dir,t){ await page.fill('#punch-time',t); await page.click(dir==='kommen'?'#punch-kommen':'#punch-gehen'); await page.waitForTimeout(300); }
await punch('kommen','06:26:00');
await punch('gehen','11:41:00');
await punch('kommen','12:11:00');
await page.waitForTimeout(400);
// Tag-Ansicht Pause heute
const pauseToday = (await page.locator('#mini-stats .l:has-text("Pause")').locator('xpath=preceding-sibling::div').textContent()).trim();
// Tages-Überschrift Summe
const sepTotals = (await page.locator('#entries-body tr.day-sep .day-sep-totals').first().textContent()).trim();
console.log('Pause heute (Kachel):', pauseToday, '(erwartet 30:00 min)');
console.log('Tages-Überschrift   :', sepTotals, '(sollte Pause 30:00 min enthalten)');
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
