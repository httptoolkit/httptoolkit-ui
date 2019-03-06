import * as React from 'react';

import { parseSource } from '../../../model/sources';
import { getHeaderDocs } from '../../../model/http-docs';

import { Content } from '../../common/external-content';

export const UserAgentHeaderDescription = (p: { value: string }) => {
    const { description } = parseSource(p.value);

    if (!description) return <p>
        { getHeaderDocs('user-agent')!.summary }
    </p>;

    return <Content>
        <p>{ description }</p>
    </Content>;
};