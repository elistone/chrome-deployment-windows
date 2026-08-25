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

Everything is configured on the extension's options page, which is a single
dashboard: every deployment and site is visible at once with its live status,
and an **Edit mode** switch reveals the controls for adding, changing and
removing entries. The raw JSON config is still there, collapsed at the bottom,
for copying a setup between machines.

The toolbar popup answers the same question for whichever page you are on:
whether the window is open right now, when it opens in both its own timezone
and yours, and any notes attached to it. It also edits: the entry behind what it
is showing, or a new one for a page that has none yet, so a wrong window can be
corrected from where it was noticed. It follows the light/dark choice made on
the options page, and can be switched from its own footer.

A **shared config** can be pointed at a JSON file on an https address, for a
team that deploys the same projects to the same windows. It is fetched hourly
and merged *underneath* everything configured locally, so any single entry can
still be corrected - or deleted - on the machine that needs it, without the
change going anywhere near the file. Entries still tracking the file are marked
"Shared" on the dashboard.

The full guide is [found here](/src/documents/HowToUse.md), and is also
available from the "How to use" link in the options page header.

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

There are two dev modes, and most day-to-day UI work wants the first.

#### `pnpm harness` — no extension install needed

```text
pnpm harness
```

Opens <http://localhost:5180> with a plain web app that renders the **real**
popup, options page and in-page notice against a `localStorage`-backed stand-in
for the `chrome.*` APIs. Nothing has to be loaded into Chrome, so the
edit/refresh loop is just a page reload.

The control bar lets you:

* switch the **simulated tab URL** between preset scenarios (window open, window
  closed, cross-timezone, notes-only, no match) or type any URL,
* watch which **toolbar icon** the notice is asking for,
* **reset the config** back to the sample after editing it.

Each surface renders in its own iframe, so the page-level CSS of the popup and
options page stays isolated exactly as it is in the real extension. The in-page
notice is injected into a stand-in host page carrying anchor classes
(`.file-navigation`, `.repository-content`, `.mod-header`), so insertion is
genuinely exercised rather than mocked. The notice draws inside a shadow root,
so it looks the same there as it does on a real page.

The harness lives entirely in `dev/` and is never part of the extension build.
It cannot replace a real extension context either: the shim installs only when
`chrome.runtime.id` is absent.

**What the harness cannot tell you**, because there is no extension context:
the service worker, the real `chrome.storage.sync` (quota, cross-device sync),
the Manifest V3 content security policy, and content-script injection into real
third-party pages. Use `pnpm dev` or the e2e suite for those.

#### `pnpm dev` — the real extension, with HMR

```text
pnpm dev
```

Vite serves the actual extension with hot module replacement for the popup and
options pages; load `dist` via "Load unpacked" as in [Setup](#setup). Content
script changes still need the extension reloaded from `chrome://extensions/` and
the page refreshed.

For a one-off production build, use `pnpm build`.

### Testing

| Command | What it does |
| --- | --- |
| `pnpm harness` | Browser-only dev harness, no extension install needed |
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

Three build checks run in CI and can be run locally:

* `pnpm check:locales` — every visible label goes through `chrome.i18n`, and a
  missing message renders as nothing at all, so this fails the build if a key is
  used without being defined (or defined and no longer used). Note that Chrome
  caches `_locales` for a loaded unpacked extension: after a rebuild that adds
  messages, reload the extension at `chrome://extensions` or the new labels will
  fall back to a humanised version of their key.
* `pnpm check:manifest` — catches Manifest V2 constructs creeping back in, a CSP
  that permits `unsafe-eval`, or the manifest pointing at files the build did not
  emit.
* `pnpm check:bundle` — fails the build if any dev-harness code reaches `dist/`.
  Importing `dev/` from `src/` builds perfectly happily, so without this a stray
  import would ship the harness's fake `chrome` API to users. It checks both
  sentinel identifiers and source-map `sources`, so a rename cannot slip past.

## Project layout

```text
src/
  manifest.config.ts     Manifest V3, generated at build time by @crxjs/vite-plugin
  app/
    background.ts        MV3 service worker (toolbar icon swapping)
    icons.ts             Toolbar icon states, sizes and paths
    content.ts           Content script entry point
    components/          DW (resolution), Notice (injection), Timezones, helpers
    config/              Storage access, types, validation, shared config
    matching/            Chrome match-pattern implementation
  ui/
    popup.html/.tsx      Browser action popup
    options.html/.tsx    Options page
    theme.ts             Light / dark / system preference
    components/
      common/            Modal, toggle, field, toasts, status pill, icons
      dashboard/         Options page cards, forms and the JSON panel
      popup/             The popup's own editor, and what it can write
  styles/
    tokens.css           Design tokens, light and dark
    base.css             Primitives shared by both extension pages
    forms.css            Buttons, toggles and fields, shared by both
    options.css          Options page layout
    popup.css            Popup layout
    notice.css           In-page notice, adopted into its shadow root
  documents/HowToUse.md  Rendered inside the options page
assets/icons/            Vector source for the toolbar icons, not shipped
public/                  Copied verbatim to dist/ (icons, _locales)
dev/                     Browser-only dev harness (never built into the extension)
tests/                   Vitest unit and component tests
e2e/                     Playwright end-to-end tests
scripts/                 Build checks, icon drawing and release packaging
CHANGELOG.md             What changed in each release
```

### Redrawing the icons

```text
pnpm icons
```

Renders `public/icons/<state>/icon{16,32,48,128}.png` from the geometry in
`scripts/icons.js`, and writes the SVG source to `assets/icons/` alongside. The
three states share one disc, one stroke weight and one set of tones, and only
the glyph changes — a ring for the extension itself, a chevron while the window
is open, a bar while it is shut. The PNGs are committed, so this only needs
running when the artwork changes.

The same marks are drawn inline by the notice, the popup and the options page,
from the shared geometry in `src/app/glyphs.ts` — the chevron in the toolbar and
the chevron in a status pill are the same chevron, which is what lets the
toolbar be read without a legend. `scripts/icons.js` keeps its own copy because
it runs as plain JavaScript outside the bundle; `tests/icons.test.ts` fails if
the two ever stop agreeing.

