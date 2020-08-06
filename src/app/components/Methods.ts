/**
 * Helper methods class
 */
export class Methods {

    /**
     * Insets element after
     *
     * @param notice
     * @param className
     */
    public static insertAfter(notice, className): boolean {
        const referenceNode = this.findClass(className);
        if (referenceNode) {
            referenceNode.parentNode.insertBefore(notice, referenceNode.nextSibling);
            return true;
        }
        return false;
    }

    /**
     * Insets element before
     *
     * @param notice
     * @param className
     */
    public static insertBefore(notice, className): boolean {
        const referenceNode = this.findClass(className);
        if (referenceNode) {
            referenceNode.parentNode.insertBefore(notice, referenceNode);
            return true;
        }
        return false;
    }

    /**
     * Update the html of an element based upon class name
     *
     * @param text
     * @param className
     */
    public static updateHtml(text, className): boolean {
        const referenceNode = this.findClass(className);
        if (referenceNode) {
            referenceNode.innerHTML = text;
            return true;
        }
        return false;
    }

    /**
     * update the class name of an element base upon finding an element by class
     *
     * @param setClass
     * @param className
     */
    public static updateClassName(setClass, className): boolean {
        const referenceNode = this.findClass(className);
        if (referenceNode) {
            referenceNode.className = setClass;
            return true;
        }
        return false;
    }

    /**
     * Helper method to find class
     *
     * @param className
     */
    public static findClass(className: string) {
        const elm = document.getElementsByClassName(className)[0];
        if (typeof elm !== "undefined") {
            return elm as HTMLElement;
        }
        return false;
    }

    /**
     * States if an element is hidden or not
     *
     * @param elem
     */
    public static isHidden(elem): boolean {
        return window.getComputedStyle(elem).display === "none" || window.getComputedStyle(elem).visibility === "hidden";
    }

    /**
     * Helper method that helps prevent errors when reloading.
     *
     * @param string
     */
    public static i18n(string: string) {
        if (typeof chrome.i18n === 'undefined') {
            return '';
        }
        try {
            return chrome.i18n.getMessage(string);
        } catch (e) {
            return 'Translation lost, please reload.';
        }
    }

    /**
     * Helper method to update icons, prevent errors when reloading.
     *
     * @param icon
     */
    public static updateIcon(icon: string) {
        if (typeof chrome.runtime === 'undefined') {
            return '';
        }
        try {
            chrome.runtime.sendMessage({"newIconPath": icon});
        } catch (e) {
            return '';
        }
    }
}