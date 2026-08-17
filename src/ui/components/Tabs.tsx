import { Component, type ReactNode } from 'react'

interface TabsProps {
  /** Alternating children: label, panel, label, panel, ... */
  children: ReactNode
}

interface TabsState {
  active: number
}

/**
 * Minimal tab strip. Children alternate label/panel, so the panel for label `i`
 * is child `i + 1`.
 */
export class Tabs extends Component<TabsProps, TabsState> {
  override state: TabsState = { active: 0 }

  private select = (index: number) => () => {
    this.setState({ active: index })
  }

  private renderLabels(items: ReactNode[]) {
    return items.map((item, index) => {
      if (index % 2 !== 0) {
        return null
      }
      const active = this.state.active === index ? 'active' : ''
      return (
        <button
          type="button"
          key={index}
          onClick={this.select(index)}
          className={`${active} tab`.trim()}
        >
          {item}
        </button>
      )
    })
  }

  private renderPanels(items: ReactNode[]) {
    return items.map((item, index) => {
      if (index - 1 !== this.state.active) {
        return null
      }
      return (
        <div className="content" key={index}>
          {item}
        </div>
      )
    })
  }

  override render() {
    // Flattening keeps index maths honest when children come from an array.
    const items = Array.isArray(this.props.children)
      ? (this.props.children.flat() as ReactNode[])
      : [this.props.children]

    return (
      <div className="tabs">
        {this.renderLabels(items)}
        {this.renderPanels(items)}
      </div>
    )
  }
}

export default Tabs
