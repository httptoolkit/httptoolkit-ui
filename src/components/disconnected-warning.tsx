import * as React from 'react';
import { inject, observer } from 'mobx-react';

import { styled } from '../styles';
import { Icon } from '../icons';

import { ProxyStore } from '../model/proxy-store';
import { canRestartApp, restartApp } from '../services/desktop-api';

import { Button } from './common/inputs';
import { trackEvent } from '../metrics';
import { logError } from '../errors';

const WarningContainer = styled.div`
    position: absolute;
    bottom: 40px;
    right: 40px;
    max-width: 300px;

    background-color: ${p => p.theme.mainBackground};
    color: ${p => p.theme.mainColor};
    border: 2px solid ${p => p.theme.warningColor};
    box-shadow: 0 2px 10px 5px rgba(0,0,0,${p => p.theme.boxShadowAlpha});
    border-radius: 4px;

    z-index: 1000;
    padding: 15px 15px;
    line-height: 1.4;

    display: flex;
    gap: 10px;
    flex-direction: column;
`;

const RestartButton = styled(Button)`
    &:not(:disabled) {
        background-color: ${p => p.theme.popColor};
        font-weight: bold;
        padding: 10px 15px;

        display: flex;
        align-items: center;
        justify-content: center;
        gap: 15px;
    }
`;

export const DisconnectedWarning = inject('proxyStore')(observer((props: {
    proxyStore?: ProxyStore
}) => {
    if (!props.proxyStore?.streamDisconnected) return null;

    return (
        <WarningContainer>
            <p>
                <strong>Disconnected from internal proxy server</strong>
            </p>

            <p>
                Please wait a moment for reconnection...
            </p>

            <p>
                In the meantime, some features may be unavailable. If this doesn't resolve
                quickly, or happens frequently, please <a
                    href="https://github.com/httptoolkit/httptoolkit/issues/new?template=bug.yml"
                    target="_blank"
                    rel="noreferrer"
                >report a bug</a> and share as much information as possible to help
                get this fixed.
            </p>

            { canRestartApp()
                ? <>
                    <p>
                        Restart the app below to fix this automatically:
                    </p>

                    <RestartButton
                        onClick={() => {
                            logError('Manual restart required to fix server disconnect');
                            setTimeout(() => restartApp(), 100); // Brief delay for logging
                        }}
                    >
                        <Icon icon='Repeat' /> Restart App
                    </RestartButton>
                </>
                : <p>
                    If this problem persists, please restart the application to reinitialize
                    the proxy server.
                </p>
            }
        </WarningContainer>
    );
}));