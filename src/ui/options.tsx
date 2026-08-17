import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import Options from './components/Options'

import '../styles/options.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('options: #root container is missing')
}

createRoot(container).render(
  <StrictMode>
    <Options />
  </StrictMode>,
)
