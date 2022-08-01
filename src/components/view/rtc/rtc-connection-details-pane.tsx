import { computed } from 'mobx';
import { inject, observer } from 'mobx-react';
import * as React from 'react';

import { UiStore } from '../../../model/ui-store';
import { RTCConnection } from '../../../model/webrtc/rtc-connection';

import { PaneOuterContainer, PaneScrollContainer } from '../view-details-pane';
import { RTCConnectionCard } from './rtc-connection-card';

@inject('uiStore')
@observer
export class RTCConnectionDetailsPane extends React.Component<{
    connection: RTCConnection,

    uiStore?: UiStore
}> {

    render() {
        const { connection, uiStore } = this.props;

        return <PaneOuterContainer>
            <PaneScrollContainer>
                <RTCConnectionCard
                    {...uiStore!.viewCardProps.rtcConnection}
                    connection={connection}
                />
            </PaneScrollContainer>
        </PaneOuterContainer>;
    }

}