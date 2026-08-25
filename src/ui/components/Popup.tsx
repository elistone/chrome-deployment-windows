import { useEffect, useState } from 'react'

import { DW } from '../../app/components/DW'
import { Methods } from '../../app/components/Methods'
import { daysLabel } from '../../app/components/dayLabels'
import { TextFormatter } from '../../app/components/TextFormatter'
import { Config } from '../../app/config/Config'
import type {
  DeploymentWindowsConfig,
  ResolvedDeployment,
} from '../../app/config/types'
import { useTheme } from '../theme'
import Countdown from './common/Countdown'
import {
  ClockIcon,
  NoteIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
} from './common/Icons'
import StatusPill, { type StatusTone } from './common/StatusPill'
import { THEME_META } from './common/themeMeta'
import { useMarkdown } from './common/useMarkdown'
import { useNow } from './common/useNow'
import { faviconUrl, siteInitials } from './dashboard/siteBranding'
import DeploymentEditor from './popup/DeploymentEditor'
import { targetFor, type PopupTarget } from './popup/target'

interface PopupView {
  config: DeploymentWindowsConfig
  deployment: ResolvedDeployment | null
  /** Host of the active tab, shown so it is clear what was matched. */
  host: string | null
  /** The full URL, kept so a new entry can be filled in from it. */
  url: string
  title: string | undefined
  /** What the popup could add or change here, if anything. */
  target: PopupTarget
}

/** The host of the active tab, or null for anything that is not a web page. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname || null
  } catch {
    return null
  }
}

const EMPTY_VIEW: PopupView = {
  config: { domains: {}, sites: {}, deployments: {} },
  deployment: null,
  host: null,
  url: '',
  title: undefined,
  target: { kind: 'unconfigured' },
}

/** Everything the popup shows, resolved from one config and one URL. */
function viewFor(
  config: DeploymentWindowsConfig,
  url: string,
  title: string | undefined,
): PopupView {
  const dw = new DW(config, url)
  const deployment = dw.getDeploymentInfo()
  return {
    config,
    deployment,
    host: hostOf(url),
    url,
    title,
    target: targetFor(config, dw.getDomainKey(), deployment),
  }
}

/**
 * Resolve the active tab against the stored config, once, on mount.
 *
 * `replace` re-resolves against a config the popup has just written, so an edit
 * is reflected without a round trip back to storage.
 */
