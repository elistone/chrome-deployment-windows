# Changelog

Notable changes to Deployment windows. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2026-08-25

### Added

- **Windows can be limited to certain days.** "No deploys on Fridays" is the
  rule almost every team has, and until now there was nowhere to write it down -
  a window was a time of day and nothing else, so a Saturday morning read as
  open. Tick the days in the form, or write them in the JSON:

  ```json
  "time": {
      "start": "09:00",
      "end": "17:00",
      "timezone": "Europe/London",
      "days": ["mon", "tue", "wed", "thu", "fri"]
  }
  ```

  A day is when the window *opens*, so an overnight `23:00`-`02:00` window on a
  Monday is Monday's window and stays open into Tuesday morning. Leave `days`
  out for a window that opens every day, which is what every config written
  before this means and goes on meaning.

### Changed

- The days move with the hours when a window is written in another timezone. A
  Monday morning in Tokyo is a Sunday afternoon in Los Angeles, and that is what
  the converted row now says.
- The countdown counts past tomorrow. On a Friday evening with a weekday-only
  window it says "Opens in 2d 15h" rather than wrapping to a morning the window
  will not open on.
- The notice, the popup and the dashboard show which days a window opens on,
  collapsing runs into ranges - "Mon-Fri" rather than five separate days.

## [2.1.0] - 2026-08-25

Housekeeping for the notice, and a large weight off every page you visit.

### Added

- A way to put the notice away. The **×** in its corner hides it for as long as
  you stay on the page; reloading, navigating, or the window opening or closing
  brings it back. Nothing is stored, so it can never be missing at the moment
  you needed it.

### Changed

- **The content script is about a quarter of the size it was.** It runs on every
  https page you visit, and it was loading a markdown parser on all of them for
  the sake of notes that most pages do not have and that start folded away. The
  parser is fetched when notes are actually opened. 294 kB down to 85 kB, before
  anything on the page has been touched.
- **The notice stops moving once it has been seen.** The sweep across the card
  and the pulse behind the status mark used to run forever; they now run on
  arrival, and again when the status changes.
- **A window already in your own timezone is shown once**, rather than as two
  rows of identical hours under different labels. The popup and the options page
  already did this.
- The popup opens without waiting for the markdown parser it only needs if the
  entry has notes.

### Fixed

- **The notice tells a screen reader when the window opens or closes.** It is a
  labelled region that can be navigated to and skipped past, and its status is a
  polite live region - which also meant stopping it rewriting the same sentence
  once a second.

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

[2.2.0]: https://github.com/elistone/chrome-deployment-windows/releases/tag/v2.2.0
[2.1.0]: https://github.com/elistone/chrome-deployment-windows/releases/tag/v2.1.0
[2.0.0]: https://github.com/elistone/chrome-deployment-windows/releases/tag/v2.0.0
[1.1.0]: https://github.com/elistone/chrome-deployment-windows/releases/tag/v1.1.0
[1.0.0]: https://github.com/elistone/chrome-deployment-windows/releases/tag/v1.0.0
