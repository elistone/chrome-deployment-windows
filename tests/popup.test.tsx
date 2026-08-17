import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import Popup from '../src/ui/components/Popup'
import { Config } from '../src/app/config/Config'
import { seedTabs } from './helpers/chromeMock'
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

    await renderPopupFor('https://github.com/acme/daytime')

    expect(await screen.findByText('Daytime project')).toBeInTheDocument()
    expect(screen.getByText('Deployment window')).toBeInTheDocument()
    // Tests run in America/New_York, so the configured London window is shown
    // alongside its converted local equivalent.
    expect(screen.getByText('09:00 - 17:00')).toBeInTheDocument()
    expect(screen.getByText('(Europe/London)')).toBeInTheDocument()
    expect(screen.getByText('04:00 - 12:00')).toBeInTheDocument()
    expect(screen.getByText('(America/New_York)')).toBeInTheDocument()
    expect(screen.getByText('Deployment window open')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('marks the popup as closed outside the window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2024-06-03T22:00:00'))

    const { container } = await renderPopupFor('https://github.com/acme/daytime')

    expect(await screen.findByText('Deployment window closed')).toBeInTheDocument()
    expect(container.querySelector('.popup-deployment-info')).toHaveClass(
      'can-not-deploy',
    )

    vi.useRealTimers()
  })

  it('renders notes as markdown', async () => {
    const { container } = await renderPopupFor('https://github.com/acme/daytime')

    await screen.findByText('Daytime project')
    expect(container.querySelector('.notes-section strong')?.textContent).toBe(
      'two',
    )
  })

  it('hides the window table for a notes-only deployment', async () => {
    const { container } = await renderPopupFor('https://github.com/acme/notes-only')

    expect(await screen.findByText('Notes only project')).toBeInTheDocument()
    expect(container.querySelector('table')).toBeNull()
    expect(screen.getByText('Frozen until Q3.')).toBeInTheDocument()
  })

  it('reports when the tab has no deployment information', async () => {
    await renderPopupFor('https://github.com/acme/unknown')

    expect(
      await screen.findByText('No deployment information for this domain.'),
    ).toBeInTheDocument()
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

    // The tag is removed outright, leaving only its surrounding text.
    expect(await screen.findByText('Proj live')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })
})
