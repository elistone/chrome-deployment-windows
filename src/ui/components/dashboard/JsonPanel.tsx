import { useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { linter, lintGutter } from '@codemirror/lint'

import { Methods } from '../../../app/components/Methods'
import { validateConfig } from '../../../app/config/schema'
import type { DeploymentWindowsConfig } from '../../../app/config/types'
import type { ResolvedTheme } from '../../theme'
import {
  CheckIcon,
  ChevronIcon,
  CopyIcon,
  DownloadIcon,
  UploadIcon,
} from '../common/Icons'

interface JsonPanelProps {
  config: DeploymentWindowsConfig
  /** Persists and reports back; the panel never writes storage itself. */
  onApply: (config: DeploymentWindowsConfig) => Promise<boolean>
  theme: ResolvedTheme
}

const FEEDBACK_MS = 1800

function serialise(config: DeploymentWindowsConfig): string {
  return JSON.stringify(config, null, 2)
}

/**
 * The escape hatch: the whole config as raw JSON.
 *
 * Editing is UI-first now, so this is collapsed by default and framed as an
 * import/export tool rather than the main way in. It stays fully functional
 * because pasting a config between machines, or diffing one into a ticket, is
 * something no amount of form building replaces.
 */
export function JsonPanel({ config, onApply, theme }: JsonPanelProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(() => serialise(config))
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Edits made through the cards must show up here, but not by silently
  // discarding text the user is part way through typing.
  useEffect(() => {
    if (!dirty) {
      setText(serialise(config))
    }
  }, [config, dirty])

  useEffect(() => {
    return () => {
      if (noticeTimer.current !== null) {
        clearTimeout(noticeTimer.current)
      }
    }
  }, [])

  const flash = (message: string) => {
    setNotice(message)
    if (noticeTimer.current !== null) {
      clearTimeout(noticeTimer.current)
    }
    noticeTimer.current = setTimeout(() => setNotice(null), FEEDBACK_MS)
  }

  const parse = (source: string): DeploymentWindowsConfig | null => {
    let parsed: unknown
    try {
      parsed = JSON.parse(source)
    } catch (error) {
      setErrors([`${Methods.i18n('l10nInvalidJson')} ${(error as Error).message}`])
      return null
    }

    const result = validateConfig(parsed)
    if (!result.valid) {
      setErrors(result.errors)
      return null
    }

    setErrors([])
    return parsed as DeploymentWindowsConfig
  }

  const handleApply = async () => {
    const parsed = parse(text)
    if (!parsed) {
      return
    }
    if (await onApply(parsed)) {
      setDirty(false)
    }
  }

  const handleRevert = () => {
    setText(serialise(config))
    setDirty(false)
    setErrors([])
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      flash(Methods.i18n('l10nCopied'))
    } catch {
      flash(Methods.i18n('l10nCopyFailed'))
    }
  }

  const handleDownload = () => {
    try {
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'deployment-windows.json'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      flash(Methods.i18n('l10nDownloadFailed'))
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) {
      return
    }
    const contents = await file.text()
    setText(contents)
    setDirty(true)
    // Validate straight away: a file picked from disk is far more likely to be
    // the wrong shape than something typed in the editor.
    parse(contents)
  }

  return (
    <section className="dw-panel dw-json-panel">
      <button
        type="button"
        className="dw-panel-summary"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronIcon
          size={16}
          className={`dw-panel-chevron${open ? ' dw-panel-chevron-open' : ''}`}
        />
        <span className="dw-panel-summary-text">
          <span className="dw-panel-title">{Methods.i18n('l10nJsonTitle')}</span>
          <span className="dw-panel-subtitle">
            {Methods.i18n('l10nJsonHint')}
          </span>
        </span>
        {dirty && (
          <span className="dw-badge dw-badge-warn">
            {Methods.i18n('l10nUnsaved')}
          </span>
        )}
      </button>

      {open && (
        <div className="dw-panel-body">
          <div className="dw-panel-toolbar">
            <button
              type="button"
              className="dw-button dw-button-ghost"
              onClick={handleCopy}
            >
              <CopyIcon size={14} />
              {Methods.i18n('l10nCopy')}
            </button>
            <button
              type="button"
              className="dw-button dw-button-ghost"
              onClick={handleDownload}
            >
              <DownloadIcon size={14} />
              {Methods.i18n('l10nDownload')}
            </button>
            <button
              type="button"
              className="dw-button dw-button-ghost"
              onClick={() => fileInput.current?.click()}
            >
              <UploadIcon size={14} />
              {Methods.i18n('l10nImportFile')}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="dw-visually-hidden"
              aria-label={Methods.i18n('l10nImportFile')}
              onChange={(event) => {
                void handleFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />

            <span className="dw-panel-toolbar-gap" />

            {notice && (
              <span className="dw-panel-notice">
                <CheckIcon size={14} />
                {notice}
              </span>
            )}
            <button
              type="button"
              className="dw-button dw-button-ghost"
              disabled={!dirty}
              onClick={handleRevert}
            >
              {Methods.i18n('l10nRevert')}
            </button>
            <button
              type="button"
              className="dw-button dw-button-primary"
              onClick={() => void handleApply()}
            >
              {Methods.i18n('l10nSave')}
            </button>
          </div>

          {errors.length > 0 && (
            <ul className="dw-errors" role="alert">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          )}

          <div className="dw-editor">
            <CodeMirror
              value={text}
              height="440px"
              theme={theme}
              extensions={[json(), linter(jsonParseLinter()), lintGutter()]}
              onChange={(value) => {
                setText(value)
                setDirty(true)
                setErrors([])
              }}
              basicSetup={{ tabSize: 2 }}
            />
          </div>
        </div>
      )}
    </section>
  )
}

export default JsonPanel
