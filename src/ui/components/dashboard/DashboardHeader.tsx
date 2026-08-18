import { Methods } from '../../../app/components/Methods'
import type { ThemeChoice } from '../../theme'
import Toggle from '../common/Toggle'
import { BookIcon } from '../common/Icons'
import ThemeSwitch from './ThemeSwitch'

interface DashboardHeaderProps {
  editing: boolean
  onEditingChange: (editing: boolean) => void
  theme: ThemeChoice
  onThemeChange: (theme: ThemeChoice) => void
  onOpenHowTo: () => void
}

export function DashboardHeader({
  editing,
  onEditingChange,
  theme,
  onThemeChange,
  onOpenHowTo,
}: DashboardHeaderProps) {
  return (
    <header className="dw-header">
      <div className="dw-header-inner">
        <div className="dw-header-identity">
          <h1 className="dw-header-title">
            {Methods.i18n('l10nDeploymentWindowsConfig')}
          </h1>
          <p className="dw-header-subtitle">
            {Methods.i18n('l10nOptionsSubtitle')}
          </p>
        </div>

        <div className="dw-header-tools">
          <button
            type="button"
            className="dw-button dw-button-ghost"
            onClick={onOpenHowTo}
          >
            <BookIcon size={15} />
            {Methods.i18n('l10nHowToUse')}
          </button>

          <ThemeSwitch choice={theme} onChange={onThemeChange} />

          <span className="dw-header-divider" aria-hidden="true" />

          <Toggle
            checked={editing}
            onChange={onEditingChange}
            label={Methods.i18n('l10nEditMode')}
            compact
          />
        </div>
      </div>
    </header>
  )
}

export default DashboardHeader
