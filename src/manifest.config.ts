import { defineManifest } from '@crxjs/vite-plugin'

import { iconPaths } from './app/icons'
import pkg from '../package.json' with { type: 'json' }

/**
 * Manifest V3.
 *
 * Notable differences from the V2 manifest this replaced:
 *  - `background.scripts` + `persistent: true` became a single `service_worker`,
 *    which is ephemeral. Nothing may be cached in module scope across
 *    invocations - see src/app/background.ts.
 *  - `browser_action` became `action` (and `chrome.browserAction` -> `chrome.action`).
 *  - Host access moved out of `permissions` into `host_permissions`.
 *  - `content_security_policy` became an object keyed by context.
 *
 * Icon paths are runtime paths: everything under public/ is copied to the root
 * of dist/ by Vite, so public/icons/default/icon16.png is served as
 * icons/default/icon16.png. src/app/icons.ts owns that mapping, because the
 * service worker needs the same paths at runtime.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'Deployment windows',
  version: pkg.version,
  description:
    'Apply reminders on to sites to give information about deployment windows.',
  default_locale: 'en',

  icons: iconPaths('default'),

  action: {
    default_title: 'Deployment windows',
    default_popup: 'src/ui/popup.html',
  },

  options_page: 'src/ui/options.html',

  background: {
    service_worker: 'src/app/background.ts',
    type: 'module',
  },

  // `favicon` serves chrome-extension://<id>/_favicon/, which reads the icons
  // Chrome has already cached. The options page uses it to label each site, and
  // it is what keeps that from becoming a network request to every configured
  // host - or worse, to a third party favicon service.
  permissions: ['storage', 'tabs', 'favicon'],

  host_permissions: ['https://*/*'],

  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },

  content_scripts: [
    {
      matches: ['https://*/*'],
      js: ['src/app/content.ts'],
      run_at: 'document_idle',
    },
  ],
})
