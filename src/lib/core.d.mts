import type { Product, CartLine, Customer, ExpandedLine, DeliveryLocation } from './types';
export const MAX_QUANTITY: 99;
export function cleanText(value: unknown, max?: number): string;
export function westernDigits(value: unknown): string;
export function normalizeSearch(value: unknown): string;
export function normalizePhone(value: unknown): string;
export function formatPrice(value: number): string;
export function lineKey(productId: string, variantId: string, choice?: string, note?: string): string;
export function expandCart(cart: CartLine[], products: Product[]): ExpandedLine[];
export function sanitizeCart(raw: unknown, products: Product[]): CartLine[];
export function totals(cart: CartLine[], products: Product[]): {
    count: number;
    subtotal: number;
};
export function addLine(cart: CartLine[], product: Product, variantId: string, quantity?: number, choice?: string, note?: string): CartLine[];
export function validateCustomer(customer: Partial<Customer>): Partial<Record<keyof Customer, string>>;
export function makeReference(now?: Date, random?: number): string;
export function buildMessage(cart: CartLine[], products: Product[], customer: Customer, reference: string): string;
export function whatsappUrl(number: string, message?: string): string;

export const BAGHDAD_BOUNDS: {south: number; north: number; west: number; east: number};
export function validLocation(value: unknown): value is DeliveryLocation;
export function wazeUrl(location: unknown): string;
export function nationalPhoneInput(value: unknown): string;
export function formatNationalPhone(value: unknown): string;
