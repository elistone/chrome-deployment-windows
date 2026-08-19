import { e2eConfig, expect, githubPageHtml, test } from './fixtures'

test.describe('in-page notice', () => {
  test.beforeEach(async ({ seedConfig }) => {
    await seedConfig(e2eConfig())
  })

  test('injects the notice after the first matching element', async ({
    openStubbedPage,
  }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/always',
      githubPageHtml(),
    )

    const notice = page.locator('.dw-notification')
    await expect(notice).toBeVisible()
    // The notice draws inside a shadow root, which Playwright's css engine
    // pierces; the page's own stylesheet cannot.
    await expect(page.locator('.dw-notification .name')).toHaveText(
      'Always open project',
    )

    // It should land immediately after .file-navigation, the first insert rule.
    const previous = notice.locator('xpath=preceding-sibling::*[1]')
    await expect(previous).toHaveClass(/file-navigation/)
  })

  test('shows the open state while inside the window', async ({
    openStubbedPage,
  }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/always',
      githubPageHtml(),
    )

    const notice = page.locator('.dw-notification .notice')
    await expect(notice).toHaveAttribute('data-status', 'open')
    await expect(page.locator('.status-text')).toHaveText(
      'Deployment window open',
    )
  })

  test('shows the closed state while outside the window', async ({
    openStubbedPage,
  }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/never',
      githubPageHtml(),
    )

    const notice = page.locator('.dw-notification .notice')
    await expect(notice).toHaveAttribute('data-status', 'closed')
    await expect(page.locator('.status-text')).toHaveText(
      'Deployment window closed',
    )
  })

  test('ticks the clock in real time', async ({ openStubbedPage }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/always',
      githubPageHtml(),
    )

    const clock = page.locator('.clock')
    const first = await clock.textContent()
    await expect(clock).not.toHaveText(first ?? '', { timeout: 5000 })
  })

  test('toggles the notes open and closed', async ({ openStubbedPage }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/always',
      githubPageHtml(),
    )

    const toggle = page.locator('.dw-notification .toggle')
    const details = page.locator('.dw-notification .details')

    await expect(toggle).toHaveText('Show details')
    await expect(details).toBeHidden()

    await toggle.click()
    await expect(details).toBeVisible()
    await expect(toggle).toHaveText('Hide details')
    // The notes are markdown, so '**two**' renders as bold.
    await expect(details.locator('.notes strong')).toHaveText('two')

    await toggle.click()
    await expect(details).toBeHidden()
  })

  test('renders a notes-only deployment without a window', async ({
    openStubbedPage,
  }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/notes',
      githubPageHtml(),
    )

    await expect(page.locator('.dw-notification .name')).toHaveText(
      'Notes only project',
    )
    await expect(page.locator('.dw-notification .notes')).toContainText(
      'Frozen until Q3.',
    )
    await expect(page.locator('.dw-notification .notice')).toHaveAttribute(
      'data-status',
      'notes',
    )
    await expect(page.locator('.dw-notification .rows')).toHaveCount(0)
    await expect(page.locator('.dw-notification .pill')).toHaveCount(0)
  })

  test('falls back to the second insert location', async ({
    openStubbedPage,
  }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/always',
      `<!doctype html><html lang="en"><body>
         <div class="repository-content">repository content</div>
       </body></html>`,
    )

    const notice = page.locator('.dw-notification')
    await expect(notice).toBeVisible()
    const next = notice.locator('xpath=following-sibling::*[1]')
    await expect(next).toHaveClass(/repository-content/)
  })

  test('puts the notice back when the page swaps its content', async ({
    openStubbedPage,
  }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/always',
      githubPageHtml(),
    )
    await expect(page.locator('.dw-notification')).toBeVisible()

    // What a turbo frame swap does: the region the notice was injected into is
    // replaced wholesale, taking the notice with it.
    await page.evaluate(() => {
      document.body.innerHTML =
        '<div class="file-navigation">file navigation</div>'
    })

    await expect(page.locator('.dw-notification')).toBeVisible()
    await expect(page.locator('.dw-notification')).toHaveCount(1)
  })

  test('follows an in-app navigation to another project', async ({
    openStubbedPage,
  }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/always',
      githubPageHtml(),
    )
    await expect(page.locator('.dw-notification .name')).toHaveText(
      'Always open project',
    )

    // No page load: the url changes and the content is re-rendered, which is
    // all a single page app does when you click one of its own links.
    await page.evaluate(() => {
      history.pushState({}, '', '/acme/notes')
      document.body.innerHTML =
        '<div class="file-navigation">file navigation</div>'
    })

    await expect(page.locator('.dw-notification .name')).toHaveText(
      'Notes only project',
    )
    await expect(page.locator('.dw-notification')).toHaveCount(1)
  })

  test('accepts a css selector as an insert location', async ({
    seedConfig,
    openStubbedPage,
  }) => {
    // What github.com needs: its stable anchor is an id, and the classes
    // beside it are generated.
    const config = e2eConfig()
    config.sites.github.insert = [
      { class: '#repository-container-header', position: 'after' },
    ]
    await seedConfig(config)

    const page = await openStubbedPage(
      'https://github.com/acme/always',
      `<!doctype html><html lang="en"><body>
         <div id="repository-container-header">repo header</div>
         <div class="repository-content">repository content</div>
       </body></html>`,
    )

    const notice = page.locator('.dw-notification')
    await expect(notice).toBeVisible()
    const previous = notice.locator('xpath=preceding-sibling::*[1]')
    await expect(previous).toHaveAttribute('id', 'repository-container-header')
  })

  test('injects nothing on a url with no configured deployment', async ({
    openStubbedPage,
  }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/unconfigured',
      githubPageHtml(),
    )

    await page.waitForTimeout(1500)
    await expect(page.locator('.dw-notification')).toHaveCount(0)
  })

  test('injects nothing when the page has no insert target', async ({
    openStubbedPage,
  }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/always',
      '<!doctype html><html lang="en"><body><p>nothing to hook onto</p></body></html>',
    )

    await page.waitForTimeout(1500)
    await expect(page.locator('.dw-notification')).toHaveCount(0)
  })
})
