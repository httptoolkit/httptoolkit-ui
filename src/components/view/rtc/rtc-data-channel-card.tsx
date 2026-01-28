/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import * as React from 'react';
import { observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';

import { RTCDataChannel } from '../../../model/webrtc/rtc-data-channel';

import { ExpandableCardProps } from '../../common/card';
import { SelfSizedEditor } from '../../editor/base-editor';
import { StreamMessageListCard } from '../stream-message-list-card';

export const RTCDataChannelCard = observer(({
    dataChannel,
    isPaidUser,
    streamMessageEditor,
    ...cardProps
}: ExpandableCardProps & {
    dataChannel: RTCDataChannel,
    isPaidUser: boolean,
    streamMessageEditor: portals.HtmlPortalNode<typeof SelfSizedEditor>
}) => <StreamMessageListCard
    {...cardProps}

    // Link the key to the channel, to ensure selected-message state gets
    // reset when we switch between traffic:
    key={dataChannel.id}
    streamId={dataChannel.id}
    cardHeading='DataChannel Messages'
    streamLabel={dataChannel.label}

    editorNode={streamMessageEditor}

    isPaidUser={isPaidUser}
    filenamePrefix={'DataChannel ' + (dataChannel.label || dataChannel.channelId)}
    messages={dataChannel.messages}
/>);