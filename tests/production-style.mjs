import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM||path.resolve('package.json'));
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const dir=process.env.REPORT_DIR||'test-results/style';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{
 for(const width of [390,820,1440]){
  const page=await browser.newPage({viewport:{width,height:width===820?1180:900},locale:'ar-IQ',reducedMotion:'reduce'});
  const failures=[];page.on('pageerror',e=>failures.push(e.message));
  await page.goto(base,{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>localStorage.getItem('fanfood:cart:v1')!==null);
  const css=await page.request.get(base+'/menu-enhancements-v2.css');assert.equal(css.status(),200);assert.ok((await css.text()).includes('.location-map'));
  assert.equal(await page.locator('.search-hints').evaluate(e=>getComputedStyle(e).display),'flex');
  await page.locator('#menu').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${width}-menu.png`});
  await page.locator('[data-product-id="p016"] .add-button').click();await page.locator('.header-cart').click();
  const dialog=page.locator('dialog.cart-modal');await dialog.getByRole('button',{name:'كمّل بيانات التوصيل',exact:true}).click();
  await page.locator('#customer-name').fill('اختبار تنسيق');await page.locator('#customer-phone').fill('07701234567');await page.locator('#customer-address').fill('الجادرية، قرب جامعة بغداد');
  assert.equal(await page.locator('.phone-input').evaluate(e=>getComputedStyle(e).display),'flex');
  assert.equal(await page.locator('#customer-city').inputValue(),'بغداد');
  await page.locator('dialog.cart-modal .drawer-body').evaluate(e=>{e.scrollTop=0;});await page.screenshot({path:`${dir}/${width}-phone.png`});
  await page.getByRole('button',{name:'حدد موقع التوصيل على الخريطة',exact:true}).click();
  await page.waitForFunction(()=>!!document.querySelector('.location-map.leaflet-container'));
  const box=await page.locator('.location-map').boundingBox();assert.ok(box.height>=240&&box.width>=200,JSON.stringify(box));
  await page.locator('.location-map').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${width}-map.png`});
  await page.locator('.location-map').click({position:{x:140,y:110}});await page.locator('[data-testid="confirm-location"]').click();
  await dialog.getByRole('button',{name:'راجع رسالة الطلب',exact:true}).click();assert.ok((await page.locator('#order-message').inputValue()).includes('https://www.waze.com/ul?ll='));
  assert.deepEqual(failures,[]);
  results.push({width,status:'passed',mapBox:box,phoneDisplay:'flex',realOrdersSent:0});await page.close();
 }
}catch(error){results.push({status:'failed',error:String(error.stack||error)});console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(dir+'/report.json',JSON.stringify({base,results},null,2));await browser.close();}
