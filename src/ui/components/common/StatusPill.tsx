import { glyphFor } from '../../../app/glyphs'
import { Methods } from '../../../app/components/Methods'
import { StatusMark } from './Icons'

export type StatusTone = 'open' | 'closed' | 'frozen' | 'notes' | 'unset'

const LABEL_KEYS: Record<StatusTone, string> = {
  open: 'l10nDeploymentOpen',
  closed: 'l10nDeploymentClosed',
  frozen: 'l10nDeploymentFrozen',
  notes: 'l10nNotesOnly',
  unset: 'l10nNoWindowSet',
}

/**
 * The one-glance answer to "can I deploy right now".
 *
 * The mark is the toolbar icon's own glyph rather than a plain dot, so the
 * chevron sitting in the toolbar and the chevron sitting in this pill say the
 * same thing, and neither has to be learned separately.
 */
export function StatusPill({ tone }: { tone: StatusTone }) {
  return (
    <span className={`dw-pill dw-pill-${tone}`}>
      <StatusMark name={glyphFor(tone)} className="dw-pill-mark" />
      {Methods.i18n(LABEL_KEYS[tone])}
    </span>
  )
}

export default StatusPill
