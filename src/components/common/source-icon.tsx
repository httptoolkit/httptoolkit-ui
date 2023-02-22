import * as React from 'react';

import { styled } from '../../styles';
import { SourceIcons, Icon } from '../../icons';

import { TrafficSource } from '../../model/http/sources';

export const SourceIcon = styled(({ source, className }: {
    source: TrafficSource,
    className?: string
}) => source.icon !== SourceIcons.Unknown
    ? <Icon
        className={className}
        title={source.summary}
        {...source.icon}
    />
    : null
)`
    margin-left: 8px;
`;