import { chromium } from 'playwright';
const B = 'http://localhost:4310';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','rp@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
// Refresh-Button
const refreshVisible = await page.locator('#refresh-btn').isVisible();
await page.click('#refresh-btn'); await page.waitForTimeout(300);
// Kommen + Pause starten
await page.click('#start-btn'); await page.waitForTimeout(300);
await page.click('#pause-toggle'); await page.waitForTimeout(400);
// Offene Pause im Log sichtbar ("läuft")?
const bodyText = await page.locator('#entries-body').innerText();
const runningPauseShown = /läuft/.test(bodyText);
const pauseRowsWhileRunning = await page.locator('#entries-body .badge.pause').count();
// Jetzt Gehen -> Pause soll ENDE bekommen (nicht gelöscht)
await page.waitForTimeout(1100);
await page.click('#stop-btn'); await page.waitForTimeout(500);
const bodyAfter = await page.locator('#entries-body').innerText();
const pauseRowsAfter = await page.locator('#entries-body .badge.pause').count();
const hasCompletedPause = /Pause/.test(bodyAfter) && !/läuft/.test(bodyAfter);
console.log('Refresh-Button sichtbar:', refreshVisible);
console.log('Laufende Pause im Log ("läuft"):', runningPauseShown, '| Pause-Zeilen:', pauseRowsWhileRunning);
console.log('Nach Gehen: Pause-Zeilen:', pauseRowsAfter, '| fertige Pause ohne läuft:', hasCompletedPause);
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
