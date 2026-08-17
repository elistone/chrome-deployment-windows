import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import {
  ICON_EVENT,
  getSimulatedTabUrl,
  setSimulatedTabUrl,
} from './chromeShim'
import { reseed } from './seed'
import { SCENARIOS } from './presets'
import './shell.css'

type Surface = 'notice' | 'popup' | 'options'

const SURFACES: { id: Surface; label: string; hint: string }[] = [
  { id: 'notice', label: 'In-page notice', hint: 'What the content script injects' },
  { id: 'popup', label: 'Popup', hint: 'The browser action popup' },
  { id: 'options', label: 'Options', hint: 'The full options page' },
]

const ICON_LABELS: Record<string, string> = {
  'icons/success/icon48.png': 'open',
  'icons/error/icon48.png': 'closed',
}

function Shell() {
  const [surface, setSurface] = useState<Surface>('notice')
  const [url, setUrl] = useState(getSimulatedTabUrl)
  const [draftUrl, setDraftUrl] = useState(url)
  const [icon, setIcon] = useState<string | null>(null)
  // Bumping this remounts the iframe, which is how config/url changes are
  // picked up: each surface reads storage once on load, exactly as the real
  // extension pages do.
  const [reloadToken, setReloadToken] = useState(0)
  const frameRef = useRef<HTMLIFrameElement>(null)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  const applyUrl = useCallback(
    (next: string) => {
      setSimulatedTabUrl(next)
      setUrl(next)
      setDraftUrl(next)
      setIcon(null)
      reload()
    },
    [reload],
  )

  // The shim rebroadcasts icon requests to window.parent, so the toolbar state
  // is observable here even though the notice runs inside the iframe.
  useEffect(() => {
    const onIcon = (event: Event) => {
      const detail = (event as CustomEvent<{ iconPath: string }>).detail
      setIcon(detail?.iconPath ?? null)
    }
    window.addEventListener(ICON_EVENT, onIcon)
    return () => window.removeEventListener(ICON_EVENT, onIcon)
  }, [])

  const activeScenario = SCENARIOS.find((scenario) => scenario.url === url)

  return (
    <div className="harness">
      <header className="harness-header">
        <div className="harness-title">
          <h1>Deployment Windows</h1>
          <span className="harness-badge">dev harness</span>
        </div>
        <p className="harness-sub">
          Runs the real components against a <code>localStorage</code>-backed
          stand-in for the extension APIs. No unpacked extension required.
        </p>
      </header>

      <section className="panel">
        <h2 className="panel-title">Simulated tab</h2>
        <div className="scenarios">
          {SCENARIOS.map((scenario) => (
            <button
              type="button"
              key={scenario.url}
              className={`chip ${scenario.url === url ? 'chip-active' : ''}`}
              onClick={() => applyUrl(scenario.url)}
              title={scenario.description}
            >
              {scenario.label}
            </button>
          ))}
        </div>

        <form
          className="url-row"
          onSubmit={(event) => {
            event.preventDefault()
            applyUrl(draftUrl)
          }}
        >
          <input
            className="url-input"
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
            spellCheck={false}
            aria-label="Simulated tab URL"
          />
          <button type="submit" className="btn">
            Apply
          </button>
        </form>

        {activeScenario && (
          <p className="scenario-hint">{activeScenario.description}</p>
        )}

        <div className="status-row">
          <span className="status-label">Toolbar icon</span>
          {icon ? (
            <span className={`pill pill-${ICON_LABELS[icon] ?? 'unknown'}`}>
              {ICON_LABELS[icon] ?? icon}
            </span>
          ) : (
            <span className="pill pill-idle">not set</span>
          )}
          <span className="status-spacer" />
          <button type="button" className="btn btn-ghost" onClick={reload}>
            Reload frame
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              reseed()
              setIcon(null)
              reload()
            }}
            title="Discard any edits made in the options page"
          >
            Reset config
          </button>
        </div>
      </section>

      <nav className="tabs">
        {SURFACES.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`tab ${surface === item.id ? 'tab-active' : ''}`}
            onClick={() => setSurface(item.id)}
          >
            <span className="tab-label">{item.label}</span>
            <span className="tab-hint">{item.hint}</span>
          </button>
        ))}
      </nav>

      <section className={`stage stage-${surface}`}>
        <iframe
          ref={frameRef}
          key={`${surface}-${reloadToken}`}
          className="stage-frame"
          src={`./${surface}.html`}
          title={SURFACES.find((item) => item.id === surface)?.label}
        />
      </section>

      <footer className="harness-footer">
        Config edits made on the Options tab are written to{' '}
        <code>localStorage</code> and picked up by the other surfaces on reload.
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
)
