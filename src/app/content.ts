import { DW } from './components/DW'
import { Notice } from './components/Notice'

import '../styles/content.css'

/**
 * Content script entry point.
 *
 * The manifest uses `run_at: document_idle`, so the DOM is already parsed by the
 * time this runs; the v1 readyState polling loop is gone.
 */
async function init(): Promise<void> {
  const dw = await DW.create(window.location.href)
  const deployment = dw.getDeploymentInfo()
  if (!deployment) {
    return
  }

  const notice = new Notice(deployment)
  notice.build()
  notice.insert()
}

void init().catch((error: unknown) => {
  console.error('[deployment-windows] failed to initialise', error)
})
