import type { ResolvedDeployment, SiteStyle } from '../config/types'
import { isCssSpacing } from '../config/schema'
import { Methods } from './Methods'
import { TextFormatter } from './TextFormatter'
import { Timezones } from './Timezones'
import { DW } from './DW'
import noticeStyles from '../../styles/notice.css?inline'

const REALTIME_INTERVAL_MS = 1000

export const ICONS = {
  open: 'icons/success/icon48.png',
  closed: 'icons/error/icon48.png',
} as const

export type NoticeTone = 'open' | 'closed' | 'notes'

/**
 * Builds and injects the in-page notice, then keeps its clock and status fresh.
 *
 * The notice renders inside a shadow root. It is put on pages this extension
 * does not control, so that boundary is what lets it carry the extension's own
 * design: nothing here leaks into the host page, and nothing the host page
 * ships - a reset, a stylesheet that styles every `dl`, a `!important` on
 * `button` - reaches in. v1 sidestepped the problem by borrowing the site's
 * own classes, which is why it looked wrong whenever the site changed them.
 *
 * Every lookup of the notice's own parts goes through references captured at
 * build time rather than a document-wide query, for the same reason.
 */
export class Notice {
  readonly deployment: ResolvedDeployment
  /** The host element, which is what lives in the page. */
  element: HTMLDivElement | null = null
  inserted = false

  /** Which insert rule placed the notice, or -1 while it is not placed. */
  private locationIndex = -1
  private realTimeTimer: ReturnType<typeof setInterval> | null = null
  private toggleHandler: ((event: Event) => void) | null = null
  /** Avoids messaging the service worker every tick when nothing changed. */
  private lastIcon: string | null = null

  // Captured from the built element, never from the document.
  private card: HTMLElement | null = null
  private clock: HTMLElement | null = null
  private statusText: HTMLElement | null = null
  private countdown: HTMLElement | null = null
  private details: HTMLElement | null = null
  private toggle: HTMLElement | null = null

  constructor(deployment: ResolvedDeployment) {
    this.deployment = deployment
  }

  /** What the notice is saying right now. */
  tone(): NoticeTone {
    if (this.deployment.notesOnly) {
      return 'notes'
    }
    const { start, end } = this.deployment.timeObj.local
    return DW.canDeploy(start, end) ? 'open' : 'closed'
  }

  /** Build the notice element. Does not touch the document. */
  build(): HTMLDivElement {
    const host = document.createElement('div')
    // Kept as the hook anything outside looks us up by - the tests, and the
    // e2e suite. Everything visible is inside the shadow root.
    host.className = 'dw-notification'
    host.dataset.theme = Notice.preferredTheme()
    Notice.applyStyle(host, this.deployment.domainInfo.style)

    const root = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = noticeStyles
    root.append(style)

    const card = document.createElement('div')
    card.className = 'notice'
    card.dataset.status = this.tone()
    card.innerHTML = this.getContent()
    root.append(card)

    this.element = host
    this.card = card
    this.clock = card.querySelector('.clock')
    this.statusText = card.querySelector('.status-text')
    this.countdown = card.querySelector('.countdown')
    this.details = card.querySelector('.details')
    this.toggle = card.querySelector('.toggle')

    return host
  }

  /**
   * Try each configured insert location in order, stopping at the first hit, so
   * the notice is only ever added once per page.
   *
   * Safe to call again after the host page has torn the notice out of the DOM:
   * the timer and the toggle listener are only ever set up once, so repeated
   * inserts cannot stack a second clock or double-fire the details toggle.
   */
  insert(): boolean {
    const element = this.element ?? this.build()
    this.inserted = false
    this.locationIndex = -1

    const locations = this.deployment.domainInfo.insert ?? []
    for (const [index, location] of locations.entries()) {
      if (location.position === 'after') {
        this.inserted = Methods.insertAfter(element, location.class)
      } else if (location.position === 'before') {
        this.inserted = Methods.insertBefore(element, location.class)
      }
      if (this.inserted) {
        this.locationIndex = index
        break
      }
    }

    if (this.inserted) {
      this.enableToggleDetails()
      this.enableRealTime()
    }

    return this.inserted
  }

  /**
   * Does the notice need putting back?
   *
   * True once it has been detached, and also once a location earlier in the
   * list has appeared. A single page app swaps its content in stages, so a pass
   * that runs mid-swap can land on the fallback while the anchor it should
   * really use is momentarily absent - which on GitHub means the notice sits
   * above the repository header instead of under its tabs.
   */
  needsInsert(): boolean {
    if (this.element?.isConnected !== true) {
      return true
    }

    const locations = this.deployment.domainInfo.insert ?? []
    for (let index = 0; index < this.locationIndex; index += 1) {
      if (Methods.findAnchor(locations[index].class)) {
        return true
      }
    }
    return false
  }

  /** Stop timers and listeners, and remove the notice from the page. */
  destroy(): void {
    if (this.realTimeTimer !== null) {
      clearInterval(this.realTimeTimer)
      this.realTimeTimer = null
    }
    if (this.toggle && this.toggleHandler) {
      this.toggle.removeEventListener('click', this.toggleHandler)
    }
    this.toggleHandler = null
    this.element?.remove()
    this.inserted = false
    this.locationIndex = -1
  }

  /**
   * The theme to paint in.
   *
   * The notice sits inside someone else's page, so it follows that page's own
   * light/dark setting rather than the extension's: a light notice on a dark
   * GitHub is a hole in the page, whichever theme the options page is set to.
   */
  private static preferredTheme(): 'light' | 'dark' {
    try {
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    } catch {
      return 'light'
    }
  }

