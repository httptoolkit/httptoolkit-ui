import * as _ from 'lodash';
import * as React from 'react';
import * as polished from 'polished';

import { styled, Theme, css } from '../../styles';
import { UnstyledButton, interactiveMouseoverStyles } from './inputs';
import {
    getTextColor,
    getBackgroundColor
} from '../../util/colors';

// Returns a non-transparent but transparency-like background color for
// a pill shown on top of the main background.
function getPillBackground(baseColor: string, theme: Theme) {
    return polished.mix(0.3, baseColor, theme.mainBackground);
}

const pillStyles = css`
    display: inline-block;
    border-radius: 4px;
    padding: 5px 8px 3px;

    text-align: center;
    text-transform: none;
    font-weight: bold;
    word-spacing: 3px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    color: ${(p: { color?: string, theme?: Theme }) =>
        getTextColor(p.color || p.theme!.pillDefaultColor, p.theme!.mainColor, p.theme!.pillContrast)
    };

    background-color: ${(p: { color?: string, theme?: Theme }) =>
        getBackgroundColor(p.color || p.theme!.pillDefaultColor, p.theme!.mainBackground)
    };
`;

export const Pill = styled.span`
    ${pillStyles}
`;

export const PillButton = styled(UnstyledButton)`
    ${pillStyles}
    ${interactiveMouseoverStyles}

    line-height: 1;

    &[disabled] {
        opacity: 0.5;
    }
`;

export const PillSelect = styled(Pill.withComponent('select'))`
    text-align: left;
    border: none;

    height: 24px;
    padding: 0 4px 0 8px;

    font-size: ${p => p.theme.textSize};
    font-family: ${p => p.theme.fontFamily};

    ${interactiveMouseoverStyles}

    * {
        background-color: ${(p: { color?: string, theme?: Theme }) =>
            getPillBackground(
                p.color || p.theme!.pillDefaultColor,
                p.theme!
            )
        };
    }
`;

export const PillSelector = <
    T extends {},
    K extends string = T extends string ? T : string
>(props: {
    value: T,
    onChange: (optionKey: K) => void
    nameFormatter?: (key: T) => string,
    keyFormatter?: (key: T) => K,
} & ({ options: readonly T[] } | { optGroups: { [groupName: string]: T[] } })
) => {
    const asKey = props.keyFormatter || ((k: T) => k.toString() as K);
    const asName = props.nameFormatter || ((k: T) => k.toString());

    return <PillSelect
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
    </PillSelect>
};