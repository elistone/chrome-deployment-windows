import { Methods } from '../../../app/components/Methods'

export type StatusTone = 'open' | 'closed' | 'notes' | 'unset'

const LABEL_KEYS: Record<StatusTone, string> = {
  open: 'l10nDeploymentOpen',
  closed: 'l10nDeploymentClosed',
  notes: 'l10nNotesOnly',
  unset: 'l10nNoWindowSet',
}

/** The one-glance answer to "can I deploy right now". */
export function StatusPill({ tone }: { tone: StatusTone }) {
  return (
    <span className={`dw-pill dw-pill-${tone}`}>
      <span className="dw-pill-dot" aria-hidden="true" />
      {Methods.i18n(LABEL_KEYS[tone])}
    </span>
  )
}

export default StatusPill
