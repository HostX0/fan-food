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
  if(!normalizePhone(customer.phone)) errors.phone='اكتب رقم موبايل عراقي صحيح، مثل 770 123 4567.';
  if(normalizeSearch(customer.city)!=='بغداد') errors.city='التوصيل متوفر داخل بغداد فقط.';
  if(cleanText(customer.address,200).trim().length<5) errors.address='اكتب المنطقة وأقرب نقطة دالة، مثل المنصور قرب مول المنصور.';
  if(customer.location && !validLocation(customer.location)) errors.location='اختار موقع توصيل صحيح داخل بغداد.';
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
    'المدينة: بغداد',
    'العنوان: '+cleanText(customer.address,200),
    ...(validLocation(customer.location)?['موقع التوصيل (Waze): '+wazeUrl(customer.location)]:[]),
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

/** Only used to reject obviously out-of-city pins, not as a delivery-service polygon. */
export const BAGHDAD_BOUNDS = { south: 33.0, north: 33.65, west: 44.05, east: 44.8 };
export function validLocation(value) {
  if (!value || typeof value !== 'object') return false;
  const {lat, lng} = value;
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= BAGHDAD_BOUNDS.south && lat <= BAGHDAD_BOUNDS.north
    && lng >= BAGHDAD_BOUNDS.west && lng <= BAGHDAD_BOUNDS.east;
}
export function wazeUrl(location) {
  if (!validLocation(location)) return '';
  return 'https://www.waze.com/ul?ll=' + encodeURIComponent(location.lat.toFixed(6) + ',' + location.lng.toFixed(6)) + '&navigate=yes&zoom=17';
}
export function nationalPhoneInput(value) {
  let n = westernDigits(value).replace(/[^0-9]/g, '');
  if (n.startsWith('00964')) n = n.slice(5);
  else if (n.startsWith('964')) n = n.slice(3);
  if (n.startsWith('0')) n = n.slice(1);
  // Preserve overlong inputs for validation instead of silently changing a pasted phone number.
  return n.slice(0, 15);
}
export function formatNationalPhone(value) {
  const n = nationalPhoneInput(value);
  return n.length === 10 ? n.slice(0,3) + ' ' + n.slice(3,6) + ' ' + n.slice(6) : n;
}
