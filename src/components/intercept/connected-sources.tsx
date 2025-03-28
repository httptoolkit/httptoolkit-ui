import * as React from 'react';

import { styled } from '../../styles';
import { TrafficSource } from '../../model/http/sources';

import { BigCard } from "../common/card";
import { Icon } from '../../icons';

const ConnectedSource = styled.div`
    &:not(:last-child) {
        margin-bottom: 30px;
    }

    font-size: ${p => p.theme.headingSize};

    > svg {
        margin-right: 30px;
    }
`;

export const ConnectedSources = styled((props: { activeSources: ReadonlyArray<TrafficSource>, className?: string }) =>
    <BigCard className={props.className}>
        <h1>Connected Sources</h1>
        {
            props.activeSources.length ?
                props.activeSources.map((source) =>
                    <ConnectedSource key={source.ua} title={source.ua}>
                        <Icon
                            {...source.icon}
                            size='1.1em'
                            fixedWidth={true}
                        />
                        { source.summary }
                    </ConnectedSource>
                )
            : null
        }
    </BigCard>
)``; // Styled here so that we can target this with selectors in SC styles elsewhere