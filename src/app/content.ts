import {Notice} from "./components/Notice";
import {DW} from "./components/DW";

// import the basic styling
import "../styles/content.css"


chrome.runtime.sendMessage({}, (response) => {
    let checkReady = setInterval(() => {
        if (document.readyState === "complete") {
            clearInterval(checkReady)
            init();
        }
    })
})

/**
 * initialize the content
 */
function init(): void {
    const dw = new DW()
    dw.loadConfig().then(() => {
        dw.setup();
        const deploymentInfo = dw.getDeploymentInfo();
        if (typeof deploymentInfo !== "undefined" && Object.keys(deploymentInfo).length !== 0) {
            const notice = new Notice(dw)
            notice.build();
            notice.insert();
        }
    })
}
