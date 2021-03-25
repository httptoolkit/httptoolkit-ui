import * as Remarkable from 'remarkable';
import * as DOMPurify from 'dompurify';

import { Html } from '../types';

const md = new Remarkable({
    html: true,
    linkify: true,
    linkTarget: '_blank' // Links should always open elsewhere
});

// Add an extra hook to DOMPurify to enforce link target. Without this, DOMPurify strips
// every link target entirely.
DOMPurify.addHook('afterSanitizeAttributes', function (node: Element | HTMLElement) {
    // Closed based on example from https://github.com/cure53/DOMPurify/tree/main/demos#hook-to-open-all-links-in-a-new-window-link

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

export function fromMarkdown(input: string): Html;
export function fromMarkdown(input: string | undefined): Html | undefined;
export function fromMarkdown(input: string | undefined): Html | undefined {
    if (!input) return undefined;
    else {
        const unsafeMarkdown = md.render(input).replace(/\n$/, '');
        const safeHtml = DOMPurify.sanitize(unsafeMarkdown);
        return { __html: safeHtml };
    }
}