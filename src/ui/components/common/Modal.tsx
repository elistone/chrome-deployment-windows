import { useEffect, useId, useRef, type ReactNode } from 'react'

import { Methods } from '../../../app/components/Methods'
import { CloseIcon } from './Icons'

interface ModalProps {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Wider layout for content-heavy panels such as the how-to document. */
  size?: 'default' | 'wide'
}

/**
 * A hand-rolled dialog rather than <dialog>.
 *
 * showModal() gives a top-layer backdrop that cannot be themed with the page's
 * custom properties in every engine, and its close behaviour is awkward to
 * drive from React state. This keeps escape-to-close, backdrop-to-close,
 * scroll locking and focus restoration explicit and testable.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  size = 'default',
}: ModalProps) {
  const titleId = useId()
  const descriptionId = `${titleId}-description`
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the first control so keyboard users land inside the dialog rather
    // than continuing from wherever the page was.
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
    )
    focusable?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      opener?.focus?.()
    }
  }, [onClose])

  return (
    <div
      className="dw-modal-backdrop"
      // A click that starts inside the panel and ends outside should not close
      // it, so only a press that lands on the backdrop itself counts.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`dw-modal dw-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        ref={panelRef}
      >
        <header className="dw-modal-head">
          <div>
            <h2 className="dw-modal-title" id={titleId}>
              {title}
            </h2>
            {description && (
              <p className="dw-modal-description" id={descriptionId}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="dw-icon-button"
            onClick={onClose}
            aria-label={Methods.i18n('l10nClose')}
          >
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="dw-modal-body">{children}</div>

        {footer && <footer className="dw-modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export default Modal
