import * as React from 'react';
import { default as ReactSplitPane } from 'react-split-pane';

import { styled } from '../styles';

// Styles original taken from
// https://github.com/tomkp/react-split-pane/blob/master/README.md#example-styling
export const SplitPane = styled(ReactSplitPane)<{
    hiddenPane?: '1' | '2',
    children?: React.ReactNode // Missing in real types - causes issues in React 18
}>`
    .Resizer {
        background: #000;
        opacity: .3;
        z-index: 100;
        -moz-box-sizing: border-box;
        -webkit-box-sizing: border-box;
        box-sizing: border-box;
        -moz-background-clip: padding;
        -webkit-background-clip: padding;
        background-clip: padding-box;
    }

    .Resizer:hover {
        -webkit-transition: all 1s ease;
        transition: all 1s ease;
        opacity: 0.9;
    }

    .Resizer.horizontal {
        height: 11px;
        margin: -5px 0;
        border-top: 5px solid rgba(255, 255, 255, 0);
        border-bottom: 5px solid rgba(255, 255, 255, 0);
        cursor: row-resize;
        width: 100%;
    }

    .Resizer.horizontal:hover {
        border-top: 5px solid rgba(0, 0, 0, 0.2);
        border-bottom: 5px solid rgba(0, 0, 0, 0.2);
    }

    .Resizer.vertical {
        width: 11px;
        margin: 0 -5px;
        border-left: 5px solid rgba(255, 255, 255, 0);
        border-right: 5px solid rgba(255, 255, 255, 0);
        cursor: col-resize;
    }

    .Resizer.vertical:hover {
        border-left: 5px solid rgba(0, 0, 0, 0.2);
        border-right: 5px solid rgba(0, 0, 0, 0.2);
    }

    .Resizer.disabled {
        cursor: not-allowed;
    }

    .Resizer.disabled:hover {
        border-color: transparent;
    }

    .Pane {
        min-width: 0; /* Don't let flexbox force panes to expand */
    }

    ${({ hiddenPane }) => {
        if (!hiddenPane) return '';
        else return `
            .Resizer {
                display: none !important;
            }

            .Pane${hiddenPane} {
                display: none !important;
            }
        `;
    }}
`;