import { e2eConfig, expect, githubPageHtml, test } from './fixtures'

async function openOptions(
  context: import('@playwright/test').BrowserContext,
  extensionId: string,
) {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/ui/options.html`)
  await expect(page.getByRole('heading', { name: 'Deployment windows config' })).toBeVisible()
  return page
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

  test('opens on site information', async ({ context, extensionId }) => {
    const page = await openOptions(context, extensionId)

    await expect(page.getByRole('heading', { name: 'github' })).toBeVisible()
    await expect(page.getByText('*://*.github.com/*')).toBeVisible()
    await expect(page.getByText('flash flash-success')).toBeVisible()
  })

  test('shows the configured deployments', async ({ context, extensionId }) => {
    const page = await openOptions(context, extensionId)

    await page.getByRole('button', { name: 'Deployment Windows' }).click()

    await expect(page.getByText('Always open project')).toBeVisible()
    await expect(page.getByText('Notes only project')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'github (url key)' })).toBeVisible()
  })

  test('renders the how-to document', async ({ context, extensionId }) => {
    const page = await openOptions(context, extensionId)

    await page.getByRole('button', { name: 'How to use' }).click()

    await expect(
      page.getByRole('heading', { name: 'Using the extension' }),
    ).toBeVisible()
    await expect(page.locator('table').first()).toBeVisible()
  })

  test('the CodeMirror editor mounts and shows the config', async ({
    context,
    extensionId,
  }) => {
    const page = await openOptions(context, extensionId)

    await page.getByRole('button', { name: 'Edit / Import / Export' }).click()

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
    await page.getByRole('button', { name: 'Edit / Import / Export' }).click()

    const content = page.locator('.cm-content')
    await content.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('{"domains": {}, "sites": {}}')

    await page.getByRole('button', { name: 'Save' }).click()

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
    await page.getByRole('button', { name: 'Edit / Import / Export' }).click()

    const next = e2eConfig()
    next.deployments.always.name = 'Renamed via options'

    const content = page.locator('.cm-content')
    await content.click()
    await page.keyboard.press('ControlOrMeta+a')
    // insertText avoids CodeMirror's bracket auto-closing mangling the json.
    await page.keyboard.insertText(JSON.stringify(next))

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Saved!' })).toBeVisible()

    // The content script reads the same storage, so a fresh page reflects it.
    const site = await openStubbedPage(
      'https://github.com/acme/always',
      githubPageHtml(),
    )
    await expect(site.locator('.dw-notification')).toContainText(
      'Renamed via options',
    )
  })
})
