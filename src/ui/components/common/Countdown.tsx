import { DW } from '../../../app/components/DW'

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
export function Countdown({ start, end }: { start: string; end: string }) {
  const text = DW.countdownText(start, end)
  if (!text) {
    return null
  }

  const tone = DW.canDeploy(start, end) ? 'open' : 'closed'
  return <span className={`dw-countdown dw-countdown-${tone}`}>{text}</span>
}

export default Countdown
