#!/usr/bin/env node
/**
 * Verify the built extension contains no dev-harness code.
 *
 * The harness in dev/ installs a fake chrome API backed by localStorage. It is
 * only reachable from vite.harness.config.ts, so it should never reach dist/ -
 * but "should never" is exactly the kind of assumption that quietly stops being
 * true after a refactor, and a shipped extension carrying a storage shim would
 * be a serious bug. This makes it a build failure instead.
 *
 * Two independent checks, because either can miss on its own:
 *
 *  1. Structural - no source map may list an original file under dev/. This
 *     catches a leak whatever the code was renamed to, but only works while
 *     source maps are emitted.
 *  2. Textual - a set of sentinel strings unique to the harness must not appear
 *     in any emitted text file. This works with or without source maps, but
 *     only catches the identifiers it knows about.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Strings that exist in dev/ and nowhere in src/. Deliberately distinctive:
 * a false positive here fails the build, so they must not be generic words.
 */
export const HARNESS_SENTINELS = [
  '__dw_dev_storage__',
  '__dw_dev_tab_url__',
  'dw-dev-icon',
  'dw-dev-storage',
  'installChromeShim',
  'getSimulatedTabUrl',
  'setSimulatedTabUrl',
  'clearDevStorage',
  'ensureSeeded',
  'devConfig',
]

/** Extensions worth scanning for sentinel strings. */
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.json'])

/** Every file under `dir`, as paths relative to it. */
export function walk(dir, relative = '', found = []) {
  for (const entry of fs.readdirSync(path.join(dir, relative), {
    withFileTypes: true,
  })) {
    const entryRelative = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      walk(dir, entryRelative, found)
    } else {
      found.push(entryRelative)
    }
  }
  return found
}

/** True when a source-map "sources" entry points at the dev harness. */
export function isHarnessSource(source) {
  const normalised = source.replace(/\\/g, '/')
  return /(^|\/)dev\/[^/]+\.(ts|tsx|css|html)$/.test(normalised)
}

/**
 * Scan a built extension directory.
 *
 * @returns {{file: string, reason: string}[]} one entry per problem found
 */
export function findLeaks(distPath) {
  const leaks = []

  for (const relative of walk(distPath)) {
    const absolute = path.join(distPath, relative)
    const extension = path.extname(relative)

    if (relative.endsWith('.map')) {
      let map
      try {
        map = JSON.parse(fs.readFileSync(absolute, 'utf8'))
      } catch {
        leaks.push({ file: relative, reason: 'source map is not valid JSON' })
        continue
      }
      for (const source of map.sources ?? []) {
        if (isHarnessSource(source)) {
          leaks.push({
            file: relative,
            reason: `source map references harness file "${source}"`,
          })
        }
      }
      // A map's own content is the original source, so skip the text scan for
      // it - the sources check above is the meaningful one.
      continue
    }

    if (!TEXT_EXTENSIONS.has(extension)) {
      continue
    }

    const contents = fs.readFileSync(absolute, 'utf8')
    for (const sentinel of HARNESS_SENTINELS) {
      if (contents.includes(sentinel)) {
        leaks.push({
          file: relative,
          reason: `contains harness identifier "${sentinel}"`,
        })
      }
    }
  }

  return leaks
}

// --- CLI -------------------------------------------------------------------

function main() {
  const distPath = path.resolve(import.meta.dirname, '../dist')

  if (!fs.existsSync(path.join(distPath, 'manifest.json'))) {
    console.error(`No build at ${distPath}. Run "pnpm build" first.`)
    process.exit(1)
  }

  const leaks = findLeaks(distPath)

  if (leaks.length > 0) {
    console.error('Dev-harness code leaked into the extension build:')
    for (const leak of leaks) {
      console.error(`  - ${leak.file}: ${leak.reason}`)
    }
    console.error(
      '\ndev/ must only be reachable from vite.harness.config.ts. Check for an ' +
        'import of dev/ from src/, or a harness entry added to vite.config.ts.',
    )
    process.exit(1)
  }

  const scanned = walk(distPath).length
  console.log(
    `Bundle OK: ${scanned} files in dist/, no dev-harness code (checked ${HARNESS_SENTINELS.length} sentinels + source maps).`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
