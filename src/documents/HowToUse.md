# Table of contents
* [Using the extension](#using-the-extension)
    * [Config](#config)
    * [Parameters](#parameters)

---

# Using the extension

The extension comes with simple options allowing you to configure when and how a deployment notice is displayed.

## Config

Below is an example of the config you will find in the options page.

```json
{
    "domains": {
        "github": [
            "*://*.github.com/*"
        ],
        "jira": [
            "*://*.atlassian.net/*"
        ]
    },
    "sites": {
        "github": {
            "insert": [
                {
                    "class": "file-navigation",
                    "position": "after"
                },
                {
                    "class": "repository-content",
                    "position": "before"
                }
            ],
            "classes": {
                "deploy": "flash flash-success",
                "no-deploy": "flash flash-error"
            }
        },
        "jira": {
            "insert": [
                {
                    "class": "mod-header",
                    "position": "before"
                }
            ],
            "classes": {
                "deploy": "aui-message aui-message-success",
                "no-deploy": "aui-message aui-message-error"
            }
        }
    },
    "deployments": {
          "chrome-deployment-windows": {
                "name": "chrome-deployment-windows",
                "github": "elistone/chrome-deployment-windows",
                "jira": "",
                "time": {
                    "start": "23:00",
                    "end": "10:00",
                    "timezone": "Europe/Paris"
                },
                "notes": "An example of some extra notes I want to have displayed."
           }
    }
}
```

The config file has three parts:

* domains
* sites
* deployments

### Domains

Domains are the start of the trigger, you assign a domain a `key` example `github` then pass it an array of [match patterns](https://developer.chrome.com/extensions/match_patterns).
If a match patten has been found in a tab deployments will be checked for any information.

### Sites

Sites work with the domains, here you can define where on a website to inject the notice, and the classes that get applied.
If there are multiple places to insert it will work it's way down the list, and first is found will be inserted. It can be not insert into multiple places on the same screen.

### Deployments

Deployments are where you will put all the information about the deployment window and what url's trigger on each domain.

```json
{
    "chrome-deployment-windows": {
        "name": "chrome-deployment-windows",
        "github": "elistone/chrome-deployment-windows",
        "jira": "",
        "time": {
            "start": "23:00",
            "end": "10:00",
            "timezone": "Europe/Paris"
        },
        "notes": "An example of some extra notes I want to have displayed."
    }
}
```

For the example above there are two domains `key` items,  `github` & `jira`. 
The part listed after is what is picked up to notify we are on that domain.

Take this  `"github": "elistone/chrome-deployment-windows"`, we already know that the deployment url for github is `*://*.github.com/*` so the extension knows you are on github or not.
This part lets it know which page you are on. So when you visit: `https://github.com/elistone/chrome-deployment-windows` everything can be combined, and a notice will be displayed.

## Parameters

**Domains** 

Option | Type | Description
------ | ---- | -----------
key|string|Unique key related to the domain
urls|array[match_patterns]|Array of [match patterns](https://developer.chrome.com/extensions/match_patterns) for the domain

**Sites**

Option | Type | Description
------ | ---- | -----------
key|string|Unique key that must match a domain
insert|array[insert_data]|Array of all the locations to try and insert, first place found will stop the searching
insert.insert_data.class|string|A class name to look up in the dom
insert.insert_data.position|string[before\|after]|Specify if the notice should be placed before or after the found class name
classes|object[class_data]|Object containing the information about classes to style the notice
classes.class_data.deploy|string|Classes to apply on deployment open
classes.class_data.no-deploy|string|Classes to apply on deployment closed
classes.class_data.notes|string|An optional parameter that will apply classes if set to notes only

**Deployments**

Option | Type | Description
------ | ---- | -----------
key|string|Unique key that for a deployment
name|string|Name of the deployment, will be displayed on the notice and popup
notes|string|Notes will be displayed on the notice and popup
case-sensitive|boolean|An optional parameter to enable case sensitivity for urls and domain keys, is set default _false_ by default
notes-only|boolean|An optional parameter to enable only showing of notes, is set to _false_ by default
time|object[time_data]|Object containing the information the deployment window
time.time_data.start|time[24]|Time in 24 hours when the deployment window starts
time.time_data.end|time[24]|Time in 24 hours when the deployment window closes
time.time_data.timezone|string|A valid time zone, uses moment.js [time zone list](https://gist.github.com/diogocapela/12c6617fc87607d11fd62d2a4f42b02a)
_domain_|string|The domain will be a key matching one of the domains e.g. `github` you can then add the rest of the url for it to match e.g. `elistone/chrome-deployment-windows`