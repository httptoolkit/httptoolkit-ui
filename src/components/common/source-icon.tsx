import * as React from 'react';

import { styled } from '../../styles';
import { SourceIcons, Icon, PhosphorIcon, IconKey } from '../../icons';

import { TrafficSource } from '../../model/http/sources';

export const SourceIcon = styled(({ source, className }: {
    source: TrafficSource,
    className?: string
}) => {
    if (source.icon === SourceIcons.Unknown) return null;

    const iconId = source.icon.icon;

    if (Array.isArray(iconId)) {
        return <Icon
            className={className}
            title={source.summary}
            {...source.icon}
            icon={iconId}
        />
    } else {
        return <PhosphorIcon
            className={className}
            alt={source.summary}
            size='1.25em'
            {...source.icon}
            icon={iconId as IconKey}
        />
    }
})`
    margin-left: 8px;
`;