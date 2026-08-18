import { useId, type ReactNode } from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  hint?: ReactNode
  /** Renders as a compact control with no hint block, for toolbars. */
  compact?: boolean
  disabled?: boolean
}

/** A checkbox presented as a switch. Still a real checkbox underneath. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  compact = false,
  disabled = false,
}: ToggleProps) {
  const id = useId()
  const hintId = `${id}-hint`

  return (
    <div className={`dw-toggle-field${compact ? ' dw-toggle-compact' : ''}`}>
      <label className="dw-toggle-row" htmlFor={id}>
        <input
          type="checkbox"
          id={id}
          className="dw-toggle-input"
          checked={checked}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="dw-toggle-track" aria-hidden="true">
          <span className="dw-toggle-thumb" />
        </span>
        <span className="dw-toggle-label">{label}</span>
      </label>
      {hint && (
        <p className="dw-field-hint dw-toggle-hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  )
}

export default Toggle
