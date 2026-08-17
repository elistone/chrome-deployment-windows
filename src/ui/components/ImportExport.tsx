import { Component } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { linter, lintGutter } from '@codemirror/lint'

import { Methods } from '../../app/components/Methods'
import { Config } from '../../app/config/Config'
import { validateConfig } from '../../app/config/schema'
import type { DeploymentWindowsConfig } from '../../app/config/types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface ImportExportProps {
  config: DeploymentWindowsConfig
  onChange: (config: DeploymentWindowsConfig) => void
}

interface ImportExportState {
  text: string
  dirty: boolean
  saveState: SaveState
  errors: string[]
}

const SAVED_MESSAGE_MS = 1500

/**
 * The raw JSON config editor.
 *
 * v1 used `jsoneditor-react` (unmaintained, and incompatible with React 19);
 * this uses CodeMirror 6, which also has no eval dependency and so is happy
 * under the MV3 extension-page CSP.
 *
 * The save path is now real: the JSON is parsed and schema-validated, and only
 * written to storage if both succeed. v1 flagged this as "fancy fakery".
 */
export class ImportExport extends Component<
  ImportExportProps,
  ImportExportState
> {
  private savedTimer: ReturnType<typeof setTimeout> | null = null

  constructor(props: ImportExportProps) {
    super(props)
    this.state = {
      text: JSON.stringify(props.config, null, 2),
      dirty: false,
      saveState: 'idle',
      errors: [],
    }
  }

  override componentWillUnmount(): void {
    if (this.savedTimer !== null) {
      clearTimeout(this.savedTimer)
    }
  }

  private handleChange = (value: string) => {
    this.setState({ text: value, dirty: true, saveState: 'idle', errors: [] })
  }

  /** Parse + schema check. Returns null (and sets errors) when unusable. */
  private parse(): DeploymentWindowsConfig | null {
    let parsed: unknown
    try {
      parsed = JSON.parse(this.state.text)
    } catch (error) {
      this.setState({
        saveState: 'error',
        errors: [`Invalid JSON: ${(error as Error).message}`],
      })
      return null
    }

    const result = validateConfig(parsed)
    if (!result.valid) {
      this.setState({ saveState: 'error', errors: result.errors })
      return null
    }

    return parsed as DeploymentWindowsConfig
  }

  private handleSave = async () => {
    const config = this.parse()
    if (!config) {
      return
    }

    this.setState({ saveState: 'saving', errors: [] })

    try {
      await Config.save(config)
      this.props.onChange(config)
      this.setState({ saveState: 'saved', dirty: false })
      this.savedTimer = setTimeout(
        () => this.setState({ saveState: 'idle' }),
        SAVED_MESSAGE_MS,
      )
    } catch (error) {
      this.setState({
        saveState: 'error',
        errors: [`Could not save: ${String(error)}`],
      })
    }
  }

  private buttonLabel(): string {
    switch (this.state.saveState) {
      case 'saving':
        return 'Saving...'
      case 'saved':
        return 'Saved!'
      default:
        return 'Save'
    }
  }

  override render() {
    const { dirty, saveState, errors, text } = this.state

    return (
      <div className="content-wrapper content-import-export">
        <div className="flex-row">
          <div className="flex-col">
            <h2>{Methods.i18n('l10nImportExport')}</h2>
          </div>
          <div className="flex-col flex-end">
            {dirty && <span className="chip chip-info">Config changes</span>}
            <button
              type="button"
              disabled={saveState === 'saving'}
              onClick={this.handleSave}
              className="btn btn-success"
            >
              {this.buttonLabel()}
            </button>
          </div>
        </div>

        {errors.length > 0 && (
          <ul className="config-errors" role="alert">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        )}

        <div className="editor">
          <CodeMirror
            value={text}
            height="520px"
            extensions={[json(), linter(jsonParseLinter()), lintGutter()]}
            onChange={this.handleChange}
            basicSetup={{ tabSize: 2 }}
          />
        </div>
      </div>
    )
  }
}

export default ImportExport
