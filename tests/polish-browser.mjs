import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM||path.resolve('package.json'));
const engines=require('playwright');const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const dir=process.env.REPORT_DIR||'test-results/polish';fs.mkdirSync(dir,{recursive:true});
const profiles=process.env.QUICK_SMOKE?[['chromium',390,844,'no-preference'],['webkit',390,844,'reduce'],['chromium',820,1180,'reduce'],['chromium',1440,1000,'no-preference']]:[['chromium',320,740,'reduce'],['chromium',390,844,'no-preference'],['chromium',430,932,'reduce'],['chromium',820,1180,'reduce'],['chromium',1440,1000,'no-preference'],['webkit',390,844,'reduce'],['webkit',820,1180,'reduce'],['firefox',1440,1000,'reduce']];
const results=[];let active;
async function aligned(page){
 await page.waitForFunction(()=>{
  const header=document.querySelector('.site-header').getBoundingClientRect();
  const anchor=document.querySelector('#category-start').getBoundingClientRect();
  const bar=document.querySelector('#category-bar').getBoundingClientRect();
  return Math.abs(anchor.top-header.bottom)<4&&Math.abs(bar.top-header.bottom)<4;
 },null,{timeout:15000});
 const a=await page.locator('#category-bar [aria-pressed="true"]').boundingBox(),b=await page.locator('#category-bar').boundingBox();
 assert.ok(a.x>=b.x-2&&a.x+a.width<=b.x+b.width+2,'Active tab visible horizontally');
}
try{
 for(const [engine,width,height,motion] of profiles){
  console.log('POLISH',engine,width,motion);
  const browser=await engines[engine].launch({headless:true});const context=await browser.newContext({viewport:{width,height},locale:'ar-IQ',reducedMotion:motion,hasTouch:width<1100});
  const page=await context.newPage();active=page;page.setDefaultTimeout(18000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  assert.equal((await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000})).status(),200);
  await page.waitForFunction(()=>localStorage.getItem('fanfood:cart:v1')!==null);
  await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,5000))]));
  const hero=page.locator('[data-testid="hero-photo"]');await hero.evaluate(async img=>{await img.decode();});
  const info=await hero.evaluate(img=>({w:img.naturalWidth,fit:getComputedStyle(img).objectFit,set:img.srcset,rect:img.getBoundingClientRect().toJSON()}));
  assert.ok(info.w>0);assert.equal(info.fit,'cover');assert.ok(info.set.includes('2000w'));assert.ok(info.rect.width>200&&info.rect.height>140);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(motion==='reduce')assert.equal(await page.locator('.hero-visual').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.waitForTimeout(motion==='reduce'?50:650);await page.screenshot({path:`${dir}/${engine}-${width}-home.png`});
  await page.locator('.hero-actions .button-primary').click();await aligned(page);
  const bar=page.locator('#category-bar');
  for(const label of ['كل المنيو','الكبة','الحلويات والمخبوزات','الأكثر طلباً']){await bar.getByRole('button',{name:label,exact:true}).click();await aligned(page);}
  await bar.getByRole('button',{name:'كل المنيو',exact:true}).click();await aligned(page);
  await page.locator('[data-product-id="p058"]').scrollIntoViewIfNeeded();
  await bar.getByRole('button',{name:'الكبة',exact:true}).click();await aligned(page);
  await page.screenshot({path:`${dir}/${engine}-${width}-categories.png`});
  const item=page.locator('[data-product-id="p016"]');await item.locator('.add-button').click();await item.locator('[data-action="increase"]').click();await item.locator('[data-action="decrease"]').click();assert.equal(await item.locator('.inline-stepper-number').textContent(),'1');
  await page.locator('.header-cart').click();const cart=page.locator('dialog.cart-modal');await cart.getByRole('button',{name:'كمّل بيانات التوصيل',exact:true}).click();
  assert.equal(await page.locator('#customer-city').inputValue(),'بغداد');assert.equal(await page.locator('#customer-area').count(),0);assert.equal(await page.locator('#customer-landmark').count(),0);assert.equal(await cart.locator('input').count(),4);
  assert.equal(await page.locator('#customer-address').getAttribute('placeholder'),'مثال: المنصور، قرب مول المنصور');
  await cart.getByRole('button',{name:'راجع رسالة الطلب',exact:true}).click();assert.ok(await page.locator('#customer-address-error').count());
  await page.locator('#customer-name').fill('تجربة الواجهة');await page.locator('#customer-phone').fill('٠٧٧٠١٢٣٤٥٦٧');await page.locator('#customer-address').fill('المنصور، قرب مول المنصور');await page.locator('#customer-note').fill('دگ الجرس');
  await cart.getByRole('button',{name:'راجع رسالة الطلب',exact:true}).click();let text=await page.locator('#order-message').inputValue();
  for(const part of ['المدينة: بغداد','العنوان: المنصور، قرب مول المنصور','دگ الجرس','+9647701234567'])assert.ok(text.includes(part),part);
  assert.equal((text.match(/العنوان:/g)||[]).length,1);assert.ok(!text.includes('المنطقة:'));assert.ok(!text.includes('waze.com'));
  let wa=new URL(await page.locator('[data-testid="send-order"]').getAttribute('href'));assert.equal(wa.searchParams.get('text'),text);assert.equal(wa.pathname,'/9647737773444');
  await cart.getByRole('button',{name:'تعديل البيانات',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cart-modal .drawer-body').scrollTop<2);assert.equal(await page.locator('#customer-address').inputValue(),'المنصور، قرب مول المنصور');
  await page.screenshot({path:`${dir}/${engine}-${width}-checkout.png`});
  await page.getByRole('button',{name:'حدد موقع التوصيل على الخريطة',exact:true}).click();await page.locator('.coordinates-details summary').click();await page.getByRole('textbox',{name:'خط العرض',exact:true}).fill('33.315200');await page.getByRole('textbox',{name:'خط الطول',exact:true}).fill('44.366100');await page.getByRole('button',{name:'استخدم الإحداثيات',exact:true}).click();await page.locator('[data-testid="confirm-location"]').click();
  await cart.getByRole('button',{name:'راجع رسالة الطلب',exact:true}).click();text=await page.locator('#order-message').inputValue();assert.ok(text.includes('waze.com/ul?ll=33.315200%2C44.366100'));assert.ok(text.includes('المنصور'));wa=new URL(await page.locator('[data-testid="send-order"]').getAttribute('href'));assert.equal(wa.searchParams.get('text'),text);
  await cart.getByRole('button',{name:'تعديل البيانات',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cart-modal .drawer-body').scrollTop<2);
  const persisted=await page.evaluate(()=>JSON.stringify({...localStorage}));assert.ok(!persisted.includes('المنصور'));assert.ok(!persisted.includes('44.366'));
  const bounds=await cart.boundingBox();assert.ok(bounds.width<=width+1&&bounds.height<=height+1);assert.deepEqual(errors,[]);
  results.push({engine,width,height,motion,status:'passed',realOrdersSent:0,checks:['full-bleed-hero','responsive-image','category-anchor','deep-scroll-switch','active-tab-visible','quick-cart','single-address','optional-map','whatsapp','step-scroll-reset','reduced-motion','no-overflow']});console.log('POLISH PASS',engine,width);
  await context.close();await browser.close();active=undefined;
 }
}catch(error){results.push({status:'failed',error:String(error.stack||error)});console.error(error);if(active)await active.screenshot({path:dir+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(dir+'/report.json',JSON.stringify({base,results,realOrdersSent:0},null,2));if(active)await active.context().browser()?.close();}
