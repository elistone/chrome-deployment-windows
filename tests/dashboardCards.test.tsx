import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import DeploymentCard, {
  statusFor,
} from '../src/ui/components/dashboard/DeploymentCard'
import SiteCard from '../src/ui/components/dashboard/SiteCard'
import HowToUse from '../src/ui/components/HowToUse'
import { GLYPHS } from '../src/app/glyphs'
import { testConfig } from './helpers/fixtures'

const DOMAINS = ['github', 'jira']

/** Midday in New York, which the tests are pinned to. */
function atMidday() {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-06-03T12:00:00'))
}

afterEach(() => {
  vi.useRealTimers()
})

function renderDeployment(key: string, editing = false) {
  const config = testConfig()
  const handlers = {
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
  }
  const view = render(
    <DeploymentCard
      configKey={key}
      deployment={config.deployments[key]}
      domainKeys={DOMAINS}
      editing={editing}
      {...handlers}
    />,
  )
  return { ...view, ...handlers }
}

describe('statusFor', () => {
  it('reports open inside the window', () => {
    // 09:00-17:00 Europe/London is 04:00-12:00 in New York.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-03T10:00:00'))
    expect(statusFor(testConfig().deployments.daytime)).toBe('open')
  })

  it('reports closed outside it', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-03T18:00:00'))
    expect(statusFor(testConfig().deployments.daytime)).toBe('closed')
  })

  it('reports notes for a notes-only entry, whatever the time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-03T18:00:00'))
    expect(statusFor(testConfig().deployments.notesOnly)).toBe('notes')
  })

  it('flags an entry with no window rather than calling it closed', () => {
    // Without times it resolves to 00:00-00:00, so a plain red "closed" would
    // be technically true and completely unhelpful.
    expect(statusFor(testConfig().deployments.untimed)).toBe('unset')
  })
})

