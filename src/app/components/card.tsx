import * as React from 'react';
import { styled } from '../styles';

const Card = styled((props: {
    disabled?: boolean,
    onClick?: (e: React.MouseEvent) => void
} & React.HTMLAttributes<HTMLElement>) =>
    <section
        {...props}
        onClick={!props.disabled ? props.onClick : undefined}
        tabIndex={props.disabled ? -1 : props.tabIndex}
    />
)`
    box-sizing: border-box;

    ${p => p.disabled && `
        opacity: 0.5;
    `}

    ${p => !p.disabled && p.onClick && `
        cursor: pointer;

        &:active {
            box-shadow: inset 0 2px 10px 0 rgba(0,0,0,0.2);
        }
    `}

    background-color: ${p => p.theme.mainBackground};
    border-radius: 4px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,0.2);

    overflow: hidden;
    position: relative;

    > header h1, > h1 {
        font-size: ${p => p.theme.headingSize};
        font-weight: bold;
    }

    > header {
        display: flex;
        align-items: center;
        justify-content: flex-end;
    }
`;

export const LittleCard = styled(Card)`
    padding: 15px;

    > header, > h1 {
        margin-bottom: 15px;
    }
`;

export const MediumCard = styled(Card)`
    padding: 20px;

    > header, > h1 {
        text-transform: uppercase;
        text-align: right;
        color: ${p => p.theme.containerWatermark};
        margin-bottom: 20px;
    }
`;

export const BigCard = styled(MediumCard)`
    padding: 30px;

    > header, > h1 {
        margin-bottom: 30px;
    }
`;