import { isValidTimezone } from '../components/Timezones'
import type { DeploymentWindowsConfig } from './types'

/**
 * Validation for the user-editable config.
 *
 * Deliberately hand written rather than schema-driven. Ajv (and every other
 * runtime JSON Schema compiler) builds validators with `new Function`, which
 * Manifest V3 forbids on extension pages: the CSP is `script-src 'self'` with
 * no `unsafe-eval` escape hatch, so the options page threw an EvalError the
 * moment a schema was compiled. Precompiling schemas at build time would work
 * too, but for a config this small a direct validator is less machinery and
 * has no generated artefact to keep in step.
 *
 * Error strings follow the JSON Schema convention - a JSON Pointer path plus a
 * "must ..." message - so they stay familiar and are safe to show verbatim.
 */

import { WEEKDAYS, isWeekday } from '../components/weekdays'
import { isCssSpacing } from './css'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const INSERT_POSITIONS = ['before', 'after'] as const

const TIME_KNOWN_KEYS = new Set(['start', 'end', 'timezone', 'days'])

const DEPLOYMENT_KNOWN_KEYS = new Set([
  'name',
  'notes',
  'time',
  'case-sensitive',
  'notes-only',
])

export interface ValidationResult {
  valid: boolean
  /** Human readable, one message per problem, safe to show in the options UI. */
  errors: string[]
}

class Errors {
  readonly messages: string[] = []

  add(path: string, message: string): void {
    this.messages.push(`${path || '(root)'} ${message}`.trim())
  }

  required(path: string, key: string): void {
    this.add(path, `must have required property '${key}'`)
  }

  type(path: string, expected: string): void {
    this.add(path, `must be ${expected}`)
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value)
  )
}

/** Escape a property name for use in a JSON Pointer path. */
function join(path: string, key: string): string {
  return `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`
}

function validateDomains(value: unknown, path: string, errors: Errors): void {
  if (!isPlainObject(value)) {
    errors.type(path, 'object')
    return
  }

  for (const [key, patterns] of Object.entries(value)) {
    const at = join(path, key)
    if (!Array.isArray(patterns)) {
      errors.type(at, 'array')
      continue
    }
    if (patterns.length === 0) {
      errors.add(at, 'must NOT have fewer than 1 items')
    }
    patterns.forEach((pattern, index) => {
      const itemPath = join(at, String(index))
      if (typeof pattern !== 'string') {
        errors.type(itemPath, 'string')
      } else if (pattern.length === 0) {
        errors.add(itemPath, 'must NOT have fewer than 1 characters')
      }
    })
  }
}

function validateInsert(value: unknown, path: string, errors: Errors): void {
  if (!Array.isArray(value)) {
    errors.type(path, 'array')
    return
  }

  value.forEach((entry, index) => {
    const at = join(path, String(index))
    if (!isPlainObject(entry)) {
      errors.type(at, 'object')
      return
    }

    if (!('class' in entry)) {
      errors.required(at, 'class')
    } else if (typeof entry.class !== 'string' || entry.class.length === 0) {
      errors.add(join(at, 'class'), 'must be a non-empty string')
    }

    if (!('position' in entry)) {
      errors.required(at, 'position')
    } else if (
      !INSERT_POSITIONS.includes(entry.position as (typeof INSERT_POSITIONS)[number])
    ) {
      errors.add(
        join(at, 'position'),
        'must be equal to one of the allowed values: before, after',
      )
    }

    for (const key of Object.keys(entry)) {
      if (key !== 'class' && key !== 'position') {
        errors.add(at, `must NOT have additional properties ('${key}')`)
      }
    }
  })
}

function validateStyle(value: unknown, path: string, errors: Errors): void {
  if (!isPlainObject(value)) {
    errors.type(path, 'object')
    return
  }

  for (const key of ['margin', 'padding', 'maxWidth']) {
    if (!(key in value)) {
      continue
    }
    const entry = value[key]
    if (typeof entry !== 'string') {
      errors.type(join(path, key), 'string')
    } else if (entry.length > 0 && !isCssSpacing(entry)) {
      errors.add(join(path, key), 'must be a CSS length, such as 1rem or 12px')
    }
  }

  for (const key of Object.keys(value)) {
    if (key !== 'margin' && key !== 'padding' && key !== 'maxWidth') {
      errors.add(path, `must NOT have additional properties ('${key}')`)
    }
  }
}

function validateSites(value: unknown, path: string, errors: Errors): void {
  if (!isPlainObject(value)) {
    errors.type(path, 'object')
    return
  }

  for (const [key, site] of Object.entries(value)) {
    const at = join(path, key)
    if (!isPlainObject(site)) {
      errors.type(at, 'object')
      continue
    }

    if (!('insert' in site)) {
      errors.required(at, 'insert')
    } else {
      validateInsert(site.insert, join(at, 'insert'), errors)
    }

    if ('style' in site) {
      validateStyle(site.style, join(at, 'style'), errors)
    }

    for (const extra of Object.keys(site)) {
      // `classes` is v1's styling, which the notice no longer borrows. It is
      // still accepted so that an existing config validates, and Config drops
      // it on load rather than failing someone's whole setup over it.
      if (extra !== 'insert' && extra !== 'style' && extra !== 'classes') {
        errors.add(at, `must NOT have additional properties ('${extra}')`)
      }
    }
  }
}