function usePopupView(): {
  loaded: boolean
  view: PopupView
  replace: (config: DeploymentWindowsConfig) => void
} {
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<PopupView>(EMPTY_VIEW)

  useEffect(() => {
    let active = true

    void (async () => {
      let next = EMPTY_VIEW
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true,
        })
        const url = tab?.url ?? ''
        next = viewFor(await Config.load(), url, tab?.title)
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

  const replace = (config: DeploymentWindowsConfig) => {
    setView((current) => viewFor(config, current.url, current.title))
  }

  return { loaded, view, replace }
}

/**
 * Recomputed rather than read off the resolved deployment: `canDeploy` was
 * decided when the popup opened, and the popup outlives the moment it asked.
 */
function toneFor(deployment: ResolvedDeployment): StatusTone {
  if (deployment.notesOnly) {
    return 'notes'
  }
  return DW.canDeploy(deployment.timeObj.local) ? 'open' : 'closed'
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

/**
 * Drops to an icon once there is a primary action beside it.
 *
 * Three labelled buttons do not fit across 340px - they wrap, and a wrapped
 * footer reads as a mistake. Settings is the one that gives up its label,
 * because it is the only one of the three that is also reachable from Chrome's
 * own extension menu.
 */
function SettingsButton({ compact }: { compact: boolean }) {
  const open = () => {
    try {
      chrome.runtime.openOptionsPage()
    } catch {
      // Nothing to fall back to, and nothing worth interrupting the popup for.
    }
  }

  const label = Methods.i18n('l10nOpenSettings')

  return (
    <button
      type="button"
      className={`dw-popup-button${compact ? ' dw-popup-button-icon' : ''}`}
      onClick={open}
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
    >
      <SettingsIcon size={15} />
      {!compact && label}
    </button>
  )
}

function Window({ deployment }: { deployment: ResolvedDeployment }) {
  const { original, local } = deployment.timeObj
  // The converted window is only worth the space when it actually differs.
  const showLocal = original.timezone !== local.timezone
  const originalDays = daysLabel(original.days)
  const localDays = daysLabel(local.days)

  return (
    <dl className="dw-popup-rows">
      <div className="dw-popup-row">
        <dt>
          <ClockIcon size={14} />
          {Methods.i18n('l10nDeploymentWindow')}
        </dt>
        <dd>
          {originalDays && <span className="dw-days">{originalDays}</span>}
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
            {localDays && <span className="dw-days">{localDays}</span>}
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

/**
 * The rendered notes.
 *
 * Its own component so the markdown renderer loading does not re-render the
 * status and the countdown around it.
 */
function Notes({ text }: { text: string }) {
  const html = useMarkdown(text)

  if (html === null) {
    return null
  }
  return <div className="dw-prose" dangerouslySetInnerHTML={{ __html: html }} />
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
        {!deployment.notesOnly && (
          <Countdown window={deployment.timeObj.local} />
        )}
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
            <Notes text={notes} />
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

/** The message shown when nothing was matched, which depends on why. */
function missingHintFor(target: PopupTarget): string {
  if (target.kind === 'no-anchor') {
    return Methods.i18n('l10nNoAnchorHint')
  }
  if (target.kind === 'add') {
    return Methods.i18n('l10nAddHereHint')
  }
  return Methods.i18n('l10nNoInformationHint')
}

/**
 * The button that opens the editor: edit what matched, or start what did not.
 *
 * Absent for a URL that matches no configured site. There is nothing sensible
 * to attach a deployment to in that case, and the settings button beside it is
 * already the way to set one up.
 */
function EditButton({
  target,
  onClick,
}: {
  target: PopupTarget
  onClick: () => void
}) {
  if (target.kind === 'unconfigured' || target.kind === 'no-anchor') {
    return null
  }

  const adding = target.kind === 'add'

  return (
    <button type="button" className="dw-popup-button" onClick={onClick}>
      {adding ? <PlusIcon size={15} /> : <PencilIcon size={15} />}
      {Methods.i18n(adding ? 'l10nAddDeployment' : 'l10nEdit')}
    </button>
  )
}

/**
 * The browser action popup. Resolves the active tab's URL against the config
 * and shows the same information the in-page notice does.
 *
 * It also writes: what is on screen is the entry for the page you are looking
 * at, so the shortest route to correcting it is here rather than on the options
 * page, where you would have to find it again first.
 */
export function Popup() {
  const { loaded, view, replace } = usePopupView()
  const [editing, setEditing] = useState(false)
  // Keeps the status and the countdown honest for as long as the popup is up.
  useNow()
  // The status tints the whole panel, so it lives on the outermost element.
  const tone = view.deployment ? toneFor(view.deployment) : undefined

  const editable =
    view.target.kind === 'edit' || view.target.kind === 'add'
      ? {
          kind: view.target.kind,
          domainKey: view.target.domainKey,
          deploymentKey:
            view.target.kind === 'edit' ? view.target.deploymentKey : null,
        }
      : null

  if (loaded && editing && editable) {
    return (
      <div className="dw-popup" data-status={tone}>
        <DeploymentEditor
          config={view.config}
          target={editable}
          url={view.url}
          title={view.title}
          onCancel={() => setEditing(false)}
          onSaved={(config) => {
            replace(config)
            setEditing(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="dw-popup" data-status={tone}>
      {!loaded && <Message title={Methods.i18n('l10nLoading')} />}
      {loaded && view.deployment && (
        <Deployment deployment={view.deployment} host={view.host} />
      )}
      {loaded && !view.deployment && (
        <Message
          title={Methods.i18n('l10nNoInformation')}
          hint={missingHintFor(view.target)}
          host={view.host}
        />
      )}
      <footer className="dw-popup-foot">
        {loaded && (
          <EditButton target={view.target} onClick={() => setEditing(true)} />
        )}
        <SettingsButton compact={editable !== null} />
        <ThemeButton />
      </footer>
    </div>
  )
}

export default Popup
