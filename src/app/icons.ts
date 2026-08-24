/**
 * The toolbar icon: which artwork exists, at which sizes, and where it lives in
 * the build.
 *
 * Shared by the manifest (the installed-extension icon), the service worker
 * (the per-tab status icon) and the content script that asks for a change, so
 * there is one place that knows a path. scripts/icons.js renders the PNGs and
 * keeps its own copy of the sizes - tests/icons.test.ts holds the two together.
 */

/** One directory of artwork per state. `default` is the resting icon. */
export const ICON_STATES = ['default', 'success', 'error'] as const

export type IconState = (typeof ICON_STATES)[number]

/**
 * Every size Chrome asks for: 16 and 32 for the toolbar at 1x and 2x, 48 for
 * the extensions page, 128 for the store listing and the install dialog.
 * Handing over all four is what stops Chrome downscaling one of them itself.
 */
export const ICON_SIZES = [16, 32, 48, 128] as const

/** Runtime paths, keyed by size, as chrome.action.setIcon wants them. */
export function iconPaths(state: IconState): Record<number, string> {
  const paths: Record<number, string> = {}
  for (const size of ICON_SIZES) {
    paths[size] = `icons/${state}/icon${size}.png`
  }
  return paths
}

export function isIconState(value: unknown): value is IconState {
  return (
    typeof value === 'string' &&
    (ICON_STATES as readonly string[]).includes(value)
  )
}
