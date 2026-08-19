import { useState } from 'react'

import { Methods } from '../../../app/components/Methods'
import type { InsertPosition, SiteConfig } from '../../../app/config/types'
import Field from '../common/Field'
import Modal from '../common/Modal'
import { PlusIcon, TrashIcon } from '../common/Icons'
import {
  fromSiteDraft,
  sitePatterns,
  validateSiteDraft,
  type DraftErrors,
  type SiteDraft,
} from './drafts'
import { slugify } from './support'

interface SiteFormProps {
  originalKey: string | null
  initial: SiteDraft
  takenKeys: string[]
  onSubmit: (key: string, patterns: string[], site: SiteConfig) => void
  onClose: () => void
}

export function SiteForm({
  originalKey,
  initial,
  takenKeys,
  onSubmit,
  onClose,
}: SiteFormProps) {
  const [draft, setDraft] = useState<SiteDraft>(initial)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const update = (patch: Partial<SiteDraft>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (submitted) {
      setErrors(validateSiteDraft(next, takenKeys))
    }
  }

  const submit = () => {
    setSubmitted(true)
    const found = validateSiteDraft(draft, takenKeys)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      return
    }
    onSubmit(draft.key.trim(), sitePatterns(draft), fromSiteDraft(draft))
  }

  const shown = (field: string) => (submitted ? (errors[field] ?? null) : null)

  const setPattern = (index: number, value: string) => {
    const patterns = [...draft.patterns]
    patterns[index] = value
    update({ patterns })
  }

  const setInsert = (index: number, patch: Partial<SiteDraft['insert'][0]>) => {
    const insert = draft.insert.map((entry, position) =>
      position === index ? { ...entry, ...patch } : entry,
    )
    update({ insert })
  }

  return (
    <Modal
      title={
        originalKey === null
          ? Methods.i18n('l10nNewSite')
          : Methods.i18n('l10nEditSite')
      }
      description={Methods.i18n('l10nSiteFormHint')}
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
        <Field
          label={Methods.i18n('l10nSiteKey')}
          hint={Methods.i18n('l10nSiteKeyHint')}
          error={shown('key')}
          required
        >
          {({ id, describedBy }) => (
            <input
              id={id}
              className="dw-input dw-mono"
              type="text"
              value={draft.key}
              aria-describedby={describedBy}
              // Tidied on blur rather than on every keystroke: slugifying as
              // you type eats the space before it can become a dash.
              onChange={(event) => update({ key: event.target.value })}
              onBlur={() => update({ key: slugify(draft.key) })}
            />
          )}
        </Field>

        <fieldset className="dw-fieldset">
          <legend>{Methods.i18n('l10nUrlPatterns')}</legend>
          <p className="dw-fieldset-hint">
            {Methods.i18n('l10nUrlPatternsHint')}
          </p>

          {draft.patterns.map((pattern, index) => (
            <div className="dw-repeat-row" key={index}>
              <Field
                label={`${Methods.i18n('l10nPattern')} ${index + 1}`}
                // Shown once, on the first row, so repeating rows stay compact.
                hint={index === 0 ? Methods.i18n('l10nPatternRowHint') : undefined}
                error={shown(`pattern.${index}`)}
              >
                {({ id, describedBy }) => (
                  <input
                    id={id}
                    className="dw-input dw-mono"
                    type="text"
                    placeholder="*://*.example.com/*"
                    value={pattern}
                    aria-describedby={describedBy}
                    onChange={(event) => setPattern(index, event.target.value)}
                  />
                )}
              </Field>
              <button
                type="button"
                className="dw-icon-button dw-icon-button-danger"
                aria-label={`${Methods.i18n('l10nRemove')} ${Methods.i18n('l10nPattern')} ${index + 1}`}
                disabled={draft.patterns.length === 1}
                onClick={() =>
                  update({
                    patterns: draft.patterns.filter(
                      (_, position) => position !== index,
                    ),
                  })
                }
              >
                <TrashIcon size={15} />
              </button>
            </div>
          ))}

          <button
            type="button"
            className="dw-button dw-button-ghost dw-button-small"
            onClick={() => update({ patterns: [...draft.patterns, ''] })}
          >
            <PlusIcon size={14} />
            {Methods.i18n('l10nAddPattern')}
          </button>

          {shown('patterns') && (
            <p className="dw-field-error" role="alert">
              {errors.patterns}
            </p>
          )}
        </fieldset>

        <fieldset className="dw-fieldset">
          <legend>{Methods.i18n('l10nInsertElements')}</legend>
          <p className="dw-fieldset-hint">{Methods.i18n('l10nInsertHint')}</p>

          {draft.insert.map((entry, index) => (
            <div className="dw-repeat-row" key={index}>
              <Field
                label={Methods.i18n('l10nPosition')}
                hint={index === 0 ? Methods.i18n('l10nPositionHint') : undefined}
              >
                {({ id }) => (
                  <select
                    id={id}
                    className="dw-input dw-select"
                    value={entry.position}
                    onChange={(event) =>
                      setInsert(index, {
                        position: event.target.value as InsertPosition,
                      })
                    }
                  >
                    <option value="after">
                      {Methods.i18n('l10nPositionAfter')}
                    </option>
                    <option value="before">
                      {Methods.i18n('l10nPositionBefore')}
                    </option>
                  </select>
                )}
              </Field>
              <Field
                label={Methods.i18n('l10nElement')}
                hint={index === 0 ? Methods.i18n('l10nElementHint') : undefined}
              >
                {({ id }) => (
                  <input
                    id={id}
                    className="dw-input dw-mono"
                    type="text"
                    placeholder="#repository-container-header"
                    value={entry.class}
                    onChange={(event) =>
                      setInsert(index, { class: event.target.value })
                    }
                  />
                )}
              </Field>
              <button
                type="button"
                className="dw-icon-button dw-icon-button-danger"
                aria-label={`${Methods.i18n('l10nRemove')} ${Methods.i18n('l10nElement')} ${index + 1}`}
                disabled={draft.insert.length === 1}
                onClick={() =>
                  update({
                    insert: draft.insert.filter(
                      (_, position) => position !== index,
                    ),
                  })
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
              update({
                insert: [...draft.insert, { class: '', position: 'after' }],
              })
            }
          >
            <PlusIcon size={14} />
            {Methods.i18n('l10nAddInsert')}
          </button>

          {shown('insert') && (
            <p className="dw-field-error" role="alert">
              {errors.insert}
            </p>
          )}
        </fieldset>

        <fieldset className="dw-fieldset">
          <legend>{Methods.i18n('l10nCustomClasses')}</legend>
          <p className="dw-fieldset-hint">{Methods.i18n('l10nClassesHint')}</p>

          <div className="dw-form-grid dw-form-grid-3">
            <Field
              label={Methods.i18n('l10nClassDeploy')}
              hint={Methods.i18n('l10nClassDeployHint')}
              error={shown('deploy')}
              required
            >
              {({ id, describedBy }) => (
                <input
                  id={id}
                  className="dw-input dw-mono"
                  type="text"
                  placeholder="flash flash-success"
                  value={draft.deploy}
                  aria-describedby={describedBy}
                  onChange={(event) => update({ deploy: event.target.value })}
                />
              )}
            </Field>

            <Field
              label={Methods.i18n('l10nClassNoDeploy')}
              hint={Methods.i18n('l10nClassNoDeployHint')}
              error={shown('noDeploy')}
              required
            >
              {({ id, describedBy }) => (
                <input
                  id={id}
                  className="dw-input dw-mono"
                  type="text"
                  placeholder="flash flash-error"
                  value={draft.noDeploy}
                  aria-describedby={describedBy}
                  onChange={(event) => update({ noDeploy: event.target.value })}
                />
              )}
            </Field>

            <Field
              label={Methods.i18n('l10nClassNotes')}
              hint={Methods.i18n('l10nClassNotesHint')}
            >
              {({ id, describedBy }) => (
                <input
                  id={id}
                  className="dw-input dw-mono"
                  type="text"
                  placeholder="flash flash-warn"
                  value={draft.notes}
                  aria-describedby={describedBy}
                  onChange={(event) => update({ notes: event.target.value })}
                />
              )}
            </Field>
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}

export default SiteForm
