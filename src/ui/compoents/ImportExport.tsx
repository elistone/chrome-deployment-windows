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
        this.state = {}
    }

    /**
     * on change of json re-save
     */
    handleChange = (data) => {
        const config = new Config()
        config.deployments = data['deployments'];
        config.domains = data['domains'];
        config.sites = data['sites'];
        this.props.onChange(config.getFullConfig());
    }

    /**
     * render method
     */
    render() {
        return (
            <div className="content-wrapper content-import-export">
                <h2>{Methods.i18n('l10nImportExport')}</h2>
                <Editor
                    value={this.props.config}
                    onChange={this.handleChange}
                    ace={ace}
                    ajv={ajv}
                    mode="code"
                    allowedModes={['code', 'text', 'tree']}
                />
            </div>
        );
    }
}

export default ImportExport;
