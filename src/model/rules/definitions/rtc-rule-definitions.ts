/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {
    PluggableAdmin
} from 'mockttp';
import {
    matchers,
    steps
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
    HasDataChannelMatcher,
    HasVideoTrackMatcher,
    HasAudioTrackMatcher,
    HasMediaTrackMatcher
} = matchers;
export type HasDataChannelMatcher = matchers.HasDataChannelMatcher;
export type HasVideoTrackMatcher = matchers.HasVideoTrackMatcher;
export type HasAudioTrackMatcher = matchers.HasAudioTrackMatcher;
export type HasMediaTrackMatcher = matchers.HasMediaTrackMatcher;

export const RTCMatcherLookup = {
    ...matchers.MatcherDefinitionLookup,

    'rtc-wildcard': RTCWildcardMatcher
};

export const RTCInitialMatcherClasses = [
    RTCWildcardMatcher
];

// Convenient re-export for various built-in step definitions:
export const {
    DynamicProxyStep,
    EchoStep,
    CloseStep,
    WaitForMediaStep,
    WaitForDurationStep,
    WaitForChannelStep,
    WaitForMessageStep,
    CreateChannelStep,
    SendStep
} = steps;
export type DynamicProxyStep = steps.DynamicProxyStep;
export type EchoStep = steps.EchoStep;
export type CloseStep = steps.CloseStep;
export type WaitForMediaStep = steps.WaitForMediaStep;
export type WaitForDurationStep = steps.WaitForDurationStep;
export type WaitForChannelStep = steps.WaitForChannelStep;
export type WaitForMessageStep = steps.WaitForMessageStep;
export type CreateChannelStep = steps.CreateChannelStep;
export type SendStep = steps.SendStep;

export const RTCStepLookup = {
    ...steps.StepDefinitionLookup
};

type RTCMatcherClass = typeof RTCMatcherLookup[keyof typeof RTCMatcherLookup];
export type RTCMatcher = InstanceType<RTCMatcherClass>;
export type RTCInitialMatcher = InstanceType<typeof RTCInitialMatcherClasses[number]>;

export type RTCStepClass = typeof RTCStepLookup[keyof typeof RTCStepLookup];
export type RTCStep = InstanceType<RTCStepClass>;

export interface RTCRule {
    id: string;
    type: 'webrtc';
    activated: boolean;
    matchers: Array<RTCMatcher> & { 0?: RTCInitialMatcher };
    steps: RTCStep[];
};