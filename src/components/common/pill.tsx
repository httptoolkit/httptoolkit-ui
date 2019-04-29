import * as _ from 'lodash';
import * as React from 'react';
import * as polished from 'polished';

import { styled, Theme } from '../../styles';

// Given a base colour, returns a constrasting (but related hue) text colour
function getTextColor(baseColor: string, theme: Theme) {
    // Effective BG colour (as it's very transparent - assume on a main-ish bg)
    const bgColor = polished.mix(0.3, baseColor, theme.mainBackground);

    const lightOption = polished.setLightness(theme.pillContrast, baseColor);
    const darkOption = polished.setLightness(1 - theme.pillContrast, baseColor);

    return polished.rgba(polished.readableColor(
        bgColor,
        darkOption,
        lightOption,
    ), theme.pillContrast);
}

// Given a base colour, returns a semi-transparent background
function getBackgroundColor(baseColor: string) {
    return polished.rgba(baseColor, 0.3);
}

function getDefaultColor(theme: Theme) {
    if (polished.getLuminance(theme.mainBackground) > 0.5) {
        return polished.darken(0.4, theme.mainBackground);
    } else {
        return polished.lighten(0.4, theme.mainBackground);
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

    color: ${(p: { color?: string, theme?: Theme }) =>
        getTextColor(p.color || getDefaultColor(p.theme!), p.theme!)
    };

    background-color: ${(p: { color?: string, theme?: Theme }) =>
        getBackgroundColor(p.color || getDefaultColor(p.theme!))
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

export const PillSelector = <
    T extends {},
    K extends string = T extends string ? T : string
>(props: {
    value: T,
    onChange: (optionKey: K) => void
    nameFormatter: (key: T) => string,
    keyFormatter?: (key: T) => K,
} & ({ options: T[] } | { optGroups: { [groupName: string]: T[] } })
) => {
    const asKey = props.keyFormatter || ((k: T) => k.toString() as K);
    const asName = props.nameFormatter || ((k: T) => k.toString());

    return <Select
        onChange={(e) => props.onChange(e.target.value as K)}
        value={asKey(props.value)}
    >
        {'options' in props
            ? props.options.map((option: T) =>
                <option key={asKey(option)} value={asKey(option)}>
                    { asName(option) }
                </option>
            )
            : _.map(props.optGroups, (options: T[], groupName: string) =>
                <optgroup key={groupName} label={groupName}>{
                    options.map((option: T) =>
                        <option key={asKey(option)} value={asKey(option)}>
                            { asName(option) }
                        </option>
                    )
                }</optgroup>
            )
        }
    </Select>
};