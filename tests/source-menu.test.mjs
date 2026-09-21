import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchProducts} from '../src/lib/search.mjs';
const menu=JSON.parse(readFileSync(new URL('../src/data/menu.json',import.meta.url)));
// Independently extracted from the user's Fan_Food_Menu_Final.xlsx, Menu!A2:E74.
const source=JSON.parse(readFileSync(new URL('./fixtures/final-menu-source.json',import.meta.url)));
test('Every final spreadsheet option keeps its exact name, category, quantity and price',()=>{
 const actual=menu.products.flatMap(p=>p.variants.map(v=>({row:v.sourceRow,name:v.sourceName,category:menu.categories.find(c=>c.id===p.categoryId).name,size:v.label,price:v.price}))).sort((a,b)=>a.row-b.row);
 const expected=source.map(r=>({row:r.row,name:r.name,category:r.category,size:r.row===16?'وسط • '+r.size:r.row===17?'كبيرة • '+r.size:r.row===63?'عائلي':r.size||'الطبق',price:r.price}));
 assert.deepEqual(actual,expected);
});
test('Corrected kubba names and musakhan category are searchable and retain their prices',()=>{
 for(const [id,name,category,price] of [['p017','كبة بتيتة جاب','kubba',8000],['p021','كبة فن فود','kubba',12000],['p027','المسخن','samosa',8000]]){
  const p=menu.products.find(p=>p.id===id);assert.equal(p.name,name);assert.equal(p.categoryId,category);assert.equal(p.variants[0].price,price);assert.equal(searchProducts(menu.products,name)[0].id,id);
 }
 assert.ok(!menu.products.some(p=>['كبة التمن','مثلثات فن فود'].includes(p.name)));
});
