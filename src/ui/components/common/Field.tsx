import { useId, type ReactNode } from 'react'

interface FieldProps {
  label: string
  /**
   * Contextual help shown under the control. The config used to be documented
   * only in the how-to page; now that entries are built in the UI the guidance
   * lives next to the control it describes.
   */
  hint?: ReactNode
  error?: string | null
  required?: boolean
  /** Receives the generated id, so the label and control stay associated. */
  children: (props: { id: string; describedBy: string | undefined }) => ReactNode
}

export function Field({
  label,
  hint,
  error,
  required = false,
  children,
}: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined

  return (
    <div className={`dw-field${error ? ' dw-field-invalid' : ''}`}>
      <label className="dw-field-label" htmlFor={id}>
        {label}
        {required && (
          <span className="dw-field-required" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, describedBy })}
      {hint && (
        <p className="dw-field-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="dw-field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default Field
