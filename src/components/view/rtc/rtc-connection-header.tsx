/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import * as React from 'react';
import { observer } from 'mobx-react';

import { RTCConnection } from '../../../model/webrtc/rtc-connection';

import { clickOnEnter } from '../../component-utils';
import {
    HeaderCard,
    HeaderText,
    HeaderButton,
    SecondaryHeaderButton
} from '../header-card';
import { CopyableMonoValue } from '../../common/text-content';

export const RTCConnectionHeader = observer((p: {
    connection: RTCConnection,

    hideConnection: () => void,
    jumpToConnection: () => void
}) => <HeaderCard>
    <HeaderText>
        Part of a WebRTC Connection from <CopyableMonoValue>{
            p.connection.clientURL
        }</CopyableMonoValue> to <CopyableMonoValue>{
            p.connection.remoteURL
        }</CopyableMonoValue>
    </HeaderText>

    <SecondaryHeaderButton
        onClick={p.hideConnection}
        onKeyPress={clickOnEnter}
    >
        Hide
    </SecondaryHeaderButton>

    <HeaderButton
        onClick={p.jumpToConnection}
        onKeyPress={clickOnEnter}
    >
        Jump to connection
    </HeaderButton>
</HeaderCard>);