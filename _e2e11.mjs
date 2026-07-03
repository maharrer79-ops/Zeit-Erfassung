import { chromium } from 'playwright';
const B = 'http://localhost:4080';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]', 'Manuel');
await page.fill('input[name="email"]', 'url@test.de');
await page.fill('input[name="password"]', 'geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');

// Tarifurlaub wählen -> Absenz-Felder sichtbar?
await page.selectOption('#manual-kind', '0100');
const endVisible = await page.locator('#manual-enddate-field').isVisible();
const hoursVisible = await page.locator('#manual-hours-field').isVisible();
const vonHidden = !(await page.locator('#manual-von-field').isVisible());
const dateLabel = (await page.textContent('#manual-date-label')).trim();
const btn = (await page.textContent('#manual-submit')).trim();

// Zeitraum Mo 06.07 - So 12.07, nur Werktage -> 5 Tage
await page.fill('input[name="date"]', '2026-07-06');
await page.fill('#manual-enddate', '2026-07-12');
await page.fill('#manual-hours', '8');
await page.click('#manual-submit');
await page.waitForTimeout(700);

// In der Liste zählen: Tarifurlaub-Einträge
const bodyText = await page.locator('#entries-body').innerText();
const tarifCount = (bodyText.match(/Tarifurlaub/g) || []).length;
const statTotal = (await page.textContent('#stat-total')).trim();

// Monatsblatt: 06.07 sollte Tarifurlaub zeigen, 11./12. (Sa/So) nicht
await page.click('a[href="/monat"]');
await page.waitForURL('**/monat**');
await page.waitForTimeout(500);
const sheet = await page.locator('#sheet-body').innerText();
const has06 = /06\.07\.[\s\S]*?Tarifurlaub/.test(sheet);

console.log('Absenz-Felder sichtbar :', endVisible, hoursVisible, '| Von versteckt:', vonHidden);
console.log('Datum-Label            :', dateLabel, '| Button:', btn);
console.log('Tarifurlaub-Einträge   :', tarifCount, '(erwartet 5, Sa+So ausgelassen)');
console.log('Gesamt-Stunden         :', statTotal, '(erwartet 40,0 h)');
console.log('Monatsblatt 06.07 Urlaub:', has06);
console.log('JS-Fehler              :', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length ? 1 : 0);
