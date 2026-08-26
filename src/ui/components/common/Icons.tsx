import type { SVGProps } from 'react'

import { GLYPHS, GLYPH_VIEWBOX, type GlyphName } from '../../../app/glyphs'

/**
 * Inline icons.
 *
 * Drawn here rather than pulled from an icon package: the extension pages are
 * bundled and offline, a dependency would ship hundreds of unused glyphs, and
 * `currentColor` means every icon themes itself for free.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

/**
 * The status mark: the toolbar icon for that state, drawn rather than loaded.
 *
 * The whole icon, not just its glyph. A bare stroke at this size reads as
 * punctuation - the closed bar in particular came out as an en dash sitting in
 * front of the label - where the disc is unmistakably the thing in the toolbar.
 * The disc takes `currentColor`, so a pill, a stat and the page header each
 * tint it from whatever they already are, and the same component doubles as the
 * extension's own mark: that is only the neutral one in accent.
 *
 * Drawn from the shared geometry on the icons' own 128 grid rather than the 24
 * the interface icons use, so the chevron in the toolbar and the chevron in a
 * pill are the same chevron. That is the point of it: it is what lets the
 * toolbar be read without being explained.
 */
export function StatusMark({
  name,
  size = 15,
  ...props
}: IconProps & { name: GlyphName }) {
  const glyph = GLYPHS[name]

  return (
    <svg
      width={size}
      height={size}
      viewBox={GLYPH_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="64" cy="64" r="60" fill="currentColor" />
      <path
        d={glyph.d}
        fill="none"
        stroke="#fff"
        strokeWidth={glyph.width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export const SunIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
)

export const MoonIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </Icon>
)

export const SystemIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Icon>
)

export const BookIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
  </Icon>
)

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const PencilIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Icon>
)

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
  </Icon>
)

/** An arrow curving back on itself: undoing a change rather than reversing it. */
export const UndoIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 10h11a5 5 0 0 1 0 10h-5" />
    <path d="m8.5 5.5-4.5 4.5 4.5 4.5" />
  </Icon>
)

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Icon>
)

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3v12M7 11l5 5 5-5M4 21h16" />
  </Icon>
)

export const UploadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 17V5M7 9l5-5 5 5M4 21h16" />
  </Icon>
)

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
)

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
)

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m4 12 5 5L20 6" />
  </Icon>
)

export const ChevronIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

export const ClockIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)

export const NoteIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 3h9l5 5v13H5z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
)

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Icon>
)
