# Chrome Deployment Windows Extension

The `Deployment Windows` Extension give you access to some configuration to add alerts onto pages such as `github.com` and `jira.com` to notify and remind that some projects/code can only be deployed during certain hours of the day.

The extension aims to be flexible in what can be displayed however it is still a work in progress.

## Table of contents
* [Using the extension](#using-the-extension)
    * [Config](#config)
    * [Parameters](#parameters)
* [Working on the extension](#working-on-the-extension)
    * [Setup](#setup) 
* [Credits](#credits)

---

## Using the extension

How to use the extension can be [found here](/src/documents/HowToUse.md)

## Working on the extension

### Setup

1. run `npm install`
2. run `npm run build` to compile
3. Go to `chrome://extensions/`
4. Toggle "Developer mode"
5. Press "Load unpacked"
6. Point to the `dist` folder of this project and open
7. Extension will now be installed

### Making changes

To make changes to the application you should have `webpack` running in watch mode to compile on changes.

```text
npm run watch
```
Now changes will automatically come through, for some things such as `content` changes you will still need to reload the extension and refresh the page to have them pull through - reloading can be done on the `chrome://extensions/` page, via the "reload icon" in the extension card.

### Ready for a new package?

You can use

```text
npm run package
```
This will compile the dist and then create a new package zip

---

## Credits

### Icon

Icons made by [Nhor Phai](https://www.flaticon.com/authors/nhor-phai) from [www.flaticon.com](https://www.flaticon.com/)
