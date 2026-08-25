# Using the extension

The extension shows a notice on the pages you already work in - a repository, a
board, a ticket - telling you whether that project can be deployed right now.

Everything below is configured on this options page. Nothing needs to be edited
by hand unless you want to.

* [Quick start](#quick-start)
* [Sites](#sites)
* [Deployments](#deployments)
* [Editing the JSON directly](#editing-the-json-directly)
* [Reference](#reference)

---

## Quick start

1. Turn on **Edit mode**, top right.
2. Check the **Sites** section. GitHub and Jira are set up out of the box; add
   your own if you use something else.
3. Add a **Deployment** for each project you want a notice on. Give it a name,
   the hours it can be deployed, and the part of the URL that identifies it.
4. Turn Edit mode back off. Open one of those pages and the notice appears.

Each card shows its live status and how long that status has left — "Closes in
2h 10m", or "Opens in 45m" — so this page doubles as an at-a-glance view of what
is open right now, and what is about to change. The notice and the toolbar popup
say the same thing on the page itself.

The notice on the page can be put away with the **×** in its corner. That lasts
for as long as you stay on the page — reloading brings it back, and so does the
window opening or closing, since that is the one thing worth telling you again.

You do not have to come back here to change one of them. The popup edits the
entry for whatever page you are on, and offers to create one where a site is set
up but the page has nothing on it yet — the times, the notes and the matching
fragment, saved from the toolbar. Anything on the page updates as soon as you
save, without a reload.

---

## Sites

A site is a place the notice can appear. It answers two questions: which pages
count, and where on the page the notice goes.

**URL patterns** decide which pages count. They are
[Chrome match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns),
so `*://*.github.com/*` covers GitHub and every subdomain of it, over both http
and https.

**Where to insert** is a list of anchors taken from the site's own HTML. The
notice is placed at the first one that exists on the page, so putting a reliable
fallback lower down the list is worthwhile - it is never inserted twice.

An anchor is usually a class name, written without the leading dot. If it starts
with `#`, `.` or `[` it is used as a full CSS selector instead, which is what you
want when the stable part of a page is an id rather than a class - GitHub's
repository header is `#repository-container-header`, and the classes around it
are generated.

Sites like GitHub and Jira replace the page's contents as you click around,
without ever reloading, which takes the notice with it. The extension watches
for that and puts the notice back, re-checking the URL as it does, so moving
between projects shows the right one without a refresh.

**Styling** is the notice's own. It renders inside a shadow root, so the page it
sits on cannot restyle it and it cannot restyle the page, and it follows that
page's light or dark setting. It is capped at a readable width and centred.

**Spacing** is the one part you can adjust per site, for when the notice sits
too tight against whatever is above it. Margin, padding and max width each take
a CSS length - `1.25rem 0`, `14px 18px`, `960px` - and anything left blank keeps
the default.

The site's **key** matters: deployments store their URL fragment under it. Renaming
a site here updates every deployment that referenced it.

---

## Deployments

A deployment is one project. It is either:

* a **deployment window** - opening and closing times in a chosen timezone, shown
  converted into the viewer's own timezone; or
* **notes only** - no window, no status, just a message. Useful for a freeze.

A window may run past midnight. `23:00` to `02:00` is a three hour window, not an
inverted one.

**URL fragments** are what tie a deployment to a page. If a site's patterns say
"we are on GitHub", the fragment says "and this is the project". The fragment for
`https://github.com/acme/checkout` is `acme/checkout`. Leave a site blank to skip
it.

Fragments are matched as substrings, and the most specific one wins - `acme/web`
and `acme/web-admin` can both exist without shadowing each other. Matching
ignores capitalisation unless **case sensitive** is turned on.

**Notes** accept Markdown. On the page they sit behind "Show details" so the
notice stays small.

---

## Sharing one config with a team

If everyone works on the same projects, one person can host the config and the
rest can point at it. Put a JSON file — the same shape as the panel at the
bottom of the page — on any https address the team can read, then open **Shared
config** and connect to it.

It is fetched when you connect, and again every hour after that. What comes back
is a layer *underneath* your own settings, which means:

* Entries you have not touched follow the file. Change a window at the source
  and everyone picks it up on the next refresh. They are marked **Shared**.
* Editing one stores your version on this machine, and yours wins from then on.
  The badge goes, because that entry has stopped following the file.
* Deleting one hides it here without touching the file. Add it back and it
  follows the file again.
* Everything you add yourself is yours alone and is never sent anywhere.

If the file cannot be fetched, the last copy that worked carries on being used
and the panel says what went wrong. Nothing is lost while it is unreachable.

The GitHub and Jira entries a fresh install starts with are a demonstration
rather than a saved config, so connecting a shared config replaces them. Add
them back from the Sites section if you need them.

### Which days it opens on

By default a window opens every day. Untick the days it should not, and the card
and the notice will say so — "Mon–Fri", or "Mon, Wed, Fri".

**A day is when the window opens.** That matters for a window that runs past
midnight: `23:00`–`02:00` on Monday is Monday night, and it stays open into
Tuesday morning. It is one window, and it belongs to the day it started.

If the window is written in someone else's timezone, the days move with the
hours. A Monday morning in Tokyo is Sunday afternoon in Los Angeles, so that is
what the converted row says — the notice tells you what your own calendar says,
not what the person who wrote the config was looking at.

When the next window is days away, the countdown says so: "Opens in 2d 4h".

### Freezes

A **freeze** is a run of calendar days when nothing ships, whatever the window
says — a Christmas change freeze, a conference week, the fortnight the people
who would fix it are away.

Add one with a first day, a last day and, if it helps, a reason. Both days are
included, so 20 December to 2 January is frozen for the whole of both. While it
is on, the status reads "Deployment frozen", the countdown says when it lifts
rather than when the window next opens, and the reason is shown beside it.

Dates are read against the window's own timezone — the same calendar the window
was written in.

A freeze beats everything else. It does not matter what the hours say or which
days are ticked.

---

## Editing the JSON directly

The **JSON config** panel at the bottom holds the same configuration as raw JSON.
Use it to copy a setup between machines, share one with a team, or make a bulk
change faster than clicking through forms.

Paste a whole config in and press Save. It is checked before anything is written,
so an invalid config is rejected rather than half applied. What it shows is both
layers merged; saving stores only the parts that differ from the shared config.

---

## Reference

The stored config has three parts: `domains`, `sites` and `deployments`.

```json
{
    "domains": {
        "github": ["*://*.github.com/*"]
    },
    "sites": {
        "github": {
            "insert": [
                { "class": "#repository-container-header", "position": "after" },
                { "class": ".application-main", "position": "before" }
            ],
            "style": {
                "margin": "1.25rem 0"
            }
        }
    },
    "deployments": {
        "checkout": {
            "name": "Checkout",
            "github": "acme/checkout",
            "time": {
                "start": "23:00",
                "end": "02:00",
                "timezone": "Europe/Paris",
                "days": ["mon", "tue", "wed", "thu"]
            },
            "notes": "Deploys need **two** approvals.",
            "freezes": [
                {
                    "from": "2026-12-20",
                    "to": "2027-01-02",
                    "reason": "Christmas change freeze"
                }
            ]
        }
    }
}
```

**Domains**

Option | Type | Description
------ | ---- | -----------
key|string|Unique key for the site, shared with `sites` and used by deployments
urls|array[match_pattern]|[Match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns) for the site

**Sites**

Option | Type | Description
------ | ---- | -----------
key|string|Unique key that must match a domain
insert|array[insert_data]|Locations to try, in order; the first one found is used
insert.insert_data.class|string|A class name to look up in the page, or a CSS selector when it starts with `#`, `.` or `[`
insert.insert_data.position|string[before\|after]|Whether the notice goes before or after that element
style|object[style_data]|Optional spacing overrides for this site
style.style_data.margin|string|CSS length for the space around the notice
style.style_data.padding|string|CSS length for the space inside it
style.style_data.maxWidth|string|CSS length capping how wide it is drawn

**Deployments**

Option | Type | Description
------ | ---- | -----------
key|string|Unique key for the deployment
name|string|Shown as the title of the notice and popup
notes|string|Markdown, shown behind "Show details"
&lt;site key&gt;|string|URL fragment identifying this project on that site
case-sensitive|boolean|Match the fragment exactly, including capitals; _false_ by default
notes-only|boolean|Show only the notes, with no window or status; _false_ by default
time|object[time_data]|The deployment window
time.time_data.start|time[24]|24 hour time the window opens, e.g. `09:00`
time.time_data.end|time[24]|24 hour time the window closes; may be earlier than the start to run past midnight
time.time_data.timezone|string|An [IANA timezone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) such as `Europe/London`
time.time_data.days|array[day]|Days the window opens on, e.g. `["mon","tue","wed","thu","fri"]`. Leave it out for every day
freezes|array[freeze_data]|Runs of days when nothing ships, whatever the window says
freezes.freeze_data.from|date|First frozen day, `YYYY-MM-DD`, included
freezes.freeze_data.to|date|Last frozen day, `YYYY-MM-DD`, included
freezes.freeze_data.reason|string|Optional, shown wherever the freeze is reported
