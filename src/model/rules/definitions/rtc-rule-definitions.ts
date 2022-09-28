/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.tech>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {
    PluggableAdmin
} from 'mockttp';
import {
    MatcherDefinitions,
    HandlerStepDefinitions
} from 'mockrtc';

export const { Serializable } = PluggableAdmin.Serialization;

export class RTCWildcardMatcher extends Serializable {

    readonly type = 'rtc-wildcard';

    explain() {
        return 'WebRTC connections';
    }

}

// Convenient re-export for various built-in matcher definitions:
export const {
    HasDataChannelMatcherDefinition,
    HasVideoTrackMatcherDefinition,
    HasAudioTrackMatcherDefinition,
    HasMediaTrackMatcherDefinition
} = MatcherDefinitions;
export type HasDataChannelMatcherDefinition = MatcherDefinitions.HasDataChannelMatcherDefinition;
export type HasVideoTrackMatcherDefinition = MatcherDefinitions.HasVideoTrackMatcherDefinition;
export type HasAudioTrackMatcherDefinition = MatcherDefinitions.HasAudioTrackMatcherDefinition;
export type HasMediaTrackMatcherDefinition = MatcherDefinitions.HasMediaTrackMatcherDefinition;

export const RTCMatcherLookup = {
    ...MatcherDefinitions.MatcherDefinitionLookup,

    'rtc-wildcard': RTCWildcardMatcher
};

export const RTCInitialMatcherClasses = [
    RTCWildcardMatcher
];

// Convenient re-export for various built-in step definitions:
export const {
    DynamicProxyStepDefinition,
    EchoStepDefinition,
    CloseStepDefinition,
    WaitForMediaStepDefinition,
    WaitForDurationStepDefinition,
    WaitForChannelStepDefinition,
    WaitForMessageStepDefinition,
    CreateChannelStepDefinition,
    SendStepDefinition
} = HandlerStepDefinitions;
export type DynamicProxyStepDefinition = HandlerStepDefinitions.DynamicProxyStepDefinition;
export type EchoStepDefinition = HandlerStepDefinitions.EchoStepDefinition;
export type CloseStepDefinition = HandlerStepDefinitions.CloseStepDefinition;
export type WaitForMediaStepDefinition = HandlerStepDefinitions.WaitForMediaStepDefinition;
export type WaitForDurationStepDefinition = HandlerStepDefinitions.WaitForDurationStepDefinition;
export type WaitForChannelStepDefinition = HandlerStepDefinitions.WaitForChannelStepDefinition;
export type WaitForMessageStepDefinition = HandlerStepDefinitions.WaitForMessageStepDefinition;
export type CreateChannelStepDefinition = HandlerStepDefinitions.CreateChannelStepDefinition;
export type SendStepDefinition = HandlerStepDefinitions.SendStepDefinition;

export const RTCStepLookup = {
    ...HandlerStepDefinitions.StepDefinitionLookup
};

type RTCMatcherClass = typeof RTCMatcherLookup[keyof typeof RTCMatcherLookup];
export type RTCMatcher = InstanceType<RTCMatcherClass>;
export type RTCInitialMatcher = InstanceType<typeof RTCInitialMatcherClasses[number]>;

export type RTCStepClass = typeof RTCStepLookup[keyof typeof RTCStepLookup];
export type RTCStep = InstanceType<RTCStepClass>;

export interface RTCMockRule {
    id: string;
    type: 'webrtc';
    activated: boolean;
    matchers: Array<RTCMatcher> & { 0?: RTCInitialMatcher };
    steps: RTCStep[];
};