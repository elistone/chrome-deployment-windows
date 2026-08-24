import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import Popup from './components/Popup'
import { applyTheme, loadTheme } from './theme'

import '../styles/popup.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('popup: #root container is missing')
}

// Painted before the first render so the popup opens in the theme chosen on
// the options page rather than flashing the other one.
applyTheme(await loadTheme())

createRoot(container).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
