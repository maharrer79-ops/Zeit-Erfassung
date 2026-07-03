import { chromium } from 'playwright';
const B = 'http://localhost:4090';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]', 'Manuel');
await page.fill('input[name="email"]', 'x4@test.de');
await page.fill('input[name="password"]', 'geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');

const today = await page.inputValue('input[name="date"]');

// (2) Beschreibung bei Zeitraum: session 08:00-12:00 mit Beschreibung "Projekt A"
await page.selectOption('#manual-kind','session');
await page.fill('input[name="description"]','Projekt A');
await page.fill('input[name="start"]','08:00:00');
await page.fill('input[name="end"]','12:00:00');
await page.click('#manual-submit');
await page.waitForTimeout(500);
const bodyText1 = await page.locator('#entries-body').innerText();
const descSaved = /Projekt A/.test(bodyText1);

// (1) Überlappung: session 10:00-11:00 überschneidet -> Fehler
await page.fill('input[name="description"]','Overlap');
await page.fill('input[name="start"]','10:00:00');
await page.fill('input[name="end"]','11:00:00');
await page.click('#manual-submit');
await page.waitForTimeout(500);
const toastText = (await page.textContent('#toast')).trim();
const countProjektA = (await page.locator('#entries-body').innerText()).match(/Kommen/g)?.length || 0;

// (3) Bearbeiten-Button bei Stempel vorhanden + Bearbeiten funktioniert
const editButtons = await page.locator('#entries-body [data-edit]').count();
// Ersten Kommen-Stempel bearbeiten: Zeit auf 07:30 ändern
await page.locator('#entries-body [data-edit]').first().click();
await page.waitForTimeout(300);
const punchDirVisible = await page.locator('#edit-punchdir-field').isVisible();
const bisHidden = !(await page.locator('#edit-bis-field').isVisible());
await page.fill('#edit-form input[name="start"]','07:30:00');
await page.click('#edit-form button[type=submit]');
await page.waitForTimeout(500);
const has0730 = /07:30/.test(await page.locator('#entries-body').innerText());

// (4) Freitag-Soll im Monatsblatt
await page.goto(B + '/monat');
await page.waitForTimeout(400);
const frInput = await page.locator('#soll-fr-input').count();
await page.fill('#soll-fr-input','6');
await page.waitForTimeout(300);
// eine Freitagszeile finden und Soll prüfen
const rows = await page.locator('#sheet-body tr').count();

console.log('(2) Beschreibung gespeichert:', descSaved);
console.log('(1) Overlap-Toast:', toastText, '| Kommen-Zeilen bleibt:', countProjektA, '(erwartet 1)');
console.log('(3) Edit-Buttons:', editButtons, '| punchdir sichtbar:', punchDirVisible, '| Bis versteckt:', bisHidden, '| 07:30 übernommen:', has0730);
console.log('(4) Freitag-Soll-Feld vorhanden:', frInput===1);
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length ? 1 : 0);
