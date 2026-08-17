import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { installChromeShim } from './chromeShim'
import { ensureSeeded } from './seed'

installChromeShim()
ensureSeeded()

const { default: Options } = await import('../src/ui/components/Options')
await import('../src/styles/options.css')

const container = document.getElementById('root')!
createRoot(container).render(
  <StrictMode>
    <Options />
  </StrictMode>,
)
