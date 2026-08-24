import { NoticeManager } from './components/NoticeManager'

/**
 * Content script entry point.
 *
 * The manifest uses `run_at: document_idle`, so the DOM is already parsed by the
 * time this runs; the v1 readyState polling loop is gone. Everything after that
 * first pass is the manager's job - see NoticeManager for why one pass is not
 * enough on a site that navigates without reloading.
 */
const manager = new NoticeManager()

void manager.start().catch((error: unknown) => {
  console.error('[deployment-windows] failed to initialise', error)
})
