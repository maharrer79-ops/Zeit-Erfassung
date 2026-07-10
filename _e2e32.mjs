import { chromium } from 'playwright';
const B = 'http://localhost:4350';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','wk@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
// heute session 08-16 (8h)
await page.selectOption('#manual-kind','session'); await page.fill('input[name="start"]','08:00:00'); await page.fill('input[name="end"]','16:00:00'); await page.click('#manual-submit'); await page.waitForTimeout(500);
// Woche umschalten
await page.click('#ov-toggle button[data-view="woche"]'); await page.waitForTimeout(300);
const labels = await page.locator('#mini-stats .l').allInnerTexts();
const gesamt = (await page.locator('#mini-stats .n').first().textContent()).trim();
const monthLabel = (await page.textContent('#month-label')).trim();
const arrowsHidden = await page.locator('#month-prev').isHidden();
// alle drei Toggle-Buttons vorhanden
const toggles = await page.locator('#ov-toggle button').allInnerTexts();
console.log('Toggle-Buttons:', toggles);
console.log('Woche-Labels:', labels);
console.log('Gesamt Woche:', gesamt, '| Wochen-Label:', monthLabel, '| Pfeile versteckt:', arrowsHidden);
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
