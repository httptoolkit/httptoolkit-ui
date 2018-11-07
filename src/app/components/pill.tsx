import * as polished from 'polished';
import { styled, Theme } from '../styles';

export const Pill = styled.div`
    display: inline-block;
    padding: 4px 8px;
    margin: 0 8px;
    border-radius: 4px;

    text-transform: none;

    font-weight: bold;

    word-spacing: 4px;

    transition: color 0.2s;

    color: ${(p: { color?: string, theme?: Theme }) =>
        p.color || p.theme!.containerBorder
    };

    background-color: ${(p: { color?: string, theme?: Theme }) =>
        polished.lighten(0.2, polished.rgba(p.color || p.theme!.containerBorder, 0.2))
    };
`;