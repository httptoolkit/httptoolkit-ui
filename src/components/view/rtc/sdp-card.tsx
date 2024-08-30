/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';
import { MockRTCSessionDescription } from 'mockrtc';
import * as portals from 'react-reverse-portal';

import {
    CollapsibleCard,
    CollapsibleCardHeading,
    ExpandableCardProps
} from '../../common/card';
import { SelfSizedEditor } from '../../editor/base-editor';
import { ContentViewer } from '../../editor/content-viewer';
import { EditorCardContent } from '../../editor/body-card-components';

import { RTCConnection } from '../../../model/webrtc/rtc-connection';

interface RtcSdpCardProps extends ExpandableCardProps {
    connection: RTCConnection;
    type: 'local' | 'remote';
    sessionDescription: MockRTCSessionDescription;
    editorNode: portals.HtmlPortalNode<typeof SelfSizedEditor>;
}

@observer
export class SDPCard extends React.Component<RtcSdpCardProps> {

    render() {
        const {
            connection,
            type,
            sessionDescription,
            editorNode,
            ...cardProps
        } = this.props;

        return <CollapsibleCard {...cardProps}>
            <header>
                <CollapsibleCardHeading onCollapseToggled={cardProps.onCollapseToggled}>
                    {
                        type === 'local' ? 'Sent' : 'Received'
                    } Session {
                        _.capitalize(sessionDescription.type)
                    }
                </CollapsibleCardHeading>
            </header>

            <EditorCardContent showFullBorder={!cardProps.expanded}>
                <ContentViewer
                    contentId={`${connection.id}:${type}:${sessionDescription.type}:sdp`}
                    editorNode={this.props.editorNode}
                    contentType='text'
                    expanded={false}
                    cache={connection.cache}
                >
                    { sessionDescription.sdp }
                </ContentViewer>
            </EditorCardContent>
        </CollapsibleCard>;
    }
}