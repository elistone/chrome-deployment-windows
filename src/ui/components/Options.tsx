import { useEffect, useMemo, useState } from 'react'

import { Methods } from '../../app/components/Methods'
import { Config, defaultConfig } from '../../app/config/Config'
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
import JsonPanel from './dashboard/JsonPanel'
import SiteCard from './dashboard/SiteCard'
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
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [filter, setFilter] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [howToOpen, setHowToOpen] = useState(false)

  const theme = useTheme()
  const toasts = useToasts()
  // Statuses are time-dependent, so the page has to re-render on its own.
  const tick = useTick()

  useEffect(() => {
    let active = true
    void Config.load()
      .then((stored) => {
        if (active) {
          setConfig(stored)
        }
      })
      .catch(() => {
        // Storage being unavailable is not a reason to show a broken page; the
        // in-memory default renders and the next save will surface the error.
      })
      .finally(() => {
        if (active) {
          setLoaded(true)
        }
      })
    return () => {
      active = false
    }
  }, [])

  const domainKeys = useMemo(() => Object.keys(config.domains), [config.domains])
  const deploymentKeys = useMemo(
    () => Object.keys(config.deployments),
    [config.deployments],
  )

  const openCount = useMemo(
    () =>
      Object.values(config.deployments).filter(
        (deployment) => statusFor(deployment) === 'open',
      ).length,
    // Recomputed on every tick as well, since the answer changes with the clock.
    [config.deployments, tick],
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

        <JsonPanel
          config={config}
          theme={theme.resolved}
          onApply={(next) =>
            persist(next, Methods.i18n('l10nSaved'))
          }
        />
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

      {howToOpen && <HowToUseDialog onClose={() => setHowToOpen(false)} />}

      <Toaster {...toasts} />
    </div>
  )
}

export default Options
