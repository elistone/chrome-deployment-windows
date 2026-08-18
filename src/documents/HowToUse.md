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

Each card shows its live status, so this page doubles as an at-a-glance view of
what is open right now.

---

## Sites

A site is a place the notice can appear. It answers two questions: which pages
count, and where on the page the notice goes.

**URL patterns** decide which pages count. They are
[Chrome match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns),
so `*://*.github.com/*` covers GitHub and every subdomain of it, over both http
and https.

**Where to insert** is a list of class names taken from the site's own HTML. The
notice is placed at the first one that exists on the page, so putting a reliable
fallback lower down the list is worthwhile - it is never inserted twice.

**Styling** reuses the host site's own classes, which is why the notice looks
like it belongs there. `flash flash-success` is GitHub's green banner;
`aui-message aui-message-error` is Atlassian's red one. The notes class is
optional and only applies to notes-only entries.

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

## Editing the JSON directly

The **JSON config** panel at the bottom holds the same configuration as raw JSON.
Use it to copy a setup between machines, share one with a team, or make a bulk
change faster than clicking through forms.

Paste a whole config in and press Save. It is checked before anything is written,
so an invalid config is rejected rather than half applied.

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
                { "class": "file-navigation", "position": "after" },
                { "class": "repository-content", "position": "before" }
            ],
            "classes": {
                "deploy": "flash flash-success",
                "no-deploy": "flash flash-error"
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
                "timezone": "Europe/Paris"
            },
            "notes": "Deploys need **two** approvals."
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
insert.insert_data.class|string|A class name to look up in the page
insert.insert_data.position|string[before\|after]|Whether the notice goes before or after that element
classes|object[class_data]|Classes applied to the notice itself
classes.class_data.deploy|string|Applied while the window is open
classes.class_data.no-deploy|string|Applied while the window is closed
classes.class_data.notes|string|Optional; applied instead for notes-only entries

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
