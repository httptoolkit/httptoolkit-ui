import * as _ from 'lodash';
import * as React from 'react';

import { styled } from "../../styles";
import { Html } from '../../types';
import { suggestionIconHtml, warningIconHtml } from '../../icons';

import { fromMarkdown } from '../../model/markdown';

export const ContentLabel = styled.h2`
    text-transform: uppercase;
    opacity: ${p => p.theme.lowlightTextOpacity};

    display: inline-block;
`;

export const ContentValue = styled.div`
    display: inline-block;
`;

export const ContentLabelBlock = styled(ContentLabel)`
    padding: 3px 0 11px;
    display: block;
    box-sizing: border-box;
    min-height: 31px;
`;

export const ContentMonoValue = styled.div`
    padding: 3px 0 11px;
    width: 100%;

    &:last-child {
        padding-bottom: 0;
    }

    font-family: ${p => p.theme.monoFontFamily};
    word-break: break-all;
`;

// Takes some HTML (in an __html object) and renders it with nice
// default formatting. THIS MUST ONLY BE CALLED WITH SANITIZED HTML.
// The __html format is intended to enforce this - those objects
// should only be created during sanitization.
export const ExternalContent = (p:  React.HTMLAttributes<HTMLDivElement> & {
    content: Html
}) => <Content {..._.omit(p, 'content')} dangerouslySetInnerHTML={p.content} />

// Format blocks of readable text/docs/etc.
export const Content = styled.div`
    line-height: 1.2;

    p, li, ul, ol, table, h1, h2, h3, h4, h5, h6, pre {
        margin-bottom: 10px;
    }

    p::first-letter,
    li::first-letter,
    h1::first-letter,
    h2::first-letter,
    h3::first-letter,
    h4::first-letter,
    h5::first-letter,
    h6::first-letter {
        text-transform: capitalize;
    }

    ol, ul {
        padding-left: 20px;
    }

    ol {
        list-style: decimal;
    }

    ul {
        list-style: circle;
    }

    table {
        border-collapse: unset;
        border-spacing: 5px;
        margin-left: -5px;
    }

    th {
        min-width: 80px;
    }

    code {
        word-break: break-all; /* Fallback for anybody without break-word */
        word-break: break-word;
        font-family: ${p => p.theme.monoFontFamily};
    }

    h1, h2, h3, h4, h5, h6 {
        font-weight: bold;
        margin-bottom: 10px;
    }

    pre {
        white-space: pre-wrap;
        display: block;
        border-left: 3px solid ${p => p.theme.containerWatermark};
        padding-left: 8px;
    }

    img {
        max-width: 100%;
    }

    a[href] {
        color: ${p => p.theme.linkColor};

        &:visited {
            color: ${p => p.theme.visitedLinkColor};
        }
    }

    :last-child :last-child {
        margin-bottom: 0;
    }
`;

export const Markdown = (p: { content: string | undefined }) =>
    p.content ?
        <ExternalContent content={fromMarkdown(
            p.content
                .replace(/:suggestion:/g, suggestionIconHtml)
                .replace(/:warning:/g, warningIconHtml)
        )} />
    : null;