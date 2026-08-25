import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Popup from '../src/ui/components/Popup'
import { Config } from '../src/app/config/Config'
import { chromeMock, seedTabs } from './helpers/chromeMock'
import { testConfig } from './helpers/fixtures'

async function renderPopupFor(url: string) {
  await Config.save(testConfig())
  seedTabs([{ url, active: true }])
  return render(<Popup />)
}

describe('Popup', () => {
  it('shows a loading message before the config resolves', () => {
    seedTabs([{ url: 'https://github.com/acme/daytime' }])
    render(<Popup />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows the deployment window for a matching tab', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2024-06-03T12:00:00'))

    const { container } = await renderPopupFor('https://github.com/acme/daytime')

    expect(await screen.findByText('Daytime project')).toBeInTheDocument()
    expect(screen.getByText('Deployment window')).toBeInTheDocument()
    // Tests run in America/New_York, so the configured London window is shown
    // alongside its converted local equivalent.
    expect(screen.getByText('09:00 – 17:00')).toBeInTheDocument()
    expect(screen.getByText('Europe/London')).toBeInTheDocument()
    expect(screen.getByText('04:00 – 12:00')).toBeInTheDocument()
    expect(screen.getByText('America/New_York')).toBeInTheDocument()
    expect(screen.getByText('Deployment window open')).toBeInTheDocument()
    expect(container.querySelector('.dw-popup')).toHaveAttribute(
      'data-status',
      'open',
    )

    vi.useRealTimers()
  })

  it('says how much longer the window has', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2024-06-03T10:00:00'))

    const { container } = await renderPopupFor('https://github.com/acme/daytime')
    await screen.findByText('Daytime project')

    expect(container.querySelector('.dw-countdown')?.textContent).toBe(
      'Closes in 2h',
    )

    vi.useRealTimers()
  })

  it('has nothing to count down for a notes-only entry', async () => {
    const { container } = await renderPopupFor(
      'https://github.com/acme/notes-only',
    )
    await screen.findByText('Notes only project')

    expect(container.querySelector('.dw-countdown')).toBeNull()
  })

  it('names the host the window was matched against', async () => {
    await renderPopupFor('https://github.com/acme/daytime')

    expect(await screen.findByText('github.com')).toBeInTheDocument()
  })

  it('marks the popup as closed outside the window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2024-06-03T22:00:00'))

    const { container } = await renderPopupFor('https://github.com/acme/daytime')

    expect(
      await screen.findByText('Deployment window closed'),
    ).toBeInTheDocument()
    expect(container.querySelector('.dw-popup')).toHaveAttribute(
      'data-status',
      'closed',
    )

    vi.useRealTimers()
  })

  it('renders notes as markdown', async () => {
    const { container } = await renderPopupFor('https://github.com/acme/daytime')

    await screen.findByText('Daytime project')
    await waitFor(() =>
      expect(
        container.querySelector('.dw-popup-notes strong')?.textContent,
      ).toBe('two'),
    )
  })

  it('hides the window rows for a notes-only deployment', async () => {
    const { container } = await renderPopupFor(
      'https://github.com/acme/notes-only',
    )

    expect(await screen.findByText('Notes only project')).toBeInTheDocument()
    expect(container.querySelector('.dw-popup-rows')).toBeNull()
    expect(screen.getByText('Notes only')).toBeInTheDocument()
    expect(await screen.findByText('Frozen until Q3.')).toBeInTheDocument()
  })

  it('reports when the tab has no deployment information', async () => {
    await renderPopupFor('https://github.com/acme/unknown')

    expect(
      await screen.findByText('No deployment information for this domain.'),
    ).toBeInTheDocument()
    // The site itself is configured, so the useful thing to say is that one
    // could be added rather than that nothing matched.
    expect(
      screen.getByText(
        'This site is set up, so a deployment can be added for this page.',
      ),
    ).toBeInTheDocument()
  })

  it('says nothing matched at all on an unconfigured host', async () => {
    await renderPopupFor('https://example.com/anything')

    expect(
      await screen.findByText('No deployment information for this domain.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Nothing on this page matches a configured site and deployment.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add deployment' }),
    ).toBeNull()
  })

  it('has nowhere to put a notice for a site with no insert rule', async () => {
    const config = testConfig()
    delete config.sites.github
    await Config.save(config)
    seedTabs([{ url: 'https://github.com/acme/daytime', active: true }])
    render(<Popup />)

    expect(
      await screen.findByText(
        'This site has no insert location yet, so the notice has nowhere to go. Add one in settings.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })

  it('reports no information when there is no active tab at all', async () => {
    await Config.save(testConfig())
    seedTabs([])
    render(<Popup />)

    expect(
      await screen.findByText('No deployment information for this domain.'),
    ).toBeInTheDocument()
  })

  it('degrades to no information when storage fails', async () => {
    seedTabs([{ url: 'https://github.com/acme/daytime' }])
    vi.mocked(chrome.storage.sync.get).mockRejectedValue(new Error('offline'))

    render(<Popup />)

    expect(
      await screen.findByText('No deployment information for this domain.'),
    ).toBeInTheDocument()
  })

  it('strips markup from a deployment name rather than rendering it', async () => {
    const config = testConfig()
    config.deployments.daytime.name = 'Proj <img src=x onerror=alert(1)> live'
    await Config.save(config)
    seedTabs([{ url: 'https://github.com/acme/daytime' }])

    const { container } = render(<Popup />)

    // The tag is removed outright, leaving only its surrounding text. The one
    // img on the page is the favicon, which the popup renders itself.
    expect(await screen.findByText('Proj live')).toBeInTheDocument()
    expect(container.querySelector('.dw-popup-title img')).toBeNull()
    expect(container.querySelector('img[src="x"]')).toBeNull()
  })

  it('opens the options page from the footer', async () => {
    const user = userEvent.setup()
    await renderPopupFor('https://github.com/acme/daytime')

    await user.click(screen.getByRole('button', { name: 'Open settings' }))

    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled()
  })

  it('cycles the shared theme preference from the footer', async () => {
    const user = userEvent.setup()
    await renderPopupFor('https://github.com/acme/daytime')

    await user.click(await screen.findByRole('button', { name: /^Theme:/ }))

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ THEME: 'light' })
  })
})

