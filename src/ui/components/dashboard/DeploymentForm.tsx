import { useId, useState } from 'react'

import { Methods } from '../../../app/components/Methods'
import { Timezones } from '../../../app/components/Timezones'
import {
  WEEK_DISPLAY_ORDER,
  dayMessageKey,
} from '../../../app/components/weekdays'
import type { DeploymentConfig } from '../../../app/config/types'
import Field from '../common/Field'
import Modal from '../common/Modal'
import Toggle from '../common/Toggle'
import {
  fromDeploymentDraft,
  validateDeploymentDraft,
  type DeploymentDraft,
  type DraftErrors,
} from './drafts'
import { slugify, timezoneOptions } from './support'

interface DeploymentFormProps {
  /** null when creating, so the key field can follow the name. */
  originalKey: string | null
  initial: DeploymentDraft
  domainKeys: string[]
  /** Keys already in use by other deployments. */
  takenKeys: string[]
  onSubmit: (key: string, deployment: DeploymentConfig) => void
  onClose: () => void
}

export function DeploymentForm({
  originalKey,
  initial,
  domainKeys,
  takenKeys,
  onSubmit,
  onClose,
}: DeploymentFormProps) {
  const [draft, setDraft] = useState<DeploymentDraft>(initial)
  const [errors, setErrors] = useState<DraftErrors>({})
  // Errors only appear after a save attempt, then update live - so the form
  // does not shout at someone who has simply not finished typing yet.
  const [submitted, setSubmitted] = useState(false)
  // Once the key has been edited by hand it stops tracking the name.
  const [keyPinned, setKeyPinned] = useState(originalKey !== null)
  const zoneListId = useId()

  const update = (patch: Partial<DeploymentDraft>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (submitted) {
      setErrors(validateDeploymentDraft(next, takenKeys))
    }
  }

  const setName = (name: string) => {
    update(keyPinned ? { name } : { name, key: slugify(name) })
  }

  const submit = () => {
    setSubmitted(true)

    const found = validateDeploymentDraft(draft, takenKeys)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      return
    }

    onSubmit(draft.key.trim(), fromDeploymentDraft(draft))
  }

  const shown = (field: string) => (submitted ? (errors[field] ?? null) : null)

  return (
    <Modal
      title={
        originalKey === null
          ? Methods.i18n('l10nNewDeployment')
          : Methods.i18n('l10nEditDeployment')
      }
      description={Methods.i18n('l10nDeploymentFormHint')}
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
          // Keeps Enter-to-save working; the footer button lives outside the
          // form element, so it calls submit() directly.
          event.preventDefault()
          submit()
        }}
        noValidate
      >
        <div className="dw-form-grid">
          <Field
            label={Methods.i18n('l10nName')}
            hint={Methods.i18n('l10nNameHint')}
            error={shown('name')}
            required
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                className="dw-input"
                type="text"
                value={draft.name}
                aria-describedby={describedBy}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>

          <Field
            label={Methods.i18n('l10nKey')}
            hint={Methods.i18n('l10nKeyHint')}
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
                onChange={(event) => {
                  setKeyPinned(true)
                  update({ key: event.target.value })
                }}
              />
            )}
          </Field>
        </div>

        <Toggle
          checked={draft.notesOnly}
          onChange={(notesOnly) => update({ notesOnly })}
          label={Methods.i18n('l10nNotesOnly')}
          hint={Methods.i18n('l10nNotesOnlyHint')}
        />

        {!draft.notesOnly && (
          <fieldset className="dw-fieldset">
            <legend>{Methods.i18n('l10nDeploymentWindow')}</legend>
            <p className="dw-fieldset-hint">{Methods.i18n('l10nTimeHint')}</p>

            <div className="dw-form-grid dw-form-grid-2">
              <Field
                label={Methods.i18n('l10nWindowStart')}
                hint={Methods.i18n('l10nWindowStartHint')}
                error={shown('start')}
                required
              >
                {({ id, describedBy }) => (
                  <input
                    id={id}
                    className="dw-input"
                    type="time"
                    value={draft.start}
                    aria-describedby={describedBy}
                    onChange={(event) => update({ start: event.target.value })}
                  />
                )}
              </Field>

              <Field
                label={Methods.i18n('l10nWindowEnd')}
                hint={Methods.i18n('l10nWindowEndHint')}
                error={shown('end')}
                required
              >
                {({ id, describedBy }) => (
                  <input
                    id={id}
                    className="dw-input"
                    type="time"
                    value={draft.end}
                    aria-describedby={describedBy}
                    onChange={(event) => update({ end: event.target.value })}
                  />
                )}
              </Field>
            </div>

            <Field
              label={Methods.i18n('l10nTimezone')}
              hint={Methods.i18n('l10nTimezoneHint')}
              error={shown('timezone')}
              required
            >
              {({ id, describedBy }) => (
                <div className="dw-input-row">
                  <input
                    id={id}
                    className="dw-input dw-mono"
                    type="text"
                    list={zoneListId}
                    value={draft.timezone}
                    aria-describedby={describedBy}
                    onChange={(event) => update({ timezone: event.target.value })}
                  />
                  <button
                    type="button"
                    className="dw-button dw-button-ghost dw-button-small"
                    onClick={() =>
                      update({ timezone: Timezones.findLocalTimezone() })
                    }
                  >
                    {Methods.i18n('l10nUseMyTimezone')}
                  </button>
                </div>
              )}
            </Field>

            <datalist id={zoneListId}>
              {timezoneOptions().map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>

            <Field
              label={Methods.i18n('l10nDays')}
              hint={Methods.i18n('l10nDaysHint')}
              error={shown('days')}
            >
              {({ describedBy }) => (
                <div
                  className="dw-daypicker"
                  role="group"
                  aria-describedby={describedBy}
                  aria-label={Methods.i18n('l10nDays')}
                >
                  {WEEK_DISPLAY_ORDER.map((day) => {
                    const on = draft.days.includes(day)
                    return (
                      <label
                        key={day}
                        className={`dw-day${on ? ' dw-day-on' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="dw-visually-hidden"
                          checked={on}
                          onChange={() =>
                            update({
                              days: on
                                ? draft.days.filter((d) => d !== day)
                                : [...draft.days, day],
                            })
                          }
                        />
                        {Methods.i18n(dayMessageKey(day))}
                      </label>
                    )
                  })}
                </div>
              )}
            </Field>
          </fieldset>
        )}

        <fieldset className="dw-fieldset">
          <legend>{Methods.i18n('l10nUrlFragments')}</legend>
          <p className="dw-fieldset-hint">
            {Methods.i18n('l10nUrlFragmentsHint')}
          </p>

          {domainKeys.length === 0 ? (
            <p className="dw-empty-inline">{Methods.i18n('l10nNoSitesYet')}</p>
          ) : (
            <div className="dw-form-grid">
              {domainKeys.map((domainKey, index) => (
                <Field
                  key={domainKey}
                  label={domainKey}
                  // Once per fieldset rather than once per site: the same
                  // sentence under every input is noise, not help.
                  hint={
                    index === 0
                      ? Methods.i18n('l10nUrlFragmentFieldHint')
                      : undefined
                  }
                >
                  {({ id }) => (
                    <input
                      id={id}
                      className="dw-input dw-mono"
                      type="text"
                      placeholder={Methods.i18n('l10nUrlFragmentPlaceholder')}
                      value={draft.fragments[domainKey] ?? ''}
                      onChange={(event) =>
                        update({
                          fragments: {
                            ...draft.fragments,
                            [domainKey]: event.target.value,
                          },
                        })
                      }
                    />
                  )}
                </Field>
              ))}
            </div>
          )}

          {shown('fragments') && (
            <p className="dw-field-error" role="alert">
              {errors.fragments}
            </p>
          )}
        </fieldset>

        <Field
          label={Methods.i18n('l10nNotes')}
          hint={Methods.i18n('l10nNotesHint')}
          error={shown('notes')}
        >
          {({ id, describedBy }) => (
            <textarea
              id={id}
              className="dw-input dw-textarea"
              rows={5}
              value={draft.notes}
              aria-describedby={describedBy}
              onChange={(event) => update({ notes: event.target.value })}
            />
          )}
        </Field>

        <Toggle
          checked={draft.caseSensitive}
          onChange={(caseSensitive) => update({ caseSensitive })}
          label={Methods.i18n('l10nCaseSensitive')}
          hint={Methods.i18n('l10nCaseSensitiveHint')}
        />
      </form>
    </Modal>
  )
}

export default DeploymentForm
