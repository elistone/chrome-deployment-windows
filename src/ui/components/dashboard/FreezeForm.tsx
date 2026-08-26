import { useState } from 'react'

import {
  type Freeze,
  isCalendarDate,
} from '../../../app/components/freezes'
import { Methods } from '../../../app/components/Methods'
import Field from '../common/Field'
import { PlusIcon, TrashIcon } from '../common/Icons'
import Modal from '../common/Modal'
import type { DraftErrors } from './drafts'

/** A freeze as typed, before it is known to be a pair of real dates. */
export type FreezeDraft = { from: string; to: string; reason: string }

export function toFreezeDrafts(freezes: readonly Freeze[]): FreezeDraft[] {
  return freezes.map((freeze) => ({
    from: freeze.from,
    to: freeze.to,
    reason: freeze.reason ?? '',
  }))
}

/** Blank rows are dropped rather than saved; a reason is left off when empty. */
export function fromFreezeDrafts(drafts: readonly FreezeDraft[]): Freeze[] {
  return drafts
    .filter((draft) => draft.from.trim() || draft.to.trim())
    .map((draft) => ({
      from: draft.from.trim(),
      to: draft.to.trim(),
      ...(draft.reason.trim() ? { reason: draft.reason.trim() } : {}),
    }))
}

export function validateFreezeDrafts(
  drafts: readonly FreezeDraft[],
): DraftErrors {
  const errors: DraftErrors = {}

  drafts.forEach((draft, index) => {
    const from = draft.from.trim()
    const to = draft.to.trim()
    if (!from && !to && !draft.reason.trim()) {
      // An untouched row is a row nobody filled in, not a mistake.
      return
    }
    if (!isCalendarDate(from)) {
      errors[`freeze.${String(index)}.from`] = Methods.i18n('l10nInvalidDate')
    }
    if (!isCalendarDate(to)) {
      errors[`freeze.${String(index)}.to`] = Methods.i18n('l10nInvalidDate')
    } else if (isCalendarDate(from) && to < from) {
      errors[`freeze.${String(index)}.to`] = Methods.i18n('l10nFreezeBackwards')
    }
  })

  return errors
}

interface FreezeFormProps {
  initial: readonly Freeze[]
  onSubmit: (freezes: Freeze[]) => void
  onClose: () => void
}

/**
 * The whole list of company-wide freezes, edited at once.
 *
 * One dialog rather than a card and a form per freeze: a freeze is three
 * fields, most teams have one or two, and a page of cards for that would be
 * more furniture than content.
 */
export function FreezeForm({ initial, onSubmit, onClose }: FreezeFormProps) {
  const [drafts, setDrafts] = useState<FreezeDraft[]>(() =>
    toFreezeDrafts(initial),
  )
  const [errors, setErrors] = useState<DraftErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const update = (next: FreezeDraft[]) => {
    setDrafts(next)
    if (submitted) {
      setErrors(validateFreezeDrafts(next))
    }
  }

  const setRow = (index: number, patch: Partial<FreezeDraft>) => {
    update(
      drafts.map((draft, position) =>
        position === index ? { ...draft, ...patch } : draft,
      ),
    )
  }

  const submit = () => {
    setSubmitted(true)
    const found = validateFreezeDrafts(drafts)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      return
    }
    onSubmit(fromFreezeDrafts(drafts))
  }

  const shown = (field: string) => (submitted ? (errors[field] ?? null) : null)

  return (
    <Modal
      title={Methods.i18n('l10nFreezes')}
      description={Methods.i18n('l10nGlobalFreezesHint')}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="dw-button dw-button-ghost"
            onClick={onClose}
          >
            {Methods.i18n('l10nCancel')}
          </button>
          <button
            type="button"
            className="dw-button dw-button-primary"
            onClick={submit}
          >
            {Methods.i18n('l10nSave')}
          </button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        noValidate
      >
        {drafts.length === 0 && (
          <p className="dw-empty-inline">{Methods.i18n('l10nNoFreezesYet')}</p>
        )}

        {drafts.map((draft, index) => (
          <div className="dw-repeat-row dw-repeat-row-freeze" key={index}>
            <Field
              label={Methods.i18n('l10nFreezeFrom')}
              error={shown(`freeze.${String(index)}.from`)}
            >
              {({ id }) => (
                <input
                  id={id}
                  className="dw-input"
                  type="date"
                  value={draft.from}
                  onChange={(event) =>
                    setRow(index, { from: event.target.value })
                  }
                />
              )}
            </Field>
            <Field
              label={Methods.i18n('l10nFreezeTo')}
              error={shown(`freeze.${String(index)}.to`)}
            >
              {({ id }) => (
                <input
                  id={id}
                  className="dw-input"
                  type="date"
                  value={draft.to}
                  onChange={(event) => setRow(index, { to: event.target.value })}
                />
              )}
            </Field>
            <Field label={Methods.i18n('l10nFreezeReason')}>
              {({ id }) => (
                <input
                  id={id}
                  className="dw-input"
                  type="text"
                  placeholder="Christmas change freeze"
                  value={draft.reason}
                  onChange={(event) =>
                    setRow(index, { reason: event.target.value })
                  }
                />
              )}
            </Field>
            <button
              type="button"
              className="dw-icon-button dw-icon-button-danger"
              aria-label={`${Methods.i18n('l10nRemove')} ${Methods.i18n('l10nFreezes')} ${String(index + 1)}`}
              onClick={() =>
                update(drafts.filter((_, position) => position !== index))
              }
            >
              <TrashIcon size={15} />
            </button>
          </div>
        ))}

        <button
          type="button"
          className="dw-button dw-button-ghost dw-button-small"
          onClick={() =>
            update([...drafts, { from: '', to: '', reason: '' }])
          }
        >
          <PlusIcon size={14} />
          {Methods.i18n('l10nAddFreeze')}
        </button>
      </form>
    </Modal>
  )
}

export default FreezeForm
