import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'

import manifest from './src/manifest.config.ts'

export default defineConfig({
  plugins: [react(), crx({ manifest })],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Extension review is easier to reason about with readable output, and the
    // bundle is small enough that minification buys very little here.
    minify: false,
    sourcemap: true,
  },

  // crxjs needs a stable port for its HMR websocket in `pnpm dev`.
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
})
