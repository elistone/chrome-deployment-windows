/**
 * CSS lengths, and only CSS lengths.
 *
 * These end up on the notice as inline custom properties. A browser would
 * discard anything malformed rather than act on it, but a config is also
 * something people read and copy between machines, so a typo is worth naming
 * where it was made instead of silently doing nothing.
 *
 * Kept out of schema.ts so the content script can check a spacing value
 * without dragging the whole config validator onto every page it visits. The
 * notice needs this one function; it has no use for the rest of it.
 */
const CSS_LENGTH = /^(auto|0|[+-]?(\d+\.?\d*|\.\d+)(px|em|rem|%|vh|vw|ch|pt))$/

export function isCssSpacing(value: string): boolean {
  const parts = value.trim().split(/\s+/)
  if (parts.length === 0 || parts.length > 4) {
    return false
  }
  return parts.every((part) => CSS_LENGTH.test(part))
}
