import * as React from 'react';
import * as polished from 'polished';
import { inject } from 'mobx-react';

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

export const Pill = styled.span`
    display: inline-block;
    border-radius: 4px;
    padding: 4px 8px;

    margin: 0 8px 0 0;
    * + & {
        margin-left: 8px;
    }
    & + & {
        margin-left: 0;
    }

    text-align: center;
    text-transform: none;
    font-weight: bold;
    word-spacing: 3px;

    transition: color 0.1s;

    color: ${(p: { color?: string, theme?: Theme }) =>
        getColor(p.color || polished.lighten(0.1, p.theme!.mainColor))
    };

    background-color: ${(p: { color?: string, theme?: Theme }) =>
        getBackgroundColor(p.color || polished.lighten(0.1, p.theme!.mainColor))
    };
`;

const Select = styled(Pill.withComponent('select'))`
    border: none;

    height: 24px;
    padding: 0 4px 3px 8px;

    font-size: 16px;
    font-family: ${p => p.theme.fontFamily};

    ${Pill} + & {
        margin-left: 0;
    }
`;

export const PillSelector = <T extends {}>(props: {
    value: T,
    options: T[],
    onChange: (option: T) => void
    nameFormatter: (key: T) => string
}) => <Select
    onChange={(e: any) => props.onChange(e.target.value)}
    value={ props.value as any }
>
    {props.options.map((option: any) =>
        <option key={option} value={option}>
            { props.nameFormatter ? props.nameFormatter(option) : option }
        </option>
    )}
</Select>;

export const ProPill = styled(inject('theme')((p: { theme?: Theme, className?: string }) =>
    <Pill className={p.className} color={p.theme!.popColor}>PRO</Pill>
))`
    font-size: 11px;
    padding: 4px 4px;
`;