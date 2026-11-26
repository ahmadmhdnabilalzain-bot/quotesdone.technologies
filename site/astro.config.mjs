// Astro config for the QuotesDone Technologies hub.
// Static output only: every word ships in HTML; JS and 3D are progressive enhancement.
import { defineConfig } from 'astro/config';

// QDT_DIST: alternative output dir (parallel builds by several agents/CI jobs); default dist/.
export default defineConfig({
  output: 'static',
  ...(process.env.QDT_DIST ? { outDir: process.env.QDT_DIST } : {}),
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    // Keep the critical CSS inline only when tiny; the budget script measures either way.
    inlineStylesheets: 'auto',
  },
  i18n: {
    // Arabic is prepared, not built: the `ar` pages are added in M6 (structure-v1 §5).
    defaultLocale: 'en',
    locales: ['en'],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    build: {
      // structure-v1 §3.7: no source maps in dist/.
      sourcemap: false,
    },
  },
});
