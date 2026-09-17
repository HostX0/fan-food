import {normalizeSearch} from './core.mjs';
// No network, analytics, or AI service: the full catalog is searched locally.
const aliases = {
  dolma:'دولمة', kubba:'كبة', kibbeh:'كبة', kibba:'كبة', biryani:'برياني', biriyani:'برياني',
  rice:'رز', chicken:'دجاج', beef:'لحم', lamb:'لحم', meat:'لحم', fish:'سمك',
  samosa:'سمبوسة', sambosa:'سمبوسة', sambousek:'سمبوسة', borek:'بورك',
  burger:'همبرغر', kofta:'كفتة', kebab:'كباب', kleicha:'كليجة', klecha:'كليجة',
  escalope:'سكالوب', schnitzel:'سكالوب', pasta:'معكرونة', macaroni:'معكرونة', pizza:'بيتزا', cheese:'جبن', spinach:'سبانغ',
  walnut:'جوز', pistachio:'فستق', dates:'تمر', dessert:'حلويات', sweets:'حلويات',
  maqluba:'مقلوبة', kabsa:'كبسة', qouzi:'قوزي', quzi:'قوزي', musakhan:'مسخن',
  بسمتي:'رز', ارز:'رز', تمن:'تمن', دياي:'دجاج', فراخ:'دجاج',
  سبانخ:'سبانغ', سامبوسه:'سمبوسة', سمبوسك:'سمبوسة', سمبوسه:'سمبوسة',
  برغر:'همبرغر', برجر:'همبرغر', همبركر:'همبرغر', مكرونه:'معكرونة',
};
const stop = new Set(['من','مع','و','او','اكل','اكله','اريد','ابحث','عن','the','and','with']);
const canonical = text => normalizeSearch(text).replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(Boolean).map(t=>{const plain=t.replace(/^(?:بال|لل|ال)(?=.{3,})/u,'');return normalizeSearch(aliases[plain]||plain);});
function editDistance(a,b) {
  if(Math.abs(a.length-b.length)>2)return 9;
  let previous=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++) {
    const next=[i];
    for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
    previous=next;
  }
  return previous[b.length];
}
function parseQuery(input) {
  let q=normalizeSearch(input).replace(/grape\s+leaves/g,'ورق عنب');
  let maxPrice=Infinity;
  q=q.replace(/(?:اقل\s+من|تحت|بحدود|لحد|حتى|under|below)\s*(\d+(?:[.,]\d+)?)\s*(الف|k)?/g,(_,number,unit)=>{
    maxPrice=Number(number.replace(',','.'))*(unit?1000:1);return ' ';
  });
  return {phrase:canonical(q).join(' '),terms:canonical(q).filter(t=>!stop.has(t)),maxPrice};
}
/** Exact name > name tokens > metadata. Typo tolerance is deliberately conservative. */
export function searchProducts(products, input='') {
  const {phrase,terms,maxPrice}=parseQuery(input);
  if(!terms.length)return products.filter(p=>Math.min(...p.variants.map(v=>v.price))<=maxPrice);
  return products.map((product,index)=>{
    if(Math.min(...product.variants.map(v=>v.price))>maxPrice)return null;
    const names=canonical(product.name),name=names.join(' ');
    const words=canonical([product.name,product.searchText,...product.choices,...product.variants.map(v=>v.label)].join(' '));
    let score=name===phrase?100:name.includes(phrase)?60:0;
    for(const term of terms) {
      if(names.includes(term)){score+=18;continue;}
      if(names.some(w=>w.includes(term))){score+=13;continue;}
      if(words.includes(term)){score+=8;continue;}
      if(words.some(w=>w.includes(term))){score+=5;continue;}
      const threshold=term.length>=7?2:term.length>=4?1:0;
      // No fuzzy matching of numeric sizes or short words.
      if(threshold&&!/\d/.test(term)&&words.some(w=>w.length>=4&&editDistance(term,w)<=threshold)){score+=1;continue;}
      return null;
    }
    return {product,index,score};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.index-b.index).map(r=>r.product);
}
