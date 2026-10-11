import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Browser selection:
//  1. PLAYWRIGHT_CHROMIUM_PATH, if set (any Chromium/Chrome binary), else
//  2. the pre-installed Chromium of the cloud dev container, if present, else
//  3. Playwright's own download — run `pnpm exec playwright install chromium`
//     once on a normal machine.
const CLOUD_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (existsSync(CLOUD_CHROMIUM) ? CLOUD_CHROMIUM : undefined);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Serves the production build (service worker + CSP behave as in prod), so
  // run `pnpm build` before `pnpm e2e`.
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
