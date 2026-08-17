import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Tabs from '../src/ui/components/Tabs'
import SiteInformation from '../src/ui/components/SiteInformation'
import DeploymentWindows from '../src/ui/components/DeploymentWindows'
import HowToUse from '../src/ui/components/HowToUse'
import { testConfig } from './helpers/fixtures'

describe('Tabs', () => {
  const renderTabs = () =>
    render(
      <Tabs>
        {'First'}
        <p>First panel</p>
        {'Second'}
        <p>Second panel</p>
      </Tabs>,
    )

  it('shows the first panel by default', () => {
    renderTabs()
    expect(screen.getByText('First panel')).toBeInTheDocument()
    expect(screen.queryByText('Second panel')).not.toBeInTheDocument()
  })

  it('marks the active tab', () => {
    renderTabs()
    expect(screen.getByRole('button', { name: 'First' })).toHaveClass('active')
    expect(screen.getByRole('button', { name: 'Second' })).not.toHaveClass('active')
  })

  it('switches panel on click', async () => {
    const user = userEvent.setup()
    renderTabs()

    await user.click(screen.getByRole('button', { name: 'Second' }))

    expect(screen.getByText('Second panel')).toBeInTheDocument()
    expect(screen.queryByText('First panel')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Second' })).toHaveClass('active')
  })

  it('switches back again', async () => {
    const user = userEvent.setup()
    renderTabs()

    await user.click(screen.getByRole('button', { name: 'Second' }))
    await user.click(screen.getByRole('button', { name: 'First' }))

    expect(screen.getByText('First panel')).toBeInTheDocument()
  })

  it('renders one label per pair of children', () => {
    renderTabs()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})

describe('SiteInformation', () => {
  const config = testConfig()

  const renderSites = (overrides = {}) =>
    render(
      <SiteInformation
        domains={config.domains}
        details={config.sites}
        {...overrides}
      />,
    )

  it('lists every configured domain', () => {
    renderSites()
    expect(screen.getByRole('heading', { name: 'github' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'jira' })).toBeInTheDocument()
  })

  it('lists the url patterns for a domain', () => {
    renderSites()
    expect(screen.getByText('*://*.github.com/*')).toBeInTheDocument()
    expect(screen.getByText('*://*.atlassian.net/*')).toBeInTheDocument()
  })

  it('lists the insert locations with their positions', () => {
    const { container } = renderSites()
    const elements = container.querySelector('.site-options-list-elements')

    expect(elements?.textContent).toContain('file-navigation')
    expect(elements?.textContent).toContain('after')
    expect(elements?.textContent).toContain('repository-content')
    expect(elements?.textContent).toContain('before')
  })

  it('shows the deploy and no-deploy classes', () => {
    renderSites()
    expect(screen.getByText('flash flash-success')).toBeInTheDocument()
    expect(screen.getByText('flash flash-error')).toBeInTheDocument()
  })

  it('reports when nothing is configured', () => {
    renderSites({ domains: {}, details: {} })
    expect(screen.getByText('No site information has been set.')).toBeInTheDocument()
  })

  it('does not crash on a domain with no matching site entry', () => {
    renderSites({
      domains: { orphan: ['https://orphan.dev/*'] },
      details: {},
    })
    expect(screen.getByRole('heading', { name: 'orphan' })).toBeInTheDocument()
  })
})

describe('DeploymentWindows', () => {
  const config = testConfig()

  const renderWindows = (overrides = {}) =>
    render(
      <DeploymentWindows
        domains={config.domains}
        deployments={config.deployments}
        {...overrides}
      />,
    )

  it('renders a row per deployment', () => {
    const { container } = renderWindows()
    const rows = container.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(Object.keys(config.deployments).length)
  })

  it('shows the configured window and timezone', () => {
    renderWindows()
    expect(
      screen.getByText('09:00 - 17:00 (Europe/London)'),
    ).toBeInTheDocument()
  })

  it('adds a column per configured domain', () => {
    renderWindows()
    expect(screen.getByRole('columnheader', { name: 'github (url key)' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'jira (url key)' })).toBeInTheDocument()
  })

  it('shows a dash where a deployment has no fragment for a domain', () => {
    const { container } = renderWindows()
    const row = within(container).getByText('Daytime project').closest('tr')!
    // Daytime is configured for github but not jira.
    expect(within(row).getByText('acme/daytime')).toBeInTheDocument()
    expect(within(row).getByText('-')).toBeInTheDocument()
  })

  it('renders the boolean flags', () => {
    const { container } = renderWindows()
    const row = within(container).getByText('Notes only project').closest('tr')!
    expect(within(row).getAllByText('True')).toHaveLength(1)
  })

  it('falls back to placeholders for missing values', () => {
    renderWindows({
      deployments: { bare: {} },
    })
    expect(screen.getByText('No name set')).toBeInTheDocument()
    expect(screen.getByText('No notes set')).toBeInTheDocument()
    expect(
      screen.getByText('Start not set - End not set (Timezone not set)'),
    ).toBeInTheDocument()
  })

  it('reports when nothing is configured', () => {
    renderWindows({ deployments: {} })
    expect(
      screen.getByText('No deployment information has been set.'),
    ).toBeInTheDocument()
  })

  it('renders notes as markdown', () => {
    const { container } = renderWindows()
    const row = within(container).getByText('Daytime project').closest('tr')!
    expect(within(row).getByText('two').tagName).toBe('STRONG')
  })

  it('does not render markup supplied in a deployment name', () => {
    const { container } = renderWindows({
      deployments: { evil: { name: '<img src=x onerror=alert(1)>' } },
    })
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('HowToUse', () => {
  it('renders the bundled document', () => {
    const { container } = render(<HowToUse />)
    expect(
      screen.getByRole('heading', { name: 'Using the extension' }),
    ).toBeInTheDocument()
    expect(container.querySelector('table')).not.toBeNull()
  })

  it('keeps json examples readable rather than entity encoded', () => {
    const { container } = render(<HowToUse />)
    const code = container.querySelector('pre code')?.textContent ?? ''
    expect(code).toContain('"domains"')
    expect(code).not.toContain('&#34;')
  })
})

describe('component smoke', () => {
  it('renders without console errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const config = testConfig()

    render(
      <>
        <SiteInformation domains={config.domains} details={config.sites} />
        <DeploymentWindows
          domains={config.domains}
          deployments={config.deployments}
        />
      </>,
    )

    expect(spy).not.toHaveBeenCalled()
  })
})
