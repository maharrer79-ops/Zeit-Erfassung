import { chromium } from 'playwright';
const B = 'http://localhost:4050';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]', 'Manuel');
await page.fill('input[name="email"]', 'z@test.de');
await page.fill('input[name="password"]', 'geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');

// Standard = Zeitraum: Bis sichtbar, Button-Text
const opt0 = (await page.locator('#manual-kind option').first().textContent()).trim();
const bisVisible = await page.locator('#manual-bis-field').isVisible();
const btn = (await page.textContent('#manual-submit')).trim();

// Zeitraum 08:00-12:00 als Session
await page.fill('input[name="start"]', '08:00:00');
await page.fill('input[name="end"]', '12:00:00');
await page.click('#manual-submit');
await page.waitForTimeout(500);

// Pause, dann zweite Session 12:30-16:30
await page.fill('input[name="start"]', '12:30:00');
await page.fill('input[name="end"]', '16:30:00');
await page.click('#manual-submit');
await page.waitForTimeout(500);

const badges = await page.locator('#entries-body .badge').allInnerTexts();
const statToday = (await page.textContent('#stat-today')).trim();

// Fehlversuch: Bis vor Von
await page.fill('input[name="start"]', '10:00:00');
await page.fill('input[name="end"]', '09:00:00');
await page.click('#manual-submit');
await page.waitForTimeout(400);
const toastText = (await page.textContent('#toast')).trim();

console.log('Standard-Option :', opt0, '| Bis sichtbar:', bisVisible, '| Button:', btn);
console.log('Badges (4 erwartet, 2xK/2xG):', badges);
console.log('Stat heute      :', statToday, '(erwartet 8,0 h: 4h + 4h, Pause zählt nicht)');
console.log('Fehler-Toast    :', toastText);
console.log('JS-Fehler       :', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length ? 1 : 0);