describe('DeploymentCard', () => {
  it('shows the name, key and configured window', () => {
    atMidday()
    renderDeployment('daytime')

    expect(screen.getByRole('heading', { name: 'Daytime project' })).toBeInTheDocument()
    expect(screen.getByText('daytime')).toBeInTheDocument()
    // The viewer's own window leads, without naming their zone. Tests run in
    // America/New_York against a London window.
    expect(screen.getByText('04:00 – 12:00')).toBeInTheDocument()
    expect(screen.queryByText('America/New_York')).toBeNull()
  })

  it('shows what the config actually says, as provenance', () => {
    atMidday()
    renderDeployment('daytime')

    expect(screen.getByText(/Set in Europe\/London/)).toBeInTheDocument()
    expect(screen.getByText('09:00 – 17:00')).toBeInTheDocument()
  })

  it('shows the window once when it is already in the viewer timezone', () => {
    atMidday()
    const config = testConfig()
    config.deployments.daytime.time = {
      start: '09:00',
      end: '17:00',
      timezone: 'America/New_York',
    }
    render(
      <DeploymentCard
        configKey="daytime"
        deployment={config.deployments.daytime}
        domainKeys={DOMAINS}
        editing={false}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText('09:00 – 17:00')).toBeInTheDocument()
    expect(screen.queryByText('Your timezone')).toBeNull()
  })

  it('shows the live status', () => {
    atMidday()
    renderDeployment('daytime')
    expect(screen.getByText('Deployment window open')).toBeInTheDocument()
  })

  it('marks the status with the toolbar icon for that state', () => {
    // The chevron in the toolbar and the chevron in the pill are the same
    // chevron, which is what makes the toolbar readable without a legend.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-03T10:00:00'))
    const open = renderDeployment('daytime')
    expect(
      open.container.querySelector('.dw-pill-mark path')?.getAttribute('d'),
    ).toBe(GLYPHS.open.d)
    open.unmount()

    vi.setSystemTime(new Date('2024-06-03T20:00:00'))
    const closed = renderDeployment('daytime')
    expect(
      closed.container.querySelector('.dw-pill-mark path')?.getAttribute('d'),
    ).toBe(GLYPHS.closed.d)
    closed.unmount()

    // Notes-only is not a state of a window, so it gets the neutral mark.
    const notes = renderDeployment('notesOnly')
    expect(
      notes.container.querySelector('.dw-pill-mark path')?.getAttribute('d'),
    ).toBe(GLYPHS.neutral.d)
  })

  it('says how much longer the window has', () => {
    // 10:00 in New York, two hours before the 04:00-12:00 local window shuts.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-03T10:00:00'))
    const { container } = renderDeployment('daytime')

    expect(container.querySelector('.dw-countdown')?.textContent).toBe(
      'Closes in 2h',
    )
  })

  it('counts up to the next opening once the window has shut', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-03T13:30:00'))
    const { container } = renderDeployment('daytime')

    expect(container.querySelector('.dw-countdown')?.textContent).toBe(
      'Opens in 14h 30m',
    )
  })

  it('keeps the status and the countdown true while it sits open', () => {
    // The options page can be left open all afternoon. Both readings are
    // worked out from the clock, so the card has to keep redrawing.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-03T11:59:00'))
    const { container } = renderDeployment('daytime')

    expect(screen.getByText('Deployment window open')).toBeInTheDocument()
    expect(container.querySelector('.dw-countdown')?.textContent).toBe(
      'Closes in 1m',
    )

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000)
    })

    expect(screen.getByText('Deployment window closed')).toBeInTheDocument()
    expect(container.querySelector('.dw-countdown')?.textContent).toBe(
      'Opens in 15h 59m',
    )
  })

  it('has nothing to count down without a window', () => {
    atMidday()
    const notes = renderDeployment('notesOnly')
    expect(notes.container.querySelector('.dw-countdown')).toBeNull()
    notes.unmount()

    const untimed = renderDeployment('untimed')
    expect(untimed.container.querySelector('.dw-countdown')).toBeNull()
  })

  it('lists a fragment per site, marking the ones not set', () => {
    atMidday()
    const { container } = renderDeployment('daytime')
    const chips = container.querySelectorAll('.dw-chip')

    expect(chips[0].textContent).toContain('acme/daytime')
    expect(chips[1].textContent).toContain('not set')
  })

  it('puts the configured sites before the gaps', () => {
    // Config order put the gaps first as often as not, which pushed the
    // fragments that actually matter to the end of the row.
    atMidday()
    const config = testConfig()
    const { container } = render(
      <DeploymentCard
        configKey="daytime"
        deployment={config.deployments.daytime}
        // github is configured, the other two are not.
        domainKeys={['unset-a', 'github', 'unset-b']}
        editing={false}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const chips = [...container.querySelectorAll('.dw-chip')]
    expect(chips[0].textContent).toContain('acme/daytime')
    expect(chips.slice(1).every((chip) => chip.textContent?.includes('not set'))).toBe(
      true,
    )
  })

  // No fake clock: the notes do not depend on one, and waitFor cannot poll
  // against timers that never advance.
  it('renders notes as markdown', async () => {
    const { container } = renderDeployment('daytime')
    // The renderer is fetched on demand, so the notes arrive a tick later.
    await waitFor(() =>
      expect(container.querySelector('.dw-card-notes strong')?.textContent).toBe(
        'two',
      ),
    )
  })

  it('explains why an entry with no window always reads as closed', () => {
    renderDeployment('untimed')
    expect(screen.getByText(/always reads as closed/)).toBeInTheDocument()
  })

  it('marks a case sensitive entry', () => {
    renderDeployment('cased')
    expect(screen.getByText('Case sensitive')).toBeInTheDocument()
  })

  it('does not render markup supplied in a name', () => {
    const config = testConfig()
    const { container } = render(
      <DeploymentCard
        configKey="evil"
        deployment={{ name: '<img src=x onerror=alert(1)>', github: 'acme/x' }}
        domainKeys={DOMAINS}
        editing={false}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(config.deployments.daytime).toBeDefined()
  })

  describe('edit mode', () => {
    it('hides the actions while not editing', () => {
      atMidday()
      renderDeployment('daytime')
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    })

    it('shows edit, duplicate and delete while editing', () => {
      atMidday()
      renderDeployment('daytime', true)
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /Delete Daytime project/ }),
      ).toBeInTheDocument()
    })

    it('calls back on edit and duplicate', async () => {
      const user = userEvent.setup()
      const { onEdit, onDuplicate } = renderDeployment('daytime', true)

      await user.click(screen.getByRole('button', { name: 'Edit' }))
      await user.click(screen.getByRole('button', { name: 'Duplicate' }))

      expect(onEdit).toHaveBeenCalledOnce()
      expect(onDuplicate).toHaveBeenCalledOnce()
    })

    it('needs two clicks to delete', async () => {
      const user = userEvent.setup()
      const { onDelete } = renderDeployment('daytime', true)

      await user.click(screen.getByRole('button', { name: /^Delete/ }))
      expect(onDelete).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: /Delete this\?/ }))
      expect(onDelete).toHaveBeenCalledOnce()
    })

    it('can be backed out of', async () => {
      const user = userEvent.setup()
      const { onDelete } = renderDeployment('daytime', true)

      await user.click(screen.getByRole('button', { name: /^Delete/ }))
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onDelete).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: /^Delete/ })).toBeInTheDocument()
    })

    it('disarms itself so a stray click cannot be completed later', async () => {
      // shouldAdvanceTime keeps userEvent's own internal waits working while
      // still letting the disarm timer be jumped forward.
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderDeployment('daytime', true)

      await user.click(screen.getByRole('button', { name: /^Delete/ }))
      expect(screen.getByText('Delete this?')).toBeInTheDocument()

      await act(() => vi.advanceTimersByTimeAsync(5000))

      expect(screen.queryByText('Delete this?')).not.toBeInTheDocument()
    })
  })
})

