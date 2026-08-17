import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'

import { installChromeMock, resetChromeMock } from './helpers/chromeMock'
import { Timezones } from '../src/app/components/Timezones'

beforeEach(() => {
  // Reinstalled per test so a mockReturnValue set in one test cannot leak into
  // the next, and reset so the backing state starts clean.
  installChromeMock()
  resetChromeMock()
})

afterEach(() => {
  cleanup()
  // Timezones.currentDate is static, so a test that pins "today" would
  // otherwise leak that date into every test after it.
  Timezones.currentDate = null
})
