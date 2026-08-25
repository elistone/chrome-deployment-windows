import { DW } from '../../../app/components/DW'
import type { ResolvedTimeWindow } from '../../../app/config/types'

/**
 * How much longer the window stays as it is.
 *
 * The pill answers "can I deploy"; this answers "for how much longer", which is
 * the one that gets planned around. Renders nothing when the times cannot be
 * read, so callers can drop it in beside the pill unconditionally.
 *
 * It recomputes rather than taking a snapshot, so it needs its parent to be
 * re-rendering - see useNow.
 */
export function Countdown({ window }: { window: ResolvedTimeWindow }) {
  const text = DW.countdownText(window)
  if (!text) {
    return null
  }

  const tone = DW.canDeploy(window) ? 'open' : 'closed'
  return <span className={`dw-countdown dw-countdown-${tone}`}>{text}</span>
}

export default Countdown