describe('SiteCard', () => {
  const config = testConfig()

  const renderSite = (key: string, editing = false, overrides = {}) =>
    render(
      <SiteCard
        configKey={key}
        patterns={config.domains[key]}
        site={config.sites[key]}
        usedBy={2}
        editing={editing}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        {...overrides}
      />,
    )

  it('shows the key and how many deployments use it', () => {
    renderSite('github')
    expect(screen.getByRole('heading', { name: 'github' })).toBeInTheDocument()
    expect(screen.getByText(/2 deployments/)).toBeInTheDocument()
  })

  it('names the host its patterns cover', () => {
    renderSite('github')
    expect(screen.getByText('github.com')).toBeInTheDocument()
  })

  it('shows a quote in a value as a quote, not as an entity', () => {
    renderSite('github', false, {
      patterns: ["*://*.github.com/it's/*"],
    })

    expect(screen.getByText("*://*.github.com/it's/*")).toBeInTheDocument()
  })

  it('shows the spacing overrides when a site has them', () => {
    renderSite('github', false, {
      site: { ...config.sites.github, style: { margin: '2rem 0' } },
    })

    expect(screen.getByText('Margin')).toBeInTheDocument()
    expect(screen.getByText('2rem 0')).toBeInTheDocument()
  })

  it('leaves the spacing section out when a site takes the defaults', () => {
    renderSite('github')
    expect(screen.queryByText('Spacing')).not.toBeInTheDocument()
  })

  it('reads a bare insert location back as the class it is', () => {
    renderSite('github')
    expect(screen.getByText('.file-navigation')).toBeInTheDocument()
  })

  it('leaves a selector insert location exactly as written', () => {
    renderSite('github', false, {
      site: {
        ...config.sites.github,
        insert: [
          { class: '#repository-container-header', position: 'after' as const },
          { class: '[data-testid="main"]', position: 'before' as const },
        ],
      },
    })

    expect(
      screen.getByText('#repository-container-header'),
    ).toBeInTheDocument()
    expect(screen.getByText('[data-testid="main"]')).toBeInTheDocument()
  })

  it('says so when the patterns name no particular host', () => {
    renderSite('github', false, { patterns: ['*://*/*'] })
    expect(screen.getByText('any host')).toBeInTheDocument()
  })

  it('carries the brand hue for a recognisable host', () => {
    const { container } = renderSite('github')
    expect(container.querySelector('article')).toHaveStyle({
      '--dw-site-hue': '220',
    })
  })

  it('gives two different sites different hues', () => {
    const first = renderSite('github').container.querySelector('article')
    const second = renderSite('jira').container.querySelector('article')

    expect(first?.getAttribute('style')).not.toBe(
      second?.getAttribute('style'),
    )
  })

  describe('favicon', () => {
    it('uses the icon Chrome already has cached', () => {
      const { container } = renderSite('github')
      const icon = container.querySelector('img.dw-site-avatar')

      expect(icon).toHaveAttribute(
        'src',
        expect.stringContaining('/_favicon/'),
      )
      // Decorative: the site name is right beside it.
      expect(icon).toHaveAttribute('alt', '')
    })

    it('falls back to initials when the icon will not load', () => {
      const { container } = renderSite('github')
      fireEvent.error(container.querySelector('img.dw-site-avatar')!)

      expect(container.querySelector('img.dw-site-avatar')).toBeNull()
      expect(container.querySelector('.dw-site-avatar')?.textContent).toBe('G')
    })

    it('falls back to initials outside an extension page', () => {
      const original = globalThis.chrome
      // @ts-expect-error - the harness and a torn down page both look like this
      delete globalThis.chrome
      try {
        const { container } = renderSite('github')
        expect(container.querySelector('img')).toBeNull()
      } finally {
        globalThis.chrome = original
      }
    })
  })

  it('uses the singular for one deployment', () => {
    renderSite('github', false, { usedBy: 1 })
    expect(screen.getByText(/1 deployment$/)).toBeInTheDocument()
  })

  it('lists the url patterns', () => {
    renderSite('github')
    expect(screen.getByText('*://*.github.com/*')).toBeInTheDocument()
  })

  it('lists the insert locations with their positions', () => {
    const { container } = renderSite('github')
    const list = container.querySelectorAll('.dw-card-section')[1]

    expect(within(list as HTMLElement).getByText('After')).toBeInTheDocument()
    expect(within(list as HTMLElement).getByText('.file-navigation')).toBeInTheDocument()
    expect(within(list as HTMLElement).getByText('Before')).toBeInTheDocument()
  })

  it('pairs every label with its value, so the columns line up', () => {
    const { container } = renderSite('github', false, {
      site: { ...config.sites.github, style: { padding: '10px' } },
    })
    const rows = container.querySelectorAll('.dw-defs .dw-def')

    // Two insert locations plus the one spacing override.
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.querySelector('dt')).not.toBeNull()
      expect(row.querySelector('dd')).not.toBeNull()
    }
  })

  it('lists the spacing overrides under readable labels', () => {
    renderSite('github', false, {
      site: {
        ...config.sites.github,
        style: { margin: '1rem 0', padding: '10px', maxWidth: '640px' },
      },
    })

    expect(screen.getByText('Margin')).toBeInTheDocument()
    expect(screen.getByText('1rem 0')).toBeInTheDocument()
    expect(screen.getByText('Max width')).toBeInTheDocument()
    expect(screen.getByText('640px')).toBeInTheDocument()
  })

  it('omits a spacing value that is not set', () => {
    renderSite('github', false, {
      site: { ...config.sites.github, style: { margin: '1rem 0' } },
    })
    expect(screen.queryByText('Max width')).not.toBeInTheDocument()
  })

  it('does not crash on a domain with no matching site entry', () => {
    renderSite('github', false, { site: undefined })
    expect(screen.getByText('No site information has been set.')).toBeInTheDocument()
  })

  it('exposes edit and delete only while editing', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    renderSite('github', true, { onEdit })

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledOnce()
  })
})

