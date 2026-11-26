import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the BUILT site (`astro preview`). Chromium only, with SwiftShader WebGL so the
 * smoke scene really renders headless. This is emulation: it proves the pipeline, not iPhone
 * performance (a real iPhone 13 check is a manual milestone gate).
 */
const PORT = 4373;
const CHROMIUM_ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: '/tmp/qdt-rail-test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: {
      args: CHROMIUM_ARGS,
      ...(process.env.QDT_CHROMIUM_PATH ? { executablePath: process.env.QDT_CHROMIUM_PATH } : {}),
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
    },
    {
      name: 'iphone13',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
      },
    },
  ],
  webServer: {
    // --ignore-lock: Astro 7 preview keeps a lock file for its background mode; Playwright owns this process.
    command: `npx astro preview --outDir /tmp/qdt-rail-dist --port ${PORT} --host 127.0.0.1 --ignore-lock`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
