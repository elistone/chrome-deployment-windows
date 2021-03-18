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
        this.state = {buttonText: "Save", messageText: false, hasChanges: false, buttonDisabled: true, changedConfig: {}}
    }

    componentDidMount() {
        this.setState({
            changedConfig: this.props.config
        });
    }

    /**
     * on change of json re-save
     */
    handleChange = (data) => {
        this.setState({
            changedConfig: data,
            hasChanges: true,
            buttonDisabled: false
        });
    }

    saveChanges = () => {
        const _that = this;
        // @ts-ignore
        const {changedConfig} = this.state;

        _that.setState({
            buttonDisabled: true,
            buttonText: "Saving...",
            messageText: false
        });

        const validator = new ConfigValidate(changedConfig);
        validator.check().then(function (value){
            // save the config information and update.
            const config = new Config();
            config.deployments = changedConfig['deployments'];
            config.domains = changedConfig['domains'];
            config.sites = changedConfig['sites'];
            _that.props.onChange(config.getFullConfig());

            setTimeout(function () {
                _that.setState({
                    buttonText: "Saved!",
                    messageText: value,
                });
                setTimeout(function () {
                    _that.setState({
                        buttonText: "Save",
                        buttonDisabled: false,
                        hasChanges: false,
                        messageText: false
                    });
                }, 1200);
            },400);
        }).catch(function (value){
            setTimeout(function () {
                _that.setState({
                    buttonText: "Error...",
                    messageText: value,
                });
                setTimeout(function () {
                    _that.setState({
                        buttonText: "Save",
                        buttonDisabled: false,
                        hasChanges: false,
                    });
                }, 2300);
            },400);
        });
    }

    /**
     * render method
     */
    render() {
        // @ts-ignore
        const {buttonText, hasChanges, buttonDisabled, messageText} = this.state;

        return (
            <div className="content-wrapper content-import-export">
                <div className="flex-row">
                    <div className="flex-col">
                        <h2>{Methods.i18n('l10nImportExport')}</h2>

                    </div>
                    <div className="flex-col flex-end">
                        {messageText && <div className="alert alert-info">{messageText}</div>}
                        {hasChanges && <span className="chip chip-info">Config changes</span>}
                        <button disabled={buttonDisabled} onClick={this.saveChanges}
                                className="btn btn-success">{buttonText}</button>
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
