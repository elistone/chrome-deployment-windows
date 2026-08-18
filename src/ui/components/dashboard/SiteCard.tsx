import { Methods } from '../../../app/components/Methods'
import { TextFormatter } from '../../../app/components/TextFormatter'
import type { SiteConfig } from '../../../app/config/types'
import ConfirmDelete from '../common/ConfirmDelete'
import { GlobeIcon, PencilIcon } from '../common/Icons'

interface SiteCardProps {
  configKey: string
  patterns: string[]
  site: SiteConfig | undefined
  /** How many deployments reference this site, shown so deleting is informed. */
  usedBy: number
  editing: boolean
  onEdit: () => void
  onDelete: () => void
}

export function SiteCard({
  configKey,
  patterns,
  site,
  usedBy,
  editing,
  onEdit,
  onDelete,
}: SiteCardProps) {
  const classes = site?.classes
  const styling: [string, string | undefined][] = [
    ['l10nClassDeploy', classes?.deploy],
    ['l10nClassNoDeploy', classes?.['no-deploy']],
    ['l10nClassNotes', classes?.notes],
  ]

  return (
    <article className="dw-card">
      <header className="dw-card-head">
        <div className="dw-card-heading">
          <h3 className="dw-card-title">
            <GlobeIcon size={16} />
            {TextFormatter.stripTags(configKey)}
          </h3>
          <span className="dw-card-key">
            {usedBy}{' '}
            {Methods.i18n(
              usedBy === 1 ? 'l10nDeploymentOne' : 'l10nDeploymentMany',
            )}
          </span>
        </div>
      </header>

      {!site ? (
        <p className="dw-card-warning">
          {Methods.i18n('l10nNoDomainInformationSet')}
        </p>
      ) : (
        <>
          <section className="dw-card-section">
            <h4 className="dw-card-section-title">
              {Methods.i18n('l10nUrlPatterns')}
            </h4>
            <ul className="dw-list">
              {patterns.map((pattern, index) => (
                <li key={index} className="dw-mono">
                  {TextFormatter.stripTags(pattern)}
                </li>
              ))}
            </ul>
          </section>

          <section className="dw-card-section">
            <h4 className="dw-card-section-title">
              {Methods.i18n('l10nInsertElements')}
            </h4>
            <ul className="dw-list">
              {(site.insert ?? []).map((entry, index) => (
                <li key={index}>
                  <span className="dw-tag">
                    {Methods.i18n(
                      entry.position === 'before'
                        ? 'l10nPositionBefore'
                        : 'l10nPositionAfter',
                    )}
                  </span>
                  <span className="dw-mono">
                    .{TextFormatter.stripTags(entry.class)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="dw-card-section">
            <h4 className="dw-card-section-title">
              {Methods.i18n('l10nCustomClasses')}
            </h4>
            <ul className="dw-list">
              {styling.map(([labelKey, value]) =>
                value ? (
                  <li key={labelKey}>
                    <span className="dw-tag">{Methods.i18n(labelKey)}</span>
                    <span className="dw-mono">
                      {TextFormatter.stripTags(value)}
                    </span>
                  </li>
                ) : null,
              )}
            </ul>
          </section>
        </>
      )}

      {editing && (
        <footer className="dw-card-actions">
          <button
            type="button"
            className="dw-button dw-button-ghost"
            onClick={onEdit}
          >
            <PencilIcon size={14} />
            {Methods.i18n('l10nEdit')}
          </button>
          <ConfirmDelete onConfirm={onDelete} label={configKey} />
        </footer>
      )}
    </article>
  )
}

export default SiteCard
