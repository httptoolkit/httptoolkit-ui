import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';

import { HttpVersion, RawTrailers } from '../../../types';

import {
    CollapsibleCard,
    CollapsibleCardProps,
    CollapsibleCardHeading
} from '../../common/card';
import { HeaderDetails } from './header-details';

interface HttpTrailersCardProps extends CollapsibleCardProps {
    type: 'request' | 'response';
    httpVersion: HttpVersion;
    requestUrl: URL;
    trailers: RawTrailers;
}

export const HttpTrailersCard = observer((props: HttpTrailersCardProps) => {
    const { type, requestUrl, httpVersion, trailers } = props;

    return <CollapsibleCard {...props} direction='left'>
        <header>
            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                { type === 'request' ? 'Request' : 'Response' } Trailers
            </CollapsibleCardHeading>
        </header>

        <div>
            <HeaderDetails
                httpVersion={httpVersion}
                headers={trailers}
                requestUrl={requestUrl}
            />
        </div>
    </CollapsibleCard>;
});