import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value }: { value: string }) => (
    <textarea aria-label="config" readOnly value={value} />
  ),
}))

const { default: Options } = await import('../src/ui/components/Options')
const { Config, defaultConfig } = await import('../src/app/config/Config')
const { testConfig } = await import('./helpers/fixtures')

describe('Options page', () => {
  it('shows a loading state before the config arrives', () => {
    render(<Options />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders the four tabs once loaded', async () => {
    await Config.save(testConfig())
    render(<Options />)

    expect(
      await screen.findByRole('button', { name: 'Site Information' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Deployment Windows' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Edit / Import / Export' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'How to use' })).toBeInTheDocument()
  })

  it('opens on the site information tab', async () => {
    await Config.save(testConfig())
    render(<Options />)

    expect(await screen.findByRole('heading', { name: 'github' })).toBeInTheDocument()
    expect(screen.getByText('*://*.github.com/*')).toBeInTheDocument()
  })

  it('switches to the deployment windows tab', async () => {
    const user = userEvent.setup()
    await Config.save(testConfig())
    render(<Options />)

    await user.click(
      await screen.findByRole('button', { name: 'Deployment Windows' }),
    )

    expect(screen.getByText('Daytime project')).toBeInTheDocument()
    expect(screen.getByText('09:00 - 17:00 (Europe/London)')).toBeInTheDocument()
  })

  it('switches to the editor tab and shows the loaded config', async () => {
    const user = userEvent.setup()
    await Config.save(testConfig())
    render(<Options />)

    await user.click(
      await screen.findByRole('button', { name: 'Edit / Import / Export' }),
    )

    const editor = screen.getByLabelText<HTMLTextAreaElement>('config')
    expect(JSON.parse(editor.value).deployments.daytime.name).toBe(
      'Daytime project',
    )
  })

  it('switches to the how-to tab', async () => {
    const user = userEvent.setup()
    await Config.save(testConfig())
    render(<Options />)

    await user.click(await screen.findByRole('button', { name: 'How to use' }))

    expect(
      screen.getByRole('heading', { name: 'Using the extension' }),
    ).toBeInTheDocument()
  })

  it('falls back to the default config when storage is empty', async () => {
    render(<Options />)

    expect(await screen.findByRole('heading', { name: 'github' })).toBeInTheDocument()
    expect(screen.getByText('flash flash-success')).toBeInTheDocument()
  })

  it('still renders when storage fails outright', async () => {
    vi.mocked(chrome.storage.sync.get).mockRejectedValue(new Error('offline'))
    render(<Options />)

    // Falls back to the in-memory default rather than showing a broken page.
    expect(
      await screen.findByRole('button', { name: 'Site Information' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'github' })).toBeInTheDocument()
  })

  it('shows the config heading', async () => {
    await Config.save(defaultConfig())
    render(<Options />)
    expect(
      await screen.findByRole('heading', { name: 'Deployment windows config' }),
    ).toBeInTheDocument()
  })
})
