import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM||path.resolve('package.json'));
const {chromium,webkit,firefox}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const dir=process.env.REPORT_DIR||'test-results/final';fs.mkdirSync(dir,{recursive:true});
const menu=JSON.parse(fs.readFileSync('src/data/menu.json','utf8'));
const profiles=process.env.QUICK_SMOKE?[['chromium',390,844],['chromium',820,1180],['chromium',1440,1000]]:[['chromium',320,740],['chromium',390,844],['chromium',820,1180],['chromium',1440,1000],['webkit',390,844],['firefox',1440,1000]];
const results=[];let active;
try{
 for(const [engine,width,height] of profiles){
  const browser=await ({chromium,webkit,firefox}[engine]).launch({headless:true});
  const context=await browser.newContext({viewport:{width,height},locale:'ar-IQ',reducedMotion:'reduce',hasTouch:width<1100});
  const page=await context.newPage();active=page;page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>localStorage.getItem('fanfood:cart:v1')!==null);
  assert.equal(await page.locator('#menu-section-popular .product-card').count(),6);
  assert.ok((await page.locator('#menu-title').innerText()).includes('مشتهي اليوم'));
  assert.ok(!(await page.locator('body').innerText()).includes('يطيّب خاطرك'));
  await page.locator('.category-nav').getByRole('button',{name:'كل المنيو',exact:true}).click();
  assert.equal(await page.locator('[data-menu-section]:not([data-menu-section="popular"]) .product-description').count(),58);
  const descriptions=await page.locator('.product-card').evaluateAll(cards=>cards.map(c=>({id:c.dataset.productId,text:c.querySelector('.product-description').textContent,size:parseFloat(getComputedStyle(c.querySelector('.product-description')).fontSize),src:c.querySelector('.photo-button img').getAttribute('src'),set:c.querySelector('.photo-button img').getAttribute('srcset')})));
  for(const d of descriptions){const p=menu.products.find(p=>p.id===d.id);assert.equal(d.text,p.description);assert.ok(d.size>=11.5);assert.equal(d.src,p.image);assert.ok(d.set.includes('480w'));}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  // The first six retain quick add; food and controls remain inside each card at all widths.
  const card=page.locator('[data-product-id="p016"]').first();await card.locator('.add-button').click();
  await card.locator('[data-action="increase"]').click();assert.equal(await card.locator('.inline-stepper-number').textContent(),'2');
  const [photo,control]=await Promise.all([card.locator('.product-photo').boundingBox(),card.locator('.card-stepper').boundingBox()]);
  assert.ok(control.x>=photo.x&&control.x+control.width<=photo.x+photo.width+1);
  await page.locator('.category-nav').getByRole('button',{name:'الكبة',exact:true}).click();
  await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,5000))]));
  await page.locator('[data-product-id="p018"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${dir}/${engine}-${width}-kubba.png`});
  await page.getByRole('searchbox').fill('معكرونة');await page.waitForFunction(()=>document.querySelectorAll('.product-card').length===1);
  await page.locator('[data-product-id="p047"] .add-button').click();
  const modal=page.locator('dialog.product-modal');
  await modal.locator('input[name="choice"][value="دجاج"]').check();
  assert.equal(await modal.locator('.modal-photo img').getAttribute('src'),'/images/menu-v4/p047-chicken.webp');
  await modal.getByRole('button',{name:/أضف للسلة/}).click();await page.locator('.header-cart').click();
  const pastaLine=page.locator('dialog.cart-modal .cart-line').filter({hasText:'معكرونة'});
  assert.equal(await pastaLine.locator('img').getAttribute('src'),'/images/menu-v4/p047-chicken-sm.webp');
  await page.getByRole('button',{name:'إغلاق السلة',exact:true}).click();
  await page.getByRole('searchbox').fill('شلغم');assert.ok(await page.locator('[data-product-id="p020"]').isVisible());
  await page.locator('.menu-disclosures summary').click();assert.ok((await page.locator('.menu-disclosures').innerText()).includes('مو وصفة المطعم الكاملة'));
  // Every optimized image is local and decodable. Only one profile makes the full network pass.
  if(engine==='chromium'&&width===390){
   const assets=[...menu.products.flatMap(p=>[p.image,p.image.replace('.webp','-sm.webp')]),'/images/menu-v4/p047-chicken.webp','/images/menu-v4/p047-chicken-sm.webp'];
   for(let n=0;n<assets.length;n+=8)await Promise.all(assets.slice(n,n+8).map(async asset=>{const r=await page.request.get(base+asset);assert.equal(r.status(),200,asset);assert.ok((await r.body()).length>5000);}));
  }
  assert.deepEqual(errors,[]);
  results.push({engine,width,height,status:'passed',checks:['58-visible-descriptions','unified-responsive-images','iraqi-copy','quick-controls','pasta-choice-photo','ingredient-search','no-overflow','all-local-assets'],realOrdersSent:0});
  console.log('FINAL MENU PASS',engine,width);await context.close();await browser.close();active=undefined;
 }
}catch(error){results.push({status:'failed',error:String(error.stack||error)});if(active)await active.screenshot({path:dir+'/failure.png'}).catch(()=>{});console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(dir+'/report.json',JSON.stringify({base,results,realOrdersSent:0},null,2));if(active)await active.context().browser()?.close();}