describe('Popup editing', () => {
  it('opens the editor on the matched deployment', async () => {
    const user = userEvent.setup()
    await renderPopupFor('https://github.com/acme/daytime')
    await screen.findByText('Daytime project')

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByRole('heading', { name: 'Edit deployment' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Name/)).toHaveValue('Daytime project')
    expect(screen.getByLabelText(/URL fragment/)).toHaveValue('acme/daytime')
    expect(screen.getByLabelText(/Opens/)).toHaveValue('09:00')
  })

  it('writes an edit back to storage and re-renders from it', async () => {
    const user = userEvent.setup()
    await renderPopupFor('https://github.com/acme/daytime')
    await screen.findByText('Daytime project')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const name = screen.getByLabelText(/Name/)
    await user.clear(name)
    await user.type(name, 'Renamed project')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // Back on the view, showing the new value ...
    expect(await screen.findByText('Renamed project')).toBeInTheDocument()

    // ... and the stored config carries it, under the original key.
    const stored = await Config.load()
    expect(stored.deployments.daytime.name).toBe('Renamed project')
    expect(stored.deployments.daytime.github).toBe('acme/daytime')
  })

  it('keeps the fragments for sites the popup did not show', async () => {
    const user = userEvent.setup()
    await renderPopupFor('https://github.com/acme/overnight')
    await screen.findByText('Overnight project')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // Only the github fragment is on screen; the jira one has to survive
    // anyway, or editing from the popup would quietly unhook the other site.
    const stored = await Config.load()
    expect(stored.deployments.overnight.jira).toBe('BOARD-9')
  })

  it('offers to add one where the site matches but nothing else does', async () => {
    const user = userEvent.setup()
    await renderPopupFor('https://github.com/acme/brand-new/pull/4')
    await screen.findByText('No deployment information for this domain.')

    await user.click(screen.getByRole('button', { name: 'Add deployment' }))

    expect(
      screen.getByRole('heading', { name: 'New deployment' }),
    ).toBeInTheDocument()
    // Prefilled from the URL: the first two path segments are the project.
    expect(screen.getByLabelText(/URL fragment/)).toHaveValue('acme/brand-new')
  })

  it('saves a new deployment and shows it straight away', async () => {
    const user = userEvent.setup()
    await renderPopupFor('https://github.com/acme/brand-new/pull/4')
    await screen.findByText('No deployment information for this domain.')

    await user.click(screen.getByRole('button', { name: 'Add deployment' }))
    const name = screen.getByLabelText(/Name/)
    await user.clear(name)
    await user.type(name, 'Brand new')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Brand new')).toBeInTheDocument()

    const stored = await Config.load()
    expect(stored.deployments['brand-new']).toMatchObject({
      name: 'Brand new',
      github: 'acme/brand-new',
    })
    // The entries that were already there are untouched.
    expect(Object.keys(stored.deployments)).toContain('daytime')
  })

  it('will not save an entry that could never match', async () => {
    const user = userEvent.setup()
    await renderPopupFor('https://github.com/acme/brand-new/pull/4')
    await screen.findByText('No deployment information for this domain.')

    await user.click(screen.getByRole('button', { name: 'Add deployment' }))
    await user.clear(screen.getByLabelText(/URL fragment/))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // Still in the editor, with the reason on screen.
    expect(
      screen.getByRole('heading', { name: 'New deployment' }),
    ).toBeInTheDocument()
    expect((await Config.load()).deployments['brand-new']).toBeUndefined()
  })

  it('drops the window fields for a notes-only entry', async () => {
    const user = userEvent.setup()
    await renderPopupFor('https://github.com/acme/daytime')
    await screen.findByText('Daytime project')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText(/Opens/)).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /Notes only/ }))
    expect(screen.queryByLabelText(/Opens/)).toBeNull()
  })

  it('leaves the config alone when the editor is cancelled', async () => {
    const user = userEvent.setup()
    await renderPopupFor('https://github.com/acme/daytime')
    await screen.findByText('Daytime project')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const name = screen.getByLabelText(/Name/)
    await user.clear(name)
    await user.type(name, 'Discarded')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByText('Daytime project')).toBeInTheDocument()
    expect((await Config.load()).deployments.daytime.name).toBe(
      'Daytime project',
    )
  })

  it('reports a failed save without leaving the editor', async () => {
    const user = userEvent.setup()
    await renderPopupFor('https://github.com/acme/daytime')
    await screen.findByText('Daytime project')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    chromeMock().failStorage = true
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('Could not save. Your changes were not stored.'),
    ).toBeInTheDocument()
    chromeMock().failStorage = false
  })
})
