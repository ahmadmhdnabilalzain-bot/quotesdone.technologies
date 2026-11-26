/**
 * robots.txt, generated so the launch switch lives in one place (src/lib/site.ts).
 * Pre-launch: disallow everything and publish no sitemap. After launch: allow and point at the sitemap.
 */
import type { APIRoute } from 'astro';
import { INDEXING_ENABLED, SITE_ORIGIN } from '../lib/site.ts';

export const GET: APIRoute = () => {
  const body = INDEXING_ENABLED
    ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
