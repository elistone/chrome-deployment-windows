import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * CodeMirror 6 needs layout APIs jsdom does not implement, and the editor
 * itself is not what these tests are about. Swapping it for a textarea keeps
 * the focus on this component's real job: parse, validate, save.
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

const { default: ImportExport } = await import(
  '../src/ui/components/ImportExport'
)
const { Config, STORAGE_KEYS } = await import('../src/app/config/Config')
const { chromeMock } = await import('./helpers/chromeMock')
const { testConfig } = await import('./helpers/fixtures')

/** Replace the whole editor contents in one go. */
async function setConfigText(user: ReturnType<typeof userEvent.setup>, text: string) {
  const editor = screen.getByLabelText('config')
  await user.clear(editor)
  await user.paste(text)
}

function renderEditor(onChange = vi.fn()) {
  const config = testConfig()
  render(<ImportExport config={config} onChange={onChange} />)
  return { config, onChange }
}

describe('ImportExport', () => {
  it('renders the current config as formatted json', () => {
    const { config } = renderEditor()
    const editor = screen.getByLabelText<HTMLTextAreaElement>('config')
    expect(JSON.parse(editor.value)).toEqual(config)
  })

  it('starts with no unsaved-changes chip', () => {
    renderEditor()
    expect(screen.queryByText('Config changes')).not.toBeInTheDocument()
  })

  it('flags unsaved changes once edited', async () => {
    const user = userEvent.setup()
    renderEditor()

    await setConfigText(user, '{}')

    expect(screen.getByText('Config changes')).toBeInTheDocument()
  })

  describe('saving', () => {
    it('writes a valid config to storage and notifies the parent', async () => {
      const user = userEvent.setup()
      const { onChange } = renderEditor()

      const next = testConfig()
      next.deployments = { added: { name: 'Added', github: 'acme/added' } }
      await setConfigText(user, JSON.stringify(next))
      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(chromeMock().storage[STORAGE_KEYS.deployments]).toEqual(
          next.deployments,
        )
      })
      expect(onChange).toHaveBeenCalledWith(next)
    })

    it('confirms the save, then returns to idle', async () => {
      const user = userEvent.setup()
      renderEditor()

      await setConfigText(user, JSON.stringify(testConfig()))
      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(await screen.findByRole('button', { name: 'Saved!' })).toBeInTheDocument()
      await waitFor(
        () => expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument(),
        { timeout: 3000 },
      )
    })

    it('clears the unsaved-changes chip after a successful save', async () => {
      const user = userEvent.setup()
      renderEditor()

      await setConfigText(user, JSON.stringify(testConfig()))
      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() =>
        expect(screen.queryByText('Config changes')).not.toBeInTheDocument(),
      )
    })

    it('round trips through Config.load', async () => {
      const user = userEvent.setup()
      renderEditor()

      const next = testConfig()
      next.deployments = { only: { name: 'Only', github: 'acme/only' } }
      await setConfigText(user, JSON.stringify(next))
      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(async () => {
        expect(await Config.load()).toEqual(next)
      })
    })
  })

  describe('validation', () => {
    it('refuses to save malformed json and says why', async () => {
      const user = userEvent.setup()
      const { onChange } = renderEditor()

      await setConfigText(user, '{ not json')
      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/Invalid JSON/)
      expect(chrome.storage.sync.set).not.toHaveBeenCalled()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('refuses to save json that violates the schema', async () => {
      const user = userEvent.setup()
      renderEditor()

      await setConfigText(user, JSON.stringify({ domains: {}, sites: {} }))
      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/deployments/)
      expect(chrome.storage.sync.set).not.toHaveBeenCalled()
    })

    it('reports a bad deployment time with its path', async () => {
      const user = userEvent.setup()
      renderEditor()

      const bad = testConfig()
      bad.deployments = {
        proj: { time: { start: '9am', end: '17:00', timezone: 'Europe/London' } },
      }
      await setConfigText(user, JSON.stringify(bad))
      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /deployments\/proj\/time\/start/,
      )
    })

    it('clears the errors once the config is fixed', async () => {
      const user = userEvent.setup()
      renderEditor()

      await setConfigText(user, '{ not json')
      await user.click(screen.getByRole('button', { name: /save/i }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      await setConfigText(user, JSON.stringify(testConfig()))
      await waitFor(() =>
        expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
      )
    })
  })

  describe('failures', () => {
    it('surfaces a storage write failure instead of claiming success', async () => {
      const user = userEvent.setup()
      const { onChange } = renderEditor()
      chromeMock().failStorage = true

      await setConfigText(user, JSON.stringify(testConfig()))
      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/Could not save/)
      expect(onChange).not.toHaveBeenCalled()
      expect(
        screen.queryByRole('button', { name: 'Saved!' }),
      ).not.toBeInTheDocument()
    })
  })
})
