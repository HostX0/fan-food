import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateCustomer,buildMessage,addLine,whatsappUrl,wazeUrl} from '../src/lib/core.mjs';
const {products}=JSON.parse(fs.readFileSync('src/data/menu.json','utf8'));
const customer={name:'زبون اختبار',phone:'+9647701234567',city:'بغداد',address:'المنصور، قرب مول المنصور',note:''};
const cart=addLine([],products[0],products[0].variants[0].id,1);
test('One combined address replaces separate area and landmark fields',()=>{
 assert.deepEqual(validateCustomer(customer),{});const text=buildMessage(cart,products,customer,'QA');
 assert.ok(text.includes('العنوان: المنصور، قرب مول المنصور'));assert.equal((text.match(/العنوان:/g)||[]).length,1);assert.ok(!text.includes('المنطقة:'));assert.ok(!text.includes('أقرب نقطة دالة:'));
});
test('Empty, missing and too-short combined addresses show an address error',()=>{
 for(const address of ['',undefined,'   ','ا','بغ'])assert.ok(validateCustomer({...customer,address}).address);
 assert.equal(validateCustomer({...customer,address:''}).area,undefined);
});
test('A pin is optional and does not replace the readable address',()=>{
 const location={lat:33.3152,lng:44.3661,source:'manual'};assert.deepEqual(validateCustomer({...customer,location}),{});
 assert.ok(validateCustomer({...customer,address:'',location}).address);assert.ok(!buildMessage(cart,products,customer,'QA').includes('waze.com'));
 const text=buildMessage(cart,products,{...customer,location,note:'دگ الجرس'},'QA');assert.ok(text.includes(wazeUrl(location)));assert.ok(text.includes('دگ الجرس'));assert.equal(new URL(whatsappUrl('9647737773444',text)).searchParams.get('text'),text);
});
test('No separate area or landmark inputs remain',()=>{
 const src=fs.readFileSync('src/components/menu-app.tsx','utf8');assert.ok(!src.includes("renderField('area'"));assert.ok(!src.includes("renderField('landmark'"));assert.ok(src.includes('مثال: المنصور، قرب مول المنصور'));assert.ok(src.includes('LocationPicker'));
});
test('Navigation uses an original-position anchor and horizontal-only active-tab reveal',()=>{
 const src=fs.readFileSync('src/components/menu-app.tsx','utf8');assert.ok(src.includes('id="category-start"'));assert.ok(src.includes('id="category-bar"'));assert.ok(src.includes('bar.scrollBy'));assert.ok(src.includes('ResizeObserver'));assert.ok(!src.includes("getElementById('menu')?.scrollIntoView"));
});
test('Hero is a responsive dedicated full-bleed image and respects reduced motion',()=>{
 const src=fs.readFileSync('src/components/menu-app.tsx','utf8');const css=fs.readFileSync('public/menu-polish-v5.css','utf8');assert.ok(src.includes('/images/hero-v5/table-1440.webp'));assert.ok(src.includes('data-testid="hero-photo"'));assert.ok(css.includes('object-fit:cover'));assert.ok(css.includes('prefers-reduced-motion:reduce'));
});
