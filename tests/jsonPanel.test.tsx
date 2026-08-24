import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * CodeMirror 6 needs layout APIs jsdom does not implement, and the editor
 * itself is not what these tests are about. Swapping it for a textarea keeps
 * the focus on this component's real job: parse, validate, hand back.
 */
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

const { default: JsonPanel } = await import(
  '../src/ui/components/dashboard/JsonPanel'
)
const { testConfig } = await import('./helpers/fixtures')

async function renderPanel(onApply = vi.fn().mockResolvedValue(true)) {
  const user = userEvent.setup()
  const config = testConfig()
  render(<JsonPanel config={config} onApply={onApply} theme="light" />)
  // The panel is collapsed by default now that editing is UI first.
  await user.click(screen.getByRole('button', { name: /JSON config/ }))
  return { user, config, onApply }
}

async function setConfigText(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) {
  const editor = screen.getByLabelText('config')
  await user.clear(editor)
  await user.paste(text)
}

describe('JsonPanel', () => {
  it('starts collapsed', () => {
    render(
      <JsonPanel config={testConfig()} onApply={vi.fn()} theme="light" />,
    )
    expect(screen.queryByLabelText('config')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /JSON config/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('shows the current config once opened', async () => {
    const { config } = await renderPanel()
    const editor = screen.getByLabelText<HTMLTextAreaElement>('config')
    expect(JSON.parse(editor.value)).toEqual(config)
  })

  it('flags unsaved edits', async () => {
    const { user } = await renderPanel()
    expect(screen.queryByText('Unsaved')).not.toBeInTheDocument()

    await setConfigText(user, '{}')

    expect(screen.getByText('Unsaved')).toBeInTheDocument()
  })

  it('hands a valid config back to be saved', async () => {
    const { user, onApply } = await renderPanel()

    const next = testConfig()
    next.deployments = { added: { name: 'Added', github: 'acme/added' } }
    await setConfigText(user, JSON.stringify(next))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onApply).toHaveBeenCalledWith(next)
    await waitFor(() =>
      expect(screen.queryByText('Unsaved')).not.toBeInTheDocument(),
    )
  })

  it('keeps the unsaved flag when the save is refused', async () => {
    const { user } = await renderPanel(vi.fn().mockResolvedValue(false))

    await setConfigText(user, JSON.stringify(testConfig()))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByText('Unsaved')).toBeInTheDocument())
  })

  describe('validation', () => {
    it('refuses malformed json and says why', async () => {
      const { user, onApply } = await renderPanel()

      await setConfigText(user, '{ not json')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/Invalid JSON/)
      expect(onApply).not.toHaveBeenCalled()
    })

    it('refuses json that violates the schema', async () => {
      const { user, onApply } = await renderPanel()

      await setConfigText(user, JSON.stringify({ domains: {}, sites: {} }))
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/deployments/)
      expect(onApply).not.toHaveBeenCalled()
    })

    it('reports a bad deployment time with its path', async () => {
      const { user } = await renderPanel()

      const bad = testConfig()
      bad.deployments = {
        proj: { time: { start: '9am', end: '17:00', timezone: 'Europe/London' } },
      }
      await setConfigText(user, JSON.stringify(bad))
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /deployments\/proj\/time\/start/,
      )
    })

    it('clears the errors once the config is fixed', async () => {
      const { user } = await renderPanel()

      await setConfigText(user, '{ not json')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      await setConfigText(user, JSON.stringify(testConfig()))
      await waitFor(() =>
        expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
      )
    })
  })

  describe('reverting', () => {
    it('is unavailable until something is edited', async () => {
      await renderPanel()
      expect(screen.getByRole('button', { name: 'Revert' })).toBeDisabled()
    })

    it('puts the stored config back', async () => {
      const { user, config } = await renderPanel()

      await setConfigText(user, '{}')
      await user.click(screen.getByRole('button', { name: 'Revert' }))

      const editor = screen.getByLabelText<HTMLTextAreaElement>('config')
      expect(JSON.parse(editor.value)).toEqual(config)
      expect(screen.queryByText('Unsaved')).not.toBeInTheDocument()
    })
  })

  describe('staying in step with the cards', () => {
    it('picks up a config changed elsewhere', async () => {
      const user = userEvent.setup()
      const config = testConfig()
      const { rerender } = render(
        <JsonPanel config={config} onApply={vi.fn()} theme="light" />,
      )
      await user.click(screen.getByRole('button', { name: /JSON config/ }))

      const next = testConfig()
      next.deployments = { only: { name: 'Only', github: 'acme/only' } }
      rerender(<JsonPanel config={next} onApply={vi.fn()} theme="light" />)

      const editor = screen.getByLabelText<HTMLTextAreaElement>('config')
      expect(JSON.parse(editor.value)).toEqual(next)
    })

    it('does not discard text being typed', async () => {
      const user = userEvent.setup()
      const config = testConfig()
      const { rerender } = render(
        <JsonPanel config={config} onApply={vi.fn()} theme="light" />,
      )
      await user.click(screen.getByRole('button', { name: /JSON config/ }))
      await setConfigText(user, '{ "half-typed"')

      rerender(
        <JsonPanel config={testConfig()} onApply={vi.fn()} theme="light" />,
      )

      expect(screen.getByLabelText('config')).toHaveValue('{ "half-typed"')
    })
  })

  describe('clipboard', () => {
    it('reports a successful copy', async () => {
      const { user } = await renderPanel()
      // Installed after setup(), which stubs the clipboard for its own use.
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      })

      await user.click(screen.getByRole('button', { name: 'Copy' }))

      expect(writeText).toHaveBeenCalledOnce()
      expect(await screen.findByText('Copied')).toBeInTheDocument()
    })

    it('says so rather than silently failing', async () => {
      const { user } = await renderPanel()
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: vi.fn().mockRejectedValue(new Error('denied')),
        },
      })

      await user.click(screen.getByRole('button', { name: 'Copy' }))

      expect(await screen.findByText('Could not copy')).toBeInTheDocument()
    })
  })
})
