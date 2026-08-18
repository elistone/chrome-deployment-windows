import type { ThemeChoice } from '../../theme'
import { MoonIcon, SunIcon, SystemIcon } from './Icons'

/**
 * The label and glyph for each theme choice.
 *
 * Shared so the dashboard's three-way switch and the popup's single cycling
 * button always name and draw a choice the same way.
 */
export const THEME_META: Record<
  ThemeChoice,
  { labelKey: string; Icon: typeof SunIcon }
> = {
  light: { labelKey: 'l10nThemeLight', Icon: SunIcon },
  dark: { labelKey: 'l10nThemeDark', Icon: MoonIcon },
  system: { labelKey: 'l10nThemeSystem', Icon: SystemIcon },
}
