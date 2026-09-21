'use client';
import * as React from 'react';
import Image from 'next/image';
import menu from '../data/menu.json';
import { SITE } from '../data/site';
import type { Product, Category, CartLine, Customer } from '../lib/types';
import { addLine, sanitizeCart, expandCart, totals, normalizeSearch, formatPrice, validateCustomer, buildMessage, makeReference, whatsappUrl } from '../lib/core.mjs';
import { Icon } from './icon';
import { LocationPicker } from './location-picker';
import { searchProducts } from '../lib/search.mjs';
import { activeMenuSection, isContinuousMenu } from '../lib/menu-scroll.mjs';
import {productImage, smallImage, productSrcSet} from '../lib/product-media.mjs';
import { isSingleSelection, changeQuickQuantity } from '../lib/quick-cart.mjs';
import { nationalPhoneInput, formatNationalPhone, wazeUrl } from '../lib/core.mjs';
import { Price, Quantity, Modal, EmptyState } from './primitives';
const products: Product[] = menu.products;
const categories: Category[] = menu.categories;
const emptyCustomer: Customer = { name: '', phone: '', city: SITE.city, address: '', note: '', location: null };
type Stage = 'cart' | 'details' | 'review';
type State = {
    cart: CartLine[];
    ready: boolean;
    category: string;
    query: string;
    sort: string;
    favorites: string[];
    selected: Product | null;
    variant: string;
    choice: string;
    itemNote: string;
    quantity: number;
    cartOpen: boolean;
    stage: Stage;
    customer: Customer;
    errors: Partial<Record<keyof Customer, string>>;
    reference: string;
    toast: string;
    confirmClear: boolean;
    copied: boolean;
};
/** All interactions stay on the client. No server actions, API routes or customer database. */
export default class MenuApp extends React.Component<Record<string, never>, State> {
    state: State = { cart: [], ready: false, category: categories[0].id, query: '', sort: 'default', favorites: [], selected: null, variant: '', choice: '', itemNote: '', quantity: 1, cartOpen: false, stage: 'cart', customer: { ...emptyCustomer }, errors: {}, reference: '', toast: '', confirmClear: false, copied: false };
    private toastTimer: ReturnType<typeof setTimeout> | undefined;
    private headerObserver: ResizeObserver | undefined;
    private menuFrame = 0;
    private checkoutFrame = 0;
    private scrollTimer: ReturnType<typeof setTimeout> | undefined;
    private navigationTimer: ReturnType<typeof setTimeout> | undefined;
    private pendingNavigation: {id: string; expires: number} | undefined;
    private continuousMenu = () => isContinuousMenu(this.state);
    private menuOffset = () => (document.querySelector('.site-header')?.getBoundingClientRect().height || 0)
        + (document.getElementById('category-bar')?.getBoundingClientRect().height || 0) + 18;
    /** Scrollspy only updates the highlighted section; it never scrolls the document. */
    private syncActiveSection = () => {
        if (!this.state.ready || !this.continuousMenu() || this.state.cartOpen || this.state.selected) return;
        const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-menu-section]'));
        if (!sections.length) return;
        const offset = this.menuOffset();
        if (this.pendingNavigation) {
            const target = sections.find(section => section.dataset.menuSection === this.pendingNavigation?.id);
            if (target && Math.abs(target.getBoundingClientRect().top - offset) > 4 && performance.now() < this.pendingNavigation.expires) return;
            this.pendingNavigation = undefined;
        }
        const id = activeMenuSection(sections.map(section => ({id: section.dataset.menuSection!, top: section.getBoundingClientRect().top})), offset + 4);
        if (id && id !== this.state.category) this.setState({category: id}, this.revealActiveTab);
    };
    // Time-throttled, passive listener: nine section measurements, only set state on a boundary change.
    private onMenuScroll = () => {
        if (this.scrollTimer) return;
        this.scrollTimer = setTimeout(() => {
            this.scrollTimer = undefined;
            this.syncActiveSection();
        }, 50);
    };
    private interruptNavigation = () => {
        cancelAnimationFrame(this.menuFrame);
        this.pendingNavigation = undefined;
        if (this.navigationTimer) clearTimeout(this.navigationTimer);
        this.onMenuScroll();
    };
    private onScrollKey = (event: KeyboardEvent) => {
        if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) this.interruptNavigation();
    };
    private revealActiveTab = () => {
        const bar = document.getElementById('category-bar');
        const active = bar?.querySelector<HTMLElement>('button[aria-pressed="true"]');
        if (!bar || !active) return;
        const box = bar.getBoundingClientRect(), tab = active.getBoundingClientRect();
        // Horizontal-only: scrollIntoView would move the page vertically in Safari.
        const delta = tab.left < box.left + 10 ? tab.left - box.left - 10 : tab.right > box.right - 10 ? tab.right - box.right + 10 : 0;
        if (delta) bar.scrollBy({left: delta, behavior: 'instant'});
    };
    private syncHeaderHeight = () => {
        const height = document.querySelector('.site-header')?.getBoundingClientRect().height;
        if (height) document.documentElement.style.setProperty('--header-offset', `${height}px`);
        const barHeight = document.getElementById('category-bar')?.getBoundingClientRect().height;
        if (barHeight) document.documentElement.style.setProperty('--category-height', `${barHeight}px`);
        this.onMenuScroll();
    };
    private onStorage = (event: StorageEvent) => {
        try {
            if (event.key === SITE.storageKey)
                this.setState({ cart: sanitizeCart(JSON.parse(event.newValue || '[]'), products) });
            if (event.key === SITE.favoritesKey)
                this.setState({ favorites: this.validFavorites(JSON.parse(event.newValue || '[]')) });
        }
        catch { /* Corrupt data in another tab must not break ordering. */ }
    };
    private validFavorites = (value: unknown): string[] => Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && products.some(p => p.id === id)) : [];
    componentDidMount() {
        let cart: CartLine[] = [];
        let favorites: string[] = [];
        try {
            cart = sanitizeCart(JSON.parse(localStorage.getItem(SITE.storageKey) || '[]'), products);
        }
        catch { }
        try {
            favorites = this.validFavorites(JSON.parse(localStorage.getItem(SITE.favoritesKey) || '[]'));
        }
        catch { }
        this.setState({ cart, favorites, ready: true });
        window.addEventListener('storage', this.onStorage);
        this.syncHeaderHeight();
        const header = document.querySelector('.site-header');
        if (header && typeof ResizeObserver !== 'undefined') {
            this.headerObserver = new ResizeObserver(this.syncHeaderHeight);
            this.headerObserver.observe(header);
            const bar = document.getElementById('category-bar');
            if (bar) this.headerObserver.observe(bar);
            const content = document.querySelector('.menu-content');
            if (content) this.headerObserver.observe(content);
        }
        window.addEventListener('resize', this.syncHeaderHeight, {passive: true});
        window.addEventListener('scroll', this.onMenuScroll, {passive: true});
        window.addEventListener('wheel', this.interruptNavigation, {passive: true});
        window.addEventListener('touchstart', this.interruptNavigation, {passive: true});
        window.addEventListener('keydown', this.onScrollKey);
    }
    componentDidUpdate(_props: Record<string, never>, previous: State) {
        if (previous.query !== this.state.query || previous.sort !== this.state.sort || previous.ready !== this.state.ready || previous.cartOpen !== this.state.cartOpen || previous.selected !== this.state.selected || (previous.category === 'favorites') !== (this.state.category === 'favorites')) this.onMenuScroll();
        // Start each checkout step at its heading instead of carrying over a scroll offset.
        if (this.state.cartOpen && (previous.stage !== this.state.stage || !previous.cartOpen)) {
            cancelAnimationFrame(this.checkoutFrame);
            this.checkoutFrame = requestAnimationFrame(() => {
                document.querySelector('.cart-modal .drawer-body')?.scrollTo({top: 0, behavior: 'instant'});
                document.querySelector<HTMLElement>('.cart-modal [data-dialog-heading]')?.focus({preventScroll: true});
            });
        }
        if (this.state.ready && (previous.cart !== this.state.cart || !previous.ready))
            try {
                localStorage.setItem(SITE.storageKey, JSON.stringify(this.state.cart));
            }
            catch { }
        if (this.state.ready && previous.favorites !== this.state.favorites)
            try {
                localStorage.setItem(SITE.favoritesKey, JSON.stringify(this.state.favorites));
            }
            catch { }
    }
    componentWillUnmount() {
        window.removeEventListener('storage', this.onStorage);
        window.removeEventListener('resize', this.syncHeaderHeight);
        window.removeEventListener('scroll', this.onMenuScroll);
        window.removeEventListener('wheel', this.interruptNavigation);
        window.removeEventListener('touchstart', this.interruptNavigation);
        window.removeEventListener('keydown', this.onScrollKey);
        if (this.scrollTimer) clearTimeout(this.scrollTimer);
        if (this.navigationTimer) clearTimeout(this.navigationTimer);
        this.headerObserver?.disconnect();
        cancelAnimationFrame(this.menuFrame);
        cancelAnimationFrame(this.checkoutFrame);
        if (this.toastTimer) clearTimeout(this.toastTimer);
    }
    notify = (message: string) => { if (this.toastTimer)
        clearTimeout(this.toastTimer); this.setState({ toast: message }); this.toastTimer = setTimeout(() => this.setState({ toast: '' }), 2600); };
    /** Categories are anchors into one continuous menu, never product filters. */
    goMenu = (category = categories[0].id) => {
        cancelAnimationFrame(this.menuFrame);
        if (this.navigationTimer) clearTimeout(this.navigationTimer);
        const targetId = category === 'all' ? categories[0].id : category;
        const sameSection = targetId === this.state.category;
        window.scrollTo({top: window.scrollY, left: window.scrollX, behavior: 'instant'});
        this.pendingNavigation = targetId === 'favorites' ? undefined : {id: targetId, expires: performance.now() + 1800};
        this.setState({category: targetId, query: '', sort: 'default'}, () => {
            this.menuFrame = requestAnimationFrame(() => {
                const target = document.getElementById(targetId === 'favorites' ? 'category-start' : `menu-section-${targetId}`);
                if (!target) return;
                const offset = targetId === 'favorites' ? (document.querySelector('.site-header')?.getBoundingClientRect().height || 0) : this.menuOffset();
                const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset);
                const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                window.scrollTo({top, behavior: reduce || sameSection ? 'instant' : 'smooth'});
                this.revealActiveTab();
                this.onMenuScroll();
                this.navigationTimer = setTimeout(() => {
                    this.pendingNavigation = undefined;
                    this.onMenuScroll();
                }, 1850);
            });
        });
    };
    openProduct = (product: Product) => this.setState({ selected: product, variant: product.variants[0].id, choice: product.choices[0] || '', quantity: 1, itemNote: '' });
    isSimpleProduct = isSingleSelection;
    quickAdd = (product: Product) => {
        if (!isSingleSelection(product)) { this.openProduct(product); return; }
        this.setState(s => ({cart: changeQuickQuantity(s.cart, product, 1)}));
    };
    incrementSimple = (product: Product) => this.setState(s => ({cart: changeQuickQuantity(s.cart, product, 1)}));
    decrementSimple = (product: Product) => this.setState(s => ({cart: changeQuickQuantity(s.cart, product, -1)}));
    decrementLine = (key: string) => this.setState(s => ({cart: s.cart.flatMap(line => line.key !== key ? [line] : line.quantity > 1 ? [{...line, quantity: line.quantity - 1}] : [])}));
    incrementLine = (key: string) => this.setState(s => ({cart: s.cart.map(line => line.key === key ? {...line, quantity: Math.min(99, line.quantity + 1)} : line)}));
    add = (product: Product, variant: string, quantity: number, choice: string, note: string) => {
        this.setState(s => ({ cart: addLine(s.cart, product, variant, quantity, choice, note), selected: null }), () => this.notify('انضاف للسلة'));
    };
    updateQuantity = (key: string, quantity: number) => this.setState(s => ({ cart: s.cart.map(l => l.key === key ? { ...l, quantity: Math.min(99, Math.max(1, quantity)) } : l) }));
    remove = (key: string) => this.setState(s => ({ cart: s.cart.filter(l => l.key !== key) }), () => this.notify('انحذف الصنف من السلة'));
    toggleFavorite = (id: string) => this.setState(s => ({ favorites: s.favorites.includes(id) ? s.favorites.filter(f => f !== id) : [...s.favorites, id] }));
    openCart = () => this.setState({ cartOpen: true, stage: 'cart', confirmClear: false, copied: false });
    setCustomer = (field: Exclude<keyof Customer, 'location'>, value: string) => this.setState(s => ({ customer: { ...s.customer, [field]: value }, errors: { ...s.errors, [field]: undefined }, copied: false }));
    reviewOrder = (e: React.FormEvent) => {
        e.preventDefault();
        const errors = validateCustomer(this.state.customer);
        if (Object.keys(errors).length) {
            this.setState({ errors }, () => document.getElementById('customer-' + Object.keys(errors)[0])?.focus());
            return;
        }
        if (!this.state.cart.length) {
            this.setState({ stage: 'cart' });
            return;
        }
        this.setState({ stage: 'review', errors: {}, reference: this.state.reference || makeReference(), copied: false }, () => document.querySelector<HTMLElement>('[data-dialog-heading]')?.focus({preventScroll: true}));
    };
    copyMessage = async (message: string) => {
        try {
            await navigator.clipboard.writeText(message);
            this.setState({ copied: true });
            this.notify('تم نسخ رسالة الطلب');
        }
        catch {
            const el = document.getElementById('order-message') as HTMLTextAreaElement | null;
            el?.focus();
            el?.select();
            this.notify('حددنا الرسالة؛ انسخها من قائمة جهازك.');
        }
    };
    getVisible = () => {
        const { category, query, sort, favorites } = this.state;
        let list = searchProducts(products, query).filter(p => category !== 'favorites' || favorites.includes(p.id));
        if (sort === 'low')
            list = [...list].sort((a, b) => Math.min(...a.variants.map(v => v.price)) - Math.min(...b.variants.map(v => v.price)));
        if (sort === 'high')
            list = [...list].sort((a, b) => Math.min(...b.variants.map(v => v.price)) - Math.min(...a.variants.map(v => v.price)));
        return list;
    };
    renderStepper = (value: number, onIncrease: () => void, onDecrease: () => void, label: string, className = '') => <div className={`inline-stepper ${className}`.trim()} role="group" aria-label={label}>
   <button type="button" aria-label={value === 1 ? `حذف ${label.replace(/^كمية /, '')}` : `تقليل ${label}`} data-action="decrease" onClick={onDecrease}><Icon name={value === 1 ? 'trash' : 'minus'} size={17}/></button>
   <span className="inline-stepper-number" aria-live="polite" dir="ltr">{value}</span>
   <button type="button" aria-label={`زيادة ${label}`} data-action="increase" disabled={value >= 99} onClick={onIncrease}><Icon name="plus" size={18}/></button>
  </div>;
    renderProduct = (product: Product) => {
        const favorite = this.state.favorites.includes(product.id);
        const amount = Math.min(...product.variants.map(v => v.price));
        const qty = this.state.cart.filter(l => l.productId === product.id).reduce((a, l) => a + l.quantity, 0);
        const simple = this.isSimpleProduct(product);
        return <article className="product-card" key={product.id} data-product-id={product.id}>
   <div className="product-photo"><button className="photo-button" type="button" onClick={() => this.openProduct(product)} aria-label={'تفاصيل ' + product.name}><img src={product.image} srcSet={productSrcSet(product)} sizes="(max-width: 767px) 136px, (max-width: 1100px) 33vw, 280px" alt={product.name + (product.imageRepresentative ? ' — صورة توضيحية' : ' — من صور فن فود')} width="640" height="480" loading="lazy" decoding="async"/></button>
    <button className={`favorite-button ${favorite ? 'is-favorite' : ''}`} type="button" aria-label={(favorite ? 'إزالة ' : 'حفظ ') + product.name + (favorite ? ' من المفضلة' : ' في المفضلة')} aria-pressed={favorite} onClick={() => this.toggleFavorite(product.id)}><Icon name="heart" size={15}/></button>
    {qty > 0 && !simple && <span className="in-cart"><Icon name="check" size={10}/>{qty} بالسلة</span>}
   </div>
   <div className="product-body"><button className="product-title" onClick={() => this.openProduct(product)}><h3>{product.name}</h3></button><p className="product-meta">{product.variants.length > 1 ? `${product.variants.length} أحجام` : product.variants[0].label === 'الطبق' ? 'طبق واحد' : product.variants[0].label}{product.choices.length > 0 ? ' • لحم أو دجاج' : ''}</p>
    <div className="product-bottom"><Price value={amount} from={product.variants.length > 1}/>{simple && qty > 0 ? this.renderStepper(qty, () => this.incrementSimple(product), () => this.decrementSimple(product), 'كمية ' + product.name, 'card-stepper') : <button type="button" className="add-button" aria-label={'أضف ' + product.name} onClick={() => this.quickAdd(product)}><Icon name="plus" size={13}/><span>{product.variants.length > 1 || product.choices.length ? 'اختار الحجم' : 'أضف'}</span></button>}</div>
   </div>
  </article>;
    };
    renderCartLines = (compact = false) => {
        const lines = expandCart(this.state.cart, products);
        const visible = compact ? lines.slice(0, 3) : lines;
        return <div className={`cart-lines ${compact ? 'compact' : ''}`}>{visible.map(line => <div className="cart-line" key={line.key}>
   <img src={smallImage(productImage(line.product, line.choice))} width="64" height="64" alt="" loading="lazy"/><div className="cart-line-info"><h3>{line.product.name}</h3><p>{line.variant.label}{line.choice ? ' • ' + line.choice : ''}</p>{line.note && <p className="line-note">{line.note}</p>}<Price value={line.total}/>{this.renderStepper(line.quantity, () => this.incrementLine(line.key), () => this.decrementLine(line.key), 'كمية ' + line.product.name, 'cart-stepper')}</div>
  </div>)}{compact && lines.length > 3 && <button className="text-link more-lines" onClick={this.openCart}>عرض باقي الأصناف ({lines.length - 3})<Icon name="arrow" size={13}/></button>}</div>;
    };
    renderCartSummary = () => {
        const { count, subtotal } = totals(this.state.cart, products);
        return <aside className="desktop-cart" aria-label="ملخص السلة"><div className="cart-aside-heading"><span className="small-icon"><Icon name="bag"/></span><h2>سلتك</h2><span className="count-badge">{count}</span></div>
   {count ? <>{this.renderCartLines(true)}<div className="aside-totals"><span>مجموع الأصناف</span><Price value={subtotal}/></div><p className="subtle-disclaimer">أجور التوصيل نأكدها وياك.</p><button className="button button-primary full" onClick={this.openCart}>راجع طلبك<Icon name="arrow" size={15}/></button><p className="direct-note"><Icon name="whatsapp" size={14}/> الطلب مباشرة عبر واتساب • بغداد</p></> : <EmptyState title="السلة فارغة"><p>أضف الأصناف من المنيو.</p></EmptyState>}
  </aside>;
    };
    renderProductModal = () => {
        const p = this.state.selected;
        if (!p)
            return null;
        const v = p.variants.find(v => v.id === this.state.variant) ?? p.variants[0];
        return <Modal className="product-modal" labelledBy="product-dialog-title" onClose={() => this.setState({ selected: null })}>
   <div className="modal-photo"><img src={productImage(p, this.state.choice)} srcSet={productSrcSet(p, this.state.choice)} sizes="(max-width: 767px) 100vw, 640px" width="960" height="720" alt={p.name + (p.imageRepresentative ? ' — صورة توضيحية' : ' — من صور فن فود')}/><button className="icon-button close-modal" aria-label="إغلاق تفاصيل الصنف" onClick={() => this.setState({ selected: null })}><Icon name="close"/></button><span>{p.imageRepresentative ? 'صورة توضيحية — التقديم يختلف' : 'من صور مطبخ فن فود'}</span></div>
   <div className="modal-body"><span className="eyebrow">{categories.find(c => c.id === p.categoryId)?.name}</span><h2 id="product-dialog-title" tabIndex={-1} data-dialog-heading>{p.name}</h2><p className="muted dish-description">{p.description}</p>{p.ingredientNote && <p className="ingredient-note">{p.ingredientNote}</p>}
    <fieldset className="variant-fieldset"><legend>الحجم / الكمية<span>سعر العبوة الواحدة</span></legend><div className="variant-options">{p.variants.map(variant => <label className={`variant-option ${this.state.variant === variant.id ? 'selected' : ''}`} key={variant.id}><input type="radio" name="variant" value={variant.id} checked={this.state.variant === variant.id} onChange={() => this.setState({ variant: variant.id })}/><span>{variant.label}</span><Price value={variant.price}/><Icon name="done" size={18}/></label>)}</div></fieldset>
    {p.choices.length > 0 && <fieldset className="choice-fieldset"><legend>اختار النوع</legend><div className="choice-options">{p.choices.map(choice => <label className={this.state.choice === choice ? 'selected' : ''} key={choice}><input type="radio" name="choice" value={choice} checked={this.state.choice === choice} onChange={() => this.setState({ choice })}/>{choice}</label>)}</div></fieldset>}
    {p.note && <div className="info-note"><Icon name="info" size={15}/><span>{p.note}</span></div>}
    <label className="field-label" htmlFor="item-note">ملاحظة لهذا الصنف<small>اختياري</small></label><textarea id="item-note" value={this.state.itemNote} onChange={e => this.setState({ itemNote: e.target.value })} maxLength={160} rows={2} placeholder="أي ملاحظة تحب توصلها للمطبخ…"/>
   </div><div className="product-modal-footer"><Quantity value={this.state.quantity} label="عدد العبوات" onChange={quantity => this.setState({ quantity })}/><button className="button button-primary grow" onClick={() => this.add(p, v.id, this.state.quantity, this.state.choice, this.state.itemNote)}><Icon name="bag" size={16}/>أضف للسلة<Price value={v.price * this.state.quantity}/></button></div>
  </Modal>;
    };
    renderField = (field: Exclude<keyof Customer, 'location'>, label: string, options: {
        placeholder?: string;
        optional?: boolean;
        type?: string;
        max?: number;
        autoComplete?: string;
        wide?: boolean;
    } = {}) => {
        const error = this.state.errors[field];
        const id = 'customer-' + field;
        return <div className={`form-field ${options.wide ? 'wide' : ''}`} key={field}><label className="field-label" htmlFor={id}>{label}<small>{options.optional ? 'اختياري' : 'مطلوب'}</small></label><input id={id} name={field} type={options.type || 'text'} inputMode={field === 'phone' ? 'tel' : undefined} dir={field === 'phone' ? 'ltr' : undefined} value={this.state.customer[field]} placeholder={options.placeholder} maxLength={options.max || 80} autoComplete={options.autoComplete} aria-required={!options.optional} aria-invalid={!!error} aria-describedby={error ? id + '-error' : undefined} onChange={e => this.setCustomer(field, e.target.value)}/>{error && <p id={id + '-error'} className="field-error" role="alert">{error}</p>}</div>;
    };
    renderCartModal = () => {
        if (!this.state.cartOpen)
            return null;
        const { stage, cart, customer } = this.state;
        const { count, subtotal } = totals(cart, products);
        const valid = Object.keys(validateCustomer(customer)).length === 0;
        const message = stage === 'review' && cart.length && valid ? buildMessage(cart, products, customer, this.state.reference) : '';
        const url = whatsappUrl(SITE.whatsapp, message);
        const long = url.length > 7500;
        return <Modal className="cart-modal" labelledBy="cart-dialog-title" onClose={() => this.setState({ cartOpen: false })}>
   <div className="drawer-heading"><div><span className="eyebrow">طلبك من فن فود</span><h2 id="cart-dialog-title" tabIndex={-1} data-dialog-heading>{stage === 'cart' ? 'سلتك' : stage === 'details' ? 'وين نوصل طلبك؟' : 'طلبك جاهز للإرسال'}</h2></div><button className="icon-button" aria-label="إغلاق السلة" onClick={() => this.setState({ cartOpen: false })}><Icon name="close"/></button></div>
   {!!count && <div className="steps" aria-label="مراحل الطلب">{(['cart', 'details', 'review'] as Stage[]).map((s, i) => <span key={s} className={stage === s ? 'active' : ''} aria-current={stage === s ? 'step' : undefined}><b>{i + 1}</b>{['السلة', 'بياناتك', 'الرسالة'][i]}</span>)}</div>}
   {!count ? <div className="drawer-body"><EmptyState title="السلة فارغة"><p>أضف الأصناف وحدد الكمية.</p><button className="button button-primary" onClick={() => this.setState({ cartOpen: false }, () => this.goMenu())}>تصفّح المنيو<Icon name="arrow" size={14}/></button></EmptyState></div> : stage === 'cart' ? <>
     <div className="drawer-body">{this.renderCartLines()}<button className="text-link continue-shopping" onClick={() => this.setState({ cartOpen: false })}><Icon name="plus" size={13}/>إضافة صنف آخر</button>
      {this.state.confirmClear ? <div className="confirm-clear"><p>متأكد تريد تفرّغ السلة؟</p><button className="text-link danger" onClick={() => this.setState({ cart: [], confirmClear: false })}>إي، فرّغها</button><button className="text-link" onClick={() => this.setState({ confirmClear: false })}>إلغاء</button></div> : <button className="text-link clear-cart" onClick={() => this.setState({ confirmClear: true })}><Icon name="trash" size={12}/>تفريغ السلة</button>}
     </div><div className="drawer-footer"><div className="total-line"><span>مجموع الأصناف</span><Price value={subtotal} large/></div><p className="subtle-disclaimer">{SITE.orderDisclaimer}<br />الإضافات نأكد سعرها وياك.</p><button className="button button-primary full" onClick={() => this.setState({ stage: 'details' }, () => document.querySelector<HTMLElement>('[data-dialog-heading]')?.focus({preventScroll: true}))}>كمّل بيانات التوصيل<Icon name="arrow"/></button></div>
    </> : stage === 'details' ? <form onSubmit={this.reviewOrder} noValidate className="checkout-form"><div className="drawer-body"><div className="form-grid">
      {this.renderField('name', 'الاسم', { placeholder: 'اسم صاحب الطلب', autoComplete: 'name', max: 70 })}
      <div className="form-field"><label className="field-label" htmlFor="customer-phone">رقم الموبايل<small>مطلوب</small></label><div className={`phone-input ${this.state.errors.phone?'has-error':''}`} dir="ltr"><span className="phone-prefix" aria-label="مفتاح العراق">+964</span><input id="customer-phone" name="phone" type="tel" inputMode="tel" dir="ltr" autoComplete="tel-national" value={customer.phone} placeholder="770 123 4567" maxLength={22} aria-required="true" aria-invalid={!!this.state.errors.phone} aria-describedby={this.state.errors.phone?'customer-phone-error':'customer-phone-help'} onChange={e=>this.setCustomer('phone',nationalPhoneInput(e.target.value))} onBlur={()=>this.setCustomer('phone',formatNationalPhone(customer.phone))}/></div><p className="field-help" id="customer-phone-help">مثال: <bdi dir="ltr">+964 770 123 4567</bdi></p>{this.state.errors.phone&&<p id="customer-phone-error" className="field-error" role="alert">{this.state.errors.phone}</p>}</div>
      <div className="form-field wide city-field"><label className="field-label" htmlFor="customer-city">المحافظة<small>التوصيل لبغداد فقط</small></label><input id="customer-city" name="city" value="بغداد" readOnly aria-readonly="true" autoComplete="address-level1" className="fixed-city"/></div>
      {this.renderField('address', 'العنوان التفصيلي (المنطقة + أقرب نقطة دالة)', { placeholder: 'مثال: المنصور، قرب مول المنصور', autoComplete: 'street-address', max: 200, wide: true })}
      <LocationPicker value={customer.location} error={this.state.errors.location} onChange={location=>this.setState(s=>({customer:{...s.customer,location},errors:{...s.errors,location:undefined},copied:false}))}/>
      <div className="form-field wide"><label className="field-label" htmlFor="customer-note">ملاحظات الطلب<small>اختياري</small></label><textarea id="customer-note" rows={2} value={customer.note} maxLength={500} placeholder="أي ملاحظة للمطبخ أو للتوصيل…" onChange={e => this.setCustomer('note', e.target.value)}/></div>
     </div><div className="privacy-note"><Icon name="care" size={18}/><p>بيانات التوصيل تُرفق برسالة طلبك.</p></div></div>
     <div className="drawer-footer"><button type="submit" className="button button-primary full">راجع رسالة الطلب<Icon name="arrow"/></button><button type="button" className="text-link back-link" onClick={() => this.setState({ stage: 'cart' })}><Icon name="back" size={13}/>الرجوع للسلة</button></div></form> : <>
     <div className="drawer-body"><div className="review-summary"><Icon name="whatsapp" size={27}/><div><strong>إلى فن فود</strong><span dir="ltr">{SITE.phoneDisplay}</span></div><Price value={subtotal}/></div>{customer.location&&<a className="review-location" href={wazeUrl(customer.location)} target="_blank" rel="noopener noreferrer"><Icon name="pin" size={16}/>موقع التوصيل مرفق — راجعه على Waze</a>}<label className="field-label" htmlFor="order-message">رسالة طلبك</label><textarea id="order-message" className="message-preview" readOnly value={message} rows={13} dir="rtl"/>
      <div className="info-note"><Icon name="info"/><span>راح يفتح واتساب برسالتك جاهزة. اضغط «إرسال» داخل واتساب؛ الطلب مو مؤكّد إلا بعد رد المطعم.</span></div>
      {long && <div className="long-message"><strong>طلبك طويل؟ انسخه ودزّه.</strong><p>انسخ الرسالة، وافتح واتساب والصقها بالمحادثة.</p></div>}
     </div><div className="drawer-footer"><button className="button button-outline full" onClick={() => this.copyMessage(message)}><Icon name={this.state.copied ? 'check' : 'copy'}/>{this.state.copied ? 'تم نسخ الرسالة' : 'انسخ رسالة الطلب'}</button>
      {<a className="button button-whatsapp full" data-testid="send-order" href={long ? whatsappUrl(SITE.whatsapp) : url} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={22}/>{long ? 'افتح واتساب والصق الرسالة' : 'افتح واتساب لإرسال الطلب'}<Icon name="arrow" size={15}/></a>}
      <button className="text-link back-link" onClick={() => this.setState({ stage: 'details' })}><Icon name="back" size={13}/>تعديل البيانات</button><p className="cart-retained">سلتك تبقى محفوظة، حتى ترجع تعدّل عليها.</p>
     </div>
    </>}
  </Modal>;
    };
    render() {
        const { category, query, sort, cart, favorites, toast } = this.state;
        const visible = this.getVisible();
        const { count, subtotal } = totals(cart, products);
        const grouped = this.continuousMenu();
        return <>
   <a href="#menu" className="skip-link">انتقل إلى المنيو</a>
   <header className="site-header"><div className="container header-inner"><a className="logo-link" href="#" aria-label="فن فود — الصفحة الرئيسية"><img src="/images/logo.png" alt="فن فود" width="119" height="67"/></a><nav className="desktop-nav" aria-label="التنقل الرئيسي"><a className="active" href="#menu">المنيو</a><a href={whatsappUrl(SITE.whatsapp)} target="_blank" rel="noopener noreferrer">تواصل ويانا</a></nav><div className="header-actions"><a className="icon-button instagram-link" aria-label="فن فود على إنستغرام" href={SITE.instagram} target="_blank" rel="noopener noreferrer"><Icon name="instagram" size={21}/></a><button className="header-cart" onClick={this.openCart} aria-label={`افتح السلة، ${count} عبوة`}><Icon name="bag" size={17}/><span>سلتك</span><b>{count}</b></button></div></div></header>
   <main>
    <section className="menu-intro container" aria-labelledby="intro-title">
     <div className="intro-heading"><div><h1 id="intro-title">منيو فن فود</h1><p>اختار الأصناف والكمية، وكمّل طلبك عبر واتساب.</p></div><span className="delivery-label"><Icon name="pin" size={15}/>بغداد</span></div>
     <nav className="category-directory" aria-label="تصفّح الأقسام بالصور">{categories.map((c, index) => <button type="button" key={c.id} onClick={() => this.goMenu(c.id)} aria-controls={'menu-section-' + c.id}><Image src={c.image} alt="" width={280} height={180} loading={index < 4 ? 'eager' : 'lazy'} sizes="(max-width: 767px) 25vw, 160px"/><span>{c.name}</span></button>)}</nav>
    </section>
    <section className="menu-section container" id="menu" aria-labelledby="menu-title"><div className="menu-heading"><div><h2 id="menu-title">الأصناف</h2><p className="menu-currency">الأسعار بالدينار العراقي</p></div><div className="menu-tools"><div className="search-box"><Icon name="search" size={18}/><input type="search" aria-label="ابحث في المنيو" placeholder="ابحث عن صنف…" maxLength={100} value={query} onChange={e => this.setState({ query: e.target.value, category: 'all' })}/>{query && <button aria-label="مسح البحث" className="icon-button" onClick={() => this.setState({ query: '' })}><Icon name="close" size={13}/></button>}</div><div className="sort-box"><Icon name="sort" size={13}/><select aria-label="ترتيب الأصناف" value={sort} onChange={e => this.setState({ sort: e.target.value })}><option value="default">ترتيب المنيو</option><option value="low">السعر: من الأقل</option><option value="high">السعر: من الأعلى</option></select></div></div></div>
     <div className="category-anchor" id="category-start" aria-hidden="true"/><div className="category-nav" id="category-bar" data-mode={grouped ? 'browse' : 'results'} role="group" aria-label="أقسام المنيو">{categories.map(c => <button key={c.id} className={grouped && category === c.id ? 'active' : ''} aria-pressed={grouped && category === c.id} aria-current={grouped && category === c.id ? 'location' : undefined} aria-controls={'menu-section-' + c.id} onClick={() => this.goMenu(c.id)}><Icon name={c.icon} size={14}/>{c.name}</button>)}<button className={category === 'favorites' ? 'active' : ''} aria-pressed={category === 'favorites'} onClick={() => this.goMenu('favorites')}><Icon name="heart" size={14}/>المفضلة{favorites.length > 0 && <small>{favorites.length}</small>}</button></div>
     <div className="menu-layout"><div className="menu-content" data-menu-mode={grouped ? 'browse' : 'results'}>
      <span className="sr-only" role="status">{grouped ? `كل المنيو، ${products.length} صنف` : `${visible.length} صنف`}</span>
      {!grouped && <div className="result-heading"><h3>{category === 'favorites' ? 'أكلاتك المفضّلة' : query ? `نتائج البحث عن «${query}»` : 'كل الأصناف'}</h3><span aria-live="polite">{visible.length} صنف</span><button className="text-link" type="button" onClick={() => this.goMenu('all')}>رجوع لكل المنيو<Icon name="back" size={13}/></button></div>}
      {grouped ? <>
       {categories.map(c => <section className="category-section" id={'menu-section-' + c.id} data-menu-section={c.id} key={c.id} aria-labelledby={'heading-' + c.id}>
        <div className="section-heading"><div><span className="section-icon"><Icon name={c.icon} size={18}/></span><div><h3 id={'heading-' + c.id}>{c.name}</h3></div></div><span className="section-count">{products.filter(p => p.categoryId === c.id).length} أصناف</span></div>
        <div className="product-grid">{products.filter(p => p.categoryId === c.id).map(this.renderProduct)}</div>
       </section>)}
      </> : !visible.length ? <EmptyState icon={category === 'favorites' ? 'heart' : 'search'} title={category === 'favorites' ? 'المفضلة بعدها فارغة' : 'ما لكينا هالأكلة'}><p>{category === 'favorites' ? 'اضغط القلب على أي صنف.' : 'جرّب اسم ثاني.'}</p><button className="button button-outline" onClick={() => this.goMenu('all')}>عرض كل المنيو</button></EmptyState> : <div className="product-grid">{visible.map(this.renderProduct)}</div>}
      <div className="catalog-footnote"><Icon name="info" size={15}/><div><p>الأسعار بالدينار. التوصيل والتوفّر نأكدهم وياك عالواتساب.</p><p className="photo-disclosure">الصور توضيحية؛ الكمية حسب الخيار المكتوب. للحساسية أو تفاصيل الحشوة، تواصل ويانا.</p></div></div>
     </div>{this.renderCartSummary()}</div>
    </section>
   </main>
   <footer className="site-footer"><div className="container practical-footer"><a className="footer-brand" href="#"><img src="/images/logo-light.png" alt="فن فود" width="116" height="65"/></a><a href={whatsappUrl(SITE.whatsapp)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={20}/><span dir="ltr">{SITE.phoneDisplay}</span></a><a href={SITE.instagram} target="_blank" rel="noopener noreferrer"><Icon name="instagram" size={20}/><span dir="ltr">@fanfood.iq</span></a><a className="agency-credit" href={SITE.agencyUrl} target="_blank" rel="noopener noreferrer" dir="ltr">{SITE.agencyName}</a></div></footer>
   {count > 0 && <div className="mobile-cart-bar"><button onClick={this.openCart}><span className="mobile-cart-count">{count}</span><span>راجع سلتك<small>وكمّل طلبك عبر واتساب</small></span><Price value={subtotal}/><Icon name="arrow" size={15}/></button></div>}
   <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">{toast && <><Icon name="check" size={15}/>{toast}<button onClick={this.openCart}>السلة<Icon name="arrow" size={11}/></button></>}</div>
   {this.renderProductModal()}{this.renderCartModal()}
  </>;
    }
}
