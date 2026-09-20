import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM||path.resolve('package.json'));
const {chromium,webkit}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const dir=process.env.REPORT_DIR||'test-results/quick';fs.mkdirSync(dir,{recursive:true});
const profiles=process.env.QUICK_SMOKE?[['chromium',390,844],['chromium',820,1180],['chromium',1440,1000]]:[['chromium',320,740],['chromium',390,844],['chromium',820,1180],['chromium',1440,1000],['webkit',390,844]];
const results=[];let active;
try {
 for(const [engine,width,height] of profiles){
  const browser=await ({chromium,webkit}[engine]).launch({headless:true});
  const context=await browser.newContext({viewport:{width,height},locale:'ar-IQ',reducedMotion:'reduce',hasTouch:width<1100});
  const page=await context.newPage();active=page;page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>localStorage.getItem('fanfood:cart:v1')!==null);
  assert.equal(await page.locator('#menu-section-popular .product-card').count(),6);
  assert.equal(await page.locator('.category-nav button').first().innerText(),'الأكثر طلباً');
  assert.equal(await page.locator('.category-nav button').first().getAttribute('aria-pressed'),'true');
  const card=page.locator('[data-product-id="p016"]').first();
  await card.locator('.add-button').click();
  assert.equal(await page.locator('dialog').count(),0,'Single selection must not open a dialog');
  const stepper=card.locator('.card-stepper');const count=stepper.locator('.inline-stepper-number');
  assert.equal(await count.innerText(),'1');
  for(let i=0;i<4;i++)await stepper.locator('[data-action="increase"]').click();
  assert.equal(await count.innerText(),'5');
  await stepper.locator('[data-action="decrease"]').click();assert.equal(await count.innerText(),'4');
  const [photo,control,minus,plus]=await Promise.all([card.locator('.product-photo').boundingBox(),stepper.boundingBox(),stepper.locator('[data-action="decrease"]').boundingBox(),stepper.locator('[data-action="increase"]').boundingBox()]);
  assert.ok(control.x>=photo.x&&control.x+control.width<=photo.x+photo.width+1,'Control must fit inside the photo');
  assert.ok(minus.x<plus.x,'Trash left, plus right');assert.ok(minus.width>=43&&minus.height>=43&&plus.width>=43&&plus.height>=43,'Touch targets');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  await card.scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${engine}-${width}-quick.png`});
  for(let i=0;i<4;i++)await stepper.locator('[data-action="decrease"]').click();
  assert.equal(await stepper.count(),0);assert.ok(await card.locator('.add-button').isVisible());
  assert.equal(await page.locator('.header-cart b').innerText(),'0');
  // A note-only cart line must also decrement correctly from the product card.
  await card.locator('.photo-button').click();
  await page.locator('#item-note').fill('ملاحظة اختبار');
  await page.locator('dialog.product-modal').getByRole('button',{name:/أضف للسلة/}).click();
  assert.equal(await count.innerText(),'1');await stepper.locator('[data-action="decrease"]').click();
  assert.equal(await page.locator('.header-cart b').innerText(),'0');
  // Multi-variant products still open a choice sheet.
  await page.locator('[data-product-id="p002"] .add-button').first().click();
  assert.equal(await page.locator('dialog.product-modal .variant-option').count(),3);
  await page.getByRole('button',{name:'إغلاق تفاصيل الصنف',exact:true}).click();
  // The cart uses the same decrement-by-one behavior rather than deleting a full row.
  await card.locator('.add-button').click();for(let i=0;i<4;i++)await stepper.locator('[data-action="increase"]').click();
  await page.locator('.header-cart').click();const dialog=page.locator('dialog.cart-modal');
  const cartControls=dialog.locator('.cart-stepper');await cartControls.locator('[data-action="decrease"]').click();
  assert.equal(await cartControls.locator('.inline-stepper-number').innerText(),'4');
  for(let i=0;i<4;i++)await cartControls.locator('[data-action="decrease"]').click();
  assert.equal(await dialog.locator('.cart-line').count(),0);
  await page.getByRole('button',{name:'إغلاق السلة',exact:true}).click();
  // Search remains global when the initial selected tab is featured.
  await page.getByRole('searchbox').fill('نصف دجاجة');
  await page.waitForFunction(()=>document.querySelectorAll('.product-card').length===1);
  const half=page.locator('[data-product-id="p008"] .photo-button img');
  assert.equal(await half.getAttribute('src'),'/images/menu-v4/p008.webp');
  const response=await page.request.get(base+'/images/menu-v4/p008.webp');
  assert.equal(response.status(),200);assert.ok((await response.body()).length>10000);
  assert.deepEqual(errors,[]);
  results.push({engine,width,height,status:'passed',checks:['six-featured-products','single-variant-in-place','five-to-four','one-to-zero','note-preservation','multi-variant-sheet','cart-decrement','touch-targets','global-search','correct-image-path'],realOrdersSent:0});
  console.log('QUICK CONTROLS PASS',engine,width);
  await context.close();await browser.close();active=undefined;
 }
}catch(error){results.push({status:'failed',error:String(error.stack||error)});if(active)await active.screenshot({path:dir+'/failure.png'}).catch(()=>{});console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(dir+'/report.json',JSON.stringify({base,results,realOrdersSent:0},null,2));if(active)await active.context().browser()?.close();}
