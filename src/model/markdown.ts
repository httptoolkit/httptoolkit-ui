import * as Remarkable from 'remarkable';
import * as DOMPurify from 'dompurify';

import { Html } from '../types';

const md = new Remarkable({
    html: true,
    linkify: true
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