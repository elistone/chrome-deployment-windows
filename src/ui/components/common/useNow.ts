import { useEffect, useState } from 'react'

/**
 * A minute is the resolution anything here is shown at, so a quarter of one is
 * close enough to never look wrong and cheap enough not to think about.
 */
const TICK_MS = 15_000

/**
 * Re-render on a timer, so anything derived from "now" stays true.
 *
 * The status pill and the countdown are both computed at render time, which
 * quietly assumed a render would happen. The options page can sit open all
 * afternoon, and a panel still insisting the window closes in ten minutes an
 * hour after it shut is worse than one that never claimed to know.
 */
export function useNow(intervalMs: number = TICK_MS): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}

export default useNow
