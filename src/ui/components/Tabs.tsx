import * as React from "react"

class Tabs extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            active: 0
        }
    }

    select = (i) => {
        let _this = this;
        return function() {
            _this.setState({
                active: i
            });
        }
    }

    renderTabs = () => {
        return React.Children.map(this.props.children, (item, i) => {
            if (i%2 === 0) {
                // @ts-ignore
                let active = this.state.active === i ? 'active' : '';
                return <a onClick={this.select(i)} className={`${active} tab`}>{item}</a>;
            }
        });
    }

    renderContent() {
        return React.Children.map(this.props.children, (item, i) => {
            // @ts-ignore
            if (i-1 === this.state.active) {
                return <div className='content'>{item}</div>;
            } else {
                return;
            }
        });
    }

    render() {
        return (
            <div className="tabs">
                {this.renderTabs()}
                {this.renderContent()}
            </div>
        );
    }
}

export default Tabs;
