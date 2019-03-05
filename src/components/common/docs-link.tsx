import * as React from 'react';

import { styled } from "../../styles";
import { FontAwesomeIcon } from "../../icons";

const ExternalLinkIcon = styled(FontAwesomeIcon).attrs({
    icon: ['fas', 'external-link-alt']
})`
    opacity: 0.5;
    margin-left: 5px;

    &:focus {
        outline: none;
        color: ${p => p.theme.popColor};
    }
`;

export const DocsLink = (p: {
    href?: string,
    children?: React.ReactNode
}) => p.href ?
    <a {...p} target='_blank' rel='noreferrer noopener'>
        { /* Whitespace after children, iff we have children */ }
        { p.children ? <>{ p.children } </> : null }
        <ExternalLinkIcon />
    </a>
: null;