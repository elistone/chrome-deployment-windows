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
    await expect(notice).toContainText('Always open project')

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

    const notice = page.locator('.dw-notification')
    await expect(notice).toHaveClass(/flash-success/)
    await expect(page.locator('.dw-current-status-text')).toHaveText(
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

    const notice = page.locator('.dw-notification')
    await expect(notice).toHaveClass(/flash-error/)
    await expect(page.locator('.dw-current-status-text')).toHaveText(
      'Deployment window closed',
    )
  })

  test('ticks the clock in real time', async ({ openStubbedPage }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/always',
      githubPageHtml(),
    )

    const clock = page.locator('.dw-current-time-text')
    const first = await clock.textContent()
    await expect(clock).not.toHaveText(first ?? '', { timeout: 5000 })
  })

  test('toggles the notes open and closed', async ({ openStubbedPage }) => {
    const page = await openStubbedPage(
      'https://github.com/acme/always',
      githubPageHtml(),
    )

    const toggle = page.locator('.dw-notification .dw-toggle')
    const details = page.locator('.dw-details')

    await expect(toggle).toHaveText('Show details')
    await expect(details).toBeHidden()

    await toggle.click()
    await expect(details).toBeVisible()
    await expect(toggle).toHaveText('Hide details')
    // The notes are markdown, so '**two**' renders as bold.
    await expect(details.locator('.dw-notes strong')).toHaveText('two')

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

    const notice = page.locator('.dw-notification')
    await expect(notice).toContainText('Notes only project')
    await expect(notice).toContainText('Frozen until Q3.')
    await expect(notice).toHaveClass(/flash-warn/)
    await expect(page.locator('.dw-deployment-time')).toHaveCount(0)
    await expect(page.locator('.dw-current-status')).toHaveCount(0)
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
