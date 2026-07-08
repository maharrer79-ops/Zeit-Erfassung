import { chromium } from 'playwright';
const B = 'http://localhost:4290';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','dr2@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
// Pause Toggle + Gehen-Reset
await page.click('#start-btn'); await page.waitForTimeout(300);
const l1 = (await page.textContent('#pause-toggle')).trim();
await page.click('#pause-toggle'); await page.waitForTimeout(400);
const l2 = (await page.textContent('#pause-toggle')).trim();
await page.click('#stop-btn'); await page.waitForTimeout(500);
const pauseBadges = await page.locator('#entries-body .badge.pause').count();
// Datumsbereich
await page.selectOption('#manual-kind','0100'); await page.waitForTimeout(200);
await page.click('#daterange-trigger'); await page.waitForTimeout(200);
await page.click('#dr-grid button:has-text("10")'); await page.waitForTimeout(150);
await page.click('#dr-grid button:has-text("15")'); await page.waitForTimeout(250);
const dateVal = await page.inputValue('#manual-form [name="date"]');
const endVal = await page.inputValue('#manual-enddate');
const label = (await page.textContent('#daterange-trigger')).trim();
const popHiddenAfter = await page.locator('#daterange-pop').isHidden();
// absenden -> Werktage im Bereich
await page.click('#manual-submit'); await page.waitForTimeout(600);
const tarif = (await page.locator('#entries-body').innerText()).match(/Tarifurlaub/g)?.length || 0;
console.log('Pause-Button:', l1, '->', l2);
console.log('Gehen-Reset: offene Pause verworfen (pause-badges=', pauseBadges, ', erwartet 0)');
console.log('Bereich date/enddate:', dateVal, '/', endVal, '| Label:', label, '| Popover zu:', popHiddenAfter);
console.log('Tarifurlaub-Einträge (10.-15., Werktage):', tarif);
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
