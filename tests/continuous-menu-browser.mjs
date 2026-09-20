import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM||path.resolve('package.json'));
const engines=require('playwright');
const menu=JSON.parse(fs.readFileSync('src/data/menu.json','utf8'));
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const dir=process.env.REPORT_DIR||'test-results/continuous';fs.mkdirSync(dir,{recursive:true});
const profiles=process.env.QUICK_SMOKE?[['chromium',390,844,'no-preference'],['webkit',390,844,'reduce'],['chromium',1440,1000,'reduce']]:[['chromium',320,740,'reduce'],['chromium',390,844,'no-preference'],['chromium',820,1180,'reduce'],['chromium',1440,1000,'no-preference'],['webkit',390,844,'reduce'],['webkit',820,1180,'reduce'],['firefox',1440,1000,'reduce']];
const ids=['popular',...menu.categories.map(c=>c.id)];const results=[];let active;
async function selected(page,id){
 await page.waitForFunction(id=>document.querySelector('#category-bar [aria-current="location"]')?.getAttribute('aria-controls')==='menu-section-'+id,id);
 const geometry=await page.evaluate(()=>{
  const bar=document.getElementById('category-bar').getBoundingClientRect(),header=document.querySelector('.site-header').getBoundingClientRect(),tab=document.querySelector('#category-bar [aria-current="location"]').getBoundingClientRect();
  return {sticky:Math.abs(bar.top-header.bottom)<4,revealed:tab.left>=bar.left-2&&tab.right<=bar.right+2,overflow:document.documentElement.scrollWidth>innerWidth+1};
 });
 assert.ok(geometry.sticky,'Categories must remain pinned below the header');assert.ok(geometry.revealed,'Active tab remains horizontally visible');assert.ok(!geometry.overflow,'No page overflow');
}
async function manualScroll(page,id){
 // No category click: mimic a user scroll and measure the unobstructed section start.
 await page.evaluate(id=>{
  window.dispatchEvent(new WheelEvent('wheel',{deltaY:1}));
  const section=document.getElementById('menu-section-'+id);
  const offset=document.querySelector('.site-header').getBoundingClientRect().height+document.getElementById('category-bar').getBoundingClientRect().height+18;
  window.scrollTo({top:scrollY+section.getBoundingClientRect().top-offset,behavior:'instant'});
 },id);
 await selected(page,id);
}
try{
 for(const [engine,width,height,motion] of profiles){
  const browser=await engines[engine].launch({headless:true});
  const context=await browser.newContext({viewport:{width,height},locale:'ar-IQ',hasTouch:width<1100,reducedMotion:motion});
  const page=await context.newPage();active=page;page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>localStorage.getItem('fanfood:cart:v1')!==null);
  await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,4000))]));
  assert.equal(await page.locator('[data-menu-section]').count(),9);
  assert.equal(await page.locator('#menu-section-popular .product-card').count(),6);
  assert.equal(await page.locator('[data-menu-section]:not([data-menu-section="popular"]) .product-card').count(),58);
  assert.equal(await page.locator('.product-card').evaluateAll(cards=>new Set(cards.map(c=>c.dataset.productId)).size),58);
  assert.ok(await page.locator('.continue-menu').isVisible());
  await page.locator('#menu-section-kubba').evaluate(e=>{e.dataset.testIdentity='retained';});
  for(const id of ids)await manualScroll(page,id);
  for(const id of [...ids].reverse())await manualScroll(page,id);
  assert.equal(await page.locator('#menu-section-kubba').getAttribute('data-test-identity'),'retained','Scrollspy must not remount sections');
  // The user can tap any section without filtering the other 58 canonical dishes away.
  for(const id of ['sweets','rice','kubba']){
   await page.locator(`#category-bar [aria-controls="menu-section-${id}"]`).click();
   await page.waitForFunction(id=>{
    const bar=document.getElementById('category-bar').getBoundingClientRect(),section=document.getElementById('menu-section-'+id).getBoundingClientRect();
    return Math.abs(section.top-bar.bottom-18)<5;
   },id);
   await selected(page,id);assert.equal(await page.locator('.product-card').count(),64);
  }
  await page.screenshot({path:`${dir}/${engine}-${width}-scroll.png`});
  // Duplicated featured cards share one cart, not separate quantities.
  const canonical=page.locator('#menu-section-kubba [data-product-id="p016"]');
  await canonical.locator('.add-button').click();await canonical.locator('[data-action="increase"]').click();
  assert.equal(await page.locator('#menu-section-popular [data-product-id="p016"] .inline-stepper-number').innerText(),'2');
  assert.equal(await page.locator('.header-cart b').innerText(),'2');
  await canonical.locator('[data-action="decrease"]').click();await canonical.locator('[data-action="decrease"]').click();assert.equal(await page.locator('.header-cart b').innerText(),'0');
  // Search/sort/favorites remain explicit modes; resetting restores the full scrollable menu.
  await page.getByRole('searchbox').fill('نصف دجاجة');await page.waitForFunction(()=>document.querySelectorAll('.product-card').length===1);
  assert.equal(await page.locator('#category-bar [aria-current="location"]').count(),0);
  await page.locator('#category-bar [aria-controls="menu-section-rice"]').click();await selected(page,'rice');assert.equal(await page.locator('.product-card').count(),64);
  await page.getByRole('combobox',{name:'ترتيب الأصناف'}).selectOption('low');assert.equal(await page.locator('.product-card').count(),58);
  await page.locator('#category-bar [aria-controls="menu-section-dolma"]').click();assert.equal(await page.getByRole('combobox',{name:'ترتيب الأصناف'}).inputValue(),'default');await selected(page,'dolma');
  await page.locator('#menu-section-dolma [data-product-id="p001"] .favorite-button').click();
  await page.locator('#category-bar').getByRole('button',{name:/^المفضلة/}).click();assert.equal(await page.locator('.product-card').count(),1);
  await page.getByRole('button',{name:'رجوع لكل المنيو',exact:true}).click();await selected(page,'popular');assert.equal(await page.locator('.product-card').count(),64);
  await manualScroll(page,'rice');const savedY=await page.evaluate(()=>scrollY);
  // Tap the visible sticky control, without an automation-induced scrollIntoView.
  const cartBox=await page.locator('.header-cart').boundingBox();assert.ok(cartBox.y>=0&&cartBox.y+cartBox.height<height);
  await page.mouse.click(cartBox.x+cartBox.width/2,cartBox.y+cartBox.height/2);
  await page.waitForFunction(()=>document.querySelector('dialog.cart-modal[open]'));
  const closeBox=await page.getByRole('button',{name:'إغلاق السلة',exact:true}).boundingBox();
  await page.mouse.click(closeBox.x+closeBox.width/2,closeBox.y+closeBox.height/2);
  await page.waitForFunction(()=>!document.querySelector('dialog.cart-modal[open]'));
  await selected(page,'rice');assert.ok(Math.abs((await page.evaluate(()=>scrollY))-savedY)<5,'Closing cart must preserve reading position');
  assert.deepEqual(errors,[]);results.push({engine,width,height,motion,status:'passed',checks:['entire-catalog-without-clicking','nine-continuous-sections','scrollspy-down-and-up','sticky-visible-active-tab','no-remount','tap-scroll-not-filter','shared-featured-cart','search-and-sort-reset','favorites','modal-scroll-preservation'],realOrdersSent:0});
  console.log('CONTINUOUS MENU PASS',engine,width);await context.close();await browser.close();active=undefined;
 }
}catch(error){results.push({status:'failed',error:String(error.stack||error)});console.error(error);if(active){
 await active.evaluate(()=>({y:scrollY,active:document.querySelector('#category-bar [aria-current="location"]')?.getAttribute('aria-controls'),sections:[...document.querySelectorAll('[data-menu-section]')].map(e=>({id:e.dataset.menuSection,top:e.getBoundingClientRect().top}))})).then(data=>fs.writeFileSync(dir+'/failure-geometry.json',JSON.stringify(data,null,2))).catch(()=>{});
 await active.screenshot({path:dir+'/failure.png'}).catch(()=>{});
}process.exitCode=1;}
finally{fs.writeFileSync(dir+'/report.json',JSON.stringify({base,results,realOrdersSent:0},null,2));if(active)await active.context().browser()?.close();}
