import * as React from 'react';

import { styled } from '../../styles';
import { TrafficSource } from '../../model/sources';

import { BigCard } from "../common/card";
import { EmptyState } from '../common/empty-state';
import { FontAwesomeIcon } from '../../icons';

const ConnectedSource = styled.div`
    &:not(:last-child) {
        margin-bottom: 30px;
    }

    font-size: ${p => p.theme.headingSize};

    > svg {
        margin-right: 30px;
    }
`;

export const ConnectedSources = styled((props: { activeSources: TrafficSource[], className?: string }) =>
    <BigCard className={props.className}>
        <h1>Connected Sources</h1>
        {
            props.activeSources.length ?
                props.activeSources.map((source) =>
                    <ConnectedSource key={source.ua} title={source.ua}>
                        <FontAwesomeIcon {...source.icon} fixedWidth={true} />
                        { source.description }
                    </ConnectedSource>
                )
            :
                <EmptyState
                    key='empty'
                    icon={['fac', 'spinner-arc']}
                    spin='slow'
                />
        }
    </BigCard>)`
        > ${EmptyState} {
            height: auto;
        }
    `;
