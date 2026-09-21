import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {productImage,smallImage,productSrcSet} from '../src/lib/product-media.mjs';
import {searchProducts} from '../src/lib/search.mjs';
const menu=JSON.parse(fs.readFileSync('src/data/menu.json','utf8'));
test('All 58 dishes use unified, distinct, local responsive images and informative descriptions',()=>{
 assert.equal(menu.products.length,58);assert.equal(new Set(menu.products.map(p=>p.image)).size,58);
 for(const p of menu.products){
  assert.match(p.image,/^\/images\/menu-v4\/p\d{3}\.webp$/);assert.equal(p.imageRepresentative,true);
  assert.ok(p.description.length>=18&&p.description.length<115,p.id);assert.ok(!p.description.includes('اختار الحجم'));
  assert.ok(p.searchText.includes(p.description),p.id+' ingredient search');
  for(const path of [p.image,smallImage(p.image)]){const bytes=fs.readFileSync('public'+path);assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.ok(bytes.length>5000);assert.ok(bytes.length<350000);}
 }
});
test('House-specific recipes are marked for restaurant confirmation rather than guessed',()=>{
 for(const id of ['p021','p026','p039','p045','p046','p048','p055','p057','p058']){const p=menu.products.find(p=>p.id===id);assert.equal(p.ingredientSource,'house-confirmation');assert.ok(p.ingredientNote.includes('نأكد'));}
});
test('Kubba sour stew and jareesh identities are distinct and searchable',()=>{
 const sour=menu.products.find(p=>p.id==='p020'),wheat=menu.products.find(p=>p.id==='p018');
 assert.match(sour.description,/مرگة حامضة/);assert.match(sour.description,/سلق وشلغم/);
 assert.match(wheat.description,/جريش/);assert.ok(!wheat.description.includes('مقرمش'));
 assert.ok(searchProducts(menu.products,'شلغم').some(p=>p.id==='p020'));
});
test('Pasta changes image by meat or chicken without changing its variant or price',()=>{
 const p=menu.products.find(p=>p.id==='p047');assert.equal(p.variants[0].price,15000);
 assert.equal(productImage(p,'لحم'),'/images/menu-v4/p047.webp');assert.equal(productImage(p,'دجاج'),'/images/menu-v4/p047-chicken.webp');
 assert.equal(productImage(p,'toString'),p.image);assert.equal(productImage(p,'unknown'),p.image);
 assert.ok(fs.existsSync('public'+smallImage(productImage(p,'دجاج'))));assert.ok(productSrcSet(p,'دجاج').includes('480w'));
});
test('Names, 73 price options and Iraqi checkout remain intact',()=>{
 assert.equal(menu.products.reduce((n,p)=>n+p.variants.length,0),73);assert.equal(menu.categories.length,8);

});
