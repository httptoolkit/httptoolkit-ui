import * as Remarkable from 'remarkable';
import * as DOMPurify from 'dompurify';

import { Html } from '../../types';

const linkedMarkdown = new Remarkable({
    html: true,
    linkify: true,
    linkTarget: '_blank' // Links should always open elsewhere
});

const linklessMarkdown = new Remarkable({
    html: true,
    linkify: false
});

// Add an extra hook to DOMPurify to enforce link target. Without this, DOMPurify strips
// every link target entirely.
DOMPurify.addHook('afterSanitizeAttributes', function (node: Element | HTMLElement) {
    // Closely based on example from https://github.com/cure53/DOMPurify/tree/main/demos#hook-to-open-all-links-in-a-new-window-link

    // Set all elements owning target to target=_blank
    if (node.hasAttribute('target') || 'target' in node) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noreferrer'); // Disables both referrer & opener
    }

    // set non-HTML/MathML links to xlink:show=new
    if (
        !node.hasAttribute('target') &&
        (node.hasAttribute('xlink:href') || node.hasAttribute('href'))
    ) {
        node.setAttribute('xlink:show', 'new');
    }
});

// Add an extra hook to strip relative URLs (markdown largely comes from external sources,
// and so should never include relative paths!)
DOMPurify.addHook('afterSanitizeAttributes', function (node: Element | HTMLElement) {
    if (node.hasAttribute('href')) {
        const target = node.getAttribute('href');
        if (target?.startsWith('/')) node.removeAttribute('href');
    }
});

export interface MarkdownRenderingOptions {
    linkify?: boolean // False by default
}

export function fromMarkdown(input: string, options?: MarkdownRenderingOptions): Html;
export function fromMarkdown(input: string | undefined, options?: MarkdownRenderingOptions): Html | undefined;
export function fromMarkdown(input: string | undefined, options?: MarkdownRenderingOptions): Html | undefined {
    if (!input) return undefined;
    else {
        const md = options?.linkify ? linkedMarkdown : linklessMarkdown;
        const unsafeMarkdown = md.render(input).replace(/\n$/, '');
        const safeHtml = DOMPurify.sanitize(unsafeMarkdown);
        return { __html: safeHtml };
    }
}

/**
 * Takes an input string, and turns it into a value that will appear the same when
 * rendered in markdown (and will not render any active HTML, e.g. links). This
 * goes further than DOMPurify above by disabling _all_ non-plain text content.
 *
 * Important notes:
 * - This escapes input for use as content, and doesn't cover cases like
 *   escaping for HTML attribute values or similar.
 * - This cannot fully escape _closing_ backticks - it's impossible to do this in
 *   markdown, as even \\\` will close a previous \` block. Use &lt;code&gt; instead.
 * - If linkify: true is used in later rendering, recognized URLs will still autolink.
 */
export function escapeForMarkdownEmbedding(input: string) {
    const htmlEscaped = input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const markdownEscaped = htmlEscaped.replace(/([\\`*_{}\[\]()#+\-.!~|])/g, '\\$1');
    return markdownEscaped;
}