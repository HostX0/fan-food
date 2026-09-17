export type Variant = {
    id: string;
    label: string;
    price: number;
    sourceName: string;
    sourceRow: number;
};
export type Product = {
    id: string;
    categoryId: string;
    name: string;
    image: string;
    imageRepresentative: boolean;
    choiceImages?: Record<string, string>;
    ingredientNote?: string;
    ingredientSource?: string;
    description: string;
    variants: Variant[];
    note: string;
    choices: string[];
    searchText: string;
};
export type Category = {
    id: string;
    name: string;
    description: string;
    image: string;
    icon: string;
};
export type CartLine = {
    key: string;
    productId: string;
    variantId: string;
    quantity: number;
    choice: string;
    note: string;
};
export type DeliveryLocation = {
    lat: number;
    lng: number;
    source: 'gps' | 'manual';
    accuracy?: number;
};
export type Customer = {
    name: string;
    phone: string;
    city: string;
    address: string;
    location?: DeliveryLocation | null;
    note: string;
};
export type ExpandedLine = CartLine & {
    product: Product;
    variant: Variant;
    total: number;
};
