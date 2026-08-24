import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

// @ts-expect-error - a plain node script, deliberately not typed
import { KEY_PATTERN, collectUsedKeys, findProblems } from '../scripts/check-locales.js'

import messages from '../public/_locales/en/messages.json'

/**
 * The check that stops a message key existing in a component but not in the
 * catalogue. Every visible label goes through chrome.i18n, and a missing entry
 * renders as nothing, so this is what turns a blank control into a red build.
 */

const directories: string[] = []

function sourceTree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-locales-'))
  directories.push(root)
  for (const [name, contents] of Object.entries(files)) {
    const full = path.join(root, name)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, contents)
  }
  return root
}

function entry(message: string) {
  return { message, description: 'test' }
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('KEY_PATTERN', () => {
  it.each(['l10nStatus', 'l10nNoWindowSet', 'l10nA1'])('matches %s', (key) => {
    expect(key.match(KEY_PATTERN)).toEqual([key])
  })

  it('ignores the bare prefix', () => {
    // Methods.humaniseKey strips it with /^l10n/, which must not read as a key.
    expect("key.replace(/^l10n/, '')".match(KEY_PATTERN)).toBeNull()
  })
})

describe('collectUsedKeys', () => {
  it('finds keys in calls, arrays and ternaries', () => {
    const root = sourceTree({
      'a.tsx': "Methods.i18n('l10nSave')",
      'nested/b.ts': "const map = ['l10nOne', 'l10nTwo']\ni18n(x ? 'l10nThree' : 'l10nOne')",
    })

    expect([...collectUsedKeys(root).keys()].sort()).toEqual([
      'l10nOne',
      'l10nSave',
      'l10nThree',
      'l10nTwo',
    ])
  })

  it('records every file a key appears in', () => {
    const root = sourceTree({
      'a.ts': "i18n('l10nSave')",
      'b.ts': "i18n('l10nSave')",
    })

    expect(collectUsedKeys(root).get('l10nSave')?.size).toBe(2)
  })

  it('ignores files that are not source', () => {
    const root = sourceTree({
      'a.ts': "i18n('l10nSave')",
      'notes.md': "i18n('l10nFromMarkdown')",
      'styles.css': '.l10nFromCss {}',
    })

    expect([...collectUsedKeys(root).keys()]).toEqual(['l10nSave'])
  })
})

describe('findProblems', () => {
  it('passes when the two sides match exactly', () => {
    const used = new Map([['l10nSave', new Set(['a.ts'])]])
    expect(findProblems(used, { l10nSave: entry('Save') })).toEqual([])
  })

  it('reports a key used but never defined, and says where', () => {
    const used = new Map([['l10nMissing', new Set(['src/ui/Thing.tsx'])]])

    const problems = findProblems(used, {})

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('l10nMissing')
    expect(problems[0]).toContain('src/ui/Thing.tsx')
  })

  it('reports a message left behind after its last use went away', () => {
    expect(findProblems(new Map(), { l10nStale: entry('Stale') })).toEqual([
      'l10nStale is defined but never used',
    ])
  })

  it('reports an entry with no text', () => {
    // An empty message is the very blank label this check exists to prevent.
    const used = new Map([['l10nBlank', new Set(['a.ts'])]])
    expect(findProblems(used, { l10nBlank: entry('') })).toEqual([
      'l10nBlank has no message text',
    ])
  })
})

describe('the real catalogue', () => {
  it('has no problems', () => {
    const source = path.resolve(import.meta.dirname, '../src')
    expect(findProblems(collectUsedKeys(source), messages)).toEqual([])
  })
})
