'use client';
import * as React from 'react';
import type {DeliveryLocation} from '../lib/types';
import {validLocation, wazeUrl, westernDigits} from '../lib/core.mjs';
import {Icon} from './icon';

type Point={lat:number;lng:number};
type MapEvent={latlng:Point};
type MapHandle={setView:(point:[number,number],zoom:number)=>MapHandle;on:(event:string,callback:(e:MapEvent)=>void)=>MapHandle;getCenter:()=>Point;invalidateSize:()=>void;remove:()=>void};
type MarkerHandle={addTo:(map:MapHandle)=>MarkerHandle;setLatLng:(point:[number,number])=>MarkerHandle;on:(event:string,callback:()=>void)=>MarkerHandle;getLatLng:()=>Point;remove:()=>void};
type Leaflet={map:(element:HTMLElement,options:Record<string,unknown>)=>MapHandle;tileLayer:(url:string,options:Record<string,unknown>)=>{addTo:(map:MapHandle)=>unknown;on:(event:string,callback:()=>void)=>unknown};marker:(point:[number,number],options:Record<string,unknown>)=>MarkerHandle;divIcon:(options:Record<string,unknown>)=>unknown};
declare global {interface Window {L?:Leaflet}}
let leafletPromise:Promise<Leaflet>|null=null;
/** Served with the site, never from an expiring Drive URL or a third-party script CDN. */
function loadLeaflet():Promise<Leaflet>{
  if(window.L)return Promise.resolve(window.L);
  if(leafletPromise)return leafletPromise;
  leafletPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-fanfood-map]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href='/vendor/leaflet/leaflet.css';css.dataset.fanfoodMap='true';document.head.append(css);
    }
    const script=document.createElement('script');script.src='/vendor/leaflet/leaflet.js';script.async=true;
    const timeout=setTimeout(()=>{script.remove();leafletPromise=null;reject(new Error('MAP_TIMEOUT'));},15000);
    script.onload=()=>{clearTimeout(timeout);if(window.L)resolve(window.L);else{leafletPromise=null;reject(new Error('MAP_LOAD'));}};
    script.onerror=()=>{clearTimeout(timeout);script.remove();leafletPromise=null;reject(new Error('MAP_LOAD'));};
    document.head.append(script);
  });
  return leafletPromise;
}
export function LocationPicker({value,onChange,error}:{value:DeliveryLocation|null|undefined;onChange:(location:DeliveryLocation|null)=>void;error?:string}){
  const [open,setOpen]=React.useState(false);
  const [draft,setDraft]=React.useState<DeliveryLocation|null>(null);
  const [status,setStatus]=React.useState<'loading'|'ready'|'error'>('loading');
  const [hint,setHint]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const [coords,setCoords]=React.useState({lat:'',lng:''});
  const [retry,setRetry]=React.useState(0);
  const [tilesError,setTilesError]=React.useState(false);
  const node=React.useRef<HTMLDivElement>(null);
  const map=React.useRef<MapHandle|null>(null);
  const marker=React.useRef<MarkerHandle|null>(null);
  const library=React.useRef<Leaflet|null>(null);
  const request=React.useRef(0);
  const mounted=React.useRef(true);
  React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current++;};},[]);
  function pick(point:Point,source:'gps'|'manual'='manual',accuracy?:number){
    request.current++;setBusy(false);
    if(!validLocation(point)){setHint('الموقع بعيد عن بغداد. اختار عنوان التوصيل داخل بغداد.');return;}
    const next:DeliveryLocation={lat:point.lat,lng:point.lng,source,...(accuracy?{accuracy}: {})};
    setDraft(next);setHint('راجع الدبوس واضغط «اعتمد هذا الموقع».');
    setCoords({lat:point.lat.toFixed(6),lng:point.lng.toFixed(6)});
  }
  React.useEffect(()=>{
    if(!open)return;
    let cancelled=false;setStatus('loading');setTilesError(false);
    loadLeaflet().then(L=>{
      if(cancelled||!node.current)return;
      library.current=L;
      const center: [number,number]=validLocation(value)?[value.lat,value.lng]:[33.3152,44.3661];
      const instance=L.map(node.current,{scrollWheelZoom:false,keyboard:true,zoomControl:true,minZoom:10,maxZoom:19}).setView(center,value?16:12);
      map.current=instance;
      const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'});
      tiles.on('tileerror',()=>{if(!cancelled)setTilesError(true);});tiles.addTo(instance);
      instance.on('click',e=>pick(e.latlng));
      setStatus('ready');setTimeout(()=>{if(!cancelled)instance.invalidateSize();},200);
    }).catch(()=>{if(!cancelled){setStatus('error');setHint('تعذّر تحميل الخريطة. استخدم موقعي الحالي أو أدخل الإحداثيات، أو أعد المحاولة.');}});
    return()=>{cancelled=true;request.current++;map.current?.remove();map.current=null;marker.current=null;};
    // The map is created only on an explicit open, never for every form keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[open,retry]);
  React.useEffect(()=>{
    if(!map.current||!library.current||!draft||status!=='ready')return;
    if(marker.current)marker.current.setLatLng([draft.lat,draft.lng]);
    else{
      marker.current=library.current.marker([draft.lat,draft.lng],{draggable:true,title:'موقع التوصيل — اسحب الدبوس للتعديل',keyboard:true,icon:library.current.divIcon({className:'delivery-pin',html:'<span></span>',iconSize:[32,40],iconAnchor:[16,39]})}).addTo(map.current);
      marker.current.on('dragend',()=>{if(marker.current)pick(marker.current.getLatLng());});
    }
  },[draft,status]);
  function start(){setDraft(validLocation(value)?value:null);setCoords(value?{lat:value.lat.toFixed(6),lng:value.lng.toFixed(6)}:{lat:'',lng:''});setHint('اضغط مكان التوصيل على الخريطة، أو استخدم موقعك الحالي.');setOpen(true);}
  function locate(){
    if(!navigator.geolocation){setHint('هذا المتصفح لا يدعم تحديد الموقع. اختار موقعك على الخريطة يدوياً.');return;}
    const id=++request.current;setBusy(true);setHint('جاري تحديد موقعك… اسمح بالوصول للموقع من رسالة المتصفح.');
    navigator.geolocation.getCurrentPosition(position=>{
      if(!mounted.current||id!==request.current)return;
      const point={lat:position.coords.latitude,lng:position.coords.longitude};pick(point,'gps',position.coords.accuracy);
      if(validLocation(point))map.current?.setView([point.lat,point.lng],17);
    },failure=>{
      if(!mounted.current||id!==request.current)return;
      setBusy(false);setHint(failure.code===1?'الوصول للموقع غير مسموح. اختار المكان يدوياً على الخريطة، أو افتح الموقع في Safari / Chrome واسمح بالموقع.':failure.code===3?'تأخر تحديد الموقع. أعد المحاولة أو اختار المكان على الخريطة.':'ما قدرنا نحدد موقعك. اختار عنوان التوصيل يدوياً على الخريطة.');
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  }
  function useCoordinates(){
    if(!coords.lat.trim()||!coords.lng.trim()){setHint('اكتب خط العرض وخط الطول معاً.');return;}
    const point={lat:Number(westernDigits(coords.lat).replace(',','.')),lng:Number(westernDigits(coords.lng).replace(',','.'))};
    pick(point);if(validLocation(point))map.current?.setView([point.lat,point.lng],17);
  }
  return <div className="form-field wide location-field" id="customer-location">
    <div className="field-label">موقع التوصيل<small>اختياري — يساعد المندوب يوصل بسهولة</small></div>
    {validLocation(value)&&<div className="saved-location"><Icon name="done" size={20}/><div><strong>تم تحديد موقع التوصيل</strong><a href={wazeUrl(value)} target="_blank" rel="noopener noreferrer">شاهد الموقع على Waze</a></div><button type="button" className="icon-button" aria-label="حذف موقع التوصيل" onClick={()=>{onChange(null);setOpen(false);}}><Icon name="trash"/></button></div>}
    {!open?<button type="button" className="button button-outline full location-open" onClick={start}><Icon name="pin"/>{value?'تعديل موقع التوصيل':'حدد موقع التوصيل على الخريطة'}</button>:<div className="location-panel">
      <div className="location-actions"><button type="button" className="button button-outline" onClick={locate} disabled={busy} data-testid="locate-me"><Icon name="pin"/>{busy?'جاري تحديد الموقع…':'استخدم موقعي الحالي'}</button><button type="button" className="text-link" onClick={()=>{request.current++;setBusy(false);setOpen(false);}}>إلغاء</button></div>
      <p className="location-hint" role="status" aria-live="polite">{hint}</p>
      <div className="location-map-wrap"><div ref={node} className="location-map" role="region" aria-label="خريطة تحديد موقع التوصيل" data-testid="delivery-map"/>{status==='loading'&&<div className="map-loading">جاري تحميل الخريطة…</div>}</div>
      {status==='error'&&<button type="button" className="text-link" onClick={()=>setRetry(n=>n+1)}>إعادة تحميل الخريطة</button>}
      {tilesError&&<p className="field-help">النت ضعيف وصور الخريطة ما اكتملت. لا تعتمد دبوساً غير واضح؛ تگدر تستخدم GPS أو الإحداثيات أدناه.</p>}
      {status==='ready'&&<button type="button" className="map-center-button" onClick={()=>{if(map.current)pick(map.current.getCenter());}}>اختيار مركز الخريطة <span>حرّك وكبّر الخريطة أولاً</span></button>}
      <details className="coordinates-details"><summary>أدخل الإحداثيات يدوياً</summary><p className="field-help">الصق إحداثيات عنوانك من تطبيق الخرائط: خط العرض ثم خط الطول.</p><div className="coordinates-grid"><label>خط العرض<input aria-label="خط العرض" inputMode="decimal" dir="ltr" placeholder="33.315200" value={coords.lat} onChange={e=>setCoords(c=>({...c,lat:e.target.value}))}/></label><label>خط الطول<input aria-label="خط الطول" inputMode="decimal" dir="ltr" placeholder="44.366100" value={coords.lng} onChange={e=>setCoords(c=>({...c,lng:e.target.value}))}/></label></div><button type="button" className="text-link" onClick={useCoordinates}>استخدم الإحداثيات</button></details>
      {draft&&<div className="pin-summary"><span dir="ltr">{draft.lat.toFixed(6)}, {draft.lng.toFixed(6)}</span>{draft.source==='gps'&&draft.accuracy&&<small>الدقة التقريبية: {Math.round(draft.accuracy)} متر. راجع الدبوس وعدّله عند الحاجة.</small>}</div>}
      <button type="button" className="button button-primary full" data-testid="confirm-location" disabled={!draft||busy} onClick={()=>{if(validLocation(draft)){onChange(draft);setOpen(false);}}}><Icon name="check"/>اعتمد هذا الموقع</button>
    </div>}
    {error&&<p className="field-error" role="alert">{error}</p>}
    <p className="field-help">التوصيل داخل بغداد فقط. الموقع يُضاف كرابط Waze إلى رسالة الطلب، ولا يُحفظ على جهازك.</p>
  </div>;
}
