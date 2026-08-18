import { Methods } from '../../../app/components/Methods'
import { THEME_CHOICES, type ThemeChoice } from '../../theme'
import { THEME_META } from '../common/themeMeta'

interface ThemeSwitchProps {
  choice: ThemeChoice
  onChange: (choice: ThemeChoice) => void
}

/**
 * Three explicit options rather than a two-state toggle.
 *
 * "System" has to be reachable: a plain light/dark switch means anyone who
 * follows their OS theme loses that the first time they touch the control, with
 * no way back.
 */
export function ThemeSwitch({ choice, onChange }: ThemeSwitchProps) {
  return (
    <div
      className="dw-segmented"
      role="group"
      aria-label={Methods.i18n('l10nTheme')}
    >
      {THEME_CHOICES.map((option) => {
        const { labelKey, Icon } = THEME_META[option]
        const label = Methods.i18n(labelKey)
        return (
          <button
            key={option}
            type="button"
            className="dw-segmented-option"
            aria-pressed={choice === option}
            title={label}
            onClick={() => onChange(option)}
          >
            <Icon size={15} />
            <span className="dw-segmented-label">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default ThemeSwitch
