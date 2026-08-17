import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'

import { installChromeMock, resetChromeMock } from './helpers/chromeMock'

beforeEach(() => {
  // Reinstalled per test so a mockReturnValue set in one test cannot leak into
  // the next, and reset so the backing state starts clean.
  installChromeMock()
  resetChromeMock()
})

afterEach(() => {
  cleanup()
})
