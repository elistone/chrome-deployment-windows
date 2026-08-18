#!/usr/bin/env node
/**
 * Keep the source and the message catalogue in step.
 *
 * Every user-visible string in the extension goes through chrome.i18n, and a
 * missing entry resolves to nothing at all - so a typo, or a key added to a
 * component but not to messages.json, shows up as a blank label rather than an
 * error. Methods.i18n falls back to a readable version of the key so the UI
 * never goes silent, but that is a safety net, not a substitute for the real
 * string. This turns the mistake into a build failure.
 *
 * It runs against the source rather than the build, so it fails before a broken
 * catalogue can be packaged.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Matches a message key wherever it appears - call, array or ternary.
 *
 * The capital after the prefix is required, so the bare `l10n` in the humanise
 * helper's own regex is not mistaken for a key.
 */
export const KEY_PATTERN = /\bl10n[A-Z][A-Za-z0-9_]*/g

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])

export function walk(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(full))
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full)
    }
  }
  return files
}

/** key -> the files referencing it, so an error can say where to look. */
export function collectUsedKeys(sourceDir) {
  const used = new Map()
  for (const file of walk(sourceDir)) {
    const contents = fs.readFileSync(file, 'utf8')
    for (const key of contents.match(KEY_PATTERN) ?? []) {
      const where = used.get(key) ?? new Set()
      where.add(file)
      used.set(key, where)
    }
  }
  return used
}

export function findProblems(used, messages) {
  const problems = []
  const defined = new Set(Object.keys(messages))

  for (const [key, files] of [...used].sort()) {
    if (!defined.has(key)) {
      problems.push(`${key} is used in ${[...files].join(', ')} but not defined`)
    }
  }

  for (const key of [...defined].sort()) {
    if (!used.has(key)) {
      problems.push(`${key} is defined but never used`)
    }
  }

  // A message with no text is the same blank label the check exists to prevent.
  for (const [key, entry] of Object.entries(messages)) {
    if (!entry?.message) {
      problems.push(`${key} has no message text`)
    }
  }

  return problems
}

function main() {
  const root = path.resolve(import.meta.dirname, '..')
  const sourceDir = path.join(root, 'src')
  const messagesPath = path.join(root, 'public/_locales/en/messages.json')

  if (!fs.existsSync(messagesPath)) {
    console.error(`No message catalogue at ${messagesPath}.`)
    process.exit(1)
  }

  const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'))
  const problems = findProblems(collectUsedKeys(sourceDir), messages).map(
    (problem) => problem.replaceAll(`${root}/`, ''),
  )

  if (problems.length > 0) {
    console.error('Locale check failed:')
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exit(1)
  }

  console.log(
    `Locales OK: ${Object.keys(messages).length} messages, all used and all defined.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
