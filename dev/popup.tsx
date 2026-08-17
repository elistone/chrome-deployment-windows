import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { installChromeShim } from './chromeShim'
import { ensureSeeded } from './seed'

// Must run before the popup module is loaded: it reaches for chrome on mount.
installChromeShim()
ensureSeeded()

const { default: Popup } = await import('../src/ui/components/Popup')
await import('../src/styles/popup.css')

const container = document.getElementById('root')!
createRoot(container).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
