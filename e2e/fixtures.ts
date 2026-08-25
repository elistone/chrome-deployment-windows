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

/**
 * Console output that is expected, and why.
 *
 * Deliberately empty. Every entry here is a message nobody will ever look at
 * again, so each one needs a reason that survives being read in a year - and
 * the moment this list is easier to add to than the underlying noise is to
 * fix, it has stopped doing its job.
 */
const EXPECTED_CONSOLE: { pattern: RegExp; because: string }[] = []

/** Levels worth failing a test over. `log`, `info` and `debug` are not. */
const LOUD_LEVELS = new Set(['error', 'warning'])

interface CapturedMessage {
  where: string
  level: string
  text: string
}

function isExpected(text: string): boolean {
  return EXPECTED_CONSOLE.some((entry) => entry.pattern.test(text))
}

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
  /** Fails the test if any page it opened logged a warning or an error. */
  consoleGuard: void
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

  /**
   * Fail a test that leaves warnings or errors in the console.
   *
   * Attached to the context rather than to individual pages, so it covers
   * every page a spec opens including the ones it makes itself. `auto` means
   * no test has to remember to ask for it - which is the point, since the
   * warnings this exists to catch are exactly the ones nobody was looking for.
   *
   * It was added after a build change filled every extension page with preload
   * warnings for weeks. The suite drove a real Chromium the whole time and
   * never once looked at what it was saying.
   */
  consoleGuard: [
    async ({ context }, use) => {
      const captured: CapturedMessage[] = []

      const watch = (page: Page) => {
        const where = () => page.url() || 'about:blank'
        page.on('console', (message) => {
          if (!LOUD_LEVELS.has(message.type())) {
            return
          }
          const text = message.text()
          if (!isExpected(text)) {
            captured.push({ where: where(), level: message.type(), text })
          }
        })
        page.on('pageerror', (error) => {
          captured.push({
            where: where(),
            level: 'pageerror',
            text: String(error),
          })
        })
      }

      context.pages().forEach(watch)
      context.on('page', watch)

      await use()

      if (captured.length > 0) {
        const lines = captured
          .map((m) => `  [${m.level}] ${m.text}\n      on ${m.where}`)
          .join('\n')
        throw new Error(
          `The console was not clean. ${String(captured.length)} message(s):\n${lines}\n\n` +
            'Fix the cause, or add it to EXPECTED_CONSOLE in e2e/fixtures.ts ' +
            'with a reason.',
        )
      }
    },
    { auto: true },
  ],

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
