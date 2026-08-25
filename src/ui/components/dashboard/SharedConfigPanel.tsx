import { useEffect, useState } from 'react'

import { Methods } from '../../../app/components/Methods'
import {
  isUsableRemoteUrl,
  readCache,
  readRemoteUrl,
  type RemoteCache,
} from '../../../app/config/remote'
import { refreshRemote, setRemoteUrl } from '../../../app/config/remoteFetch'
import Field from '../common/Field'
import { ChevronIcon, DownloadIcon } from '../common/Icons'

interface SharedConfigPanelProps {
  /** Reloads the dashboard once the shared layer underneath it has moved. */
  onChanged: () => void
}

/** How many entries the shared layer is currently contributing. */
function sharedCount(cache: RemoteCache | null): number {
  if (!cache?.config) {
    return 0
  }
  return (
    Object.keys(cache.config.domains).length +
    Object.keys(cache.config.sites).length +
    Object.keys(cache.config.deployments).length
  )
}

function whenFetched(cache: RemoteCache | null): string {
  if (!cache?.fetchedAt) {
    return ''
  }
  return new Date(cache.fetchedAt).toLocaleString()
}

/**
 * Point the extension at a config someone else maintains.
 *
 * The file is a layer underneath everything configured here, so it can be
 * pointed at a team's shared list without giving up the ability to correct any
 * one entry locally - which is the difference between this and simply pasting
 * their JSON in through the panel below.
 */
export function SharedConfigPanel({ onChanged }: SharedConfigPanelProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [cache, setCache] = useState<RemoteCache | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [storedUrl, storedCache] = await Promise.all([
          readRemoteUrl(),
          readCache(),
        ])
        if (active) {
          setUrl(storedUrl)
          setCache(storedCache)
          // Opened on its own when one is configured, because a shared config
          // that is failing to fetch is the first thing worth seeing.
          setOpen(storedUrl !== '')
        }
      } catch {
        // Storage being unavailable leaves the panel closed and empty, which
        // is what it looks like when nothing is configured. The dashboard
        // beside it reports the failure once a save is attempted.
      }
      if (active) {
        setLoaded(true)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const run = async (work: () => Promise<RemoteCache>) => {
    setBusy(true)
    try {
      setCache(await work())
      onChanged()
    } catch (error: unknown) {
      // Writing the URL is a storage write like any other, and it can fail.
      // Reported in the same place as a fetch failure, since from here they
      // are the same thing: the shared config did not take.
      setCache({
        url: trimmed,
        fetchedAt: Date.now(),
        config: null,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusy(false)
    }
  }

  const trimmed = url.trim()
  const invalid = trimmed !== '' && !isUsableRemoteUrl(trimmed)
  const connected = cache?.url === trimmed && trimmed !== ''
  const count = sharedCount(cache)

  return (
    <section className="dw-panel">
      <button
        type="button"
        className="dw-panel-summary"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronIcon
          size={16}
          className={`dw-panel-chevron${open ? ' dw-panel-chevron-open' : ''}`}
        />
        <span className="dw-panel-summary-text">
          <span className="dw-panel-title">
            {Methods.i18n('l10nSharedTitle')}
          </span>
          <span className="dw-panel-subtitle">
            {Methods.i18n('l10nSharedHint')}
          </span>
        </span>
        {loaded && cache?.error && (
          <span className="dw-badge dw-badge-warn">
            {Methods.i18n('l10nSharedFailed')}
          </span>
        )}
        {loaded && connected && !cache.error && count > 0 && (
          <span className="dw-badge">
            {count} {Methods.i18n('l10nSharedEntries')}
          </span>
        )}
      </button>

      {open && (
        <div className="dw-panel-body">
          <Field
            label={Methods.i18n('l10nSharedUrl')}
            hint={Methods.i18n('l10nSharedUrlHint')}
            error={invalid ? Methods.i18n('l10nSharedUrlInvalid') : null}
          >
            {({ id, describedBy }) => (
              <div className="dw-input-row">
                <input
                  id={id}
                  className="dw-input dw-mono"
                  type="url"
                  inputMode="url"
                  placeholder="https://example.com/deployment-windows.json"
                  value={url}
                  aria-describedby={describedBy}
                  onChange={(event) => setUrl(event.target.value)}
                />
                <button
                  type="button"
                  className="dw-button dw-button-primary"
                  disabled={busy || invalid}
                  onClick={() => void run(() => setRemoteUrl(url))}
                >
                  {Methods.i18n(
                    connected ? 'l10nSharedUpdate' : 'l10nSharedConnect',
                  )}
                </button>
              </div>
            )}
          </Field>

          <div className="dw-panel-toolbar">
            <button
              type="button"
              className="dw-button dw-button-ghost"
              disabled={busy || !connected}
              onClick={() => void run(refreshRemote)}
            >
              <DownloadIcon size={14} />
              {Methods.i18n('l10nSharedRefresh')}
            </button>
            {connected && (
              <button
                type="button"
                className="dw-button dw-button-ghost dw-button-danger"
                disabled={busy}
                onClick={() => {
                  setUrl('')
                  void run(() => setRemoteUrl(''))
                }}
              >
                {Methods.i18n('l10nSharedDisconnect')}
              </button>
            )}
          </div>

          {loaded && cache?.error && (
            <p className="dw-field-error" role="alert">
              {Methods.i18n('l10nSharedError')} {cache.error}
            </p>
          )}

          {loaded && connected && !cache.error && (
            <p className="dw-panel-note">
              {count} {Methods.i18n('l10nSharedEntries')}
              {' \u00b7 '}
              {Methods.i18n('l10nSharedChecked')} {whenFetched(cache)}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export default SharedConfigPanel
