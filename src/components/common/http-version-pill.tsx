import * as React from 'react';

import { HtkRequest } from '../../types';
import { styled } from '../../styles';

import { Pill } from './pill';

export const HttpVersionPill = styled(({ request, className }: {
    request: HtkRequest
    className?: string
}) => request.httpVersion
    ? <Pill
        title={`The client sent this request using HTTP ${request.httpVersion}`}
    >HTTP/{request.httpVersion.replace('.0', '')}</Pill>
    : null
)``;