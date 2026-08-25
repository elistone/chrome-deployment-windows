# Changelog

Notable changes to Deployment windows. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-08-25

A rebuild rather than an upgrade. Manifest V2 stops being loadable, so
everything that hung off it had to be replaced; the interface and the toolchain
were replaced with it.

Nothing needs migrating. An existing configuration keeps working, and the one
key that no longer means anything - v1's `classes`, which is what the notice
used to borrow its styling from - is dropped quietly on load rather than
rejected.

### Added

- A shared config. Point the extension at a JSON file on an https address and
  it is fetched hourly and merged *underneath* your own settings, so a team can
  keep one list between them. Any single entry can still be corrected, or
  deleted, on the machine that needs it - entries still following the file are
  marked "Shared".
- Adding and editing a deployment from the toolbar popup, for the page you are
  looking at, rather than having to find it again on the options page.
- A live countdown on the notice, the popup and every dashboard card: "Closes
  in 2h 10m", "Opens in 45m".
- A dev harness for working on the interface in an ordinary browser tab,
  without loading the extension.

### Changed

- **Manifest V3.** The persistent background page is now an ephemeral service
  worker, `browser_action` is `action`, and host access has moved into
  `host_permissions`.
- **The notice renders inside a shadow root** and brings its own stylesheet. v1
  styled itself by borrowing the host site's classes, which is why it looked
  wrong whenever a site changed them; nothing about it now depends on the page
  it is sitting on, and nothing the page ships reaches into it.
- **The options page is one dashboard.** Every deployment and site is visible
  at once with its live status, and an Edit mode switch reveals the controls
  for adding, changing and removing entries. Deletes ask again and every change
  can be undone from the toast that reports it.
- **The popup matches it**, and names the host it matched against.
- Light, dark and system themes across both extension pages and the notice.
- New toolbar and application icons, drawn as one family at every size Chrome
  asks for. The mark in the toolbar is the mark in the notice and on the
  dashboard: a ring for the extension, a chevron while the window is open, a
  bar while it is shut.
- An insert location can be a CSS selector, not only a class name. GitHub's
  stable anchor is an id, and the classes beside it are generated.
- The notice keeps up with sites that navigate without reloading, and is put
  back if the page tears it out.
- Every visible string goes through `chrome.i18n`, and a build fails if the
  catalogue and the source disagree.
- **Toolchain:** pnpm replaces npm, Vite replaces Gulp, and TypeScript and
  React replace the hand-written DOM code. CI typechecks, lints, checks the
  message catalogue, runs the unit and end-to-end suites, and refuses a build
  that leaked dev-harness code into the extension.

### Fixed

- The GitHub notice appears again. It aimed at `file-navigation`, which no
  longer exists, and at `repository-content`, which survives a full page load
  but not an in-app navigation.
- A window is open for exactly the hours it says. A 09:00-17:00 window used to
  report itself open from 08:59 and stay open until 17:01.
- The longest matching URL fragment wins, so a more general entry no longer
  shadows a more specific one - which of the two won used to depend on object
  key order.
- One unrecognised timezone no longer removes the notice entirely. It is
  rejected in the editor while you are looking at it, and a value already in
  storage falls back to your own timezone rather than throwing.
- The notice no longer reads or writes the host page's elements. It located its
  own children by class name across the whole document, so any page element
  sharing a class could be read - or overwritten - in preference to its own.
- A URL fragment is matched against the path and query but not the anchor, so
  `example.com/a` matches `example.com/a#section`.
- A message missing from the catalogue renders as a readable version of its key
  rather than as an empty control.

### Removed

- `package-lock.json`, and with it v1's dependency tree - and the 74 Dependabot
  alerts standing against it.
- The `classes` key on a site, which the notice no longer needs.
- The Cypress and Mocha CI workflows, replaced by Vitest and Playwright.

## [1.1.0] - 2020-11-30

### Added

- Notes-only entries, for showing a message with no deployment window.
- Markdown in notes.
- Case-sensitive URL matching, off by default.
- A "how to use" page in the options.
- Some basic tests.

### Changed

- Moment.js replaced with Day.js.

## [1.0.0] - 2020-11-30

First release.

[2.0.0]: https://github.com/elistone/chrome-deployment-windows/releases/tag/v2.0.0
[1.1.0]: https://github.com/elistone/chrome-deployment-windows/releases/tag/v1.1.0
[1.0.0]: https://github.com/elistone/chrome-deployment-windows/releases/tag/v1.0.0
