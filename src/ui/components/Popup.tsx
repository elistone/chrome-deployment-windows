import { useEffect, useState } from 'react'

import { DW } from '../../app/components/DW'
import { Methods } from '../../app/components/Methods'
import { TextFormatter } from '../../app/components/TextFormatter'
import type { ResolvedDeployment } from '../../app/config/types'
import { useTheme } from '../theme'
import { ClockIcon, NoteIcon, SettingsIcon } from './common/Icons'
import StatusPill, { type StatusTone } from './common/StatusPill'
import { THEME_META } from './common/themeMeta'
import { faviconUrl, siteInitials } from './dashboard/siteBranding'

interface PopupView {
  deployment: ResolvedDeployment | null
  /** Host of the active tab, shown so it is clear what was matched. */
  host: string | null
}

/** The host of the active tab, or null for anything that is not a web page. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname || null
  } catch {
    return null
  }
}

/** Resolve the active tab against the stored config, once, on mount. */
function usePopupView(): { loaded: boolean; view: PopupView } {
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<PopupView>({ deployment: null, host: null })

  useEffect(() => {
    let active = true

    void (async () => {
      let next: PopupView = { deployment: null, host: null }
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true,
        })
        const url = tab?.url ?? ''
        const dw = await DW.create(url)
        next = { deployment: dw.getDeploymentInfo(), host: hostOf(url) }
      } catch {
        // Storage or the tabs API being unavailable leaves nothing to show,
        // which the "no information" state already covers.
      }
      if (active) {
        setView(next)
        setLoaded(true)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  return { loaded, view }
}

function toneFor(deployment: ResolvedDeployment): StatusTone {
  if (deployment.notesOnly) {
    return 'notes'
  }
  return deployment.canDeploy ? 'open' : 'closed'
}

/** The active tab's favicon, from Chrome's own cache, or its initial. */
function PopupFavicon({ host }: { host: string }) {
  const [failed, setFailed] = useState(false)
  const url = faviconUrl(host, 16)

  if (!url || failed) {
    return (
      <span className="dw-popup-favicon" aria-hidden="true">
        {siteInitials(host)}
      </span>
    )
  }

  return (
    <img
      className="dw-popup-favicon dw-popup-favicon-image"
      src={url}
      alt=""
      width={16}
      height={16}
      onError={() => setFailed(true)}
    />
  )
}

/**
 * One button that cycles light -> dark -> system.
 *
 * The dashboard has room for all three at once; the popup does not, and the
 * preference is shared, so this is a shortcut rather than a second setting.
 */
function ThemeButton() {
  const { choice, cycle } = useTheme()
  const { labelKey, Icon } = THEME_META[choice]
  const label = `${Methods.i18n('l10nTheme')}: ${Methods.i18n(labelKey)}`

  return (
    <button
      type="button"
      className="dw-popup-button dw-popup-button-icon"
      onClick={cycle}
      title={label}
      aria-label={label}
    >
      <Icon size={16} />
    </button>
  )
}

function SettingsButton() {
  const open = () => {
    try {
      chrome.runtime.openOptionsPage()
    } catch {
      // Nothing to fall back to, and nothing worth interrupting the popup for.
    }
  }

  return (
    <button type="button" className="dw-popup-button" onClick={open}>
      <SettingsIcon size={15} />
      {Methods.i18n('l10nOpenSettings')}
    </button>
  )
}

function Window({ deployment }: { deployment: ResolvedDeployment }) {
  const { original, local } = deployment.timeObj
  // The converted window is only worth the space when it actually differs.
  const showLocal = original.timezone !== local.timezone

  return (
    <dl className="dw-popup-rows">
      <div className="dw-popup-row">
        <dt>
          <ClockIcon size={14} />
          {Methods.i18n('l10nDeploymentWindow')}
        </dt>
        <dd>
          <span className="dw-mono">
            {original.start} &ndash; {original.end}
          </span>
          <span className="dw-popup-zone">{original.timezone}</span>
        </dd>
      </div>
      {showLocal && (
        <div className="dw-popup-row dw-popup-row-subtle">
          <dt>{Methods.i18n('l10nYourTimezone')}</dt>
          <dd>
            <span className="dw-mono">
              {local.start} &ndash; {local.end}
            </span>
            <span className="dw-popup-zone">{local.timezone}</span>
          </dd>
        </div>
      )}
    </dl>
  )
}

function Deployment({
  deployment,
  host,
}: {
  deployment: ResolvedDeployment
  host: string | null
}) {
  const notes = deployment.notes

  return (
    <>
      <header className="dw-popup-head">
        {/* The pill shares the line with the host rather than the title: it is
            the wider of the two, and the title needs the full width. */}
        <div className="dw-popup-meta">
          {host && (
            <p className="dw-popup-site">
              <PopupFavicon host={host} />
              {host}
            </p>
          )}
          <StatusPill tone={toneFor(deployment)} />
        </div>
        <h1 className="dw-popup-title">
          {TextFormatter.toPlainText(deployment.name)}
        </h1>
      </header>

      <div className="dw-popup-body">
        {!deployment.notesOnly && <Window deployment={deployment} />}
        {notes && (
          <section
            className={`dw-popup-notes${
              deployment.notesOnly ? ' dw-popup-notes-only' : ''
            }`}
          >
            <h2 className="dw-popup-section-title">
              <NoteIcon size={14} />
              {Methods.i18n('l10nNotes')}
            </h2>
            <div
              className="dw-prose"
              dangerouslySetInnerHTML={{
                __html: TextFormatter.toMarkdown(notes),
              }}
            />
          </section>
        )}
      </div>
    </>
  )
}

function Message({
  title,
  hint,
  host,
}: {
  title: string
  hint?: string
  host?: string | null
}) {
  return (
    <>
      {host && (
        <header className="dw-popup-head">
          <div className="dw-popup-meta">
            <p className="dw-popup-site">
              <PopupFavicon host={host} />
              {host}
            </p>
          </div>
        </header>
      )}
      <div className="dw-popup-message">
        <p className="dw-popup-message-title">{title}</p>
        {hint && <p className="dw-popup-message-hint">{hint}</p>}
      </div>
    </>
  )
}

/**
 * The browser action popup. Resolves the active tab's URL against the config
 * and shows the same information the in-page notice does.
 */
export function Popup() {
  const { loaded, view } = usePopupView()
  // The status tints the whole panel, so it lives on the outermost element.
  const tone = view.deployment ? toneFor(view.deployment) : undefined

  return (
    <div className="dw-popup" data-status={tone}>
      {!loaded && <Message title={Methods.i18n('l10nLoading')} />}
      {loaded && view.deployment && (
        <Deployment deployment={view.deployment} host={view.host} />
      )}
      {loaded && !view.deployment && (
        <Message
          title={Methods.i18n('l10nNoInformation')}
          hint={Methods.i18n('l10nNoInformationHint')}
          host={view.host}
        />
      )}
      <footer className="dw-popup-foot">
        <SettingsButton />
        <ThemeButton />
      </footer>
    </div>
  )
}

export default Popup
