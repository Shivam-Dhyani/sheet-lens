import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// SheetLens is browser-only (ADR-01). The engine runs in a Web Worker; heavy
// deps (xlsx) are chunked so the landing page stays light (NFR-03).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['samples/*'],
      manifest: {
        name: 'SheetLens — Compare Excel files',
        short_name: 'SheetLens',
        description: 'Compare two Excel files in seconds. Your files never leave this device.',
        theme_color: '#0E6B66',
        background_color: '#F7F7F4',
        display: 'standalone',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,xlsx}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
