#!/usr/bin/env node
/**
 * Sanity-check the built manifest.
 *
 * Cheap insurance in CI: the manifest is generated, so a build or plugin change
 * could silently drop a key or reintroduce a Manifest V2 construct, and neither
 * the unit tests nor the type checker would notice.
 */
import fs from 'node:fs'
import path from 'node:path'

const distPath = path.resolve(import.meta.dirname, '../dist')
const manifestPath = path.join(distPath, 'manifest.json')

const problems = []

function check(condition, message) {
  if (!condition) problems.push(message)
}

if (!fs.existsSync(manifestPath)) {
  console.error(`No manifest at ${manifestPath}. Run "pnpm build" first.`)
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

check(manifest.manifest_version === 3, 'manifest_version must be 3')
check(!!manifest.name, 'name is missing')
check(
  /^\d+\.\d+\.\d+$/.test(manifest.version ?? ''),
  `version "${manifest.version}" is not x.y.z`,
)
check(!!manifest.default_locale, 'default_locale is missing')

// Manifest V2 leftovers.
check(!manifest.browser_action, 'browser_action is V2; use action')
check(!manifest.page_action, 'page_action is V2; use action')
check(
  !manifest.background?.scripts && !manifest.background?.persistent,
  'background must be a service_worker, not V2 scripts/persistent',
)
check(
  typeof manifest.content_security_policy !== 'string',
  'content_security_policy must be an object in V3',
)

check(!!manifest.action?.default_popup, 'action.default_popup is missing')
check(!!manifest.options_page, 'options_page is missing')
check(
  !!manifest.background?.service_worker,
  'background.service_worker is missing',
)
check(
  Array.isArray(manifest.host_permissions) && manifest.host_permissions.length > 0,
  'host_permissions is missing',
)
check(
  (manifest.permissions ?? []).includes('storage'),
  'the storage permission is missing',
)

// The CSP must not reopen the eval hole that MV3 closes; a runtime schema
// compiler already broke the options page once because of it.
const pagesCsp = manifest.content_security_policy?.extension_pages ?? ''
check(
  !pagesCsp.includes('unsafe-eval'),
  'extension_pages CSP must not allow unsafe-eval',
)

// Every path the manifest points at must actually exist in the build.
const referenced = [
  ...Object.values(manifest.icons ?? {}),
  manifest.action?.default_popup,
  manifest.options_page,
  manifest.background?.service_worker,
  ...(manifest.content_scripts ?? []).flatMap((entry) => [
    ...(entry.js ?? []),
    ...(entry.css ?? []),
  ]),
].filter(Boolean)

for (const relative of referenced) {
  if (!fs.existsSync(path.join(distPath, relative))) {
    problems.push(`manifest references missing file: ${relative}`)
  }
}

// Locales must be present for default_locale to resolve.
if (manifest.default_locale) {
  const messages = path.join(
    distPath,
    '_locales',
    manifest.default_locale,
    'messages.json',
  )
  check(fs.existsSync(messages), `missing _locales/${manifest.default_locale}/messages.json`)
}

if (problems.length > 0) {
  console.error('Manifest check failed:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(
  `Manifest OK: ${manifest.name} v${manifest.version} (MV${manifest.manifest_version}), ${referenced.length} referenced files present.`,
)
