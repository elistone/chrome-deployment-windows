import { installChromeShim, getSimulatedTabUrl } from './chromeShim'
import { ensureSeeded } from './seed'

installChromeShim()
ensureSeeded()

const { DW } = await import('../src/app/components/DW')
const { Notice } = await import('../src/app/components/Notice')
await import('./hostPage.css')

/**
 * Mimics what the content script does, but against the harness's simulated tab
 * URL instead of window.location.href, inside a stand-in for the host page.
 *
 * The insert anchors below carry the same class names the default config looks
 * for, so insertion is exercised for real rather than faked.
 */
const root = document.getElementById('root')!

root.innerHTML = `
  <div class="host-chrome">
    <span class="host-dot"></span><span class="host-dot"></span><span class="host-dot"></span>
    <span class="host-url" id="host-url"></span>
  </div>
  <div class="host-page">
    <div class="host-header">acme / <strong>repository</strong></div>
    <div class="mod-header">jira anchor (.mod-header)</div>
    <div class="file-navigation">github anchor (.file-navigation)</div>
    <div class="repository-content">
      github anchor (.repository-content)
      <p>Stand-in for the host page body.</p>
    </div>
  </div>
  <p class="host-empty" id="host-empty" hidden>
    Nothing injected for this URL &mdash; no configured deployment matches it.
  </p>
`

const url = getSimulatedTabUrl()
document.getElementById('host-url')!.textContent = url

const dw = await DW.create(url)
const deployment = dw.getDeploymentInfo()

if (deployment) {
  const notice = new Notice(deployment)
  notice.build()
  const inserted = notice.insert()
  if (!inserted) {
    document.getElementById('host-empty')!.hidden = false
  }
} else {
  document.getElementById('host-empty')!.hidden = false
}
