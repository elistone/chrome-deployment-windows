import type { ResolvedDeployment } from '../config/types'
import { Methods } from './Methods'
import { TextFormatter } from './TextFormatter'
import { Timezones } from './Timezones'
import { DW } from './DW'

const REALTIME_INTERVAL_MS = 1000

export const ICONS = {
  open: 'icons/success/icon48.png',
  closed: 'icons/error/icon48.png',
} as const

/**
 * Builds and injects the in-page notice, then keeps its clock and status fresh.
 *
 * Every lookup of the notice's own parts goes through references captured at
 * build time rather than a document-wide class query. The notice is injected
 * into pages we do not control, and `document.getElementsByClassName(...)[0]`
 * would happily return a host page element that happened to share the class -
 * reading the wrong node, or worse, overwriting it.
 */
export class Notice {
  readonly deployment: ResolvedDeployment
  element: HTMLDivElement | null = null
  inserted = false

  private realTimeTimer: ReturnType<typeof setInterval> | null = null
  private toggleHandler: ((event: Event) => void) | null = null
  /** Avoids messaging the service worker every tick when nothing changed. */
  private lastIcon: string | null = null

  // Captured from the built element, never from the document.
  private timeText: HTMLElement | null = null
  private statusText: HTMLElement | null = null
  private details: HTMLElement | null = null
  private toggle: HTMLElement | null = null

  constructor(deployment: ResolvedDeployment) {
    this.deployment = deployment
  }

  /** Build the notice element. Does not touch the document. */
  build(): HTMLDivElement {
    const { start, end } = this.deployment.timeObj.local
    const notice = document.createElement('div')
    notice.innerHTML = this.getContent()
    notice.className = this.getDeploymentClass(start, end)
    notice.style.marginBottom = '1.25em'

    this.element = notice
    this.timeText = notice.querySelector('.dw-current-time-text')
    this.statusText = notice.querySelector('.dw-current-status-text')
    this.details = notice.querySelector('.dw-details')
    this.toggle = notice.querySelector('.dw-toggle')

    return notice
  }

  /**
   * Try each configured insert location in order, stopping at the first hit, so
   * the notice is only ever added once per page.
   */
  insert(): boolean {
    const element = this.element ?? this.build()
    this.inserted = false

    for (const location of this.deployment.domainInfo.insert ?? []) {
      if (location.position === 'after') {
        this.inserted = Methods.insertAfter(element, location.class)
      } else if (location.position === 'before') {
        this.inserted = Methods.insertBefore(element, location.class)
      }
      if (this.inserted) {
        break
      }
    }

    if (this.inserted) {
      this.enableToggleDetails()
      this.enableRealTime()
    }

    return this.inserted
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
  }

  private getContent(): string {
    const { timeObj, name, notes, notesOnly } = this.deployment
    return notesOnly
      ? Notice.contentNotesOnly(name, notes)
      : this.contentDeployment(timeObj.original, timeObj.local, name, notes)
  }

  private contentDeployment(
    ogTime: ResolvedDeployment['timeObj']['original'],
    lcTime: ResolvedDeployment['timeObj']['local'],
    nameTxt: string,
    notesTxt: string,
  ): string {
    const status = DW.statusText(lcTime.start, lcTime.end)
    const t = TextFormatter.stripTags

    const name = `<span class="dw-current-name"><strong>${t(nameTxt)}</strong></span>`
    const currentTime = `<span class="dw-current-time"><strong>${Methods.i18n('l10nCurrentTime')}:</strong> <span class="dw-current-time-text">${t(Timezones.getCurrentTime())}</span></span>`
    const currentStatus = `<span class="dw-current-status"><strong>${Methods.i18n('l10nStatus')}:</strong> <span class="dw-current-status-text">${t(status)}</span></span>`
    const deploymentTime = `<span class="dw-deployment-time"><strong>${Methods.i18n('l10nDeploymentWindow')}:</strong> ${t(ogTime.start)} - ${t(ogTime.end)} <small>(${t(ogTime.timezone)})</small></span>`
    const localTime = `<span class="dw-local-time"><strong>${Methods.i18n('l10nYourTimezone')}:</strong> ${t(lcTime.start)} - ${t(lcTime.end)} <small>(${t(lcTime.timezone)})</small></span>`

    const hasNotes = notesTxt.length > 0
    const showDetails = hasNotes
      ? `<a href="#" class="dw-toggle">${Methods.i18n('l10nDetailsShow')}</a>`
      : ''
    const textDetails = hasNotes
      ? `<div class="dw-details" style="display: none;"><strong>${Methods.i18n('l10nNotes')}</strong><br><span class="dw-notes">${TextFormatter.toMarkdown(notesTxt)}</span></div>`
      : ''

    return [
      `<div class='dw-notice-row dw-notice-row-0'>${name} ${showDetails}</div>`,
      `<div class='dw-notice-row dw-notice-row-1'>${deploymentTime} ${currentTime}</div>`,
      `<div class='dw-notice-row dw-notice-row-2'>${localTime} ${currentStatus}</div>`,
      `<div class='dw-notice-row dw-notice-row-3'>${textDetails}</div>`,
    ].join('')
  }

  private static contentNotesOnly(nameTxt: string, notesTxt: string): string {
    const name = `<span class="dw-current-name"><strong>${TextFormatter.stripTags(nameTxt)}</strong></span>`
    const textDetails = `<div class="dw-details"><strong>${Methods.i18n('l10nNotes')}</strong><br><span class="dw-notes">${TextFormatter.toMarkdown(notesTxt)}</span></div>`

    return [
      `<div class='dw-notice-row dw-notice-row-0'>${name}</div>`,
      `<div class='dw-notice-row dw-notice-row-1'>${textDetails}</div>`,
    ].join('')
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
    this.realTimeTimer = setInterval(() => this.realTime(), REALTIME_INTERVAL_MS)
  }

  private enableToggleDetails(): void {
    if (!this.toggle) {
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

    if (Methods.isHidden(this.details)) {
      this.details.style.display = 'block'
      this.toggle.textContent = Methods.i18n('l10nDetailsHide')
    } else {
      this.details.style.display = 'none'
      this.toggle.textContent = Methods.i18n('l10nDetailsShow')
    }
  }

  /** One tick: refresh clock, status text and the notice's own classes. */
  realTime(): void {
    const { start, end } = this.deployment.timeObj.local

    if (this.timeText) {
      this.timeText.textContent = Timezones.getCurrentTime()
    }
    if (this.statusText) {
      this.statusText.textContent = DW.statusText(start, end)
    }
    if (this.element) {
      this.element.className = this.getDeploymentClass(start, end)
    }

    this.updateIcon()
  }

  private getDeploymentClass(startTime: string, endTime: string): string {
    const classes = this.deployment.domainInfo.classes
    let deploymentClass = DW.canDeploy(startTime, endTime)
      ? classes.deploy
      : classes['no-deploy']

    if (this.deployment.notesOnly && classes.notes) {
      deploymentClass = classes.notes
    }

    return `dw-notification ${deploymentClass}`
  }
}
