/** SEO plumbing: canonical URLs, hreflang alternates, JSON-LD. Pure functions, unit-tested. */
import { BUILT_LOCALES, COMPANY, SITE_ORIGIN, type Locale } from './site.ts';

/** '/company' and '/company/' both become '/company/'; the home stays '/'. */
export function normalisePath(path: string): string {
  const clean = `/${path.replace(/^\/+|\/+$/g, '')}`;
  return clean === '/' ? '/' : `${clean}/`;
}

export function canonicalUrl(path: string, origin: string = SITE_ORIGIN): string {
  return new URL(normalisePath(path), origin).href;
}

/** English lives at the root and Arabic at /ar/ (structure-v1 section 5, prefixDefaultLocale false). */
export function localePath(path: string, locale: Locale): string {
  const base = normalisePath(path);
  if (locale === 'en') return base;
  return base === '/' ? '/ar/' : `/ar${base}`;
}

export interface Alternate { hreflang: string; href: string }

/** hreflang pairs, emitted only when more than one locale is built. Includes x-default. */
export function alternates(path: string, locales: readonly Locale[] = BUILT_LOCALES, origin: string = SITE_ORIGIN): Alternate[] {
  if (locales.length < 2) return [];
  const list = locales.map((l) => ({ hreflang: l, href: canonicalUrl(localePath(path, l), origin) }));
  return [...list, { hreflang: 'x-default', href: canonicalUrl(localePath(path, 'en'), origin) }];
}

/** JSON-LD Organization. Facts from copy deck section 5 only; matches /legal exactly. */
export function organizationJsonLd(origin: string = SITE_ORIGIN): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: COMPANY.name,
    legalName: COMPANY.name,
    url: `${origin}/`,
    description: COMPANY.description,
    address: { '@type': 'PostalAddress', addressLocality: COMPANY.locality, addressCountry: COMPANY.country },
    identifier: { '@type': 'PropertyValue', name: 'DET Dubai Trader License', value: COMPANY.licenceNumber },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>, origin: string = SITE_ORIGIN): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: canonicalUrl(item.path, origin) })),
  };
}

/** Serialise for an inline <script type="application/ld+json">; escapes "<" so the JSON cannot close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
