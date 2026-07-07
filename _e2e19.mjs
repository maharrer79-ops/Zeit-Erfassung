import { chromium } from 'playwright';
const B = 'http://localhost:4180';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','ds@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
const today = await page.inputValue('input[name="date"]');
async function session(von,bis){ await page.selectOption('#manual-kind','session'); await page.fill('input[name="start"]',von); await page.fill('input[name="end"]',bis); await page.click('#manual-submit'); await page.waitForTimeout(400); }
await session('08:00:00','12:00:00');
await session('12:20:00','16:00:00');

// Tages-Überschrift-Summen
const sepText = (await page.locator('#entries-body tr.day-sep .day-sep-totals').first().textContent()).trim();
// Alte Tagesliste weg?
const dayListExists = await page.locator('#day-list').count();
const cardTitle = (await page.locator('.grid .card h3').first().textContent()).trim();

console.log('Tages-Überschrift-Summe:', sepText, '(erwartet 7,7 h · Pause 20:00 min)');
console.log('Alte #day-list vorhanden:', dayListExists, '(erwartet 0)');
console.log('Karten-Titel:', cardTitle);
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
