import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Deliberately separate from vite.config.ts: the crxjs plugin rewrites entry
 * points and emits a manifest, which is meaningless (and disruptive) under test.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // Pin the viewer timezone so conversions are reproducible everywhere, and
    // pick one that differs from the fixtures' Europe/London so that a bug
    // swapping "original" and "local" cannot pass unnoticed.
    env: { TZ: 'America/New_York' },
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // e2e is Playwright's, not Vitest's.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/manifest.config.ts',
        // Thin composition roots: covered end-to-end by Playwright instead.
        'src/app/content.ts',
        'src/ui/popup.tsx',
        'src/ui/options.tsx',
      ],
    },
  },
})
