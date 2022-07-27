import * as React from 'react';

import { WarningIcon } from '../../../icons';

import { versionSatisfies, serverVersion, CLOSE_IN_BREAKPOINT } from '../../../services/service-versions';

import { clickOnEnter } from '../../component-utils';
import {
    HeaderCard,
    HeaderText,
    HeaderButton,
    SecondaryHeaderButton
} from '../header-card';

export const HttpRequestBreakpointHeader = (p: {
    onResume: () => void,
    onCreateResponse: () => void,
    onClose: () => void
}) =>
    <HeaderCard>
        <HeaderText>
            <WarningIcon /> <strong>This request is paused at a breakpoint</strong>
        </HeaderText>
        <HeaderText>
            {
                versionSatisfies(serverVersion.value as string, CLOSE_IN_BREAKPOINT)
                ? <>
                    Edit the request and then resume to let your edited request continue to the target URL,
                    respond directly to provide a response yourself, or close to immediately end the connection.
                </>
                : <>
                    Respond directly to provide a response yourself, or edit the request as you'd like
                    and then resume to let your edited request continue to the target URL.
                </>
            }
        </HeaderText>

        <SecondaryHeaderButton onClick={p.onCreateResponse} onKeyPress={clickOnEnter}>
            Respond directly
        </SecondaryHeaderButton>

        { versionSatisfies(serverVersion.value as string, CLOSE_IN_BREAKPOINT)
            ? <SecondaryHeaderButton onClick={p.onClose} onKeyPress={clickOnEnter}>
                Close
            </SecondaryHeaderButton>
            : null
        }

        <HeaderButton onClick={p.onResume} onKeyPress={clickOnEnter}>
            Resume
        </HeaderButton>
    </HeaderCard>;

export const HttpResponseBreakpointHeader = (p: {
    onResume: () => void,
    onClose: () => void
}) =>
    <HeaderCard>
        <HeaderText>
            <WarningIcon /> <strong>This response is paused at a breakpoint</strong>
        </HeaderText>
        <HeaderText>
            {
                versionSatisfies(serverVersion.value as string, CLOSE_IN_BREAKPOINT)
                ? <>
                    Edit it as you'd like and resume to let the edited response continue back to the client,
                    or close to immediately end the connection.
                </>
                : <>
                    Edit it as you'd like, then resume to let the edited response continue back to the client.
                </>
            }
        </HeaderText>

        { versionSatisfies(serverVersion.value as string, CLOSE_IN_BREAKPOINT)
            ? <SecondaryHeaderButton onClick={p.onClose} onKeyPress={clickOnEnter}>
                Close
            </SecondaryHeaderButton>
            : null
        }

        <HeaderButton onClick={p.onResume} onKeyPress={clickOnEnter}>
            Resume
        </HeaderButton>
    </HeaderCard>;