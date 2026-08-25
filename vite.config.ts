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
    /*
     * No modulepreload links.
     *
     * Vite stamps `crossorigin` on them, which is right on the web and wrong
     * on a chrome-extension:// page: Chrome treats the preload as belonging to
     * a different world from the module fetch that follows, refuses to reuse
     * it, and says so twice per chunk in the console. Every preloaded chunk was
     * being fetched and thrown away.
     *
     * Preloading buys close to nothing here in any case. These pages load from
     * the extension's own storage rather than over a network, and the module
     * graph is discovered from the entry script either way.
     */
    modulePreload: false,
  },

  // crxjs needs a stable port for its HMR websocket in `pnpm dev`.
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
})
