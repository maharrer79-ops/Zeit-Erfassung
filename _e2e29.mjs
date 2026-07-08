import { chromium } from 'playwright';
const B = 'http://localhost:4300';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('dialog', d => d.accept()); // beide confirms bestätigen
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]','Del'); await page.fill('input[name="email"]','del@test.de'); await page.fill('input[name="password"]','geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
// etwas Daten
await page.click('#start-btn'); await page.waitForTimeout(300);
const btnVisible = await page.locator('#delete-account-btn').isVisible();
await page.click('#delete-account-btn');
await page.waitForURL('**/'); await page.waitForTimeout(300);
const url = page.url();
// Login mit gelöschtem Account soll fehlschlagen
const res = await page.evaluate(async ()=>{
  const r = await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'del@test.de',password:'geheim123'})});
  return r.status;
});
console.log('Button sichtbar:', btnVisible);
console.log('Nach Löschen URL endet auf / :', url.endsWith('/') || /:\d+\/$/.test(url), url);
console.log('Login nach Löschen Status:', res, '(erwartet 401)');
console.log('JS-Fehler:', errors.length ? errors : 'keine');
await browser.close();
process.exit(errors.length?1:0);
