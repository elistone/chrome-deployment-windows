import type { DeploymentWindowsConfig } from '../../src/app/config/types'

/**
 * A config covering the shapes the tests care about: two domains, a normal
 * window, a wrapping window, a notes-only entry and a case-sensitive entry.
 */
export function testConfig(): DeploymentWindowsConfig {
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
      },
      jira: {
        insert: [{ class: 'mod-header', position: 'before' }],
      },
    },
    deployments: {
      daytime: {
        name: 'Daytime project',
        github: 'acme/daytime',
        notes: 'Deploys need **two** approvals.',
        time: { start: '09:00', end: '17:00', timezone: 'Europe/London' },
      },
      overnight: {
        name: 'Overnight project',
        github: 'acme/overnight',
        jira: 'BOARD-9',
        time: { start: '23:00', end: '02:00', timezone: 'Europe/London' },
      },
      notesOnly: {
        name: 'Notes only project',
        github: 'acme/notes-only',
        notes: 'Frozen until Q3.',
        'notes-only': true,
      },
      cased: {
        name: 'Case sensitive project',
        github: 'acme/CaseSensitive',
        'case-sensitive': true,
      },
      untimed: {
        name: 'Untimed project',
        github: 'acme/untimed',
      },
    },
  }
}

/** A minimal page with the elements the github insert rules look for. */
export function renderGithubPage(): void {
  document.body.innerHTML = `
    <div id="page">
      <div class="file-navigation">nav</div>
      <div class="repository-content">content</div>
    </div>
  `
}
