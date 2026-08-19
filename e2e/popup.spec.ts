import { e2eConfig, expect, githubPageHtml, test } from './fixtures'

/**
 * The popup reads the *active* tab, which a directly-opened extension page is
 * not. These specs open the popup as a page and stub chrome.tabs.query so it
 * resolves against a chosen url, which is what the popup would see in real use.
 */
test.describe('popup', () => {
  test.beforeEach(async ({ seedConfig }) => {
    await seedConfig(e2eConfig())
  })

  async function popupFor(
    context: import('@playwright/test').BrowserContext,
    extensionId: string,
    url: string,
  ) {
    const page = await context.newPage()
    // Stub the tab lookup before the popup bundle runs.
    await page.addInitScript((activeUrl) => {
      const applyStub = () => {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.query = (async () => [{ url: activeUrl }]) as never
        }
      }
      applyStub()
      document.addEventListener('readystatechange', applyStub)
    }, url)

    await page.goto(`chrome-extension://${extensionId}/src/ui/popup.html`)
    return page
  }

  test('shows the window and open status for the active tab', async ({
    context,
    extensionId,
  }) => {
    const page = await popupFor(
      context,
      extensionId,
      'https://github.com/acme/always',
    )

    await expect(page.locator('.dw-popup-title')).toHaveText(
      'Always open project',
    )
    await expect(page.locator('.dw-popup')).toHaveAttribute(
      'data-status',
      'open',
    )
    await expect(page.locator('.dw-pill')).toHaveText('Deployment window open')
    await expect(page.locator('.dw-countdown')).toHaveText(
      /^Closes in (1h|59m)$/,
    )
    await expect(page.locator('.dw-popup-rows')).toBeVisible()
    await expect(page.locator('.dw-popup-site')).toContainText('github.com')
  })

  test('shows the closed status outside the window', async ({
    context,
    extensionId,
  }) => {
    const page = await popupFor(
      context,
      extensionId,
      'https://github.com/acme/never',
    )

    await expect(page.locator('.dw-popup-title')).toHaveText(
      'Always closed project',
    )
    await expect(page.locator('.dw-popup')).toHaveAttribute(
      'data-status',
      'closed',
    )
    await expect(page.locator('.dw-pill')).toHaveText('Deployment window closed')
  })

  test('renders notes as markdown', async ({ context, extensionId }) => {
    const page = await popupFor(
      context,
      extensionId,
      'https://github.com/acme/always',
    )

    await expect(page.locator('.dw-popup-notes strong')).toHaveText('two')
  })

  test('hides the window rows for a notes-only deployment', async ({
    context,
    extensionId,
  }) => {
    const page = await popupFor(
      context,
      extensionId,
      'https://github.com/acme/notes',
    )

    await expect(page.locator('.dw-popup-title')).toHaveText(
      'Notes only project',
    )
    await expect(page.locator('.dw-popup-rows')).toHaveCount(0)
    await expect(page.locator('.dw-popup-notes')).toContainText(
      'Frozen until Q3.',
    )
  })

  test('reports when there is nothing configured for the tab', async ({
    context,
    extensionId,
  }) => {
    const page = await popupFor(
      context,
      extensionId,
      'https://github.com/acme/unconfigured',
    )

    await expect(page.locator('.dw-popup-message-title')).toHaveText(
      'No deployment information for this domain.',
    )
  })

  test('opens in the theme chosen on the options page', async ({
    context,
    extensionId,
  }) => {
    const settings = await context.newPage()
    await settings.goto(`chrome-extension://${extensionId}/src/ui/options.html`)
    await settings.getByRole('button', { name: 'Dark' }).click()
    await settings.close()

    const page = await popupFor(
      context,
      extensionId,
      'https://github.com/acme/always',
    )

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})

test.describe('toolbar icon', () => {
  test.beforeEach(async ({ seedConfig }) => {
    await seedConfig(e2eConfig())
  })

  test('the service worker handles the icon message from a live page', async ({
    context,
    openStubbedPage,
  }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/always',
      githubPageHtml(),
    )
    await expect(page.locator('.dw-notification')).toBeVisible()

    // The notice messages the worker on insert; if that round trip threw, the
    // page would have logged an unhandled rejection.
    const [worker] = context.serviceWorkers()
    expect(worker).toBeTruthy()

    const responded = await worker.evaluate(
      async () =>
        new Promise((resolve) => {
          chrome.action
            .setIcon({ path: 'icons/success/icon48.png' })
            .then(() => resolve(true))
            .catch(() => resolve(false))
        }),
    )
    expect(responded).toBe(true)
  })
})