describe('HowToUse', () => {
  it('renders the bundled document', async () => {
    const { container } = render(<HowToUse />)
    expect(
      await screen.findByRole('heading', { name: 'Using the extension' }),
    ).toBeInTheDocument()
    expect(container.querySelector('table')).not.toBeNull()
  })

  it('keeps json examples readable rather than entity encoded', async () => {
    const { container } = render(<HowToUse />)
    await screen.findByRole('heading', { name: 'Using the extension' })
    const code = container.querySelector('pre code')?.textContent ?? ''
    expect(code).toContain('"domains"')
    expect(code).not.toContain('&#34;')
  })

  it('leads with the UI workflow rather than the json', async () => {
    render(<HowToUse />)
    expect(
      await screen.findByRole('heading', { name: 'Quick start' }),
    ).toBeInTheDocument()
  })
})

describe('a frozen card', () => {
  function frozenConfig(reason?: string) {
    const config = testConfig()
    config.deployments.daytime.time = {
      start: '09:00',
      end: '17:00',
      timezone: 'America/New_York',
    }
    ;(config.deployments.daytime as Record<string, unknown>).freezes = [
      { from: '2026-12-20', to: '2027-01-02', ...(reason ? { reason } : {}) },
    ]
    return config
  }

  function renderFrozen(reason?: string) {
    const config = frozenConfig(reason)
    return render(
      <DeploymentCard
        configKey="daytime"
        deployment={config.deployments.daytime}
        domainKeys={DOMAINS}
        editing={false}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
  }

  it('says frozen rather than closed', () => {
    // The same word the notice and the popup use; a card saying "closed" for
    // the same state would read as a different one.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-23T12:00:00'))
    renderFrozen()

    expect(screen.getByText('Deployment frozen')).toBeInTheDocument()
    expect(screen.queryByText('Deployment window closed')).toBeNull()
    vi.useRealTimers()
  })

  it('says when it lifts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-23T12:00:00'))
    const { container } = renderFrozen()

    expect(container.querySelector('.dw-countdown')?.textContent).toContain(
      'Frozen until',
    )
    vi.useRealTimers()
  })

  it('gives the reason its own line, and only the reason', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-23T12:00:00'))
    const { container } = renderFrozen('Christmas change freeze')

    const banner = container.querySelector('.dw-frozen')
    expect(banner?.textContent).toBe('Christmas change freeze')
    // The pill says what and the countdown says until when; repeating either
    // here would be the card saying one thing three times.
    expect(banner?.textContent).not.toContain('Frozen until')
    vi.useRealTimers()
  })

  it('shows no banner when no reason was given', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-23T12:00:00'))
    const { container } = renderFrozen()

    expect(container.querySelector('.dw-frozen')).toBeNull()
    vi.useRealTimers()
  })

  it('goes back to normal once the freeze has lifted', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-01-03T12:00:00'))
    renderFrozen('Christmas change freeze')

    expect(screen.getByText('Deployment window open')).toBeInTheDocument()
    vi.useRealTimers()
  })
})
