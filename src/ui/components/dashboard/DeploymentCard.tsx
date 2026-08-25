import { DW } from '../../../app/components/DW'
import { daysLabel } from '../../../app/components/dayLabels'
import { Methods } from '../../../app/components/Methods'
import { TextFormatter } from '../../../app/components/TextFormatter'
import type { DeploymentConfig } from '../../../app/config/types'
import ConfirmDelete from '../common/ConfirmDelete'
import Countdown from '../common/Countdown'
import StatusPill, { type StatusTone } from '../common/StatusPill'
import { ClockIcon, CopyIcon, NoteIcon, PencilIcon } from '../common/Icons'
import { useMarkdown } from '../common/useMarkdown'
import { useNow } from '../common/useNow'

interface DeploymentCardProps {
  configKey: string
  deployment: DeploymentConfig
  /** Every configured site key, so missing fragments can be shown as gaps. */
  domainKeys: string[]
  /** True while this entry is still exactly what the shared config says. */
  shared?: boolean
  editing: boolean
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

/** What the pill should say for this entry, right now. */
export function statusFor(deployment: DeploymentConfig): StatusTone {
  if (deployment['notes-only'] === true) {
    return 'notes'
  }
  if (!deployment.time) {
    // Resolves to 00:00-00:00, which reads as closed for all but one minute of
    // the day. Saying so is more use than showing a permanent red "closed".
    return 'unset'
  }
  const { local } = DW.buildTimes(deployment)
  return DW.canDeploy(local) ? 'open' : 'closed'
}

/**
 * The sites this deployment is configured for, then the ones it is not.
 *
 * Config order put the gaps first as often as not, which pushed the fragments
 * that actually matter to the end of the row - and gets worse the more sites
 * are configured.
 */
function orderedFragments(
  deployment: DeploymentConfig,
  domainKeys: string[],
): { domainKey: string; fragment: string }[] {
  const entries = domainKeys.map((domainKey) => {
    const value = deployment[domainKey]
    return {
      domainKey,
      fragment: typeof value === 'string' ? value : '',
    }
  })

  return [
    ...entries.filter((entry) => entry.fragment),
    ...entries.filter((entry) => !entry.fragment),
  ]
}

export function DeploymentCard({
  configKey,
  deployment,
  domainKeys,
  shared = false,
  editing,
  onEdit,
  onDuplicate,
  onDelete,
}: DeploymentCardProps) {
  // The status and the countdown are both worked out from the clock, so the
  // card has to keep redrawing for either to stay true.
  useNow()
  const tone = statusFor(deployment)
  const name =
    typeof deployment.name === 'string' && deployment.name
      ? deployment.name
      : configKey
  const notes = typeof deployment.notes === 'string' ? deployment.notes : ''
  const notesHtml = useMarkdown(notes)
  const times = deployment.time ? DW.buildTimes(deployment) : null
  // The converted window is only worth the space when it actually differs.
  const showLocal =
    times !== null && times.original.timezone !== times.local.timezone

  return (
    <article className="dw-card" data-status={tone}>
      <header className="dw-card-head">
        <div className="dw-card-heading">
          <h3 className="dw-card-title">{TextFormatter.toPlainText(name)}</h3>
          <div className="dw-card-meta">
            <code className="dw-card-key">{configKey}</code>
            {shared && (
              <span className="dw-badge" title={Methods.i18n('l10nSharedHint')}>
                {Methods.i18n('l10nShared')}
              </span>
            )}
          </div>
        </div>
        <div className="dw-card-status">
          <StatusPill tone={tone} />
          {times && tone !== 'notes' && tone !== 'unset' && (
            <Countdown window={times.local} />
          )}
        </div>
      </header>

      {times && (
        <dl className="dw-card-rows">
          <div className="dw-card-row">
            {/* The clock carries the meaning; spelling out "Deployment window"
                as well pushes the times onto a second line in a narrow card. */}
            <dt>
              <ClockIcon size={14} />
              <span className="dw-visually-hidden">
                {Methods.i18n('l10nDeploymentWindow')}
              </span>
            </dt>
            <dd>
              {daysLabel(times.original.days) && (
                <span className="dw-days">
                  {daysLabel(times.original.days)}
                </span>
              )}
              <span className="dw-mono">
                {times.original.start} &ndash; {times.original.end}
              </span>
              <span className="dw-card-zone">{times.original.timezone}</span>
            </dd>
          </div>
          {showLocal && (
            <div className="dw-card-row dw-card-row-subtle">
              <dt>{Methods.i18n('l10nYourTimezone')}</dt>
              <dd>
                {daysLabel(times.local.days) && (
                  <span className="dw-days">{daysLabel(times.local.days)}</span>
                )}
                <span className="dw-mono">
                  {times.local.start} &ndash; {times.local.end}
                </span>
                <span className="dw-card-zone">{times.local.timezone}</span>
              </dd>
            </div>
          )}
        </dl>
      )}

      {tone === 'unset' && (
        <p className="dw-card-warning">{Methods.i18n('l10nNoWindowSetHint')}</p>
      )}

      <ul className="dw-chips">
        {orderedFragments(deployment, domainKeys).map(
          ({ domainKey, fragment }) => (
            <li
              key={domainKey}
              className={`dw-chip${fragment ? '' : ' dw-chip-empty'}`}
            >
              <span className="dw-chip-key">{domainKey}</span>
              <span className="dw-chip-value">
                {fragment
                  ? TextFormatter.toPlainText(fragment)
                  : Methods.i18n('l10nNotConfigured')}
              </span>
            </li>
          ),
        )}
        {deployment['case-sensitive'] === true && (
          <li className="dw-chip dw-chip-flag">
            {Methods.i18n('l10nCaseSensitive')}
          </li>
        )}
      </ul>

      {notes && notesHtml !== null && (
        <div className="dw-card-notes">
          <h4 className="dw-card-notes-title">
            <NoteIcon size={14} />
            {Methods.i18n('l10nNotes')}
          </h4>
          <div
            className="dw-prose"
            dangerouslySetInnerHTML={{ __html: notesHtml }}
          />
        </div>
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
          <button
            type="button"
            className="dw-button dw-button-ghost"
            onClick={onDuplicate}
          >
            <CopyIcon size={14} />
            {Methods.i18n('l10nDuplicate')}
          </button>
          <ConfirmDelete onConfirm={onDelete} label={name} />
        </footer>
      )}
    </article>
  )
}

export default DeploymentCard
