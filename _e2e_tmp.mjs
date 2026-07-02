import { chromium } from 'playwright';

const B = 'http://localhost:3555';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(async () => {
  return chromium.launch();
});
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

// Registrieren -> Redirect zu /app
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]', 'Manuel Harrer');
await page.fill('input[name="email"]', 'e2e@test.de');
await page.fill('input[name="password"]', 'geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');

// Manuellen Eintrag mit Sekunden anlegen
await page.fill('input[name="description"]', 'E2E Test');
await page.fill('input[name="start"]', '09:00:15');
await page.fill('input[name="end"]', '11:30:45');
await page.click('#manual-form button[type=submit]');
await page.waitForTimeout(600);

const monthLabel = await page.textContent('#month-label');
const ovTotal = await page.textContent('#ov-total');
const ovDays = await page.textContent('#ov-days');
const dayRows = await page.locator('.day-row').count();
const projRows = await page.locator('.proj-row').count();
const durCell = await page.locator('#entries-body td.dur').first().textContent();

console.log('Monat-Label :', monthLabel);
console.log('Monat-Summe :', ovTotal);
console.log('Arbeitstage :', ovDays);
console.log('Tages-Zeilen:', dayRows);
console.log('Projekt-Zln :', projRows);
console.log('Dauer-Zelle :', durCell, '(erwartet HH:MM:SS)');
console.log('JS-Fehler   :', errors.length ? errors : 'keine');

await browser.close();
process.exit(errors.length ? 1 : 0);
