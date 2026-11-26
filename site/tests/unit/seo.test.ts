import { describe, expect, it } from 'vitest';
import { alternates, breadcrumbJsonLd, canonicalUrl, jsonLdString, localePath, normalisePath, organizationJsonLd } from '../../src/lib/seo.ts';

describe('seo helpers', () => {
  it('normalises paths with one trailing slash', () => {
    expect(normalisePath('/company')).toBe('/company/');
    expect(normalisePath('company//')).toBe('/company/');
    expect(normalisePath('/')).toBe('/');
  });
  it('builds canonical URLs on the given origin', () => {
    expect(canonicalUrl('/products/sonobolt', 'https://example.test')).toBe('https://example.test/products/sonobolt/');
  });
  it('emits no hreflang while only English is built', () => {
    expect(alternates('/company', ['en'])).toEqual([]);
  });
  it('emits both-way hreflang and x-default once Arabic exists', () => {
    const list = alternates('/company', ['en', 'ar'], 'https://example.test');
    expect(list.map((a) => a.hreflang)).toEqual(['en', 'ar', 'x-default']);
    expect(list[1]?.href).toBe('https://example.test/ar/company/');
    expect(localePath('/', 'ar')).toBe('/ar/');
  });
  it('Organization JSON-LD carries the legal name and no company suffix', () => {
    const org = organizationJsonLd('https://example.test');
    expect(org.legalName).toBe('QuotesDone Technologies');
    expect(JSON.stringify(org)).not.toMatch(/L\.?L\.?C/);
  });
  it('breadcrumbs are positioned from 1 and JSON-LD escapes "<"', () => {
    const b = breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'X', path: '/x' }], 'https://example.test') as { itemListElement: Array<{ position: number }> };
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(jsonLdString({ a: '</script>' })).not.toContain('</script>');
  });
});
