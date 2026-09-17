import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM||path.resolve('package.json'));
const {chromium,webkit,firefox}=require('playwright');
const engines={chromium,webkit,firefox};
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const dir=process.env.REPORT_DIR||'test-results/enhancements';fs.mkdirSync(dir,{recursive:true});
const profiles=process.env.QUICK_SMOKE?[['chromium',390,844,'manual'],['chromium',820,1180,'granted'],['chromium',1440,1000,'denied']]:[['chromium',320,740,'manual'],['chromium',390,844,'granted'],['chromium',430,932,'denied'],['chromium',820,1180,'late'],['chromium',1024,768,'outside'],['chromium',1440,1000,'manual'],['webkit',390,844,'manual'],['webkit',820,1180,'manual'],['firefox',1440,1000,'denied']];
const results=[];let active;
try{
 for(const [engine,width,height,mode] of profiles){
  console.log('ENHANCEMENTS',engine,width,mode);
  const browser=await engines[engine].launch({headless:true});
  const context=await browser.newContext({viewport:{width,height},locale:'ar-IQ',reducedMotion:'reduce',hasTouch:width<1100});
  const page=await context.newPage();active=page;page.setDefaultTimeout(20000);
  await page.addInitScript(mode=>{
   window.__geoCalls=0;
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success,failure){window.__geoCalls++;if(mode==='denied')setTimeout(()=>failure({code:1}),20);else if(mode==='outside')setTimeout(()=>success({coords:{latitude:51.5,longitude:.1,accuracy:10}}),20);else if(mode==='late')window.__lateGPS=success;else setTimeout(()=>success({coords:{latitude:33.3,longitude:44.4,accuracy:12}}),20);}}});
  },mode);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const r=await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});assert.equal(r.status(),200);
  await page.waitForFunction(()=>localStorage.getItem('fanfood:cart:v1')!==null);
  assert.equal((await page.request.get(base+'/release.json')).status(),200);
  assert.equal((await(await page.request.get(base+'/release.json')).json()).release,'fanfood-baghdad-v2');
  assert.equal(await page.evaluate(()=>window.__geoCalls),0,'No unsolicited geolocation');
  const search=page.getByRole('searchbox');await search.fill('chicken escalope');
  await page.waitForFunction(()=>document.querySelector('.product-card')?.getAttribute('data-product-id')==='p044');
  await search.fill('تحت 15000');await page.waitForFunction(()=>document.querySelectorAll('.product-card').length>0&&document.querySelectorAll('.product-card').length<58);
  await search.fill('دولمه كورديه');await page.waitForFunction(()=>document.querySelector('.product-card')?.getAttribute('data-product-id')==='p003');
  await search.fill('');await page.waitForFunction(()=>document.querySelectorAll('.product-card').length===58);
  if(engine==='chromium'&&[390,820,1440].includes(width))await page.screenshot({path:`${dir}/${width}-menu.png`});
  await page.locator('[data-product-id="p001"] .add-button').click();
  await page.locator('dialog.product-modal').getByRole('button',{name:/أضف للسلة/}).click();
  await page.locator('.header-cart').click();const cart=page.locator('dialog.cart-modal');
  await cart.getByRole('button',{name:'كمّل بيانات التوصيل',exact:true}).click();
  assert.equal(await page.locator('#customer-city').inputValue(),'بغداد');assert.ok(await page.locator('#customer-city').getAttribute('readonly')!==null);
  assert.equal(await page.locator('.phone-prefix').innerText(),'+964');
  assert.equal(await page.locator('#customer-address').getAttribute('aria-required'),'false');
  await page.locator('#customer-name').fill('زبون اختبار');await page.locator('#customer-phone').fill('+964 770 123 4567');await page.locator('#customer-area').fill('الجادرية');
  assert.equal(await page.locator('#customer-phone').inputValue(),'770 123 4567');
  // No detailed address or pin required; opening review must not fabricate coordinates.
  await cart.getByRole('button',{name:'عاين رسالة الطلب',exact:true}).click();await page.locator('#order-message').waitFor();
  let message=await page.locator('#order-message').inputValue();assert.ok(!message.includes('waze.com'));assert.ok(message.includes('+9647701234567'));
  await cart.getByRole('button',{name:'تعديل البيانات',exact:true}).click();
  await page.getByRole('button',{name:'حدد موقع التوصيل على الخريطة',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__geoCalls),0);
  assert.ok(await page.locator('[data-testid="confirm-location"]').isDisabled());
  await page.waitForFunction(()=>document.querySelector('.location-map.leaflet-container')!==null);
  if(mode==='manual'){
   await page.locator('[data-testid="delivery-map"]').click({position:{x:130,y:110}});
   await page.waitForFunction(()=>!document.querySelector('[data-testid="confirm-location"]').disabled);
   assert.ok(await page.locator('.delivery-pin.leaflet-marker-draggable').count()>0);
  }
  if(mode!=='manual'){
   await page.locator('[data-testid="locate-me"]').click();
   if(mode==='granted')await page.waitForFunction(()=>!document.querySelector('[data-testid="confirm-location"]').disabled);
   if(mode==='denied')await page.getByText('الوصول للموقع غير مسموح.',{exact:false}).waitFor();
   if(mode==='outside'){await page.getByText('الموقع بعيد عن بغداد.',{exact:false}).waitFor();assert.ok(await page.locator('[data-testid="confirm-location"]').isDisabled());}
  }
  if(mode!=='granted'){
   await page.locator('.coordinates-details summary').click();await page.getByRole('textbox',{name:'خط العرض',exact:true}).fill('33.315200');await page.getByRole('textbox',{name:'خط الطول',exact:true}).fill('44.366100');
   await page.getByRole('button',{name:'استخدم الإحداثيات',exact:true}).click();
  }
  if(mode==='late'){await page.evaluate(()=>window.__lateGPS?.({coords:{latitude:33.4,longitude:44.5,accuracy:10}}));}
  if(engine==='chromium'&&width===390){await page.locator('.location-map').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${width}-map.png`});}
  await page.locator('[data-testid="confirm-location"]').click();
  assert.ok(await page.getByText('تم تحديد موقع التوصيل',{exact:true}).isVisible());
  const href=await page.getByRole('link',{name:'شاهد الموقع على Waze',exact:true}).getAttribute('href');
  assert.equal(new URL(href).searchParams.get('ll'),mode==='granted'?'33.300000,44.400000':'33.315200,44.366100');
  if(engine==='chromium'&&[390,820,1440].includes(width)){await page.locator('dialog.cart-modal .drawer-body').evaluate(e=>{e.scrollTop=0;});await page.screenshot({path:`${dir}/${width}-checkout.png`});}
  await cart.getByRole('button',{name:'عاين رسالة الطلب',exact:true}).click();message=await page.locator('#order-message').inputValue();
  const wa=new URL(await page.locator('[data-testid="send-order"]').getAttribute('href'));
  assert.equal(wa.origin,'https://wa.me');assert.equal(wa.pathname,'/9647737773444');assert.equal(wa.searchParams.get('text'),message);
  for(const text of ['المدينة: بغداد','الجادرية','+9647701234567','ورق عنب','8,000',href])assert.ok(message.includes(text),text);
  assert.ok(!message.includes('العنوان:'));assert.ok(!message.includes('NaN'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const bounds=await cart.boundingBox();assert.ok(bounds.width<=width+1&&bounds.height<=height+1);
  const saved=await page.evaluate(()=>JSON.stringify({...localStorage}));for(const text of ['زبون اختبار','الجادرية','33.315','44.366','7701234567'])assert.ok(!saved.includes(text),'Customer data remains transient');
  await cart.getByRole('button',{name:'تعديل البيانات',exact:true}).click();await page.getByRole('button',{name:'حذف موقع التوصيل',exact:true}).click();
  await cart.getByRole('button',{name:'عاين رسالة الطلب',exact:true}).click();assert.ok(!(await page.locator('#order-message').inputValue()).includes('waze.com'));
  assert.deepEqual(errors,[]);
  results.push({engine,width,height,mode,status:'passed',realOrdersSent:0});console.log('PASS',engine,width,mode);
  await context.close();await browser.close();active=undefined;
 }
}catch(error){results.push({status:'failed',error:String(error.stack||error)});if(active)await active.screenshot({path:dir+'/failure.png'}).catch(()=>{});console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(dir+'/report.json',JSON.stringify({base,created:new Date().toISOString(),results,realOrdersSent:0},null,2));if(active)await active.context().browser()?.close();}
