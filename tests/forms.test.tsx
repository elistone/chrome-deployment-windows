import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import DeploymentForm from '../src/ui/components/dashboard/DeploymentForm'
import SiteForm from '../src/ui/components/dashboard/SiteForm'
import {
  emptyDeploymentDraft,
  emptySiteDraft,
  toDeploymentDraft,
  toSiteDraft,
} from '../src/ui/components/dashboard/drafts'
import { testConfig } from './helpers/fixtures'

const DOMAINS = ['github', 'jira']

function renderDeploymentForm(
  overrides: Partial<Parameters<typeof DeploymentForm>[0]> = {},
) {
  const props = {
    originalKey: null as string | null,
    initial: emptyDeploymentDraft(DOMAINS),
    domainKeys: DOMAINS,
    takenKeys: [] as string[],
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<DeploymentForm {...props} />)
  return props
}

function renderSiteForm(
  overrides: Partial<Parameters<typeof SiteForm>[0]> = {},
) {
  const props = {
    originalKey: null as string | null,
    initial: emptySiteDraft(),
    takenKeys: [] as string[],
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<SiteForm {...props} />)
  return props
}

describe('DeploymentForm', () => {
  it('opens as a dialog titled for creating', () => {
    renderDeploymentForm()
    expect(
      screen.getByRole('dialog', { name: 'New deployment' }),
    ).toBeInTheDocument()
  })

  it('is titled for editing when given an existing key', () => {
    const config = testConfig()
    renderDeploymentForm({
      originalKey: 'daytime',
      initial: toDeploymentDraft('daytime', config.deployments.daytime, DOMAINS),
    })
    expect(
      screen.getByRole('dialog', { name: 'Edit deployment' }),
    ).toBeInTheDocument()
  })

  it('fills the existing values in when editing', () => {
    const config = testConfig()
    renderDeploymentForm({
      originalKey: 'daytime',
      initial: toDeploymentDraft('daytime', config.deployments.daytime, DOMAINS),
    })

    expect(screen.getByLabelText(/^Name/)).toHaveValue('Daytime project')
    expect(screen.getByLabelText('github')).toHaveValue('acme/daytime')
    expect(screen.getByLabelText(/^Opens/)).toHaveValue('09:00')
  })

  it('derives the key from the name while creating', async () => {
    const user = userEvent.setup()
    renderDeploymentForm()

    await user.type(screen.getByLabelText(/^Name/), 'Checkout API')

    expect(screen.getByLabelText(/^Key/)).toHaveValue('checkout-api')
  })

  it('stops following the name once the key is edited by hand', async () => {
    const user = userEvent.setup()
    renderDeploymentForm()

    await user.type(screen.getByLabelText(/^Key/), 'chosen')
    await user.type(screen.getByLabelText(/^Name/), 'Something Else')

    expect(screen.getByLabelText(/^Key/)).toHaveValue('chosen')
  })

  it('never rewrites the key of an existing entry', async () => {
    const user = userEvent.setup()
    const config = testConfig()
    renderDeploymentForm({
      originalKey: 'daytime',
      initial: toDeploymentDraft('daytime', config.deployments.daytime, DOMAINS),
    })

    await user.clear(screen.getByLabelText(/^Name/))
    await user.type(screen.getByLabelText(/^Name/), 'Renamed')

    expect(screen.getByLabelText(/^Key/)).toHaveValue('daytime')
  })

  describe('validation', () => {
    it('says nothing until the first save attempt', () => {
      renderDeploymentForm()
      expect(screen.queryByText('Required')).not.toBeInTheDocument()
    })

    it('blocks an empty save and points at what is missing', async () => {
      const user = userEvent.setup()
      const { onSubmit } = renderDeploymentForm()

      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(onSubmit).not.toHaveBeenCalled()
      expect(screen.getAllByText('Required').length).toBeGreaterThan(0)
      expect(screen.getByText(/at least one site/)).toBeInTheDocument()
    })

    it('updates live once it has spoken', async () => {
      const user = userEvent.setup()
      renderDeploymentForm()

      await user.click(screen.getByRole('button', { name: 'Save' }))
      await user.type(screen.getByLabelText(/^Name/), 'Checkout')

      expect(screen.queryByText('Required')).not.toBeInTheDocument()
    })

    it('rejects a key that is already taken', async () => {
      const user = userEvent.setup()
      const { onSubmit } = renderDeploymentForm({ takenKeys: ['checkout'] })

      await user.type(screen.getByLabelText(/^Name/), 'Checkout')
      await user.type(screen.getByLabelText('github'), 'acme/checkout')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(screen.getByText('That key is already in use.')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('rejects an unknown timezone', async () => {
      const user = userEvent.setup()
      const { onSubmit } = renderDeploymentForm()

      await user.type(screen.getByLabelText(/^Name/), 'Checkout')
      await user.type(screen.getByLabelText('github'), 'acme/checkout')
      await user.clear(screen.getByLabelText(/^Timezone/))
      await user.type(screen.getByLabelText(/^Timezone/), 'Not/AZone')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(screen.getByText('Unknown timezone.')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  it('saves a complete entry in the stored shape', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderDeploymentForm()

    await user.type(screen.getByLabelText(/^Name/), 'Checkout')
    await user.type(screen.getByLabelText('github'), 'acme/checkout')
    await user.clear(screen.getByLabelText(/^Timezone/))
    await user.type(screen.getByLabelText(/^Timezone/), 'Europe/London')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith('checkout', {
      name: 'Checkout',
      github: 'acme/checkout',
      time: { start: '09:00', end: '17:00', timezone: 'Europe/London' },
    })
  })

  it('fills the timezone with the local one on request', async () => {
    const user = userEvent.setup()
    renderDeploymentForm()

    await user.clear(screen.getByLabelText(/^Timezone/))
    await user.click(screen.getByRole('button', { name: 'Use mine' }))

    expect(screen.getByLabelText(/^Timezone/)).toHaveValue('America/New_York')
  })

  describe('notes only', () => {
    it('hides the window fields entirely', async () => {
      const user = userEvent.setup()
      renderDeploymentForm()
      expect(screen.getByLabelText(/^Opens/)).toBeInTheDocument()

      await user.click(screen.getByLabelText('Notes only'))

      expect(screen.queryByLabelText(/^Opens/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/^Timezone/)).not.toBeInTheDocument()
    })

    it('needs notes before it will save', async () => {
      const user = userEvent.setup()
      const { onSubmit } = renderDeploymentForm()

      await user.click(screen.getByLabelText('Notes only'))
      await user.type(screen.getByLabelText(/^Name/), 'Frozen')
      await user.type(screen.getByLabelText('github'), 'acme/frozen')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(screen.getByText(/needs some notes/)).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('saves without a window once it has notes', async () => {
      const user = userEvent.setup()
      const { onSubmit } = renderDeploymentForm()

      await user.click(screen.getByLabelText('Notes only'))
      await user.type(screen.getByLabelText(/^Name/), 'Frozen')
      await user.type(screen.getByLabelText('github'), 'acme/frozen')
      await user.type(screen.getByLabelText('Notes'), 'Frozen until Q3.')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(onSubmit).toHaveBeenCalledWith('frozen', {
        name: 'Frozen',
        notes: 'Frozen until Q3.',
        'notes-only': true,
        github: 'acme/frozen',
      })
    })
  })

  describe('closing', () => {
    it('closes on cancel', async () => {
      const user = userEvent.setup()
      const { onClose, onSubmit } = renderDeploymentForm()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onClose).toHaveBeenCalledOnce()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('closes on escape', async () => {
      const user = userEvent.setup()
      const { onClose } = renderDeploymentForm()

      await user.keyboard('{Escape}')

      expect(onClose).toHaveBeenCalledOnce()
    })

    it('closes on a click landing on the backdrop', async () => {
      const user = userEvent.setup()
      const { onClose } = renderDeploymentForm()

      await user.click(document.querySelector('.dw-modal-backdrop')!)

      expect(onClose).toHaveBeenCalledOnce()
    })

    it('stays open for a click inside the panel', async () => {
      const user = userEvent.setup()
      const { onClose } = renderDeploymentForm()

      await user.click(screen.getByRole('dialog'))

      expect(onClose).not.toHaveBeenCalled()
    })
  })
})

describe('SiteForm', () => {
  it('fills the existing values in when editing', () => {
    const config = testConfig()
    renderSiteForm({
      originalKey: 'github',
      initial: toSiteDraft('github', config.domains.github, config.sites.github),
    })

    expect(screen.getByLabelText(/^Site key/)).toHaveValue('github')
    expect(screen.getByLabelText('Pattern 1')).toHaveValue('*://*.github.com/*')
    // The github fixture has two insert rows, so two Element fields.
    expect(screen.getAllByLabelText(/^Element/)[0]).toHaveValue(
      'file-navigation',
    )
  })

  it('fills the spacing overrides in when editing', () => {
    const config = testConfig()
    config.sites.github.style = { margin: '2rem 0', maxWidth: '640px' }
    renderSiteForm({
      originalKey: 'github',
      initial: toSiteDraft('github', config.domains.github, config.sites.github),
    })

    expect(screen.getByLabelText(/^Margin/)).toHaveValue('2rem 0')
    expect(screen.getByLabelText(/^Padding/)).toHaveValue('')
    expect(screen.getByLabelText(/^Max width/)).toHaveValue('640px')
  })

  it('adds and removes pattern rows', async () => {
    const user = userEvent.setup()
    renderSiteForm()

    await user.click(screen.getByRole('button', { name: 'Add pattern' }))
    expect(screen.getByLabelText('Pattern 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Remove Pattern 2/ }))
    expect(screen.queryByLabelText('Pattern 2')).not.toBeInTheDocument()
  })

  it('will not let the last pattern row be removed', () => {
    renderSiteForm()
    expect(screen.getByRole('button', { name: /Remove Pattern 1/ })).toBeDisabled()
  })

  it('rejects a malformed match pattern', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderSiteForm()

    await user.type(screen.getByLabelText(/^Site key/), 'gitlab')
    await user.type(screen.getByLabelText('Pattern 1'), 'gitlab.com')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Not a valid match pattern.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('saves a complete site in the stored shape', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderSiteForm()

    await user.type(screen.getByLabelText(/^Site key/), 'gitlab')
    await user.type(screen.getByLabelText('Pattern 1'), '*://gitlab.com/*')
    await user.type(screen.getByLabelText(/^Element/), 'content-wrapper')
    await user.type(screen.getByLabelText(/^Padding/), '10px 14px')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      'gitlab',
      ['*://gitlab.com/*'],
      {
        insert: [{ class: 'content-wrapper', position: 'after' }],
        style: { padding: '10px 14px' },
      },
    )
  })

  it('refuses to save spacing that is not a css length', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderSiteForm()

    await user.type(screen.getByLabelText(/^Site key/), 'gitlab')
    await user.type(screen.getByLabelText('Pattern 1'), '*://gitlab.com/*')
    await user.type(screen.getByLabelText(/^Element/), 'content-wrapper')
    await user.type(screen.getByLabelText(/^Margin/), 'massive')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/CSS length/)).toBeInTheDocument()
  })

  it('records the chosen insert position', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderSiteForm()

    await user.type(screen.getByLabelText(/^Site key/), 'gitlab')
    await user.type(screen.getByLabelText('Pattern 1'), '*://gitlab.com/*')
    await user.type(screen.getByLabelText(/^Element/), 'content-wrapper')
    await user.selectOptions(screen.getByLabelText(/^Position/), 'before')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(vi.mocked(onSubmit).mock.calls[0][2].insert[0].position).toBe('before')
  })

  it('tidies the key into a usable slug once it is left alone', async () => {
    const user = userEvent.setup()
    renderSiteForm()

    await user.type(screen.getByLabelText(/^Site key/), 'My Site!')
    // Mid-typing the raw text is kept, so a space is not eaten before it can
    // become a dash.
    expect(screen.getByLabelText(/^Site key/)).toHaveValue('My Site!')

    await user.tab()

    expect(screen.getByLabelText(/^Site key/)).toHaveValue('my-site')
  })
})

describe('DeploymentForm days', () => {
  function dayToggle(label: string): HTMLInputElement {
    const box = screen
      .getAllByRole('checkbox')
      .find((input) => input.closest('label')?.textContent?.trim() === label)
    if (!box) {
      throw new Error(`no day toggle for ${label}`)
    }
    return box as HTMLInputElement
  }

  it('starts with every day on', () => {
    // A new window opens every day until told otherwise, and an empty row of
    // days would read as one that never opens.
    renderDeploymentForm()

    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(dayToggle(day).checked).toBe(true)
    }
  })

  it('shows the week starting on Monday', () => {
    renderDeploymentForm()
    const labels = screen
      .getAllByRole('checkbox')
      .map((input) => input.closest('label')?.textContent?.trim())
      .filter((text) => text && text.length === 3)

    expect(labels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('reads the days off an existing entry', () => {
    const config = testConfig()
    config.deployments.daytime.time = {
      start: '09:00',
      end: '17:00',
      timezone: 'Europe/London',
      days: ['mon', 'tue'],
    }
    renderDeploymentForm({
      originalKey: 'daytime',
      initial: toDeploymentDraft('daytime', config.deployments.daytime, DOMAINS),
    })

    expect(dayToggle('Mon').checked).toBe(true)
    expect(dayToggle('Wed').checked).toBe(false)
  })

  it('writes the days back when some are off', async () => {
    const user = userEvent.setup()
    const props = renderDeploymentForm({
      initial: {
        ...emptyDeploymentDraft(DOMAINS),
        name: 'Weekdays',
        key: 'weekdays',
        fragments: { ...emptyDeploymentDraft(DOMAINS).fragments, github: 'acme/x' },
      },
    })

    await user.click(dayToggle('Sat'))
    await user.click(dayToggle('Sun'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(props.onSubmit).toHaveBeenCalledWith(
      'weekdays',
      expect.objectContaining({
        time: expect.objectContaining({
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        }),
      }),
    )
  })

  it('writes no days at all when every one is on', async () => {
    const user = userEvent.setup()
    const props = renderDeploymentForm({
      initial: {
        ...emptyDeploymentDraft(DOMAINS),
        name: 'Any day',
        key: 'any-day',
        fragments: { ...emptyDeploymentDraft(DOMAINS).fragments, github: 'acme/x' },
      },
    })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    // A config that never cared about days should not grow a key saying so.
    expect(props.onSubmit).toHaveBeenCalledWith(
      'any-day',
      expect.objectContaining({
        time: expect.not.objectContaining({ days: expect.anything() }),
      }),
    )
  })

  it('refuses a window with no days at all', async () => {
    const user = userEvent.setup()
    const props = renderDeploymentForm({
      initial: {
        ...emptyDeploymentDraft(DOMAINS),
        name: 'Never',
        key: 'never',
        days: [],
        fragments: { ...emptyDeploymentDraft(DOMAINS).fragments, github: 'acme/x' },
      },
    })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      screen.getByText('Pick at least one day, or the window can never open.'),
    ).toBeInTheDocument()
    expect(props.onSubmit).not.toHaveBeenCalled()
  })
})
