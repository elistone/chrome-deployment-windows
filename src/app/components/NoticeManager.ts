import { DW } from './DW'
import { Notice } from './Notice'

/** Mutations arrive in bursts; one pass per burst is enough. */
const SYNC_DEBOUNCE_MS = 150

export interface NoticeManagerOptions {
  /** Overridable so the manager can be driven without a real location. */
  currentUrl?: () => string
  /** The subtree to watch for the host page tearing the notice out. */
  root?: Node
}

/**
 * Keeps exactly one notice on the page, for as long as the page is showing a
 * deployment we know about.
 *
 * A content script runs once per document, which was enough when GitHub served
 * a new document per click. It no longer does: the repository tabs, the file
 * browser and Jira's boards all swap their content region in place. That both
 * throws away an already injected notice - it lives inside the region being
 * replaced - and changes which deployment should be showing, with no page load
 * to notice either. So rather than injecting once and hoping, the manager
 * re-checks after every burst of DOM changes, and after every history move.
 *
 * The check is deliberately cheap. Unless the URL has changed or the notice has
 * been detached, it does nothing at all, which is the outcome for almost every
 * mutation on a page as busy as GitHub's.
 */
export class NoticeManager {
  private readonly currentUrl: () => string
  private readonly root: Node

  private notice: Notice | null = null
  private deploymentKey: string | null = null
  private url: string | null = null

  private observer: MutationObserver | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  /** A sync is in flight; DW.create has to wait on storage. */
  private running = false
  /** Something changed while a sync was in flight, so run once more after it. */
  private queued = false

  constructor(options: NoticeManagerOptions = {}) {
    this.currentUrl = options.currentUrl ?? (() => window.location.href)
    this.root = options.root ?? document.documentElement
  }

  /** Watch the page, then place the notice for wherever it is right now. */
  async start(): Promise<void> {
    // Watching before the first sync means a swap that lands mid-resolution is
    // still seen, rather than falling into the gap.
    this.observer = new MutationObserver(() => this.schedule())
    this.observer.observe(this.root, { childList: true, subtree: true })
    window.addEventListener('popstate', this.onHistoryMove)

    await this.sync()
  }

  /** Stop watching and take the notice away. */
  stop(): void {
    this.observer?.disconnect()
    this.observer = null
    window.removeEventListener('popstate', this.onHistoryMove)
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.clear()
  }

  /** Bring the page back into line with the config. */
  async sync(): Promise<void> {
    if (this.running) {
      this.queued = true
      return
    }

    this.running = true
    try {
      await this.run()
    } finally {
      this.running = false
    }

    if (this.queued) {
      this.queued = false
      await this.sync()
    }
  }

  private onHistoryMove = (): void => {
    this.schedule()
  }

  private schedule(): void {
    if (this.timer !== null) {
      return
    }
    this.timer = setTimeout(() => {
      this.timer = null
      void this.sync()
    }, SYNC_DEBOUNCE_MS)
  }

  private async run(): Promise<void> {
    const href = this.currentUrl()

    if (href === this.url) {
      // Same page. The only thing that can need doing is putting the notice
      // back after the host page has replaced the region it was sitting in.
      if (this.notice?.needsInsert()) {
        this.notice.insert()
      }
      return
    }

    this.url = href
    const deployment = (await DW.create(href)).getDeploymentInfo()

    if (!deployment) {
      this.clear()
      return
    }

    if (deployment.key !== this.deploymentKey) {
      // A different project: the old notice's times and notes are no longer
      // the right ones, so it goes rather than being moved.
      this.clear()
      this.notice = new Notice(deployment)
      this.deploymentKey = deployment.key
    }

    this.notice?.insert()
  }

  private clear(): void {
    this.notice?.destroy()
    this.notice = null
    this.deploymentKey = null
  }
}
