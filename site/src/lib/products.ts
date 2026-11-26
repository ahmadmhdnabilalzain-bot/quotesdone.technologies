/** Product data loader: one JSON per product in src/content/en/products/. Order is the display order. */
import pages from '../content/en/pages.json';

export interface ProductCta { label: string; href: string }
export interface ProductProof { title: string; body: string }
export interface Product {
  slug: string;
  name: string;
  status: 'live' | 'in-development';
  headline: string;
  promise: string;
  proof: ProductProof[];
  statusLine: string;
  family?: Array<{ name: string; state: string }>;
  cta: ProductCta[];
  ownerToConfirm?: string;
}

const modules = import.meta.glob<Product>('../content/en/products/*.json', { eager: true, import: 'default' });
const ORDER = ['quotesdone', 'sonobolt', 'mubinflow'];

export const products: Product[] = Object.values(modules).sort((a, b) => {
  const ia = ORDER.indexOf(a.slug);
  const ib = ORDER.indexOf(b.slug);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
});

export function getProduct(slug: string): Product {
  const found = products.find((p) => p.slug === slug);
  if (!found) throw new Error(`[products] unknown product slug "${slug}"`);
  return found;
}

export function nextProduct(slug: string): Product {
  const i = products.findIndex((p) => p.slug === slug);
  const following = products[(i + 1) % products.length];
  if (!following) throw new Error('[products] no products defined');
  return following;
}

/** The product's own site, taken from its first call to action. MubinFlow has none. */
export function productOrigin(product: Product): string | undefined {
  const href = product.cta[0]?.href;
  return href ? new URL(href).origin : undefined;
}

export function statusLabel(status: string): string {
  const labels = pages.status as Record<string, string>;
  return labels[status] ?? status;
}
