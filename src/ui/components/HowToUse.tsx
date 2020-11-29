import * as React from "react"

type Props = {}

class HowToUse extends React.Component<Props> {
    /**
     * on constructor
     * @param props
     */
    constructor(props) {
        super(props);
        this.state = { }
    }

    /**
     * render method
     */
    render() {
        const howToUseMD = require('../../documents/HowToUse.md');

        return (
            <div className="content-wrapper content-site-information">
                <div dangerouslySetInnerHTML={{__html: howToUseMD}}/>
            </div>
        );
    }
}

export default HowToUse;
