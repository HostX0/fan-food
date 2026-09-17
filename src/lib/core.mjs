/** Shared, dependency-free ordering logic. Prices are always read from the catalog. */
export const MAX_QUANTITY = 99;
export function cleanText(value, max = 300) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0,max);
}
export function westernDigits(value) {
  return String(value ?? '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
}
export function normalizeSearch(value) {
  return westernDigits(value).toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/[ىی]/g,'ي').replace(/ک/g,'ك').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
}
export function normalizePhone(value) {
  let s = westernDigits(value).replace(/[\s()+.-]/g,'');
  if(s.startsWith('00964')) s=s.slice(2);
  if(/^07\d{9}$/.test(s)) return '964'+s.slice(1);
  if(/^7\d{9}$/.test(s)) return '964'+s;
  return /^9647\d{9}$/.test(s) ? s : '';
}
export function formatPrice(n) { return new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n); }
export function lineKey(productId,variantId,choice='',note='') { return JSON.stringify([productId,variantId,cleanText(choice,40),cleanText(note,160)]); }
export function expandCart(cart, products) {
  return cart.flatMap(line=>{
    const product=products.find(p=>p.id===line.productId);
    const variant=product?.variants.find(v=>v.id===line.variantId);
    if(!product||!variant) return [];
    return [{...line, product, variant, total:variant.price*line.quantity}];
  });
}
export function sanitizeCart(raw,products) {
  if(!Array.isArray(raw)) return [];
  const result=new Map();
  for(const candidate of raw.slice(0,200)) {
    if(!candidate||typeof candidate!=='object') continue;
    const product=products.find(p=>p.id===candidate.productId);
    const variant=product?.variants.find(v=>v.id===candidate.variantId);
    const quantity=Number(candidate.quantity);
    if(!product||!variant||!Number.isInteger(quantity)||quantity<1) continue;
    const choice=cleanText(candidate.choice,40);
    if((product.choices.length && !product.choices.includes(choice))||(!product.choices.length&&choice)) continue;
    const note=cleanText(candidate.note,160);
    const key=lineKey(product.id,variant.id,choice,note);
    const previous=result.get(key)?.quantity??0;
    result.set(key,{key,productId:product.id,variantId:variant.id,quantity:Math.min(MAX_QUANTITY,quantity+previous),choice,note});
  }
  return Array.from(result.values());
}
export function totals(cart,products) {
  const lines=expandCart(cart,products);
  return {count:lines.reduce((n,l)=>n+l.quantity,0),subtotal:lines.reduce((n,l)=>n+l.total,0)};
}
export function addLine(cart,product,variantId,quantity=1,choice='',note='') {
  const variant=product.variants.find(v=>v.id===variantId);
  if(!variant||!Number.isInteger(quantity)||quantity<1||quantity>MAX_QUANTITY) return cart;
  if(product.choices.length&&!product.choices.includes(choice))return cart;
  const normalizedNote=cleanText(note,160); const key=lineKey(product.id,variantId,choice,normalizedNote);
  const existing=cart.find(l=>l.key===key);
  if(existing) return cart.map(l=>l.key===key?{...l,quantity:Math.min(MAX_QUANTITY,l.quantity+quantity)}:l);
  return [...cart,{key,productId:product.id,variantId,quantity,choice:cleanText(choice,40),note:normalizedNote}];
}
export function validateCustomer(customer) {
  const errors={};
  if(cleanText(customer.name,70).length<2) errors.name='اكتب الاسم، حرفين على الأقل.';
  if(!normalizePhone(customer.phone)) errors.phone='اكتب رقم موبايل عراقي صحيح، مثل 07XXXXXXXXX.';
  if(cleanText(customer.city,60).length<2) errors.city='اكتب اسم المدينة.';
  if(cleanText(customer.area,80).length<2) errors.area='اكتب اسم المنطقة.';
  if(cleanText(customer.address,200).length<4) errors.address='اكتب العنوان بوضوح حتى يوصل طلبك.';
  return errors;
}
export function makeReference(now = new Date(), random = Math.random()) {
  return 'FF-'+now.toISOString().slice(0,10).replaceAll('-','')+'-'+Math.floor(random*0xffff).toString(16).padStart(4,'0').toUpperCase();
}
export function buildMessage(cart,products,customer,reference) {
  const lines=expandCart(cart,products);
  if(!lines.length) throw new Error('EMPTY_CART');
  if(Object.keys(validateCustomer(customer)).length) throw new Error('INVALID_CUSTOMER');
  const t=totals(cart,products);
  const message=[
    '*طلب جديد — فن فود*',
    'مرجع الطلب: '+cleanText(reference,40),
    '', '*بيانات الزبون*',
    'الاسم: '+cleanText(customer.name,70),
    'الهاتف: +'+normalizePhone(customer.phone),
    'المدينة: '+cleanText(customer.city,60),
    'المنطقة: '+cleanText(customer.area,80),
    'العنوان: '+cleanText(customer.address,200),
    ...(cleanText(customer.landmark,120)?['أقرب نقطة دالة: '+cleanText(customer.landmark,120)]:[]),
    '', '*تفاصيل الطلب*',
  ];
  for(const [i,l] of lines.entries()) {
    message.push(`${i+1}. ${l.product.name} — ${l.variant.label}${l.choice?' — '+l.choice:''}`);
    message.push(`الكمية: ${l.quantity} × ${formatPrice(l.variant.price)} د.ع = ${formatPrice(l.total)} د.ع`);
    if(l.note)message.push('ملاحظة الصنف: '+cleanText(l.note,160));
  }
  message.push('','*مجموع الأصناف: '+formatPrice(t.subtotal)+' د.ع*');
  message.push('أجور التوصيل وأي إضافات غير مسعّرة غير مشمولة بالمجموع.');
  if(cleanText(customer.note,500)) message.push('','ملاحظات الطلب: '+cleanText(customer.note,500));
  message.push('','يرجى تأكيد التوفّر وموعد التجهيز وأجور التوصيل والمبلغ النهائي.');
  return message.join('\n');
}
export function whatsappUrl(number,message='') {
  if(!/^\d{10,15}$/.test(number)) throw new Error('INVALID_WHATSAPP_NUMBER');
  return 'https://wa.me/'+number+(message?'?text='+encodeURIComponent(message):'');
}
