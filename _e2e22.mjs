import { chromium } from 'playwright';
const B = 'http://localhost:4210';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','tm@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
async function session(von,bis){ await page.selectOption('#manual-kind','session'); await page.fill('input[name="start"]',von); await page.fill('input[name="end"]',bis); await page.click('#manual-submit'); await page.waitForTimeout(400); }
await session('08:00:00','12:00:00');
await session('12:20:00','16:00:00');
await page.waitForTimeout(300);

// Tag-Ansicht (Standard): Labels
const tagLabels = await page.locator('#mini-stats .l').allInnerTexts();
const monthNavHiddenTag = await page.locator('#month-prev').isHidden();
const projGone = await page.locator('#project-breakdown').count();

// Auf Monat umschalten
await page.click('#ov-toggle button[data-view="monat"]');
await page.waitForTimeout(300);
const monatLabels = await page.locator('#mini-stats .l').allInnerTexts();
const monthNavShown = await page.locator('#month-prev').isVisible();
const monthLabel = (await page.textContent('#month-label')).trim();

console.log('Tag-Labels    :', tagLabels, '| Monatsnav versteckt:', monthNavHiddenTag);
console.log('Projekt-Karte weg:', projGone===0);
console.log('Monat-Labels  :', monatLabels, '| Monatsnav sichtbar:', monthNavShown, '| Label:', monthLabel);
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
