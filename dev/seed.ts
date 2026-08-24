import { STORAGE_KEYS } from '../src/app/config/Config'
import { devConfig } from './presets'
import { readDevStorage, writeDevStorage } from './chromeShim'

/**
 * Put the sample config into the shim's storage the first time the harness
 * runs. Subsequent runs leave whatever is stored alone, so edits made in the
 * options page survive a reload.
 */
export function ensureSeeded(): void {
  const stored = readDevStorage()
  if (STORAGE_KEYS.domains in stored) {
    return
  }
  reseed()
}

/** Overwrite storage with the sample config. */
export function reseed(): void {
  const config = devConfig()
  writeDevStorage({
    [STORAGE_KEYS.domains]: config.domains,
    [STORAGE_KEYS.sites]: config.sites,
    [STORAGE_KEYS.deployments]: config.deployments,
  })
}
