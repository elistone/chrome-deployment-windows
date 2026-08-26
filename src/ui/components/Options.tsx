import { useCallback, useEffect, useMemo, useState } from 'react'

import { Methods } from '../../app/components/Methods'
import {
  activeFreeze,
  toFreezes,
  todayIn,
} from '../../app/components/freezes'
import { Timezones } from '../../app/components/Timezones'
import { Config, defaultConfig } from '../../app/config/Config'
import {
  emptyConfig,
  readHidden,
  splitLocal,
  visibleRemote,
} from '../../app/config/remote'
import type {
  DeploymentConfig,
  DeploymentWindowsConfig,
  SiteConfig,
} from '../../app/config/types'
import { useTheme } from '../theme'
import { HowToUseDialog } from './HowToUse'
import Toaster, { useToasts } from './common/Toaster'
import { PlusIcon, SearchIcon, StatusMark } from './common/Icons'
import DashboardHeader from './dashboard/DashboardHeader'
import DeploymentCard, { statusFor } from './dashboard/DeploymentCard'
import DeploymentForm from './dashboard/DeploymentForm'
import FreezeForm from './dashboard/FreezeForm'
import JsonPanel from './dashboard/JsonPanel'
import SiteCard from './dashboard/SiteCard'
import SharedConfigPanel from './dashboard/SharedConfigPanel'
import SiteForm from './dashboard/SiteForm'
import {
  deploymentsUsingSite,
  emptyDeploymentDraft,
  emptySiteDraft,
  removeDeployment,
  removeSite,
  toDeploymentDraft,
  toSiteDraft,
  upsertDeployment,
  upsertSite,
  type DeploymentDraft,
  type SiteDraft,
} from './dashboard/drafts'
import { matchesFilter, uniqueKey, useTick } from './dashboard/support'

type Dialog =
  | { kind: 'deployment'; originalKey: string | null; draft: DeploymentDraft }
  | { kind: 'site'; originalKey: string | null; draft: SiteDraft }
  | { kind: 'freezes' }

/**
 * The options page.
 *
 * Previously four tabs over one config, with editing available only as raw
 * JSON. It is now a single dashboard: everything configured is visible at once
 * with its live status, and an edit-mode switch reveals the controls rather
 * than moving you to a different screen. The JSON editor is still there, at the
 * bottom, as an import/export tool.
 */
