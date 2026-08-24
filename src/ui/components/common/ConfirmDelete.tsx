import { useEffect, useState } from 'react'

import { Methods } from '../../../app/components/Methods'
import { TrashIcon } from './Icons'

interface ConfirmDeleteProps {
  onConfirm: () => void
  /** Names the thing being deleted, for the accessible label. */
  label: string
}

const DISARM_AFTER_MS = 4000

/**
 * Two-step delete.
 *
 * window.confirm would be simpler but it blocks the whole extension page, and
 * a modal for every removal is heavy for something that is undoable from the
 * toast anyway. Arming disarms itself so a stray click cannot be completed by
 * an unrelated one much later.
 */
export function ConfirmDelete({ onConfirm, label }: ConfirmDeleteProps) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) {
      return
    }
    const timer = setTimeout(() => setArmed(false), DISARM_AFTER_MS)
    return () => clearTimeout(timer)
  }, [armed])

  if (!armed) {
    return (
      <button
        type="button"
        className="dw-button dw-button-ghost dw-button-danger"
        onClick={() => setArmed(true)}
        aria-label={`${Methods.i18n('l10nDelete')} ${label}`}
      >
        <TrashIcon size={14} />
        {Methods.i18n('l10nDelete')}
      </button>
    )
  }

  return (
    <span className="dw-confirm">
      <span className="dw-confirm-text">{Methods.i18n('l10nConfirmDelete')}</span>
      <button
        type="button"
        className="dw-button dw-button-danger dw-button-small"
        onClick={onConfirm}
        aria-label={`${Methods.i18n('l10nConfirmDelete')} ${label}`}
      >
        {Methods.i18n('l10nDeleteYes')}
      </button>
      <button
        type="button"
        className="dw-button dw-button-ghost dw-button-small"
        onClick={() => setArmed(false)}
      >
        {Methods.i18n('l10nCancel')}
      </button>
    </span>
  )
}

export default ConfirmDelete
