# Chrome Deployment Windows Extension

The `Deployment Windows` extension adds alerts to pages such as `github.com` and `jira.com`, to notify and remind you that some projects/code can only be deployed during certain hours of the day.

The extension aims to be flexible in what can be displayed, however it is still a work in progress.

## Table of contents

* [Using the extension](#using-the-extension)
* [Working on the extension](#working-on-the-extension)
  * [Requirements](#requirements)
  * [Setup](#setup)
  * [Making changes](#making-changes)
  * [Testing](#testing)
  * [Packaging a release](#packaging-a-release)
* [Project layout](#project-layout)
* [Credits](#credits)

---

## Using the extension

How to use the extension can be [found here](/src/documents/HowToUse.md).

## Working on the extension

### Requirements

* **Node 22.22.2 or newer** — the version is pinned in `.nvmrc`, and `.npmrc` sets
  `use-node-version`, so pnpm downloads and uses the right Node for this repo
  automatically without touching your global install.
* **pnpm 10** — enable it with `corepack enable` if you do not have it.

### Setup

1. `pnpm install`
2. `pnpm build`
3. Go to `chrome://extensions/`
4. Toggle "Developer mode"
5. Press "Load unpacked"
6. Select the `dist` folder of this project
7. The extension is now installed

### Making changes

```text
pnpm dev
```

Vite serves the extension with hot module replacement for the popup and options
pages. Content script changes still need the extension reloaded from
`chrome://extensions/` and the page refreshed.

For a one-off production build, use `pnpm build`.

### Testing

| Command | What it does |
| --- | --- |
| `pnpm test` | Unit and component tests (Vitest + Testing Library) |
| `pnpm test:watch` | The same, in watch mode |
| `pnpm test:coverage` | Unit tests with a coverage report |
| `pnpm test:e2e` | Builds, then drives a real Chromium with the extension loaded (Playwright) |
| `pnpm test:e2e:ui` | The same, in Playwright's UI mode |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm check` | typecheck + lint + unit tests |

Playwright needs its browser once: `pnpm exec playwright install chromium`.

The end-to-end tests stub `https://` responses rather than hitting the network,
because the extension only matches `https` URLs. They also assert the options
page loads cleanly under the Manifest V3 content security policy — a check worth
keeping, since MV3 forbids `unsafe-eval` and that has already broken one
dependency here.

### Packaging a release

```text
pnpm package
```

Builds, then writes `release/deployment-windows-v<version>.zip`, ready to upload.
Source maps are excluded from the zip.

`pnpm check:manifest` validates the built manifest separately — it is also run in
CI, and catches Manifest V2 constructs creeping back in or the manifest pointing
at files the build did not emit.

## Project layout

```text
src/
  manifest.config.ts     Manifest V3, generated at build time by @crxjs/vite-plugin
  app/
    background.ts        MV3 service worker (toolbar icon swapping)
    content.ts           Content script entry point
    components/          DW (resolution), Notice (injection), Timezones, helpers
    config/              Storage access, types and validation
    matching/            Chrome match-pattern implementation
  ui/
    popup.html/.tsx      Browser action popup
    options.html/.tsx    Options page
    components/          React components for both pages
  styles/                Plain CSS
  documents/HowToUse.md  Rendered inside the options page
public/                  Copied verbatim to dist/ (icons, _locales)
tests/                   Vitest unit and component tests
e2e/                     Playwright end-to-end tests
scripts/                 Manifest check and release packaging
```

---

## Credits

### Icon

Icons made by [Nhor Phai](https://www.flaticon.com/authors/nhor-phai) from [www.flaticon.com](https://www.flaticon.com/)
