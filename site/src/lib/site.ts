/**
 * Site-wide constants: the ONE place for the indexing switch, the canonical origin and the
 * company identity used in JSON-LD. Wording comes from docs/website/copy-v1.md section 5.
 */

/**
 * LAUNCH SWITCH. While false, every page carries `noindex` and robots.txt disallows everything.
 * Flip to true at launch (milestone M5), after the owner confirms the items in the README
 * "Before launch" list. Nothing else needs to change: Base.astro and robots.txt.ts read this.
 */
export const INDEXING_ENABLED = false;

/**
 * Canonical origin. The domain is NOT purchased yet (HANDOVER); this is the planned address and a
 * placeholder until DNS exists. Change it here when the real origin is known.
 */
export const SITE_ORIGIN = 'https://quotesdone.technologies';

/** Locales that have built pages. Add 'ar' when the Arabic pages exist: hreflang switches on by itself. */
export const BUILT_LOCALES = ['en'] as const;
export type Locale = 'en' | 'ar';

/** Company identity. Sole Establishment, never "L.L.C." (copy deck rule 9). */
export const COMPANY = {
  name: 'QuotesDone Technologies',
  form: 'Sole Establishment',
  licence: 'DET Dubai Trader License No. 1633275',
  licenceNumber: '1633275',
  authority: 'Dubai Department of Economy and Tourism',
  locality: 'Dubai',
  country: 'AE',
  countryName: 'United Arab Emirates',
  description: 'A technology company in Dubai that designs software, builds products from it and runs them after launch.',
} as const;
