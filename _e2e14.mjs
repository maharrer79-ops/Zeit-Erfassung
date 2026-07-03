import { chromium } from 'playwright';
const B = 'http://localhost:4130';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','mob@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');

// mobiles Arbeiten (0406) -> Uhrzeit-Modus
await page.selectOption('#manual-kind','0406');
const mobBis = await page.locator('#manual-bis-field').isVisible();
const mobVonTime = await page.locator('#manual-von-field').isVisible();
const mobEnddate = await page.locator('#manual-enddate-field').isVisible();
const mobBtn = (await page.textContent('#manual-submit')).trim();
const mobDateLabel = (await page.textContent('#manual-date-label')).trim();
// eintragen 09:00-13:00
await page.fill('input[name="date"]','2026-07-06');
await page.fill('input[name="start"]','09:00:00');
await page.fill('input[name="end"]','13:00:00');
await page.click('#manual-submit');
await page.waitForTimeout(500);
const listText = await page.locator('#entries-body').innerText();
const hasMob = /mobiles Arbeiten/.test(listText) && /09:00–13:00/.test(listText);

// Tarifurlaub (0100) -> Datumsbereich-Modus
await page.selectOption('#manual-kind','0100');
const urlEnddate = await page.locator('#manual-enddate-field').isVisible();
const urlHours = await page.locator('#manual-hours-field').isVisible();
const urlVonTime = await page.locator('#manual-von-field').isVisible();
const urlBtn = (await page.textContent('#manual-submit')).trim();

console.log('mobiles Arbeiten: Bis-Zeit', mobBis, '| Von-Zeit', mobVonTime, '| Enddatum', mobEnddate, '| Label', mobDateLabel, '| Btn', mobBtn);
console.log('  -> Eintrag 09:00-13:00 in Liste:', hasMob);
console.log('Tarifurlaub: Enddatum', urlEnddate, '| Stunden', urlHours, '| Von-Zeit', urlVonTime, '| Btn', urlBtn);
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
