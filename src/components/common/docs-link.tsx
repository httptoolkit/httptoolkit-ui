import * as React from 'react';

import { styled } from "../../styles";
import { Icon } from "../../icons";

const ExternalLinkIcon = styled(Icon).attrs(() => ({
    icon: ['fas', 'external-link-alt']
}))`
    opacity: 0.5;
    margin-left: 5px;

    &:focus {
        outline: none;
        color: ${p => p.theme.popColor};
    }
`;

const DocsA = styled.a`
    &[href] {
        color: ${p => p.theme.linkColor};

        &:visited {
            color: ${p => p.theme.visitedLinkColor};
        }
    }
`;

export const DocsLink = (p: {
    href?: string,
    children?: React.ReactNode
}) => p.href ?
    <DocsA {...p} target='_blank' rel='noreferrer noopener'>
        { /* Whitespace after children, iff we have children */ }
        { p.children ? <>{ p.children } </> : null }
        <ExternalLinkIcon />
    </DocsA>
: null;