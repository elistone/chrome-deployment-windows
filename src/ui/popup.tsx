import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import Popup from './components/Popup'

import '../styles/popup.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('popup: #root container is missing')
}

createRoot(container).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
