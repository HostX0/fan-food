import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM || path.resolve('package.json'));
const {chromium, webkit, firefox} = require('playwright');
const menu = JSON.parse(fs.readFileSync('src/data/menu.json','utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const output = process.env.REPORT_DIR || 'test-results/browser';
fs.mkdirSync(output,{recursive:true});
const results=[];
let activePage;
const profiles = process.env.QUICK_SMOKE ? [['chromium',390,844],['chromium',820,1180],['chromium',1440,1000]] : [['chromium',320,740],['chromium',360,800],['chromium',390,844],['chromium',430,932],['chromium',768,1024],['chromium',820,1180],['chromium',1024,768],['chromium',1440,1000],['webkit',390,844],['webkit',820,1180],['firefox',1440,1000]];
const engines={chromium,webkit,firefox};
async function hydrate(page){
 await page.waitForFunction(()=>{try{return localStorage.getItem('fanfood:cart:v1')!==null;}catch{return false;}},{},{timeout:20000});
}
async function count(page,n){await page.waitForFunction(n=>document.querySelectorAll('.product-card').length===n,n);}
async function fits(page,label){
 const measurement=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(measurement.scroll<=measurement.width+1,`${label}: page overflows ${JSON.stringify(measurement)}`);
}
try {
 for(const [engine,width,height] of profiles){
  console.log(`START ${engine} ${width}x${height}`);
  const browser=await engines[engine].launch({headless:true});
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,locale:'ar-IQ',reducedMotion:'reduce',hasTouch:width<1100});
  const page=await context.newPage(); activePage=page;
  page.setDefaultTimeout(15000);
  const errors=[];const failedAssets=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)failedAssets.push(`${r.status()} ${r.url()}`);});
  const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response.status(),200);
  await hydrate(page);await count(page,6);
  await page.locator('.category-nav').getByRole('button',{name:'كل المنيو',exact:true}).click();await count(page,menu.products.length);
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  assert.equal(await page.locator('html').getAttribute('lang'),'ar');
  await fits(page,'initial');
  if([390,820,1440].includes(width)&&engine==='chromium'){
   await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,6000))]));
   await page.screenshot({path:`${output}/${engine}-${width}-home.png`});
  }
  const nav=page.locator('.category-nav');
  for(const category of menu.categories){
   await nav.getByRole('button',{name:category.name,exact:true}).click();
   await count(page,menu.products.filter(p=>p.categoryId===category.id).length);
   await fits(page,category.name);
  }
  await nav.getByRole('button',{name:'كل المنيو',exact:true}).click();
  const search=page.getByRole('searchbox');
  // Search includes category names; use the full dish to test Arabic letter normalization.
  await search.fill('دولمه كورديه');
  await count(page,1);
  assert.equal(await page.locator('.product-card h3').textContent(),'دولمة كوردية');
  await search.fill('zxqnonexistent987');await count(page,0);
  await search.fill('');await count(page,menu.products.length);
  const first=menu.products[0];
  await page.locator(`[data-product-id="${first.id}"] .favorite-button`).click();
  await nav.getByRole('button',{name:/^المفضلة/}).click();await count(page,1);
  assert.equal(await page.locator('.product-card').getAttribute('data-product-id'),first.id);
  await nav.getByRole('button',{name:'كل المنيو',exact:true}).click();
  await page.getByRole('combobox',{name:'ترتيب الأصناف'}).selectOption('low');
  const ids=await page.locator('.product-card').evaluateAll(cards=>cards.map(c=>c.dataset.productId));
  const prices=ids.map(id=>Math.min(...menu.products.find(p=>p.id===id).variants.map(v=>v.price)));
  assert.deepEqual(prices,[...prices].sort((a,b)=>a-b));
  await page.getByRole('combobox',{name:'ترتيب الأصناف'}).selectOption('default');
  await page.locator(`[data-product-id="${first.id}"] .add-button`).click();
  const product=page.locator('dialog.product-modal');await product.waitFor({state:'visible'});
  const variant=first.variants[1];
  await product.locator('label.variant-option').nth(1).click();
  await product.locator('#item-note').fill('بدون فلفل');
  await product.getByRole('button',{name:'زيادة عدد العبوات',exact:true}).click();
  await product.getByRole('button',{name:/أضف للسلة/}).click();
  await product.waitFor({state:'detached'});
  await page.waitForFunction(()=>document.querySelector('.header-cart b')?.textContent==='2');
  await page.reload({waitUntil:'domcontentloaded'});await hydrate(page);
  await nav.getByRole('button',{name:'كل المنيو',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.header-cart b')?.textContent==='2');
  const pasta=menu.products.find(p=>p.choices.length);
  await page.locator(`[data-product-id="${pasta.id}"] .add-button`).click();
  await page.locator('dialog.product-modal label').filter({has:page.locator('input[name="choice"][value="دجاج"]')}).click();
  await page.locator('dialog.product-modal').getByRole('button',{name:/أضف للسلة/}).click();
  await page.locator('dialog.product-modal').waitFor({state:'detached'});
  await page.locator('.header-cart').click();
  const cart=page.locator('dialog.cart-modal');await cart.waitFor({state:'visible'});
  assert.equal(await cart.locator('.cart-line').count(),2);
  await cart.getByRole('button',{name:`زيادة كمية ${first.name}`,exact:true}).click();
  await cart.getByRole('button',{name:`تقليل كمية ${first.name}`,exact:true}).click();
  const total=variant.price*2+pasta.variants[0].price;
  assert.equal((await cart.locator('.total-line .price b').textContent()).replaceAll(',',''),String(total));
  await cart.getByRole('button',{name:'كمّل بيانات التوصيل',exact:true}).click();
  await cart.getByRole('button',{name:'عاين رسالة الطلب',exact:true}).click();
  assert.ok(await cart.locator('[aria-invalid="true"]').count()>=3);
  await page.locator('#customer-name').fill('اختبار الواجهة');
  await page.locator('#customer-phone').fill('٠٧٧٠٠٠٠٠٠٠٠');
  await page.locator('#customer-area').fill('منطقة اختبار');
  await page.locator('#customer-address').fill('عنوان تجريبي لفحص الواجهة فقط');
  await page.locator('#customer-landmark').fill('نقطة دالة تجريبية');
  await page.locator('#customer-note').fill('اختبار محلي — لا يرسل للمطعم');
  await cart.getByRole('button',{name:'عاين رسالة الطلب',exact:true}).click();
  await page.locator('[data-testid="send-order"]').waitFor();
  const message=await page.locator('#order-message').inputValue();
  const link=new URL(await page.locator('[data-testid="send-order"]').getAttribute('href'));
  assert.equal(link.origin,'https://wa.me');assert.equal(link.pathname,'/9647737773444');
  assert.equal(link.searchParams.get('text'),message);
  for(const value of [first.name,variant.label,'بدون فلفل',pasta.name,'دجاج','اختبار الواجهة','+9647700000000','منطقة اختبار','نقطة دالة تجريبية',new Intl.NumberFormat('en-US').format(total),'أجور التوصيل'])assert.ok(message.includes(value),`Missing ${value}`);
  const box=await cart.boundingBox();assert.ok(box.width<=width+1&&box.height<=height+1,'Modal exceeds viewport');
  await fits(page,'checkout');
  if([390,820,1440].includes(width)&&engine==='chromium')await page.screenshot({path:`${output}/${engine}-${width}-checkout.png`});
  // Only inspect the prepared URL. Never open WhatsApp or send a real order.
  await cart.getByRole('button',{name:'إغلاق السلة',exact:true}).click();
  await page.locator('.header-cart').click();
  await page.locator('dialog.cart-modal').getByRole('button',{name:`حذف ${pasta.name}`,exact:true}).click();
  assert.equal(await page.locator('dialog.cart-modal .cart-line').count(),1);
  await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});
  const footer=page.getByRole('link',{name:'By The Third Act LLC',exact:true});
  assert.equal(await footer.getAttribute('href'),'https://the-3rdact.com/');
  const stored=await page.evaluate(()=>localStorage.getItem('fanfood:cart:v1'));
  assert.ok(stored&&!stored.includes('اختبار الواجهة'),'Customer data not stored');
  if(engine==='chromium'&&width===390){
   for(const asset of [...new Set(menu.products.map(p=>p.image)), '/images/logo.png','/images/hero.webp','/images/brand-pattern.webp','/icon.svg','/manifest.webmanifest']){
    const r=await context.request.get(new URL(asset,base).href);assert.equal(r.status(),200,asset);assert.ok((await r.body()).length>0,asset);
   }
  }
  assert.deepEqual(errors,[],'Browser JavaScript errors');assert.deepEqual(failedAssets,[],'Failed same-origin requests');
  results.push({engine,width,height,status:'passed',catalog:menu.products.length,checks:['responsive-layout','eight-categories','arabic-search','empty-search','favorites','sort','variants','quantity','notes','persistence','pasta-choice','cart-total','required-fields','arabic-phone','whatsapp-recipient-and-message','modal-fit','remove','escape','agency-link','no-runtime-errors']});
  console.log(`PASS ${engine} ${width}x${height}`);
  await context.close();await browser.close();activePage=undefined;
 }
} catch(error){
 results.push({status:'failed',error:String(error.stack||error)});
 if(activePage)await activePage.screenshot({path:`${output}/failure.png`}).catch(()=>{});
 console.error(error);process.exitCode=1;
} finally {
 fs.writeFileSync(`${output}/report.json`,JSON.stringify({base,createdAt:new Date().toISOString(),results,realOrdersSent:0},null,2));
 if(activePage)await activePage.context().browser()?.close();
}
