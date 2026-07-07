import { chromium } from 'playwright';
const B = 'http://localhost:4170';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','th@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
const today = await page.inputValue('input[name="date"]');
// gestriges Datum
const yest = new Date(); yest.setDate(yest.getDate()-1);
const yStr = `${yest.getFullYear()}-${String(yest.getMonth()+1).padStart(2,'0')}-${String(yest.getDate()).padStart(2,'0')}`;

// Heute: zwei Sessions mit 20 min Lücke -> Pause heute 20 min
async function session(date,von,bis){ await page.selectOption('#manual-kind','session'); await page.fill('input[name="date"]',date); await page.fill('input[name="start"]',von); await page.fill('input[name="end"]',bis); await page.click('#manual-submit'); await page.waitForTimeout(400); }
await session(today,'08:00:00','12:00:00');
await session(today,'12:20:00','16:00:00');
// Gestern: explizite Pause 60 min
await page.selectOption('#manual-kind','pause'); await page.fill('input[name="date"]',yStr); await page.fill('input[name="start"]','12:00:00'); await page.fill('input[name="end"]','13:00:00'); await page.click('#manual-submit'); await page.waitForTimeout(400);

const ovPause = (await page.textContent('#ov-pause')).trim();
const ovPauseLabel = (await page.locator('#ov-pause').locator('xpath=following-sibling::div').textContent()).trim();
console.log('Pause-Kachel:', ovPause, '| Label:', ovPauseLabel, '(erwartet 20:00 min / Pause heute)');
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
