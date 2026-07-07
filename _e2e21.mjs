import { chromium } from 'playwright';
const B = 'http://localhost:4200';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','M'); await page.fill('input[name="email"]','ht@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
// Setze Soll heute = 8 (localStorage) fuer Saldo
await page.evaluate(()=>localStorage.setItem('zeitwerk_soll','8'));
async function session(von,bis){ await page.selectOption('#manual-kind','session'); await page.fill('input[name="start"]',von); await page.fill('input[name="end"]',bis); await page.click('#manual-submit'); await page.waitForTimeout(400); }
// heute: 2 Sessions, Lücke 30min -> gearbeitet, pause, sessions=2
await session('08:00:00','10:00:00');
await session('10:30:00','13:30:00'); // 3h, pause 30min -> total 5h, pause 30min, saldo -3
// reload to apply localStorage soll in render (already rendered, force reload)
await page.reload(); await page.waitForTimeout(600);
const today = (await page.textContent('#ov-today')).trim();
const pause = (await page.textContent('#ov-pause')).trim();
const saldo = (await page.textContent('#ov-saldo')).trim();
const sessions = (await page.textContent('#ov-sessions')).trim();
console.log('Gearbeitet heute:', today, '(erwartet 5,0 h)');
console.log('Pause heute     :', pause, '(erwartet 30:00 min)');
console.log('Saldo heute     :', saldo, '(erwartet -3,0 h, Wochentag; am Wochenende +5,0)');
console.log('Sitzungen       :', sessions, '(erwartet 2)');
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
