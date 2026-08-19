import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import fs from 'node:fs'

import {
  type BrowserContext,
  type Page,
  chromium,
  test as base,
} from '@playwright/test'

import type { DeploymentWindowsConfig } from '../src/app/config/types'

const here = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.resolve(here, '../dist')

/** Storage keys must stay in step with src/app/config/Config.ts. */
const STORAGE_KEYS = {
  domains: 'DOMAINS',
  sites: 'SITES',
  deployments: 'DEPLOYMENTS',
} as const

export interface ExtensionFixtures {
  context: BrowserContext
  extensionId: string
  /** Write a config into the extension's chrome.storage.sync. */
  seedConfig: (config: DeploymentWindowsConfig) => Promise<void>
  /**
   * Open a stubbed https page. The extension only matches https, so rather than
   * running an http test server the response is fulfilled locally.
   */
  openStubbedPage: (url: string, body: string) => Promise<Page>
}

export const test = base.extend<ExtensionFixtures>({
  // Playwright reads the destructuring pattern to work out fixture
  // dependencies, so the empty pattern is required and cannot be simplified.
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    if (!fs.existsSync(path.join(distPath, 'manifest.json'))) {
      throw new Error(
        `No built extension at ${distPath}. Run "pnpm build" before the e2e tests.`,
      )
    }

    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-e2e-'))
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${distPath}`,
        `--load-extension=${distPath}`,
      ],
    })

    await use(context)

    await context.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  },

  extensionId: async ({ context }, use) => {
    // The MV3 service worker registers on load; wait for it to learn the id.
    let [worker] = context.serviceWorkers()
    if (!worker) {
      worker = await context.waitForEvent('serviceworker')
    }
    await use(new URL(worker.url()).host)
  },

  seedConfig: async ({ context, extensionId }, use) => {
    await use(async (config: DeploymentWindowsConfig) => {
      // chrome.storage is only reachable from an extension page.
      const page = await context.newPage()
      await page.goto(`chrome-extension://${extensionId}/src/ui/options.html`)
      await page.evaluate(
        ([keys, value]) =>
          chrome.storage.sync.set({
            [keys.domains]: value.domains,
            [keys.sites]: value.sites,
            [keys.deployments]: value.deployments,
          }),
        [STORAGE_KEYS, config] as const,
      )
      await page.close()
    })
  },

  openStubbedPage: async ({ context }, use) => {
    await use(async (url: string, body: string) => {
      const page = await context.newPage()
      // Only https is stubbed. A catch-all would also swallow the content
      // script's own chrome-extension:// module import and break injection.
      await page.route(
        (candidate) => candidate.protocol === 'https:',
        (route) =>
          route.fulfill({
            status: 200,
            contentType: 'text/html',
            body,
          }),
      )
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      return page
    })
  },
})

export const expect = test.expect

/** A page carrying the elements the github insert rules look for. */
export function githubPageHtml(title = 'repo'): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>${title}</title></head>
  <body>
    <div class="file-navigation">file navigation</div>
    <div class="repository-content">repository content</div>
  </body>
</html>`
}

function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** HH:mm, `hours` away from now, in the machine's own timezone. */
function offsetFromNow(hours: number): string {
  const at = new Date(Date.now() + hours * 60 * 60 * 1000)
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

/**
 * The config the e2e specs run against.
 *
 * The windows are built relative to the current time rather than hard coded, so
 * "open" and "closed" hold whenever the suite happens to run. The notice
 * compares against the real clock, which no fixture can freeze from outside.
 */
export function e2eConfig(): DeploymentWindowsConfig {
  const timezone = localTimezone()

  return {
    domains: {
      github: ['*://*.github.com/*'],
    },
    sites: {
      github: {
        insert: [
          { class: 'file-navigation', position: 'after' },
          { class: 'repository-content', position: 'before' },
        ],
      },
    },
    deployments: {
      always: {
        name: 'Always open project',
        github: 'acme/always',
        notes: 'Deploys need **two** approvals.',
        // Straddles now, so the window is open.
        time: { start: offsetFromNow(-1), end: offsetFromNow(1), timezone },
      },
      never: {
        name: 'Always closed project',
        github: 'acme/never',
        // Entirely in the future, so the window is closed.
        time: { start: offsetFromNow(2), end: offsetFromNow(3), timezone },
      },
      notes: {
        name: 'Notes only project',
        github: 'acme/notes',
        notes: 'Frozen until Q3.',
        'notes-only': true,
      },
    },
  }
}
