import { chromium } from 'playwright';
const B = 'http://localhost:4340';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','soll@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
// heute exakt 7,7h arbeiten (session 08:00-15:42) -> saldo 0
await page.selectOption('#manual-kind','session');
await page.fill('input[name="start"]','08:00:00'); await page.fill('input[name="end"]','15:42:00');
await page.click('#manual-submit'); await page.waitForTimeout(500);
const saldo = (await page.locator('#mini-stats .l:has-text("Saldo")').locator('xpath=preceding-sibling::div').textContent()).trim();
// Monatsblatt Soll-Felder
await page.goto(B + '/monat'); await page.waitForTimeout(500);
const sollMoDo = await page.inputValue('#soll-input');
const sollFr = await page.inputValue('#soll-fr-input');
// heutige Zeile Soll
const dds=String(new Date().getDate()).padStart(2,'0'); const mm=String(new Date().getMonth()+1).padStart(2,'0');
const wd = new Date().getDay();
const rowSel = `tbody#sheet-body tr:has(td.c-date:text-is("${dds}.${mm}."))`;
const sollCell = (await page.locator(rowSel).first().locator('td.c-num').nth(2).textContent()).trim();
console.log('Saldo heute (7,7h Arbeit):', saldo, '(erwartet ~+0,0 h an Werktagen)');
console.log('Monatsblatt Soll Mo-Do / Fr:', sollMoDo, '/', sollFr, '(erwartet 7.7 / 7.7)');
console.log('Soll-Zelle heute:', sollCell, '| Wochentag:', wd, '(0=So,6=Sa)');
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
