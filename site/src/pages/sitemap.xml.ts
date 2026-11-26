/** sitemap.xml: every public English route. The 404 is excluded. Add Arabic routes with BUILT_LOCALES. */
import type { APIRoute } from 'astro';
import { BUILT_LOCALES, SITE_ORIGIN } from '../lib/site.ts';
import { alternates, canonicalUrl, localePath } from '../lib/seo.ts';
import { products } from '../lib/products.ts';

const STATIC_ROUTES = ['/', '/products', '/company', '/contact', '/legal', '/privacy', '/terms'];

export const GET: APIRoute = () => {
  const routes = [...STATIC_ROUTES, ...products.map((p) => `/products/${p.slug}`)];
  const entries = routes.flatMap((route) =>
    BUILT_LOCALES.map((locale) => {
      const loc = canonicalUrl(localePath(route, locale), SITE_ORIGIN);
      const links = alternates(route, BUILT_LOCALES, SITE_ORIGIN)
        .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`)
        .join('\n');
      return `  <url>\n    <loc>${loc}</loc>${links ? `\n${links}` : ''}\n  </url>`;
    }),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
