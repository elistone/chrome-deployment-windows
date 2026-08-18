import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (value: string) => void
  }) => (
    <textarea
      aria-label="config"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

const { default: Options } = await import('../src/ui/components/Options')
const { Config, STORAGE_KEYS } = await import('../src/app/config/Config')
const { THEME_STORAGE_KEY } = await import('../src/ui/theme')
const { chromeMock } = await import('./helpers/chromeMock')
const { testConfig } = await import('./helpers/fixtures')

/** Render with a seeded config and wait for the first paint. */
async function openDashboard(config = testConfig()) {
  const user = userEvent.setup()
  await Config.save(config)
  // Seeding is itself a write; forget it so "did this save?" assertions are
  // about what the dashboard did.
  vi.mocked(chrome.storage.sync.set).mockClear()
  render(<Options />)
  await screen.findByRole('heading', { name: 'Deployment windows config' })
  return { user, config }
}

async function enterEditMode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText('Edit mode'))
}

function cardFor(name: string): HTMLElement {
  return screen.getByRole('heading', { name }).closest('article')!
}

describe('Options dashboard', () => {
  it('shows a loading state before the config arrives', () => {
    render(<Options />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows every deployment and site on one screen', async () => {
    await openDashboard()

    expect(screen.getByRole('heading', { name: 'Daytime project' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Notes only project' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'github' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'jira' })).toBeInTheDocument()
  })

  it('summarises the config above the cards', async () => {
    await openDashboard()
    const stats = screen.getByLabelText('Overview')

    expect(within(stats).getByText('Deployments').previousSibling).toHaveTextContent('5')
    expect(within(stats).getByText('Sites').previousSibling).toHaveTextContent('2')
  })

  it('falls back to the default config when storage is empty', async () => {
    render(<Options />)
    expect(await screen.findByRole('heading', { name: 'github' })).toBeInTheDocument()
    expect(screen.getByText('*://*.github.com/*')).toBeInTheDocument()
  })

  it('still renders when storage fails outright', async () => {
    vi.mocked(chrome.storage.sync.get).mockRejectedValue(new Error('offline'))
    render(<Options />)

    expect(
      await screen.findByRole('heading', { name: 'Deployment windows config' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'github' })).toBeInTheDocument()
  })

  describe('edit mode', () => {
    it('hides the editing controls by default', async () => {
      await openDashboard()
      expect(
        screen.queryByRole('button', { name: 'Add deployment' }),
      ).not.toBeInTheDocument()
    })

    it('reveals them when switched on', async () => {
      const { user } = await openDashboard()
      await enterEditMode(user)

      expect(screen.getByRole('button', { name: 'Add deployment' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add site' })).toBeInTheDocument()
    })
  })

  describe('adding a deployment', () => {
    it('writes it to storage and shows the new card', async () => {
      const { user } = await openDashboard()
      await enterEditMode(user)

      await user.click(screen.getByRole('button', { name: 'Add deployment' }))
      await user.type(screen.getByLabelText(/^Name/), 'Checkout')
      await user.type(screen.getByLabelText('github'), 'acme/checkout')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() =>
        expect(
          screen.getByRole('heading', { name: 'Checkout' }),
        ).toBeInTheDocument(),
      )
      const stored = chromeMock().storage[STORAGE_KEYS.deployments] as Record<
        string,
        unknown
      >
      expect(stored.checkout).toEqual({
        name: 'Checkout',
        github: 'acme/checkout',
        time: {
          start: '09:00',
          end: '17:00',
          timezone: 'America/New_York',
        },
      })
    })

    it('confirms the change', async () => {
      const { user } = await openDashboard()
      await enterEditMode(user)

      await user.click(screen.getByRole('button', { name: 'Add deployment' }))
      await user.type(screen.getByLabelText(/^Name/), 'Checkout')
      await user.type(screen.getByLabelText('github'), 'acme/checkout')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByText('Added')).toBeInTheDocument()
    })

    it('does not write anything when cancelled', async () => {
      const { user } = await openDashboard()
      await enterEditMode(user)

      await user.click(screen.getByRole('button', { name: 'Add deployment' }))
      await user.type(screen.getByLabelText(/^Name/), 'Checkout')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('heading', { name: 'Checkout' })).not.toBeInTheDocument()
      expect(chrome.storage.sync.set).not.toHaveBeenCalled()
    })
  })

  describe('editing a deployment', () => {
    it('opens pre-filled and saves the change', async () => {
      const { user } = await openDashboard()
      await enterEditMode(user)

      await user.click(
        within(cardFor('Daytime project')).getByRole('button', { name: 'Edit' }),
      )
      const name = screen.getByLabelText(/^Name/)
      expect(name).toHaveValue('Daytime project')

      await user.clear(name)
      await user.type(name, 'Renamed project')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(async () => {
        const stored = await Config.load()
        expect(stored.deployments.daytime.name).toBe('Renamed project')
      })
    })

    it('offers a duplicate as a new entry rather than saving one', async () => {
      const { user } = await openDashboard()
      await enterEditMode(user)

      await user.click(
        within(cardFor('Daytime project')).getByRole('button', {
          name: 'Duplicate',
        }),
      )

      expect(screen.getByRole('dialog', { name: 'New deployment' })).toBeInTheDocument()
      expect(screen.getByLabelText(/^Key/)).toHaveValue('daytime-2')
      expect(chrome.storage.sync.set).not.toHaveBeenCalled()
    })
  })

  describe('deleting', () => {
    it('removes the entry after confirmation', async () => {
      const { user } = await openDashboard()
      await enterEditMode(user)

      const card = cardFor('Daytime project')
      await user.click(within(card).getByRole('button', { name: /^Delete/ }))
      await user.click(within(card).getByRole('button', { name: /Delete this\?/ }))

      await waitFor(() =>
        expect(
          screen.queryByRole('heading', { name: 'Daytime project' }),
        ).not.toBeInTheDocument(),
      )
      const stored = await Config.load()
      expect(stored.deployments.daytime).toBeUndefined()
    })

    it('can be undone from the confirmation', async () => {
      const { user } = await openDashboard()
      await enterEditMode(user)

      const card = cardFor('Daytime project')
      await user.click(within(card).getByRole('button', { name: /^Delete/ }))
      await user.click(within(card).getByRole('button', { name: /Delete this\?/ }))

      await user.click(await screen.findByRole('button', { name: 'Undo' }))

      await waitFor(() =>
        expect(
          screen.getByRole('heading', { name: 'Daytime project' }),
        ).toBeInTheDocument(),
      )
      const stored = await Config.load()
      expect(stored.deployments.daytime.name).toBe('Daytime project')
    })

    it('removes a site and the fragments pointing at it', async () => {
      const { user } = await openDashboard()
      await enterEditMode(user)

      const card = cardFor('jira')
      await user.click(within(card).getByRole('button', { name: /^Delete/ }))
      await user.click(within(card).getByRole('button', { name: /Delete this\?/ }))

      await waitFor(async () => {
        const stored = await Config.load()
        expect(stored.domains.jira).toBeUndefined()
        expect('jira' in stored.deployments.overnight).toBe(false)
      })
    })
  })

  describe('failures', () => {
    it('says so rather than pretending the change was saved', async () => {
      const { user } = await openDashboard()
      await enterEditMode(user)
      chromeMock().failStorage = true

      await user.click(screen.getByRole('button', { name: 'Add deployment' }))
      await user.type(screen.getByLabelText(/^Name/), 'Checkout')
      await user.type(screen.getByLabelText('github'), 'acme/checkout')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByText(/Could not save/)).toBeInTheDocument()
    })
  })

  describe('filtering', () => {
    it('narrows the cards to what matches', async () => {
      const { user } = await openDashboard()

      await user.type(screen.getByLabelText('Filter'), 'overnight')

      expect(screen.getByRole('heading', { name: 'Overnight project' })).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: 'Daytime project' }),
      ).not.toBeInTheDocument()
    })

    it('matches on the url fragment, not only the name', async () => {
      const { user } = await openDashboard()

      await user.type(screen.getByLabelText('Filter'), 'acme/notes-only')

      expect(screen.getByRole('heading', { name: 'Notes only project' })).toBeInTheDocument()
    })

    it('says when nothing matches', async () => {
      const { user } = await openDashboard()

      await user.type(screen.getByLabelText('Filter'), 'zzzz')

      expect(screen.getAllByText('Nothing matches that filter.')).toHaveLength(2)
    })
  })

  describe('empty sections', () => {
    // A wholly empty config is never loaded - Config.load substitutes the
    // defaults - so each empty state is reached with the other half present.
    const noDeployments = () => ({ ...testConfig(), deployments: {} })
    const noSites = () => ({ ...testConfig(), domains: {}, sites: {} })

    it('invites the first deployment', async () => {
      await openDashboard(noDeployments())
      expect(screen.getByText('No deployments yet')).toBeInTheDocument()
    })

    it('explains what a site is for', async () => {
      await openDashboard(noSites())
      expect(screen.getByText('No sites yet')).toBeInTheDocument()
    })

    it('turns edit mode on from the empty state', async () => {
      const { user } = await openDashboard(noDeployments())

      await user.click(screen.getByRole('button', { name: 'Add deployment' }))

      expect(screen.getByRole('dialog', { name: 'New deployment' })).toBeInTheDocument()
      expect(screen.getByLabelText('Edit mode')).toBeChecked()
    })
  })

  describe('theme', () => {
    it('offers light, dark and system', async () => {
      await openDashboard()
      const group = screen.getByRole('group', { name: 'Theme' })

      expect(within(group).getByRole('button', { name: 'Light' })).toBeInTheDocument()
      expect(within(group).getByRole('button', { name: 'Dark' })).toBeInTheDocument()
      expect(within(group).getByRole('button', { name: 'System' })).toBeInTheDocument()
    })

    it('applies and remembers a choice', async () => {
      const { user } = await openDashboard()

      await user.click(screen.getByRole('button', { name: 'Dark' }))

      expect(document.documentElement.dataset.theme).toBe('dark')
      await waitFor(() =>
        expect(chromeMock().storage[THEME_STORAGE_KEY]).toBe('dark'),
      )
      delete document.documentElement.dataset.theme
    })
  })

  describe('how to use', () => {
    it('is a link in the header rather than a tab', async () => {
      const { user } = await openDashboard()

      await user.click(screen.getByRole('button', { name: 'How to use' }))

      const dialog = screen.getByRole('dialog', { name: 'How to use' })
      expect(
        within(dialog).getByRole('heading', { name: 'Using the extension' }),
      ).toBeInTheDocument()
    })

    it('closes again', async () => {
      const { user } = await openDashboard()

      await user.click(screen.getByRole('button', { name: 'How to use' }))
      // The header icon and the footer button both close it.
      await user.click(screen.getAllByRole('button', { name: 'Close' })[0])

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('json panel', () => {
    it('sits at the bottom, collapsed', async () => {
      await openDashboard()
      expect(screen.getByRole('button', { name: /JSON config/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
    })

    it('saves an edited config and updates the cards', async () => {
      const { user } = await openDashboard()
      await user.click(screen.getByRole('button', { name: /JSON config/ }))

      const next = testConfig()
      next.deployments.daytime.name = 'Renamed via json'
      const editor = screen.getByLabelText('config')
      await user.clear(editor)
      await user.paste(JSON.stringify(next))
      await user.click(
        within(screen.getByRole('button', { name: /JSON config/ }).parentElement!)
          .getByRole('button', { name: 'Save' }),
      )

      await waitFor(() =>
        expect(
          screen.getByRole('heading', { name: 'Renamed via json' }),
        ).toBeInTheDocument(),
      )
    })
  })
})
