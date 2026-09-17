import type {CartLine, Product} from './types';
export const CURATED_PRODUCT_IDS: string[];
export function isSingleSelection(product: Product): boolean;
export function quickCount(cart: CartLine[], product: Product): number;
export function changeQuickQuantity(cart: CartLine[], product: Product, delta: number): CartLine[];
