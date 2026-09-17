import * as React from 'react';
import { faArrowLeft, faArrowRight, faBagShopping, faBasketShopping, faMagnifyingGlass, faXmark, faPlus, faMinus, faTrashCan, faHeart, faLeaf, faUtensils, faBowlRice, faWheatAwn, faBreadSlice, faPizzaSlice, faFireFlameCurved, faBellConcierge, faCookieBite, faPhone, faLocationDot, faCheck, faChevronDown, faChevronLeft, faCopy, faSliders, faCircleInfo, faHouse, faTruckFast, faShieldHeart, faArrowUp, faList, faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp, faInstagram } from '@fortawesome/free-brands-svg-icons';
const icons = { arrow: faArrowLeft, back: faArrowRight, bag: faBagShopping, basket: faBasketShopping, search: faMagnifyingGlass, close: faXmark, plus: faPlus, minus: faMinus, trash: faTrashCan, heart: faHeart, leaf: faLeaf, all: faUtensils, bowl: faBowlRice, wheat: faWheatAwn, bread: faBreadSlice, triangle: faPizzaSlice, fire: faFireFlameCurved, cloche: faBellConcierge, cookie: faCookieBite, phone: faPhone, pin: faLocationDot, check: faCheck, down: faChevronDown, left: faChevronLeft, copy: faCopy, sort: faSliders, info: faCircleInfo, home: faHouse, truck: faTruckFast, care: faShieldHeart, up: faArrowUp, list: faList, done: faCircleCheck, whatsapp: faWhatsapp, instagram: faInstagram };
export function Icon({ name, size = 18, className = '' }: {
    name: string;
    size?: number;
    className?: string;
}) {
    const definition = icons[name as keyof typeof icons] ?? faLeaf;
    const [w, h, , , path] = definition.icon;
    return <svg width={size} height={size} viewBox={`0 0 ${w} ${h}`} fill="currentColor" aria-hidden="true" focusable="false" className={`icon ${className}`}>{typeof path === 'string' ? <path d={path}/> : path.map((d, i) => <path key={i} d={d}/>)}</svg>;
}
