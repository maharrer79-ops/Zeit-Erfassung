import { chromium } from 'playwright';
const B = 'http://localhost:4240';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','pn@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
// Buttons vorhanden?
const gehenBtn = await page.locator('#pause-gehen-now').isVisible();
const kommenBtn = await page.locator('#pause-kommen-now').isVisible();
// Erst Kommen (einstempeln via nachtragen 08:00 heute wäre komplex) -> live Kommen
await page.click('#start-btn'); await page.waitForTimeout(400);
// Pause Gehen (live) -> jetzt away
await page.click('#pause-gehen-now'); await page.waitForTimeout(400);
const metaAfterGehen = (await page.textContent('#timer-meta')).trim();
const startVisible = await page.locator('#start-btn').isVisible();
// Pause Kommen (live) -> present again
await page.click('#pause-kommen-now'); await page.waitForTimeout(400);
const metaAfterKommen = (await page.textContent('#timer-meta')).trim();
// Liste: 3 Stempel (Kommen, Gehen, Kommen)
const badges = await page.locator('#entries-body .badge').allInnerTexts();
console.log('Buttons sichtbar:', gehenBtn, kommenBtn);
console.log('Nach Pause-Gehen: meta=', metaAfterGehen, '| Kommen-Btn sichtbar:', startVisible);
console.log('Nach Pause-Kommen: meta=', metaAfterKommen);
console.log('Badges:', badges);
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
