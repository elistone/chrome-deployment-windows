import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import Options from './components/Options'
import { applyTheme, loadTheme } from './theme'

import '../styles/options.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('options: #root container is missing')
}

// Painted before the first render so a stored "light" choice does not flash
// dark (or the reverse) while storage is being read.
applyTheme(await loadTheme())

createRoot(container).render(
  <StrictMode>
    <Options />
  </StrictMode>,
)
