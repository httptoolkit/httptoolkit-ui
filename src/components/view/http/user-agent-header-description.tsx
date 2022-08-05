import * as React from 'react';

import { parseSource } from '../../../model/http/sources';
import { getHeaderDocs } from '../../../model/http/http-docs';

import { Content } from '../../common/text-content';

export const UserAgentHeaderDescription = (p: { value: string }) => {
    const { description } = parseSource(p.value);

    if (!description) return <p>
        { getHeaderDocs('user-agent')!.summary }
    </p>;

    return <Content>
        <p>{ description }</p>
    </Content>;
};