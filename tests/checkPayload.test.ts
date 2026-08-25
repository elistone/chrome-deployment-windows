import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// @ts-expect-error - plain JS build script, no type declarations
import { BUDGET_BYTES, FORBIDDEN_EAGER, eagerFiles, loaderTarget, resolveTarget, staticImports } from '../scripts/check-payload.js'

let dir: string

function write(relative: string, contents: string): void {
  const target = path.join(dir, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, contents)
}

/** The shape @crxjs emits: a loader that resolves the real chunk at runtime. */
const LOADER = `(function () {
  (async () => {
    const { onExecute } = await import(
      chrome.runtime.getURL("assets/content.js")
    );
    onExecute?.();
  })().catch(console.error);
})();`

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-payload-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('check-payload', () => {
  describe('staticImports', () => {
    it('finds a named import', () => {
      expect(staticImports('import { a } from "./chunk.js"')).toEqual([
        './chunk.js',
      ])
    })

    it('finds a side-effect import', () => {
      expect(staticImports('import "./side.js"\n')).toEqual(['./side.js'])
    })

    // The whole measurement rests on this distinction: a dynamic import is
    // the thing being deferred, so counting one would defeat the check.
    it('ignores a dynamic import', () => {
      expect(staticImports('const m = await import("./lazy.js")')).toEqual([])
    })

    it('ignores a bare module specifier', () => {
      expect(staticImports('import x from "markdown-it"')).toEqual([])
    })

    it('does not report the same target twice', () => {
      expect(
        staticImports('import { a } from "./x.js"\nimport { b } from "./x.js"'),
      ).toEqual(['./x.js'])
    })
  })

  describe('loaderTarget', () => {
    it('reads the chunk the loader resolves through getURL', () => {
      expect(loaderTarget(LOADER)).toBe('assets/content.js')
    })

    it('reads a plain dynamic import too', () => {
      expect(loaderTarget('await import("./content.js")')).toBe('./content.js')
    })

    it('is null when there is nothing to import', () => {
      expect(loaderTarget('console.log(1)')).toBeNull()
    })
  })

  describe('resolveTarget', () => {
    it('resolves a chunk-relative import against its own directory', () => {
      expect(resolveTarget('assets/content.js', './remote.js')).toBe(
        'assets/remote.js',
      )
    })

    it('treats what the loader hands to getURL as root-relative', () => {
      expect(resolveTarget('assets/loader.js', 'assets/content.js')).toBe(
        'assets/content.js',
      )
    })
  })

  describe('eagerFiles', () => {
    it('follows the loader into the chunk and its static imports', () => {
      write('assets/loader.js', LOADER)
      write('assets/content.js', 'import { a } from "./shared.js"\n')
      write('assets/shared.js', 'export const a = 1')

      expect(eagerFiles(dir, 'assets/loader.js').sort()).toEqual([
        'assets/content.js',
        'assets/loader.js',
        'assets/shared.js',
      ])
    })

    it('stops at a dynamic import', () => {
      write('assets/loader.js', LOADER)
      write('assets/content.js', 'const md = () => import("./markdown-it.js")')
      write('assets/markdown-it.js', 'export const render = () => {}')

      const files = eagerFiles(dir, 'assets/loader.js')
      expect(files).not.toContain('assets/markdown-it.js')
    })

    it('survives a cycle between two chunks', () => {
      write('assets/loader.js', LOADER)
      write('assets/content.js', 'import { b } from "./other.js"')
      write('assets/other.js', 'import { a } from "./content.js"')

      expect(eagerFiles(dir, 'assets/loader.js')).toHaveLength(3)
    })

    it('ignores an import of something that was not emitted', () => {
      write('assets/loader.js', LOADER)
      write('assets/content.js', 'import { a } from "./missing.js"')

      expect(eagerFiles(dir, 'assets/loader.js')).toEqual([
        'assets/loader.js',
        'assets/content.js',
      ])
    })
  })

  describe('the budget itself', () => {
    it('names markdown-it as the thing that must stay lazy', () => {
      expect(FORBIDDEN_EAGER).toContain('markdown-it')
    })

    // Loose enough not to fail on an ordinary change, tight enough that the
    // parser coming back cannot fit under it.
    it('leaves room to grow without leaving room for the parser', () => {
      expect(BUDGET_BYTES).toBeGreaterThan(64 * 1024)
      expect(BUDGET_BYTES).toBeLessThan(200 * 1024)
    })
  })
})
