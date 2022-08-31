/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.tech>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';
import { MockRTCSessionDescription } from 'mockrtc';
import * as portals from 'react-reverse-portal';

import { styled } from '../../../styles';

import {
    CollapsibleCard,
    CollapsibleCardHeading
} from '../../common/card';
import { ThemedSelfSizedEditor } from '../../editor/base-editor';
import { ContentViewer } from '../../editor/content-viewer';

import { RTCConnection } from '../../../model/webrtc/rtc-connection';

interface RtcSdpCardProps {
    connection: RTCConnection;
    type: 'local' | 'remote';
    sessionDescription: MockRTCSessionDescription;
    editorNode: portals.HtmlPortalNode<typeof ThemedSelfSizedEditor>;

    collapsed: boolean;
    expanded: boolean;
    onExpandToggled: () => void;
    onCollapseToggled?: () => void;
};

export const EditorCardContent = styled.div`
    margin: 0 -20px -20px -20px;
    border-top: solid 1px ${p => p.theme.containerBorder};
    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};

    .monaco-editor-overlaymessage {
        display: none;
    }

    position: relative;
    flex-grow: 1;

    /*
    Allows shrinking smaller than content, to allow scrolling overflow e.g. for
    scrollable URL param content
    */
    min-height: 0;
`;

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

            <EditorCardContent>
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