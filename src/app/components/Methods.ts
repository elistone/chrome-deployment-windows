/**
 * Small DOM / extension-API helpers shared by the content script and UI.
 */
export class Methods {
  /** Insert `node` immediately after the first element with `className`. */
  static insertAfter(node: Node, className: string): boolean {
    const reference = Methods.findClass(className)
    if (reference?.parentNode) {
      reference.parentNode.insertBefore(node, reference.nextSibling)
      return true
    }
    return false
  }

  /** Insert `node` immediately before the first element with `className`. */
  static insertBefore(node: Node, className: string): boolean {
    const reference = Methods.findClass(className)
    if (reference?.parentNode) {
      reference.parentNode.insertBefore(node, reference)
      return true
    }
    return false
  }

  /**
   * First element in the document with `className`.
   *
   * Only for locating host page insert anchors. The notice's own parts are
   * held as references from build time - see Notice - because a document-wide
   * lookup can match an element belonging to the page we injected into.
   */
  static findClass(className: string): HTMLElement | null {
    const element = document.getElementsByClassName(className)[0]
    return element instanceof HTMLElement ? element : null
  }

  static isHidden(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element)
    return style.display === 'none' || style.visibility === 'hidden'
  }

  /**
   * Localised message lookup.
   *
   * Guarded because the content script keeps running in pages that were open
   * when the extension was reloaded, at which point chrome.* is torn down.
   */
  static i18n(key: string): string {
    try {
      return chrome?.i18n?.getMessage(key) ?? ''
    } catch {
      return 'Translation lost, please reload.'
    }
  }

  /** Ask the service worker to swap the toolbar icon. Never throws. */
  static updateIcon(icon: string): void {
    try {
      void chrome?.runtime?.sendMessage({ newIconPath: icon })?.catch(() => {
        // The worker may be asleep or the extension reloaded; nothing to do.
      })
    } catch {
      // chrome.* is gone after an extension reload - ignore.
    }
  }
}
