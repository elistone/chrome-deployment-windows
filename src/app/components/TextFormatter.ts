import * as MarkdownIt from "markdown-it"

export class TextFormatter {
    /**
     * Remove tags from a string
     * @param text
     */
    public static stripTags(text: string) {
        return TextFormatter.sanitize(text.replace(/(<([^>]+)>)/gi, ""));
    }

    /**
     * Sanitizes a string to prevent any strange html
     * @param text
     */
    public static sanitize(text: string){
        const lt = /</g, gt = />/g, ap = /'/g, ic = /"/g;
        return text.toString().replace(lt, "&lt;").replace(gt, "&gt;").replace(ap, "&#39;").replace(ic, "&#34;");
    }

    /**
     * Converts a string to markdown
     * @param text
     */
    public static toMarkdown(text: string){
        const md = new MarkdownIt();
        return md.render(TextFormatter.stripTags(text));
    }
}