import { useId, useMemo, useState } from 'react'

import { Methods } from '../../../app/components/Methods'
import { Config } from '../../../app/config/Config'
import type { DeploymentWindowsConfig } from '../../../app/config/types'
import Field from '../common/Field'
import Toggle from '../common/Toggle'
import {
  fromDeploymentDraft,
  toDeploymentDraft,
  upsertDeployment,
  validateDeploymentDraft,
  type DeploymentDraft,
  type DraftErrors,
} from '../dashboard/drafts'
import { timezoneOptions } from '../dashboard/support'
import { suggestFragment, suggestKey, suggestName } from './target'

/** The two targets that can actually be written to. */
export interface EditorTarget {
  kind: 'edit' | 'add'
  domainKey: string
  /** The deployment being changed, or null when it is being created. */
  deploymentKey: string | null
}

interface DeploymentEditorProps {
  config: DeploymentWindowsConfig
  target: EditorTarget
  /** The active tab's URL and title, used to fill a new entry in. */
  url: string
  title?: string
  onCancel: () => void
  onSaved: (config: DeploymentWindowsConfig) => void
}

function initialDraft(
  config: DeploymentWindowsConfig,
  target: EditorTarget,
  url: string,
  title: string | undefined,
): DeploymentDraft {
  const domainKeys = Object.keys(config.domains)

  if (target.deploymentKey !== null) {
    // Built over every site, not just the matched one, so the fragments for
    // the other sites this deployment covers survive the round trip - only the
    // matched one is put on screen.
    return toDeploymentDraft(
      target.deploymentKey,
      config.deployments[target.deploymentKey],
      domainKeys,
    )
  }

  const fragment = suggestFragment(url)
  const name = suggestName(title, fragment)
  const draft = toDeploymentDraft('', {}, domainKeys)

  return {
    ...draft,
    key: suggestKey(name, Object.keys(config.deployments)),
    name,
    fragments: { ...draft.fragments, [target.domainKey]: fragment },
  }
}

/**
 * Add or change one deployment without leaving the popup.
 *
 * The dashboard's form is the complete one: every site's fragment, the key, the
 * case-sensitivity switch. This is the same draft and the same validation, cut
 * down to what someone looking at the page in question would want to change -
 * the key follows the name, and the fragment shown is the one for the site they
 * are actually on. Anything else stays available on the options page.
 */
export function DeploymentEditor({
  config,
  target,
  url,
  title,
  onCancel,
  onSaved,
}: DeploymentEditorProps) {
  const [draft, setDraft] = useState<DeploymentDraft>(() =>
    initialDraft(config, target, url, title),
  )
  const [errors, setErrors] = useState<DraftErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const zoneListId = useId()

  const takenKeys = useMemo(
    () =>
      Object.keys(config.deployments).filter(
        (key) => key !== target.deploymentKey,
      ),
    [config.deployments, target.deploymentKey],
  )

  const update = (patch: Partial<DeploymentDraft>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (submitted) {
      setErrors(validateDeploymentDraft(next, takenKeys))
    }
  }

  const setFragment = (fragment: string) => {
    update({ fragments: { ...draft.fragments, [target.domainKey]: fragment } })
  }

  const submit = () => {
    if (saving) {
      return
    }
    setSubmitted(true)

    // A new entry's key is never shown, so it has to stay in step with the
    // name right up to the save rather than only while the field is untouched.
    const key =
      target.deploymentKey ?? suggestKey(draft.name, takenKeys)
    const candidate = { ...draft, key }
    const found = validateDeploymentDraft(candidate, takenKeys)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      return
    }

    setSaving(true)
    setFailed(false)
    const next = upsertDeployment(
      config,
      target.deploymentKey,
      key,
      fromDeploymentDraft(candidate),
    )
    void Config.save(next)
      .then(() => onSaved(next))
      .catch(() => {
        setFailed(true)
        setSaving(false)
      })
  }

  const shown = (field: string) => (submitted ? (errors[field] ?? null) : null)

  return (
    <form
      className="dw-popup-editor"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      noValidate
    >
      <h1 className="dw-popup-editor-title">
        {Methods.i18n(
          target.deploymentKey === null
            ? 'l10nNewDeployment'
            : 'l10nEditDeployment',
        )}
      </h1>

      <div className="dw-popup-editor-fields">
      <Field label={Methods.i18n('l10nName')} error={shown('name')} required>
        {({ id, describedBy }) => (
          <input
            id={id}
            className="dw-input"
            type="text"
            value={draft.name}
            aria-describedby={describedBy}
            onChange={(event) => update({ name: event.target.value })}
          />
        )}
      </Field>

      <Field
        label={Methods.i18n('l10nUrlFragment')}
        hint={Methods.i18n('l10nUrlFragmentFieldHint')}
        error={shown('fragments')}
        required
      >
        {({ id, describedBy }) => (
          <input
            id={id}
            className="dw-input dw-mono"
            type="text"
            placeholder={Methods.i18n('l10nUrlFragmentPlaceholder')}
            value={draft.fragments[target.domainKey] ?? ''}
            aria-describedby={describedBy}
            onChange={(event) => setFragment(event.target.value)}
          />
        )}
      </Field>

      <Toggle
        checked={draft.notesOnly}
        onChange={(notesOnly) => update({ notesOnly })}
        label={Methods.i18n('l10nNotesOnly')}
        compact
      />

      {!draft.notesOnly && (
        <>
          <div className="dw-form-grid dw-form-grid-2">
            <Field
              label={Methods.i18n('l10nWindowStart')}
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
            error={shown('timezone')}
            required
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                className="dw-input dw-mono"
                type="text"
                list={zoneListId}
                value={draft.timezone}
                aria-describedby={describedBy}
                onChange={(event) => update({ timezone: event.target.value })}
              />
            )}
          </Field>

          <datalist id={zoneListId}>
            {timezoneOptions().map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </>
      )}

      <Field label={Methods.i18n('l10nNotes')} error={shown('notes')}>
        {({ id, describedBy }) => (
          <textarea
            id={id}
            className="dw-input dw-textarea"
            rows={3}
            value={draft.notes}
            aria-describedby={describedBy}
            onChange={(event) => update({ notes: event.target.value })}
          />
        )}
      </Field>

      {failed && (
        <p className="dw-field-error" role="alert">
          {Methods.i18n('l10nSaveFailed')}
        </p>
      )}
      </div>

      <div className="dw-popup-editor-actions">
        <button
          type="button"
          className="dw-button dw-button-ghost"
          onClick={onCancel}
        >
          {Methods.i18n('l10nCancel')}
        </button>
        <button
          type="submit"
          className="dw-button dw-button-primary"
          disabled={saving}
        >
          {Methods.i18n('l10nSave')}
        </button>
      </div>
    </form>
  )
}

export default DeploymentEditor
