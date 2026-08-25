import type { ResolvedDeployment, SiteStyle } from '../config/types'
import { GLYPHS, GLYPH_VIEWBOX, glyphFor } from '../glyphs'
import type { IconState } from '../icons'
import { isCssSpacing } from '../config/css'
import { Methods } from './Methods'
import { renderNotes as renderMarkdown } from './Markdown'
import { TextFormatter } from './TextFormatter'
import { Timezones } from './Timezones'
import { DW } from './DW'
import noticeStyles from '../../styles/notice.css?inline'

const REALTIME_INTERVAL_MS = 1000

/**
 * The id the notice's own heading carries, so the card can be labelled by it.
 *
 * Safe as a fixed id: it only exists inside the shadow root, where it cannot
 * collide with anything the host page has.
 */
const NAME_ID = 'dw-notice-name'

/**
 * How long the notice takes to fold away, in step with the transition in
 * notice.css. Only used to decide when to stop animating and go to
 * `display: none` - the animation itself is CSS, and a reduced-motion
 * preference collapses it there, not here.
 */
const DISMISS_MS = 260

/** Which artwork the toolbar wears for each state of the window. */
export const ICONS = {
  open: 'success',
  closed: 'error',
} as const satisfies Record<'open' | 'closed', IconState>

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
  private markPath: SVGPathElement | null = null
  private details: HTMLElement | null = null
  private notesBody: HTMLElement | null = null
  private toggle: HTMLElement | null = null
  /** The notes have been rendered, or are being rendered right now. */
  private notesRequested = false
  private close: HTMLElement | null = null
  private closeHandler: ((event: Event) => void) | null = null
  /**
   * Hidden by hand, for this page view only.
   *
   * Hidden rather than destroyed, deliberately: the notice's own timer is what
   * keeps the toolbar icon honest and what notices the window opening or
   * closing, and both of those should carry on after someone has waved the
   * card away.
   */
  private dismissed = false
  private dismissTimer: ReturnType<typeof setTimeout> | null = null

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
    // A named region rather than an anonymous div: this arrives uninvited on
    // someone else's page, so it needs to be something a screen reader user can
    // find deliberately and skip past. Labelled by its own heading, which is
    // already the thing that says which project it is about.
    card.setAttribute('role', 'region')
    card.setAttribute('aria-labelledby', NAME_ID)
    card.dataset.status = this.tone()
    card.innerHTML = this.getContent()
    root.append(card)

    this.element = host
    this.card = card
    this.clock = card.querySelector('.clock')
    this.statusText = card.querySelector('.status-text')
    this.countdown = card.querySelector('.countdown')
    this.markPath = card.querySelector('.mark path')
    this.details = card.querySelector('.details')
    this.notesBody = card.querySelector('.notes-body')
    this.toggle = card.querySelector('.toggle')
    this.close = card.querySelector('.close')

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
      this.enableDismiss()
      this.enableRealTime()
      // A notes-only entry opens with its notes showing, so there is nothing
      // to wait for - the renderer is wanted now rather than on a click that
      // is never coming.
      if (this.deployment.notesOnly) {
        void this.renderNotes()
      }
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
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer)
      this.dismissTimer = null
    }
    if (this.toggle && this.toggleHandler) {
      this.toggle.removeEventListener('click', this.toggleHandler)
    }
    this.toggleHandler = null
    if (this.close && this.closeHandler) {
      this.close.removeEventListener('click', this.closeHandler)
    }
    this.closeHandler = null
    this.element?.remove()
    // Dropped so a render still in flight writes into nothing rather than into
    // a card that has been taken off the page.
    this.notesBody = null
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
    const close = `<button type="button" class="close" aria-label="${Methods.i18n(
      'l10nDismiss',
    )}" title="${Methods.i18n('l10nDismissHint')}">${Notice.CLOSE_GLYPH}</button>`
    const heading = [
      notesOnly ? '' : this.statusPill(),
      `<h2 class="name" id="${NAME_ID}">${t(name)}</h2>`,
      `<div class="head-end">${countdown}${toggle}${close}</div>`,
    ].join('')

    // The converted window is only worth the space when it actually differs.
    // Reading the same hours twice, under two labels, says less than reading
    // them once - and the notice is a strip across someone else's page, so the
    // room it does not need is room it should not take.
    const showLocal = timeObj.original.timezone !== timeObj.local.timezone

    const times = notesOnly
      ? ''
      : `<dl class="rows">
          ${Notice.row(Methods.i18n('l10nDeploymentWindow'), timeObj.original)}
          ${showLocal ? Notice.row(Methods.i18n('l10nYourTimezone'), timeObj.local) : ''}
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
              <div class="notes-body"></div>
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
    // role="status" is a polite live region: the window opening or closing is
    // the one thing here worth interrupting for, and it happens while the page
    // is just sitting there with nobody looking at this corner of it.
    return `<span class="pill">${Notice.mark(this.tone())}<span class="status-text" role="status">${status}</span></span>`
  }

  /**
   * The status mark: the toolbar icon this page is currently showing.
   *
   * A plain dot said only "there is a status here". The chevron and the bar say
   * which one, in the same shapes sitting in the toolbar and on the options
   * page, so none of the three has to be learned on its own. The disc comes
   * with them: at this size a bare stroke reads as punctuation.
   */
  private static mark(tone: NoticeTone): string {
    const glyph = GLYPHS[glyphFor(tone)]
    return `<span class="mark"><svg viewBox="${GLYPH_VIEWBOX}" aria-hidden="true" focusable="false"><circle cx="64" cy="64" r="60" fill="currentColor"></circle><path d="${glyph.d}" fill="none" stroke="#fff" stroke-width="${glyph.width}" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>`
  }

  /** The cross on the dismiss control. Drawn here; the shadow root has no React. */
  private static readonly CLOSE_GLYPH =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round"></path></svg>'

  /** Redraw the mark for the current status. */
  private applyMark(): void {
    const glyph = GLYPHS[glyphFor(this.tone())]
    this.markPath?.setAttribute('d', glyph.d)
    this.markPath?.setAttribute('stroke-width', String(glyph.width))
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

  private enableDismiss(): void {
    if (!this.close || this.closeHandler) {
      return
    }
    this.closeHandler = (event: Event) => {
      event.preventDefault()
      this.dismiss()
    }
    this.close.addEventListener('click', this.closeHandler)
  }

  /**
   * Put the notice away for this page view.
   *
   * Not stored anywhere. A reload or a navigation brings it back, and so does
   * the window opening or closing - which is the one thing that could have
   * happened since that is worth saying again.
   */
  dismiss(): void {
    this.dismissed = true
    const host = this.element
    if (!host) {
      return
    }

    host.dataset.dismissed = ''

    // Folding the space up rather than dropping it, so the page below does not
    // jump by the height of the card. A transition needs a number to go from,
    // and `overflow: hidden` while dismissing is also what stops the card's
    // margin escaping the host - so what is measured is the room the notice is
    // actually taking up.
    host.dataset.dismissing = ''
    host.style.height = `${host.scrollHeight}px`
    void host.offsetHeight
    host.style.height = '0px'

    // Nothing here reads the clock, so a fixed wait is honest: this only ends
    // the animation, and CSS has already decided how long that was - including
    // deciding it was instant, for anyone who asked for reduced motion.
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer)
    }
    this.dismissTimer = setTimeout(() => {
      this.dismissTimer = null
      this.settleDismissed()
    }, DISMISS_MS)
  }

  /** Stop animating and let the notice go to `display: none`. */
  private settleDismissed(): void {
    if (!this.element) {
      return
    }
    delete this.element.dataset.dismissing
    this.element.style.removeProperty('height')
  }

  isDismissed(): boolean {
    return this.dismissed
  }

  private restore(): void {
    this.dismissed = false
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer)
      this.dismissTimer = null
    }
    if (this.element) {
      delete this.element.dataset.dismissed
      delete this.element.dataset.dismissing
      this.element.style.removeProperty('height')
    }
  }

  private toggleDetails(event: Event): void {
    event.preventDefault()
    if (!this.details || !this.toggle) {
      return
    }

    const open = this.details.dataset.open !== 'true'
    if (open) {
      void this.renderNotes()
    }
    this.details.dataset.open = String(open)
    this.toggle.setAttribute('aria-expanded', String(open))
    this.toggle.textContent = Methods.i18n(
      open ? 'l10nDetailsHide' : 'l10nDetailsShow',
    )
  }

  /**
   * Render the notes, the first time anyone asks to see them.
   *
   * markdown-it is the largest thing the extension ships and this is the only
   * thing on the page that needs it, so it is fetched on the way to being
   * shown rather than on the way to every page. Notes that are never opened
   * never load it at all.
   */
  private async renderNotes(): Promise<void> {
    if (this.notesRequested || !this.notesBody) {
      return
    }
    this.notesRequested = true

    try {
      const html = await renderMarkdown(this.deployment.notes)
      // The notice may have been torn down while the chunk was in flight.
      if (this.notesBody) {
        this.notesBody.innerHTML = html
      }
    } catch {
      // A chunk that will not load leaves the notes empty rather than the
      // notice broken. Allowed to be retried on the next open.
      this.notesRequested = false
    }
  }

  /** One tick: refresh the clock, the status text and the notice's tone. */
  realTime(): void {
    const { start, end } = this.deployment.timeObj.local

    if (this.clock) {
      this.clock.textContent = Timezones.getCurrentTime()
    }
    // Only written when it actually changed. It is a live region and this runs
    // every second, so re-assigning the same sentence would have a screen
    // reader announce "deployment window open" once a second, all day.
    const status = DW.statusText(start, end)
    if (this.statusText && this.statusText.textContent !== status) {
      this.statusText.textContent = status
    }
    if (this.countdown) {
      this.countdown.textContent = this.countdownText()
    }
    if (this.card && this.card.dataset.status !== this.tone()) {
      this.card.dataset.status = this.tone()
      this.applyMark()
      // Whatever was true when it was waved away is not true any more.
      this.restore()
      this.flip()
    }

    this.updateIcon()
  }
}
