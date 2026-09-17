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
export type Customer = {
    name: string;
    phone: string;
    city: string;
    area: string;
    address: string;
    landmark: string;
    note: string;
};
export type ExpandedLine = CartLine & {
    product: Product;
    variant: Variant;
    total: number;
};