  /** Apply the site's spacing overrides, ignoring anything malformed. */
  private static applyStyle(
    host: HTMLElement,
    style: SiteStyle | undefined,
  ): void {
    const properties: [keyof SiteStyle, string][] = [
      ['margin', '--dw-notice-margin'],
      ['padding', '--dw-notice-padding'],
      ['maxWidth', '--dw-notice-max-width'],
    ]

    for (const [key, property] of properties) {
      const value = style?.[key]
      // Checked rather than trusted: a config can be pasted in wholesale, and
      // this is the one part of it that reaches a style attribute.
      if (typeof value === 'string' && value && isCssSpacing(value)) {
        host.style.setProperty(property, value)
      }
    }
  }

  private getContent(): string {
    const { timeObj, name, notes, notesOnly } = this.deployment
    const t = TextFormatter.stripTags

    // A notes-only entry has nothing to hide behind a toggle: the notes are
    // the whole notice, and they start open.
    const toggle =
      notes && !notesOnly
        ? `<button type="button" class="toggle" aria-expanded="false">${Methods.i18n('l10nDetailsShow')}</button>`
        : ''
    const countdown = notesOnly
      ? ''
      : `<span class="countdown">${t(this.countdownText())}</span>`
    const heading = [
      notesOnly ? '' : this.statusPill(),
      `<h2 class="name">${t(name)}</h2>`,
      countdown || toggle
        ? `<div class="head-end">${countdown}${toggle}</div>`
        : '',
    ].join('')

    const times = notesOnly
      ? ''
      : `<dl class="rows">
          ${Notice.row(Methods.i18n('l10nDeploymentWindow'), timeObj.original)}
          ${Notice.row(Methods.i18n('l10nYourTimezone'), timeObj.local)}
          <div class="row">
            <dt>${Methods.i18n('l10nCurrentTime')}</dt>
            <dd><span class="time clock">${t(Timezones.getCurrentTime())}</span></dd>
          </div>
        </dl>`

    // A notes-only entry has nothing else to say, so its notes start open.
    const details = notes
      ? `<div class="details" data-open="${String(notesOnly)}">
          <div class="details-inner">
            <div class="notes">
              <p class="notes-title">${Methods.i18n('l10nNotes')}</p>
              ${TextFormatter.toMarkdown(notes)}
            </div>
          </div>
        </div>`
      : ''

    return `<div class="head">${heading}</div>${times}${details}`
  }

  /** "Closes in 2h 10m", for the head. */
  private countdownText(): string {
    const { start, end } = this.deployment.timeObj.local
    return DW.countdownText(start, end)
  }

  private statusPill(): string {
    const { start, end } = this.deployment.timeObj.local
    const status = TextFormatter.stripTags(DW.statusText(start, end))
    return `<span class="pill"><span class="dot"></span><span class="status-text">${status}</span></span>`
  }

  private static row(
    label: string,
    window: ResolvedDeployment['timeObj']['original'],
  ): string {
    const t = TextFormatter.stripTags
    return `<div class="row">
      <dt>${label}</dt>
      <dd>
        <span class="time">${t(window.start)} &ndash; ${t(window.end)}</span>
        <span class="zone">${t(window.timezone)}</span>
      </dd>
    </div>`
  }

  /**
   * Play the attention animation once.
   *
   * The attribute has to come off and go back on for the animation to run a
   * second time, and the layout read between the two is what makes the browser
   * treat that as two separate states rather than collapsing it into no change
   * at all.
   */
  private flip(): void {
    const card = this.card
    if (!card) {
      return
    }
    delete card.dataset.flip
    void card.offsetWidth
    card.dataset.flip = ''
  }

  /** Push the open/closed icon to the service worker, but only on change. */
  updateIcon(): void {
    const { start, end } = this.deployment.timeObj.local
    const icon = DW.canDeploy(start, end) ? ICONS.open : ICONS.closed
    if (icon !== this.lastIcon) {
      this.lastIcon = icon
      Methods.updateIcon(icon)
    }
  }

  private enableRealTime(): void {
    this.realTime()
    if (this.realTimeTimer !== null) {
      return
    }
    this.realTimeTimer = setInterval(() => this.realTime(), REALTIME_INTERVAL_MS)
  }

  private enableToggleDetails(): void {
    // The listener lives on the notice's own element, which survives being
    // removed from the page, so it is still attached on a re-insert.
    if (!this.toggle || this.toggleHandler) {
      return
    }
    this.toggleHandler = (event: Event) => this.toggleDetails(event)
    this.toggle.addEventListener('click', this.toggleHandler)
  }

  private toggleDetails(event: Event): void {
    event.preventDefault()
    if (!this.details || !this.toggle) {
      return
    }

    const open = this.details.dataset.open !== 'true'
    this.details.dataset.open = String(open)
    this.toggle.setAttribute('aria-expanded', String(open))
    this.toggle.textContent = Methods.i18n(
      open ? 'l10nDetailsHide' : 'l10nDetailsShow',
    )
  }

  /** One tick: refresh the clock, the status text and the notice's tone. */
  realTime(): void {
    const { start, end } = this.deployment.timeObj.local

    if (this.clock) {
      this.clock.textContent = Timezones.getCurrentTime()
    }
    if (this.statusText) {
      this.statusText.textContent = DW.statusText(start, end)
    }
    if (this.countdown) {
      this.countdown.textContent = this.countdownText()
    }
    if (this.card && this.card.dataset.status !== this.tone()) {
      this.card.dataset.status = this.tone()
      this.flip()
    }

    this.updateIcon()
  }
}
