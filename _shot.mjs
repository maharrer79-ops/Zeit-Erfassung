import { chromium } from 'playwright';
const B = 'http://localhost:4330';
const SP = process.env.SP;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
await page.goto(B + '/');
await page.click('[data-auth="register"]');
await page.fill('input[name="name"]', 'Manuel Harrer'); await page.fill('input[name="email"]', 'm@test.de'); await page.fill('input[name="password"]', 'geheim123');
await page.click('#auth-form button[type=submit]');
await page.waitForURL('**/app');
for (const [t,dir] of [['08:00:00','kommen'],['12:00:00','gehen'],['12:30:00','kommen'],['16:30:00','gehen']]){ await page.fill('#punch-time',t); await page.click(dir==='kommen'?'#punch-kommen':'#punch-gehen'); await page.waitForTimeout(150);}
await page.waitForTimeout(400);
const r = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth}));
// find widest element
const widest = await page.evaluate(()=>{
  let max=0, tag='';
  document.querySelectorAll('*').forEach(el=>{ if(el.scrollWidth>max && el.getBoundingClientRect().width>document.documentElement.clientWidth+1){ } });
  // elements exceeding viewport
  const over=[];
  document.querySelectorAll('body *').forEach(el=>{ const w=el.getBoundingClientRect().width; if(w>document.documentElement.clientWidth+1) over.push((el.id?'#'+el.id:el.className||el.tagName)+':'+Math.round(w)); });
  return over.slice(0,8);
});
console.log('overflow:', r.sw, r.cw, r.sw<=r.cw+1?'OK':'ÜBERLAUF');
console.log('zu breit:', widest);
await page.screenshot({ path: SP + '/m-app2.png', fullPage: true });
await browser.close();
