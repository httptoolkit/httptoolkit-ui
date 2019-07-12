import * as _ from 'lodash';
import * as React from 'react';

import { observer, inject } from 'mobx-react';

import { styled } from '../../styles';

import { ActivatedStore } from '../../model/interception-store';
import { WithInjected } from '../../types';

interface MockPageProps {
    className?: string,
    interceptionStore: ActivatedStore,
}

@inject('interceptionStore')
@observer
class MockPage extends React.Component<MockPageProps> {

    render(): JSX.Element {
        return <div>
            Mock page
        </div>
    }
}

const StyledMockPage = styled(
    // Exclude store from the external props, as it's injected
    MockPage as unknown as WithInjected<typeof MockPage, 'interceptionStore'>
)`
    height: 100%;
    overflow-y: auto;
    position: relative;
`;

export { StyledMockPage as MockPage };