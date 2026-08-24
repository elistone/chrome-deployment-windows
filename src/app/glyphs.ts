/**
 * The three status marks, as geometry.
 *
 * These are the shapes on the toolbar icons: a ring for the extension itself, a
 * chevron up while the window is open, a bar while it is shut. They are shared
 * so the same mark appears everywhere the extension says something about a
 * window - the toolbar, the in-page notice, the popup and the options page -
 * rather than each surface inventing its own dot. Seeing the chevron in the
 * toolbar and the chevron in the notice is what makes the toolbar legible
 * without being explained.
 *
 * Drawn on the icons' own 128 grid rather than the 24 the interface icons use,
 * so nothing has to be redrawn or re-weighted to scale between them. The stroke
 * widths travel with the paths for the same reason: a bar and a ring need
 * different weights to look like the same weight.
 *
 * scripts/icons.js carries the same paths, because it has to run as plain
 * JavaScript outside the bundle. tests/icons.test.ts holds the two together.
 */

export type GlyphName = 'open' | 'closed' | 'neutral'

export interface Glyph {
  /** A single stroked path on a 0 0 128 128 viewBox. */
  d: string
  /** Stroke width on that same grid. */
  width: number
}

export const GLYPHS: Record<GlyphName, Glyph> = {
  // Ship it.
  open: { d: 'M40 76 64 48 88 76', width: 14 },
  // The universal "not through here".
  closed: { d: 'M38 64H90', width: 14 },
  // An aperture: a window, and the extension's own mark. Written as arcs
  // rather than a <circle> so every glyph is one path and one attribute.
  neutral: { d: 'M64 37a27 27 0 1 0 0 54 27 27 0 1 0 0-54', width: 13 },
}

export const GLYPH_VIEWBOX = '0 0 128 128'

/** The mark for a status: anything that is not open or closed is neutral. */
export function glyphFor(tone: string): GlyphName {
  if (tone === 'open' || tone === 'closed') {
    return tone
  }
  return 'neutral'
}
