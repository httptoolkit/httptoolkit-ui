import * as React from 'react';
import { observer } from 'mobx-react';

import { styled } from '../../styles';

import { SplitPane } from '../split-pane';
import { RequestPane } from './request-pane';
import { ResponsePane } from './response-pane';

const SendPageContainer = styled.div`
    height: 100vh;
    position: relative;
`;

@observer
export class SendPage extends React.Component<{}> {

    render() {
        return <SendPageContainer>
            <SplitPane
                split='vertical'
                primary='second'
                defaultSize='50%'
                minSize={300}
                maxSize={-300}
            >
                <RequestPane />
                <ResponsePane />
            </SplitPane>
        </SendPageContainer>;
    }

}