function validateTime(value: unknown, path: string, errors: Errors): void {
  if (!isPlainObject(value)) {
    errors.type(path, 'object')
    return
  }

  for (const key of ['start', 'end'] as const) {
    if (!(key in value)) {
      errors.required(path, key)
    } else if (typeof value[key] !== 'string') {
      errors.type(join(path, key), 'string')
    } else if (!TIME_PATTERN.test(value[key] as string)) {
      errors.add(
        join(path, key),
        'must match pattern "^([01]\\d|2[0-3]):[0-5]\\d$" (24 hour HH:mm)',
      )
    }
  }

  if (!('timezone' in value)) {
    errors.required(path, 'timezone')
  } else if (
    typeof value.timezone !== 'string' ||
    value.timezone.length === 0
  ) {
    errors.add(join(path, 'timezone'), 'must be a non-empty string')
  } else if (!isValidTimezone(value.timezone)) {
    // Caught here so a typo is rejected while the user is looking at the
    // editor. At runtime an unknown zone makes dayjs throw, which used to take
    // the whole notice down.
    errors.add(
      join(path, 'timezone'),
      `must be a known IANA timezone (got "${value.timezone}")`,
    )
  }

  if ('days' in value) {
    validateDays(value.days, join(path, 'days'), errors)
  }

  for (const extra of Object.keys(value)) {
    if (!TIME_KNOWN_KEYS.has(extra)) {
      errors.add(path, `must NOT have additional properties ('${extra}')`)
    }
  }
}

/**
 * Which days a window opens on.
 *
 * Rejected rather than quietly filtered: a config is something people read and
 * copy between machines, so `"monday"` where `"mon"` was meant is worth naming
 * where it was written. At runtime the same value is filtered instead, because
 * by then there is nobody to tell.
 */
function validateDays(value: unknown, path: string, errors: Errors): void {
  if (!Array.isArray(value)) {
    errors.type(path, 'array')
    return
  }

  const seen = new Set<string>()
  value.forEach((entry, index) => {
    const at = `${path}/${String(index)}`
    if (!isWeekday(entry)) {
      errors.add(
        at,
        `must be one of ${WEEKDAYS.map((day) => `"${day}"`).join(', ')}`,
      )
      return
    }
    if (seen.has(entry)) {
      errors.add(at, `must not repeat a day ("${entry}")`)
    }
    seen.add(entry)
  })
}

function validateDeployments(value: unknown, path: string, errors: Errors): void {
  if (!isPlainObject(value)) {
    errors.type(path, 'object')
    return
  }

  for (const [key, deployment] of Object.entries(value)) {
    const at = join(path, key)
    if (!isPlainObject(deployment)) {
      errors.type(at, 'object')
      continue
    }

    if ('name' in deployment && typeof deployment.name !== 'string') {
      errors.type(join(at, 'name'), 'string')
    }
    if ('notes' in deployment && typeof deployment.notes !== 'string') {
      errors.type(join(at, 'notes'), 'string')
    }
    for (const flag of ['case-sensitive', 'notes-only'] as const) {
      if (flag in deployment && typeof deployment[flag] !== 'boolean') {
        errors.type(join(at, flag), 'boolean')
      }
    }
    if ('time' in deployment) {
      validateTime(deployment.time, join(at, 'time'), errors)
    }

    // Anything else is a per-domain url fragment and must be a string.
    for (const [extra, extraValue] of Object.entries(deployment)) {
      if (!DEPLOYMENT_KNOWN_KEYS.has(extra) && typeof extraValue !== 'string') {
        errors.type(join(at, extra), 'string')
      }
    }
  }
}

/** Validate an unknown value against the config rules. */
export function validateConfig(value: unknown): ValidationResult {
  const errors = new Errors()

  if (!isPlainObject(value)) {
    errors.type('', 'object')
    return { valid: false, errors: errors.messages }
  }

  for (const section of ['domains', 'sites', 'deployments'] as const) {
    if (!(section in value)) {
      errors.required('', section)
    }
  }

  for (const key of Object.keys(value)) {
    if (key !== 'domains' && key !== 'sites' && key !== 'deployments') {
      errors.add('', `must NOT have additional properties ('${key}')`)
    }
  }

  if ('domains' in value) validateDomains(value.domains, '/domains', errors)
  if ('sites' in value) validateSites(value.sites, '/sites', errors)
  if ('deployments' in value) {
    validateDeployments(value.deployments, '/deployments', errors)
  }

  return { valid: errors.messages.length === 0, errors: errors.messages }
}

export function isValidConfig(value: unknown): value is DeploymentWindowsConfig {
  return validateConfig(value).valid
}
