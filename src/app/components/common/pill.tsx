import * as polished from 'polished';
import { styled, Theme } from '../../styles';

function needsInversion(color: string) {
    return color && polished.getLuminance(color) > 0.45;
}

function getColor(color: string) {
    if (needsInversion(color)) {
        return polished.setLightness(0.25, color);
    } else {
        return color;
    }
}

function getBackgroundColor(color: string) {
    if (needsInversion(color)) {
        return polished.darken(0.2, polished.rgba(color, 0.4));
    } else {
        return polished.lighten(0.2, polished.rgba(color, 0.2));
    }
}

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
        getColor(p.color || p.theme!.containerBorder)
    };

    background-color: ${(p: { color?: string, theme?: Theme }) =>
        getBackgroundColor(p.color || p.theme!.containerBorder)
    };
`;