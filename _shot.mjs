import { chromium } from 'playwright';
const B = 'http://localhost:4040';
const SP = process.env.SP;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]', 'Manuel Harrer');
await page.fill('input[name="email"]', 'm@test.de');
await page.fill('input[name="password"]', 'geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
const today = await page.inputValue('#punch-date');
for (const [t,dir] of [['08:00:00','kommen'],['12:00:00','gehen'],['12:45:00','kommen'],['16:30:00','gehen']]){
  await page.fill('#punch-time', t); await page.click(dir==='kommen'?'#punch-kommen':'#punch-gehen'); await page.waitForTimeout(150);
}
await page.waitForTimeout(400);
await page.screenshot({ path: SP + '/mobile-app.png', fullPage: true });
await page.goto(B + '/monat');
await page.waitForTimeout(500);
await page.screenshot({ path: SP + '/mobile-monat.png', fullPage: true });
await browser.close();
