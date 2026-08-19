/**
 * Small DOM / extension-API helpers shared by the content script and UI.
 */
export class Methods {
  /** Insert `node` immediately after the first element `target` names. */
  static insertAfter(node: Node, target: string): boolean {
    const reference = Methods.findAnchor(target)
    if (reference?.parentNode) {
      reference.parentNode.insertBefore(node, reference.nextSibling)
      return true
    }
    return false
  }

  /** Insert `node` immediately before the first element `target` names. */
  static insertBefore(node: Node, target: string): boolean {
    const reference = Methods.findAnchor(target)
    if (reference?.parentNode) {
      reference.parentNode.insertBefore(node, reference)
      return true
    }
    return false
  }

  /**
   * Is this insert location a CSS selector rather than a bare class name?
   *
   * Shared with the options page so what it draws and what the content script
   * looks for can never disagree about what a value means.
   */
  static isSelector(target: string): boolean {
    return /^[#.[]/.test(target.trim())
  }

  /**
   * The element an insert rule points at.
   *
   * A bare word is a class name, which is what every configuration written so
   * far contains. A value starting with `#`, `.` or `[` is a CSS selector
   * instead, because a site's stable anchor is not always a class: GitHub's
   * repository header is identified by an id, and the classes beside it are
   * generated and change without notice.
   *
   * The distinction is drawn on the first character on purpose. Whitespace is
   * not a signal, since `getElementsByClassName('a b')` already means "has
   * both classes" and reading it as a selector would silently change what an
   * existing config matches.
   */
  static findAnchor(target: string): HTMLElement | null {
    const value = target.trim()
    if (!value) {
      return null
    }

    if (Methods.isSelector(value)) {
      try {
        const element = document.querySelector(value)
        return element instanceof HTMLElement ? element : null
      } catch {
        // An unparseable selector is a typo in the config, not a crash.
        return null
      }
    }

    return Methods.findClass(value)
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
   *
   * A missing message resolves to an empty string, and since every visible
   * label in the UI comes through here that turned an out of date catalogue
   * into a page of blank controls rather than anything diagnosable. Chrome
   * caches _locales for the loaded extension, so a rebuilt unpacked extension
   * that has not been reloaded hits exactly that. The key is humanised instead:
   * approximate wording beats no wording. check-locales.js is what stops a
   * genuinely missing message reaching a build.
   */
  static i18n(key: string): string {
    try {
      return chrome?.i18n?.getMessage(key) || Methods.humaniseKey(key)
    } catch {
      return 'Translation lost, please reload.'
    }
  }

  /** `l10nAddDeployment` -> `Add deployment`. */
  private static humaniseKey(key: string): string {
    const words = key
      .replace(/^l10n/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .trim()

    if (!words) {
      return key
    }
    return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
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
