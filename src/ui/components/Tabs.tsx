import * as React from "react"

class Tabs extends React.Component {
    constructor(props) {
        super(props);
        let id: number = parseInt(window.location.hash.replace(/^#id-/, ''));
        id = isNaN(id) ? 0 : (id) - 1
        this.state = {
            active: id
        }
    }

    componentDidMount() {
        let _this = this;
        window.addEventListener("hashchange", _this.hashChanged, false);
    }

    componentWillUnmount() {
        let _this = this;
        window.removeEventListener("hashchange", _this.hashChanged, false);
    }

    hashChanged = () => {
        let id: number = parseInt(window.location.hash.replace(/^#id-/, ''));
        id = isNaN(id) ? 0 : (id) - 1
        this.setState({
            active: id
        });
    }

    select = (i) => {
        let _this = this;
        return function () {
            _this.setState({
                active: i
            });
        }
    }

    renderTabs = () => {
        return React.Children.map(this.props.children, (item, i) => {
            if (i % 2 === 0) {
                // @ts-ignore
                let active = this.state.active === i ? 'active' : '';
                // @ts-ignore
                const icon = "fa " + item.props['data-icon'];
                return <li><a onClick={this.select(i)} className={`${active} tab`}><i className={icon}
                                                                                      aria-hidden="true"/>{item}</a>
                </li>;
            }
        });
    }

    renderContent() {
        return React.Children.map(this.props.children, (item, i) => {
            // @ts-ignore
            if (i - 1 === this.state.active) {
                window.location.hash = 'id-' + i;
                return <div className='content'>{item}</div>;
            } else {
                return;
            }
        });
    }

    render() {
        return (
            <div className="tabs">
                <ul className="navigation">
                    {this.renderTabs()}
                </ul>
                {this.renderContent()}
            </div>
        );
    }
}

export default Tabs;
