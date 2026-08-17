import type { DeploymentWindowsConfig } from '../src/app/config/types'

/** HH:mm, `hours` away from now, in the machine's own timezone. */
function offsetFromNow(hours: number): string {
  const at = new Date(Date.now() + hours * 60 * 60 * 1000)
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Sample config for the harness.
 *
 * Windows are built relative to the current time rather than hard coded, so the
 * "open" and "closed" examples always demonstrate what their names say without
 * anyone having to wait for a particular hour.
 */
export function devConfig(): DeploymentWindowsConfig {
  const timezone = localTimezone()

  return {
    domains: {
      github: ['*://*.github.com/*'],
      jira: ['*://*.atlassian.net/*'],
    },
    sites: {
      github: {
        insert: [
          { class: 'file-navigation', position: 'after' },
          { class: 'repository-content', position: 'before' },
        ],
        classes: {
          deploy: 'flash flash-success',
          'no-deploy': 'flash flash-error',
          notes: 'flash flash-warn',
        },
      },
      jira: {
        insert: [{ class: 'mod-header', position: 'before' }],
        classes: {
          deploy: 'aui-message aui-message-success',
          'no-deploy': 'aui-message aui-message-error',
        },
      },
    },
    deployments: {
      daytime: {
        name: 'Daytime project (open now)',
        github: 'acme/daytime',
        notes:
          'Deploys need **two** approvals.\n\n- Check the dashboard first\n- Post in #releases',
        time: { start: offsetFromNow(-2), end: offsetFromNow(2), timezone },
      },
      overnight: {
        name: 'Overnight project (closed now)',
        github: 'acme/overnight',
        notes: 'Overnight window only.',
        time: { start: offsetFromNow(3), end: offsetFromNow(5), timezone },
      },
      crossZone: {
        name: 'Cross timezone project',
        github: 'acme/cross-zone',
        notes: 'Configured in Tokyo time, to exercise the conversion.',
        time: { start: '09:00', end: '17:00', timezone: 'Asia/Tokyo' },
      },
      notesOnly: {
        name: 'Notes only project',
        github: 'acme/notes-only',
        notes: 'Frozen until Q3. **No deploys at all.**',
        'notes-only': true,
      },
    },
  }
}

export interface Scenario {
  label: string
  url: string
  description: string
}

/** The simulated tab URLs offered in the harness control bar. */
export const SCENARIOS: Scenario[] = [
  {
    label: 'Window open',
    url: 'https://github.com/acme/daytime',
    description: 'Inside the window: success styling, notes behind a toggle',
  },
  {
    label: 'Window closed',
    url: 'https://github.com/acme/overnight',
    description: 'Outside the window: error styling',
  },
  {
    label: 'Cross timezone',
    url: 'https://github.com/acme/cross-zone',
    description: 'Tokyo window converted into your local time',
  },
  {
    label: 'Notes only',
    url: 'https://github.com/acme/notes-only',
    description: 'No window or status, notes shown immediately',
  },
  {
    label: 'No match',
    url: 'https://github.com/acme/not-configured',
    description: 'Domain matches but no deployment does: nothing renders',
  },
  {
    label: 'Other domain',
    url: 'https://example.com/somewhere',
    description: 'Domain does not match at all',
  },
]
