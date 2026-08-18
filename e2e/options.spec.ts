import { e2eConfig, expect, githubPageHtml, test } from './fixtures'

async function openOptions(
  context: import('@playwright/test').BrowserContext,
  extensionId: string,
) {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/ui/options.html`)
  await expect(
    page.getByRole('heading', { name: 'Deployment windows config' }),
  ).toBeVisible()
  return page
}

async function enterEditMode(page: import('@playwright/test').Page) {
  await page.getByLabel('Edit mode').check()
}

test.describe('options page', () => {
  test.beforeEach(async ({ seedConfig }) => {
    await seedConfig(e2eConfig())
  })

  test('loads under the MV3 content security policy without errors', async ({
    context,
    extensionId,
  }) => {
    const errors: string[] = []
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })

    await page.goto(`chrome-extension://${extensionId}/src/ui/options.html`)
    await expect(
      page.getByRole('heading', { name: 'Deployment windows config' }),
    ).toBeVisible()

    expect(errors).toEqual([])
  })

  test('shows deployments and sites together, with live status', async ({
    context,
    extensionId,
  }) => {
    const page = await openOptions(context, extensionId)

    await expect(page.getByRole('heading', { name: 'Always open project' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Notes only project' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'github' })).toBeVisible()
    await expect(page.getByText('*://*.github.com/*')).toBeVisible()

    const openCard = page.locator('article', {
      has: page.getByRole('heading', { name: 'Always open project' }),
    })
    await expect(openCard).toHaveAttribute('data-status', 'open')
    await expect(openCard.getByText('Deployment window open')).toBeVisible()
  })

  test('adds a deployment through the form and the notice picks it up', async ({
    context,
    extensionId,
    openStubbedPage,
  }) => {
    const page = await openOptions(context, extensionId)
    await enterEditMode(page)

    await page.getByRole('button', { name: 'Add deployment' }).click()

    const dialog = page.getByRole('dialog', { name: 'New deployment' })
    await dialog.getByLabel(/^Name/).fill('Added from the UI')
    await dialog.getByLabel('github').fill('acme/added')
    // A window that straddles now, so the notice reports it open.
    await dialog.getByLabel(/^Opens/).fill('00:00')
    await dialog.getByLabel(/^Closes/).fill('23:59')
    await dialog.getByLabel(/^Timezone/).fill(
      await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Added from the UI' })).toBeVisible()

    const site = await openStubbedPage(
      'https://github.com/acme/added',
      githubPageHtml(),
    )
    await expect(site.locator('.dw-notification')).toContainText('Added from the UI')
  })

  test('refuses to save an entry that could never match a page', async ({
    context,
    extensionId,
  }) => {
    const page = await openOptions(context, extensionId)
    await enterEditMode(page)

    await page.getByRole('button', { name: 'Add deployment' }).click()
    await page.getByRole('dialog').getByLabel(/^Name/).fill('No fragment')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText(/at least one site/)).toBeVisible()
  })

  test('deletes a deployment and offers an undo', async ({
    context,
    extensionId,
  }) => {
    const page = await openOptions(context, extensionId)
    await enterEditMode(page)

    const card = page.locator('article', {
      has: page.getByRole('heading', { name: 'Notes only project' }),
    })
    await card.getByRole('button', { name: /^Delete/ }).click()
    await card.getByRole('button', { name: /Delete this\?/ }).click()

    await expect(
      page.getByRole('heading', { name: 'Notes only project' }),
    ).toBeHidden()

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(
      page.getByRole('heading', { name: 'Notes only project' }),
    ).toBeVisible()
  })

  test('switches between light and dark, and remembers it', async ({
    context,
    extensionId,
  }) => {
    const page = await openOptions(context, extensionId)

    await page.getByRole('button', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    // Reopening reads the stored preference before the first paint.
    const reopened = await openOptions(context, extensionId)
    await expect(reopened.locator('html')).toHaveAttribute('data-theme', 'dark')

    await reopened.getByRole('button', { name: 'System' }).click()
    await expect(reopened.locator('html')).not.toHaveAttribute('data-theme', 'dark')
  })

  test('opens the how-to document from the header', async ({
    context,
    extensionId,
  }) => {
    const page = await openOptions(context, extensionId)

    await page.getByRole('button', { name: 'How to use' }).click()

    const dialog = page.getByRole('dialog', { name: 'How to use' })
    await expect(dialog.getByRole('heading', { name: 'Quick start' })).toBeVisible()
    await expect(dialog.locator('table').first()).toBeVisible()
  })

  test('the CodeMirror editor mounts and shows the config', async ({
    context,
    extensionId,
  }) => {
    const page = await openOptions(context, extensionId)

    await page.getByRole('button', { name: /JSON config/ }).click()

    const editor = page.locator('.cm-editor')
    await expect(editor).toBeVisible()
    await expect(editor).toContainText('deployments')
    await expect(editor).toContainText('Always open project')
  })

  test('rejects an invalid config instead of saving it', async ({
    context,
    extensionId,
  }) => {
    const page = await openOptions(context, extensionId)
    await page.getByRole('button', { name: /JSON config/ }).click()

    const content = page.locator('.cm-content')
    await content.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('{"domains": {}, "sites": {}}')

    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByRole('alert')).toContainText('deployments')
    // The stored config must be untouched.
    const storedKeys = await page.evaluate(async () => {
      const stored = await chrome.storage.sync.get('DEPLOYMENTS')
      return Object.keys(stored.DEPLOYMENTS ?? {})
    })
    expect(storedKeys).toContain('always')
  })

  test('saves an edited config and the notice picks it up', async ({
    context,
    extensionId,
    openStubbedPage,
  }) => {
    const page = await openOptions(context, extensionId)
    await page.getByRole('button', { name: /JSON config/ }).click()

    const next = e2eConfig()
    next.deployments.always.name = 'Renamed via json'

    const content = page.locator('.cm-content')
    await content.click()
    await page.keyboard.press('ControlOrMeta+a')
    // insertText avoids CodeMirror's bracket auto-closing mangling the json.
    await page.keyboard.insertText(JSON.stringify(next))

    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Renamed via json' })).toBeVisible()

    // The content script reads the same storage, so a fresh page reflects it.
    const site = await openStubbedPage(
      'https://github.com/acme/always',
      githubPageHtml(),
    )
    await expect(site.locator('.dw-notification')).toContainText(
      'Renamed via json',
    )
  })
})
