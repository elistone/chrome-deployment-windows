import * as React from "react"
import {Methods} from "../../app/components/Methods";
import {Config} from "../../app/config/Config";
import {ConfigValidate} from "../../app/config/ConfigValidate";

import {JsonEditor as Editor} from 'jsoneditor-react';
import * as Ajv from 'ajv';

const ajv = new Ajv({allErrors: true, verbose: true});
import * as ace from 'brace';
import 'brace/mode/json';
import 'brace/theme/github';


type Props = {
    config: {},
    onChange: (config: object) => void
}

class ImportExport extends React.Component<Props> {
    /**
     * on constructor
     * @param props
     */
    constructor(props) {
        super(props);
        this.state = {
            buttonText: Methods.i18n("l10nSave"),
            messageText: false,
            messageClass: "alert alert-info",
            hasChanges: false,
            buttonDisabled: true,
            changedConfig: {}
        }
    }

    componentDidMount() {
        this.setState({
            changedConfig: this.props.config,
            currentConfig: this.props.config,
        });
    }

    /**
     * on change of json re-save
     */
    handleChange = (data) => {
        // @ts-ignore
        if (JSON.stringify(this.state.currentConfig) === JSON.stringify(data)) {
            this.setState({
                hasChanges: false,
                buttonDisabled: true
            });
        } else {
            this.setState({
                hasChanges: true,
                buttonDisabled: false,
                changedConfig: data,
            });
        }
        this.setState({
            messageText: false,
        });
    }

    saveChanges = () => {
        const _this = this;
        // @ts-ignore
        const {changedConfig} = this.state;

        _this.setState({
            buttonDisabled: true,
            buttonText: Methods.i18n("l10nValidating"),
            messageText: false,
            messageClass: "alert alert-info"
        });

        const validator = new ConfigValidate(changedConfig);
        validator.check().then(function (value) {
            // save the config information and update.
            const config = new Config();
            config.deployments = changedConfig['deployments'];
            config.domains = changedConfig['domains'];
            config.sites = changedConfig['sites'];
            _this.props.onChange(config.getFullConfig());

            setTimeout(function () {
                _this.setState({
                    buttonText: Methods.i18n("l10nSaved"),
                    messageText: value,
                    messageClass: "alert alert-success"
                });
                setTimeout(function () {
                    _this.setState({
                        buttonText: Methods.i18n("l10nSave"),
                        hasChanges: false,
                        messageText: false
                    });
                }, 1200);
            }, 400);
        }).catch(function (value) {
            _this.setState({
                buttonText: Methods.i18n("l10nSave"),
                hasChanges: false,
                messageText: value,
                messageClass: "alert alert-danger"
            });
        }).finally(function () {
            _this.setState({
                currentConfig: changedConfig,
            });
        });
    }

    /**
     * render method
     */
    render() {
        // @ts-ignore
        const {buttonText, hasChanges, buttonDisabled, messageText, messageClass} = this.state;

        return (
            <div className="content-wrapper content-import-export">
                <div className="flex-row">
                    <div className="flex-col">
                        <h2 className="page-title">{Methods.i18n('l10nImportExport')}</h2>
                        <h3 className="page-subtitle">{Methods.i18n('l10nImportExportSubtitle')}</h3>
                    </div>
                    <div className="settings">
                        <fieldset>
                            <legend> Settings</legend>
                            <div className="form-holder">
                                <p className="form-info above">Would you like to enable global config?</p>
                                <div className="form-selects">
                                    <input type="radio" id="global_true" name="global" value="true"/>
                                    <label htmlFor="global_true">Enabled</label>
                                    <input type="radio" id="global_false" name="global" value="false"/>
                                    <label htmlFor="global_false">Disabled</label>
                                </div>
                            </div>
                            <div className="form-holder">
                                <span>
                                    <input className="form-input" id="config_url" type="text" placeholder="Enter your global url"/>
                                    <label htmlFor="config_url">Global URL</label>
                                </span>
                                <p className="form-info below">Enter a valid global config url.</p>
                            </div>
                        </fieldset>
                    </div>
                    <div className="controls">
                        <div className="chip-holder">
                            {messageText && <span className={messageClass}>{messageText}</span>}
                            {!messageText && hasChanges &&
                            <span className="alert alert-info">{Methods.i18n('l10nChangesDetected')}</span>}
                        </div>
                        <div className="btn-holder">
                            <button disabled={buttonDisabled} onClick={this.saveChanges}
                                    className="btn btn-success">{buttonText}</button>
                        </div>
                    </div>
                </div>
                <div className="editor">
                    <Editor
                        value={this.props.config}
                        onChange={this.handleChange}
                        ace={ace}
                        ajv={ajv}
                        mode="code"
                        allowedModes={['code', 'text', 'tree']}
                    />
                </div>
            </div>
        );
    }
}

export default ImportExport;