export function Options() {
  const [config, setConfig] = useState<DeploymentWindowsConfig>(defaultConfig)
  // The shared layer on its own, so a card can say where it came from.
  const [remote, setRemote] = useState<DeploymentWindowsConfig>(emptyConfig)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [filter, setFilter] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [howToOpen, setHowToOpen] = useState(false)

  const theme = useTheme()
  const toasts = useToasts()
  // Statuses are time-dependent, so the page has to re-render on its own.
  const tick = useTick()

  /** Read both layers. Also used after the shared one is pointed elsewhere. */
  const reload = useCallback(async () => {
    try {
      const [stored, shared, hidden] = await Promise.all([
        Config.load(),
        Config.loadRemote(),
        readHidden(),
      ])
      setConfig(stored)
      setRemote(visibleRemote(shared, hidden))
    } catch {
      // Storage being unavailable is not a reason to show a broken page; the
      // in-memory default renders and the next save will surface the error.
    }
  }, [])

  useEffect(() => {
    let active = true
    void reload().finally(() => {
      if (active) {
        setLoaded(true)
      }
    })
    return () => {
      active = false
    }
  }, [reload])

  /**
   * Which keys are showing exactly what the shared config says.
   *
   * Anything the local layer holds has been changed here and is no longer
   * following the file, so the same split that decides what gets stored decides
   * what gets the badge - there is no second rule to keep in step.
   */
  const shared = useMemo(() => {
    const { local } = splitLocal(config, remote)
    return {
      deployments: new Set(
        Object.keys(config.deployments).filter(
          (key) => !(key in local.deployments),
        ),
      ),
      sites: new Set(
        Object.keys(config.domains).filter(
          (key) => !(key in local.domains) && !(key in local.sites),
        ),
      ),
    }
  }, [config, remote])

  /**
   * Entries the shared config has, which have since been changed here.
   *
   * The other half of the same split: `shared` is what is still following the
   * file, this is what has stopped. Anything in neither set is simply local.
   */
  const overridden = useMemo(
    () => ({
      deployments: new Set(
        Object.keys(remote.deployments).filter(
          (key) => key in config.deployments && !shared.deployments.has(key),
        ),
      ),
      sites: new Set(
        Object.keys(remote.domains).filter(
          (key) => key in config.domains && !shared.sites.has(key),
        ),
      ),
    }),
    [config, remote, shared],
  )

  /** Put the shared version back, which drops the local copy on save. */
  const revertDeployment = (key: string) => {
    void persist(
      upsertDeployment(config, key, key, remote.deployments[key]),
      Methods.i18n('l10nReverted'),
    )
  }

  const revertSite = (key: string) => {
    void persist(
      upsertSite(
        config,
        key,
        key,
        remote.domains[key] ?? [],
        remote.sites[key],
      ),
      Methods.i18n('l10nReverted'),
    )
  }

  const domainKeys = useMemo(() => Object.keys(config.domains), [config.domains])
  const deploymentKeys = useMemo(
    () => Object.keys(config.deployments),
    [config.deployments],
  )

  /** Freezes that apply to everything, read from the merged config. */
  const globalFreezes = useMemo(() => toFreezes(config.freezes), [config.freezes])
  // The list is a summary rather than a per-project answer, so "on now" is
  // read against the viewer's own calendar. Each deployment still decides for
  // itself, against the timezone its window is written in.
  const localZone = Timezones.findLocalTimezone()

  const openCount = useMemo(
    () =>
      Object.values(config.deployments).filter(
        (deployment) => statusFor(deployment, globalFreezes) === 'open',
      ).length,
    // Recomputed on every tick as well, since the answer changes with the clock.
    [config.deployments, globalFreezes, tick],
  )

  const visibleDeployments = deploymentKeys.filter((key) => {
    const deployment = config.deployments[key]
    const fragments = domainKeys
      .map((domainKey) => deployment[domainKey])
      .filter((value): value is string => typeof value === 'string')
    return matchesFilter(
      filter,
      key,
      typeof deployment.name === 'string' ? deployment.name : '',
      ...fragments,
    )
  })

  const visibleSites = domainKeys.filter((key) =>
    matchesFilter(filter, key, ...(config.domains[key] ?? [])),
  )

  /**
   * Save, then report. Every mutation goes through here so the undo affordance
   * and the failure message are the same wherever the change came from.
   */
  const persist = async (
    next: DeploymentWindowsConfig,
    message: string,
    undoable = true,
  ): Promise<boolean> => {
    const previous = config
    try {
      await Config.save(next)
      setConfig(next)
      toasts.push({
        message,
        tone: 'success',
        action: undoable
          ? {
              label: Methods.i18n('l10nUndo'),
              run: () => {
                void persist(previous, Methods.i18n('l10nRestored'), false)
              },
            }
          : undefined,
      })
      return true
    } catch {
      toasts.push({ message: Methods.i18n('l10nSaveFailed'), tone: 'danger' })
      return false
    }
  }

  const openDeployment = (key: string | null) => {
    setDialog({
      kind: 'deployment',
      originalKey: key,
      draft:
        key === null
          ? emptyDeploymentDraft(domainKeys)
          : toDeploymentDraft(key, config.deployments[key], domainKeys),
    })
  }

  const duplicateDeployment = (key: string) => {
    const draft = toDeploymentDraft(key, config.deployments[key], domainKeys)
    setDialog({
      kind: 'deployment',
      // Opened as a new entry, so nothing is written until it is reviewed.
      originalKey: null,
      draft: {
        ...draft,
        key: uniqueKey(draft.key, deploymentKeys),
        name: `${draft.name} ${Methods.i18n('l10nCopySuffix')}`.trim(),
      },
    })
  }

  const openSite = (key: string | null) => {
    setDialog({
      kind: 'site',
      originalKey: key,
      draft:
        key === null
          ? emptySiteDraft()
          : toSiteDraft(key, config.domains[key] ?? [], config.sites[key]),
    })
  }

  const saveDeployment = (key: string, deployment: DeploymentConfig) => {
    const originalKey =
      dialog?.kind === 'deployment' ? dialog.originalKey : null
    setDialog(null)
    void persist(
      upsertDeployment(config, originalKey, key, deployment),
      Methods.i18n(originalKey === null ? 'l10nAdded' : 'l10nSaved'),
    )
  }

  const saveSite = (key: string, patterns: string[], site: SiteConfig) => {
    const originalKey = dialog?.kind === 'site' ? dialog.originalKey : null
    setDialog(null)
    void persist(
      upsertSite(config, originalKey, key, patterns, site),
      Methods.i18n(originalKey === null ? 'l10nAdded' : 'l10nSaved'),
    )
  }

  if (!loaded) {
    return (
      <div className="dw-app dw-app-loading">
        <p className="dw-loading">{Methods.i18n('l10nLoading')}</p>
      </div>
    )
  }

  return (
    <div className="dw-app">
      <DashboardHeader
        editing={editing}
        onEditingChange={setEditing}
        theme={theme.choice}
        onThemeChange={theme.setChoice}
        onOpenHowTo={() => setHowToOpen(true)}
      />

      <main className="dw-main">
        <section className="dw-stats" aria-label={Methods.i18n('l10nOverview')}>
          <div className="dw-stat">
            <span className="dw-stat-value">{deploymentKeys.length}</span>
            <span className="dw-stat-label">
              {Methods.i18n('l10nDeployments')}
            </span>
            <span className="dw-stat-hint">
              {Methods.i18n('l10nDeploymentsStatHint')}
            </span>
          </div>
          <div className="dw-stat dw-stat-open">
            <span className="dw-stat-value">{openCount}</span>
            <span className="dw-stat-label">
              <StatusMark name="open" size={13} />
              {Methods.i18n('l10nOpenNow')}
            </span>
            <span className="dw-stat-hint">
              {Methods.i18n('l10nOpenNowStatHint')}
            </span>
          </div>
          <div className="dw-stat">
            <span className="dw-stat-value">{domainKeys.length}</span>
            <span className="dw-stat-label">{Methods.i18n('l10nSites')}</span>
            <span className="dw-stat-hint">
              {Methods.i18n('l10nSitesStatHint')}
            </span>
          </div>
        </section>

        <div className="dw-toolbar">
          <div className="dw-search">
            <SearchIcon size={16} />
            <input
              type="search"
              className="dw-input dw-search-input"
              value={filter}
              placeholder={Methods.i18n('l10nFilterPlaceholder')}
              aria-label={Methods.i18n('l10nFilter')}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
        </div>

        <section className="dw-section" aria-labelledby="dw-deployments-title">
          <div className="dw-section-head">
            <div className="dw-section-heading">
              <h2 className="dw-section-title" id="dw-deployments-title">
                {Methods.i18n('l10nDeployments')}
              </h2>
              <p className="dw-section-subtitle">
                {Methods.i18n('l10nDeploymentsSubtitle')}
              </p>
            </div>
            {editing && (
              <button
                type="button"
                className="dw-button dw-button-primary"
                onClick={() => openDeployment(null)}
              >
                <PlusIcon size={15} />
                {Methods.i18n('l10nAddDeployment')}
              </button>
            )}
          </div>

          {deploymentKeys.length === 0 ? (
            <div className="dw-empty">
              <p className="dw-empty-title">
                {Methods.i18n('l10nNoDeploymentsYet')}
              </p>
              <p className="dw-empty-hint">
                {Methods.i18n('l10nNoDeploymentsYetHint')}
              </p>
              {!editing && (
                <button
                  type="button"
                  className="dw-button dw-button-primary"
                  onClick={() => {
                    setEditing(true)
                    openDeployment(null)
                  }}
                >
                  <PlusIcon size={15} />
                  {Methods.i18n('l10nAddDeployment')}
                </button>
              )}
            </div>
          ) : visibleDeployments.length === 0 ? (
            <p className="dw-empty-inline">{Methods.i18n('l10nNoMatches')}</p>
          ) : (
            <div className="dw-grid">
              {visibleDeployments.map((key) => (
                <DeploymentCard
                  key={key}
                  configKey={key}
                  deployment={config.deployments[key]}
                  domainKeys={domainKeys}
                  globalFreezes={globalFreezes}
                  shared={shared.deployments.has(key)}
                  onRevert={
                    overridden.deployments.has(key)
                      ? () => revertDeployment(key)
                      : undefined
                  }
                  editing={editing}
                  onEdit={() => openDeployment(key)}
                  onDuplicate={() => duplicateDeployment(key)}
                  onDelete={() =>
                    void persist(
                      removeDeployment(config, key),
                      Methods.i18n('l10nDeleted'),
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="dw-section" aria-labelledby="dw-freezes-title">
          <div className="dw-section-head">
            <div className="dw-section-heading">
              <h2 className="dw-section-title" id="dw-freezes-title">
                {Methods.i18n('l10nGlobalFreezes')}
              </h2>
              <p className="dw-section-subtitle">
                {Methods.i18n('l10nGlobalFreezesSubtitle')}
              </p>
            </div>
            {editing && (
              <button
                type="button"
                className="dw-button dw-button-primary"
                onClick={() => setDialog({ kind: 'freezes' })}
              >
                <PlusIcon size={15} />
                {Methods.i18n('l10nEditFreezes')}
              </button>
            )}
          </div>

          {globalFreezes.length === 0 ? (
            <p className="dw-empty-inline">
              {Methods.i18n('l10nNoFreezesYet')}
            </p>
          ) : (
            <ul className="dw-freeze-list">
              {globalFreezes.map((freeze) => {
                const on = activeFreeze([freeze], todayIn(localZone)) !== null
                return (
                  <li
                    className={`dw-freeze${on ? ' dw-freeze-on' : ''}`}
                    key={`${freeze.from}-${freeze.to}-${freeze.reason ?? ''}`}
                  >
                    <span className="dw-mono dw-freeze-dates">
                      {freeze.from} &ndash; {freeze.to}
                    </span>
                    {freeze.reason && (
                      <span className="dw-freeze-reason">{freeze.reason}</span>
                    )}
                    {on && (
                      <span className="dw-badge dw-badge-warn">
                        {Methods.i18n('l10nFreezeActive')}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="dw-section" aria-labelledby="dw-sites-title">
          <div className="dw-section-head">
            <div className="dw-section-heading">
              <h2 className="dw-section-title" id="dw-sites-title">
                {Methods.i18n('l10nSites')}
              </h2>
              <p className="dw-section-subtitle">
                {Methods.i18n('l10nSitesSubtitle')}
              </p>
            </div>
            {editing && (
              <button
                type="button"
                className="dw-button dw-button-primary"
                onClick={() => openSite(null)}
              >
                <PlusIcon size={15} />
                {Methods.i18n('l10nAddSite')}
              </button>
            )}
          </div>

          {domainKeys.length === 0 ? (
            <div className="dw-empty">
              <p className="dw-empty-title">{Methods.i18n('l10nNoSitesYet')}</p>
              <p className="dw-empty-hint">
                {Methods.i18n('l10nNoSitesYetHint')}
              </p>
            </div>
          ) : visibleSites.length === 0 ? (
            <p className="dw-empty-inline">{Methods.i18n('l10nNoMatches')}</p>
          ) : (
            <div className="dw-grid">
              {visibleSites.map((key) => (
                <SiteCard
                  key={key}
                  configKey={key}
                  patterns={config.domains[key] ?? []}
                  site={config.sites[key]}
                  usedBy={deploymentsUsingSite(config, key)}
                  shared={shared.sites.has(key)}
                  onRevert={
                    overridden.sites.has(key) ? () => revertSite(key) : undefined
                  }
                  editing={editing}
                  onEdit={() => openSite(key)}
                  onDelete={() =>
                    void persist(
                      removeSite(config, key),
                      Methods.i18n('l10nDeleted'),
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* One block rather than two full-width slabs. Neither is a place you
            go on purpose - they are the ways in and out of the config, not part
            of it - so they should not weigh the same as the cards above. */}
        <section className="dw-panels" aria-label={Methods.i18n('l10nConfig')}>
          <SharedConfigPanel onChanged={() => void reload()} />

          <JsonPanel
            config={config}
            theme={theme.resolved}
            onApply={(next) => persist(next, Methods.i18n('l10nSaved'))}
          />
        </section>
      </main>

      {dialog?.kind === 'deployment' && (
        <DeploymentForm
          originalKey={dialog.originalKey}
          initial={dialog.draft}
          domainKeys={domainKeys}
          takenKeys={deploymentKeys.filter((key) => key !== dialog.originalKey)}
          onSubmit={saveDeployment}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === 'site' && (
        <SiteForm
          originalKey={dialog.originalKey}
          initial={dialog.draft}
          takenKeys={domainKeys.filter((key) => key !== dialog.originalKey)}
          onSubmit={saveSite}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === 'freezes' && (
        <FreezeForm
          initial={globalFreezes}
          onSubmit={(freezes) => {
            setDialog(null)
            void persist(
              {
                ...config,
                ...(freezes.length > 0 ? { freezes } : { freezes: [] }),
              },
              Methods.i18n('l10nSaved'),
            )
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {howToOpen && <HowToUseDialog onClose={() => setHowToOpen(false)} />}

      <Toaster {...toasts} />
    </div>
  )
}

export default Options
