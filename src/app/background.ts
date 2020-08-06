let lastIcon = "icons/default/icon48.png"

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.hasOwnProperty('newIconPath') && message.newIconPath !== lastIcon) {
        chrome.browserAction.setIcon({
            path: message.newIconPath,
            tabId: sender.tab.id
        });
    }
    sendResponse({error: false})
})
