import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {activeMenuSection, isContinuousMenu} from '../src/lib/menu-scroll.mjs';
const sections = [{id:'popular',top:-1300},{id:'dolma',top:-500},{id:'rice',top:170},{id:'kubba',top:1800}];
test('Default and every real section show the entire menu, not a category subset',()=>{
 for(const category of ['popular','all','dolma','rice','kubba','sweets'])assert.equal(isContinuousMenu({category,query:'',sort:'default'}),true);
});
test('Only explicit search, sorting and favorites change the browsing mode',()=>{
 assert.equal(isContinuousMenu({category:'favorites'}),false);
 assert.equal(isContinuousMenu({category:'all',query:'كبة'}),false);
 assert.equal(isContinuousMenu({category:'rice',sort:'low'}),false);
 assert.equal(isContinuousMenu({category:'rice',sort:'high'}),false);
 assert.equal(isContinuousMenu({category:'popular',query:'  '}),true);
});
test('Scrollspy selects the last heading crossing the unobstructed reading line',()=>{
 assert.equal(activeMenuSection(sections,169),'dolma');assert.equal(activeMenuSection(sections,170),'rice');
 assert.equal(activeMenuSection(sections,1750),'rice');assert.equal(activeMenuSection(sections,1800),'kubba');
});
test('Scrolling upward selects the preceding section without requiring an intersection exit',()=>{
 assert.equal(activeMenuSection(sections,170),'rice');assert.equal(activeMenuSection(sections,169),'dolma');
});
test('Above the menu keeps the first section active and the footer keeps the last',()=>{
 assert.equal(activeMenuSection([{id:'popular',top:1000},{id:'rice',top:5000}],180),'popular');
 assert.equal(activeMenuSection(sections,9000),'kubba');assert.equal(activeMenuSection([],180),null);
 assert.equal(activeMenuSection([{id:'bad',top:NaN}],180),null);
});
test('The active section no longer remounts or filters the product list',()=>{
 const source=fs.readFileSync('src/components/menu-app.tsx','utf8');
 assert.ok(!source.includes('key={category}'));assert.ok(source.includes('data-menu-section={c.id}'));
 assert.ok(!source.includes("p.categoryId === category"));
 assert.ok(source.includes("window.addEventListener('scroll', this.onMenuScroll, {passive: true})"));
 assert.ok(source.includes("window.removeEventListener('scroll', this.onMenuScroll)"));
});
