import * as React from 'react';

import { SourceIcons, Icon } from '../../icons';
import { TrafficSource } from '../../model/http/sources';

export const SourceIcon = ({ source, className }: {
    source: TrafficSource,
    className?: string
}) => source.icon !== SourceIcons.Unknown
    ? <Icon
        className={className}
        title={source.summary}
        {...source.icon}
    />
    : null;