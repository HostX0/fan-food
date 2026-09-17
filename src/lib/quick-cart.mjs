/** Quick controls never merge or discard a customer's item notes. */
import {addLine, MAX_QUANTITY} from './core.mjs';
// Editorial selection, not measured order-volume analytics.
export const CURATED_PRODUCT_IDS = ['p002', 'p003', 'p010', 'p016', 'p037', 'p048'];
export const isSingleSelection = p => p.variants.length === 1 && p.choices.length === 0;
export const quickCount = (cart, p) => cart.filter(l => l.productId === p.id).reduce((n, l) => n + l.quantity, 0);
export function changeQuickQuantity(cart, product, delta) {
  if (!isSingleSelection(product) || ![1, -1].includes(delta)) return cart;
  if (delta === 1) {
    if (quickCount(cart, product) >= MAX_QUANTITY) return cart;
    return addLine(cart, product, product.variants[0].id, 1, '', '');
  }
  const matches = cart.filter(l => l.productId === product.id && l.variantId === product.variants[0].id);
  const target = matches.find(l => !l.note && !l.choice) ?? matches.at(-1);
  if (!target) return cart;
  return target.quantity <= 1 ? cart.filter(l => l.key !== target.key)
    : cart.map(l => l.key === target.key ? {...l, quantity: l.quantity - 1} : l);
}
