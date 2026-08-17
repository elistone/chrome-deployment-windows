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

  /** Replace the text of the first element with `className`. */
  static updateText(text: string, className: string): boolean {
    const reference = Methods.findClass(className)
    if (reference) {
      reference.textContent = text
      return true
    }
    return false
  }

  static updateClassName(setClass: string, className: string): boolean {
    const reference = Methods.findClass(className)
    if (reference) {
      reference.className = setClass
      return true
    }
    return false
  }

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
