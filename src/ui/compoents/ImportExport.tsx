import * as React from "react"
import {Methods} from "../../app/components/Methods";
import {Config} from "../../app/config/Config";

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
        this.state = {buttonText: "Save", hasChanges: false, buttonDisabled: true, changedConfig: {}}
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
            buttonText: "Saving..."
        });

        const config = new Config()
        config.deployments = changedConfig['deployments'];
        config.domains = changedConfig['domains'];
        config.sites = changedConfig['sites'];
        _that.props.onChange(config.getFullConfig());

        // FIXME: This is just fancy fakery at the moment
        // The future this will be promises after validation and other things
        setTimeout(function () {
            _that.setState({
                buttonText: "Saved!"
            });
            setTimeout(function () {
                _that.setState({
                    buttonText: "Save",
                    buttonDisabled: false,
                    hasChanges: false
                });
            }, 1200);
        }, 400)
    }
    /**
     * render method
     */
    render() {
        // @ts-ignore
        const {buttonText, hasChanges, buttonDisabled} = this.state;

        return (
            <div className="content-wrapper content-import-export">
                <div className="flex-row">
                    <div className="flex-col">
                        <h2>{Methods.i18n('l10nImportExport')}</h2>
                    </div>
                    <div className="flex-col flex-end">
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
