#!/usr/bin/env node
/**
 * Keep the content script small.
 *
 * It runs on every https page the user visits, most of which have no
 * deployment configured at all, so whatever it loads eagerly is paid for by
 * pages that get nothing back. markdown-it - by a distance the largest thing
 * this extension ships - used to be in there because the notice renders notes,
 * and it is now behind a dynamic import.
 *
 * Nothing about that arrangement is self-enforcing: one ordinary-looking static
 * import anywhere on the content script's path puts it straight back, the build
 * still succeeds, and the only symptom is a slower web. So the budget is
 * checked here instead.
 *
 * "Eager" means the loader, the chunk it pulls in on load, and everything
 * reachable from those by static import. A dynamic import() is what the notes
 * use and is deliberately not counted.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Raw bytes the content script may load before it has done anything.
 *
 * Raw rather than gzipped so the number is deterministic and easy to check by
 * hand. Raise it deliberately, with a reason - it is meant to be a decision,
 * not a formality.
 */
export const BUDGET_BYTES = 96 * 1024

/** Modules that must never be reachable without a click. */
export const FORBIDDEN_EAGER = ['markdown-it']

/** Static imports only: `import ... from "./x.js"`, never `import("./x.js")`. */
export function staticImports(source) {
  const found = new Set()
  const fromClause = /\bfrom\s*["'](\.[^"']+)["']/g
  const bareImport = /^\s*import\s*["'](\.[^"']+)["']/gm

  for (const pattern of [fromClause, bareImport]) {
    let match
    while ((match = pattern.exec(source)) !== null) {
      found.add(match[1])
    }
  }
  return [...found]
}

/**
 * The first thing the loader reaches for, which is eager by definition.
 *
 * @crxjs emits a loader that resolves the real chunk through
 * `chrome.runtime.getURL(...)` and then imports it, so the path is an argument
 * to that call rather than a literal inside `import()`.
 */
export function loaderTarget(source) {
  const match =
    /(?:chrome\.runtime\.getURL|import)\s*\(\s*["']([^"']+)["']/.exec(source)
  return match ? match[1] : null
}

/**
 * A path as written inside a chunk, resolved against dist/.
 *
 * Chunk-to-chunk imports are relative (`./remote-x.js`); what the loader hands
 * to getURL is already relative to the extension root.
 */
export function resolveTarget(fromRelative, target) {
  if (!target.startsWith('.')) {
    return path.posix.normalize(target)
  }
  return path.posix.normalize(
    path.posix.join(path.posix.dirname(fromRelative), target),
  )
}

/**
 * Every file the content script loads before the page has been touched, as
 * paths relative to dist/.
 */
export function eagerFiles(distPath, entry) {
  const seen = new Set()
  const queue = [entry]

  while (queue.length > 0) {
    const relative = queue.shift()
    if (seen.has(relative)) {
      continue
    }
    const absolute = path.join(distPath, relative)
    if (!fs.existsSync(absolute)) {
      continue
    }
    seen.add(relative)

    const source = fs.readFileSync(absolute, 'utf8')
    const targets = staticImports(source)

    // The loader's only job is to import the real chunk, so that one counts.
    if (seen.size === 1) {
      const target = loaderTarget(source)
      if (target) {
        targets.push(target)
      }
    }

    for (const target of targets) {
      queue.push(resolveTarget(relative, target))
    }
  }

  return [...seen]
}

function main() {
  const distPath = path.resolve(import.meta.dirname, '../dist')
  const manifestPath = path.join(distPath, 'manifest.json')

  if (!fs.existsSync(manifestPath)) {
    console.error(`No build at ${distPath}. Run "pnpm build" first.`)
    process.exit(1)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const entries = (manifest.content_scripts ?? []).flatMap((entry) => entry.js ?? [])

  if (entries.length === 0) {
    console.error('The manifest declares no content script to measure.')
    process.exit(1)
  }

  const problems = []
  let total = 0
  const loaded = new Set()

  for (const entry of entries) {
    for (const file of eagerFiles(distPath, entry)) {
      if (loaded.has(file)) {
        continue
      }
      loaded.add(file)
      total += fs.statSync(path.join(distPath, file)).size

      for (const name of FORBIDDEN_EAGER) {
        if (file.includes(name)) {
          problems.push(
            `${name} is loaded eagerly (${file}). It must stay behind a dynamic import.`,
          )
        }
      }
    }
  }

  if (total > BUDGET_BYTES) {
    problems.push(
      `the content script loads ${(total / 1024).toFixed(1)} kB eagerly, over the ${(
        BUDGET_BYTES / 1024
      ).toFixed(0)} kB budget.`,
    )
  }

  if (problems.length > 0) {
    console.error('Content script payload check failed:')
    for (const problem of problems) {
      console.error(`  - ${problem}`)
    }
    console.error(
      '\nEvery https page the user visits pays for this. Either move the new ' +
        'code behind a dynamic import, or raise BUDGET_BYTES in ' +
        'scripts/check-payload.js on purpose.',
    )
    process.exit(1)
  }

  console.log(
    `Payload OK: the content script loads ${(total / 1024).toFixed(1)} kB across ` +
      `${loaded.size} files, under the ${(BUDGET_BYTES / 1024).toFixed(0)} kB budget.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
