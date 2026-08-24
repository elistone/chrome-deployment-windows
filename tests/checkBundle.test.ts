import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// @ts-expect-error - plain JS build script, no type declarations
import { HARNESS_SENTINELS, findLeaks, isHarnessSource, walk } from '../scripts/check-bundle.js'

interface Leak {
  file: string
  reason: string
}

let dir: string

function write(relative: string, contents: string): void {
  const target = path.join(dir, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, contents)
}

/** A minimal clean build. */
function writeCleanBuild(): void {
  write('manifest.json', JSON.stringify({ manifest_version: 3 }))
  write('assets/content.js', 'export const notice = () => chrome.storage.sync.get()')
  write('assets/options.css', '.dw-notification { color: red }')
  write('src/ui/popup.html', '<!doctype html><div id="root"></div>')
  write(
    'assets/content.js.map',
    JSON.stringify({
      version: 3,
      sources: ['../src/app/content.ts', '../src/app/components/Notice.ts'],
    }),
  )
}

describe('check-bundle', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-bundle-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  describe('a clean build', () => {
    it('reports no leaks', () => {
      writeCleanBuild()
      expect(findLeaks(dir) as Leak[]).toEqual([])
    })

    it('does not flag legitimate uses of chrome APIs', () => {
      writeCleanBuild()
      write(
        'assets/config.js',
        'await chrome.storage.sync.set({ DOMAINS: {} }); chrome.tabs.query({})',
      )
      expect(findLeaks(dir) as Leak[]).toEqual([])
    })

    it('does not flag the word "dev" appearing incidentally', () => {
      writeCleanBuild()
      write('assets/notes.js', 'const message = "ask a developer to review"')
      expect(findLeaks(dir) as Leak[]).toEqual([])
    })
  })

  describe('textual detection', () => {
    it.each(HARNESS_SENTINELS as string[])(
      'detects the sentinel %s in emitted js',
      (sentinel) => {
        writeCleanBuild()
        write('assets/leaked.js', `function x() { return ${sentinel} }`)

        const leaks = findLeaks(dir) as Leak[]
        expect(leaks).toHaveLength(1)
        expect(leaks[0].file).toBe('assets/leaked.js')
        expect(leaks[0].reason).toContain(sentinel)
      },
    )

    it('detects a leak in emitted html', () => {
      writeCleanBuild()
      write('leaked.html', '<script>installChromeShim()</script>')
      expect(findLeaks(dir) as Leak[]).toHaveLength(1)
    })

    it('detects a leak in emitted json', () => {
      writeCleanBuild()
      write('data.json', JSON.stringify({ key: '__dw_dev_storage__' }))
      expect(findLeaks(dir) as Leak[]).toHaveLength(1)
    })

    it('reports every distinct problem, not just the first', () => {
      writeCleanBuild()
      write('assets/a.js', 'installChromeShim()')
      write('assets/b.js', 'getSimulatedTabUrl()')

      const leaks = findLeaks(dir) as Leak[]
      expect(leaks.map((leak) => leak.file).sort()).toEqual([
        'assets/a.js',
        'assets/b.js',
      ])
    })

    it('ignores binary assets', () => {
      writeCleanBuild()
      // A png whose bytes happen to spell a sentinel must not trip the check.
      write('icons/icon.png', 'installChromeShim')
      expect(findLeaks(dir) as Leak[]).toEqual([])
    })
  })

  describe('source map detection', () => {
    it('detects a harness file listed as a source', () => {
      writeCleanBuild()
      write(
        'assets/leaked.js.map',
        JSON.stringify({ version: 3, sources: ['../dev/chromeShim.ts'] }),
      )

      const leaks = findLeaks(dir) as Leak[]
      expect(leaks).toHaveLength(1)
      expect(leaks[0].reason).toContain('chromeShim.ts')
    })

    it('catches a leak that was renamed beyond sentinel recognition', () => {
      writeCleanBuild()
      // No sentinel present: only the source map gives it away.
      write('assets/renamed.js', 'function q(){return localStorage.getItem("x")}')
      write(
        'assets/renamed.js.map',
        JSON.stringify({ version: 3, sources: ['../dev/seed.ts'] }),
      )

      expect(findLeaks(dir) as Leak[]).toHaveLength(1)
    })

    it('flags a malformed source map rather than skipping it', () => {
      writeCleanBuild()
      write('assets/broken.js.map', 'not json at all')

      const leaks = findLeaks(dir) as Leak[]
      expect(leaks).toHaveLength(1)
      expect(leaks[0].reason).toContain('not valid JSON')
    })

    it('tolerates a source map with no sources array', () => {
      writeCleanBuild()
      write('assets/empty.js.map', JSON.stringify({ version: 3 }))
      expect(findLeaks(dir) as Leak[]).toEqual([])
    })
  })

  describe('isHarnessSource', () => {
    it.each([
      '../dev/chromeShim.ts',
      'dev/shell.tsx',
      '/Users/x/project/dev/seed.ts',
      '../dev/shell.css',
    ])('treats %s as harness', (source) => {
      expect(isHarnessSource(source)).toBe(true)
    })

    it.each([
      '../src/app/content.ts',
      '../src/ui/components/Popup.tsx',
      // A src directory that merely contains "dev" in its name must not match.
      '../src/developer/tools.ts',
      '../node_modules/react/index.js',
    ])('treats %s as legitimate', (source) => {
      expect(isHarnessSource(source)).toBe(false)
    })

    it('handles windows style separators', () => {
      expect(isHarnessSource('..\\dev\\chromeShim.ts')).toBe(true)
    })
  })

  describe('walk', () => {
    it('returns nested files as relative paths', () => {
      writeCleanBuild()
      const files = (walk(dir) as string[]).sort()
      expect(files).toContain('manifest.json')
      expect(files).toContain('assets/content.js')
      expect(files).toContain('src/ui/popup.html')
    })
  })
})
