import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * The dev harness: a plain web app that renders the real extension surfaces
 * against a localStorage-backed chrome shim.
 *
 * Deliberately does NOT use @crxjs/vite-plugin. That plugin rewrites entry
 * points and emits a manifest for an extension context, which is exactly what
 * the harness exists to avoid needing.
 */
export default defineConfig({
  root: path.resolve(import.meta.dirname, 'dev'),
  // dev/ sits inside the repo, so the project root still needs to be reachable
  // for imports of src/ and public/.
  envDir: import.meta.dirname,
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    open: true,
  },
  build: {
    // Only used by `pnpm harness:build`, for previewing a static copy.
    outDir: path.resolve(import.meta.dirname, 'dist-harness'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(import.meta.dirname, 'dev/index.html'),
        notice: path.resolve(import.meta.dirname, 'dev/notice.html'),
        popup: path.resolve(import.meta.dirname, 'dev/popup.html'),
        options: path.resolve(import.meta.dirname, 'dev/options.html'),
      },
    },
  },
})
