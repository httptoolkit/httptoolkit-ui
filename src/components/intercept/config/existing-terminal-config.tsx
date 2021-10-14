import * as React from 'react';
import { disposeOnUnmount, inject, observer } from 'mobx-react';
import { observable, runInAction, computed, when, action } from 'mobx';

import { styled, css } from '../../../styles';

import { InterceptorStore } from '../../../model/interception/interceptor-store';
import { Interceptor } from '../../../model/interception/interceptors';

import { CopyButtonIcon } from '../../common/copy-button';
import { AccountStore } from '../../../model/account/account-store';

const CopyableCommand = styled((p: {
    className?: string;
    onCopy: () => void;
    children: string;
    disabled: boolean;
}) =>
    <div className={p.className}>
        <code onCopy={p.onCopy}>
            { p.children }
        </code>
        <CopyButtonIcon onClick={p.onCopy} content={p.children} />
    </div>
)`
    display: inline-block;
    margin: 20px auto;

    ${p => p.disabled && css`
        opacity: 0.5;
        pointer-events: none;
    `}

    border: solid 1px ${p => p.theme.containerBorder};
    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};

    padding: 10px 75px 10px 20px;
    border-radius: 4px;

    > code {
        font-family: ${p => p.theme.monoFontFamily};
        user-select: all;
    }

    position: relative;
    > button {
        padding: 10px 20px 10px 20px;
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;

        border-radius: 0 4px 4px 0;
        border-left: solid 1px ${p => p.theme.containerBorder};

        background-color: ${p => p.theme.mainLowlightBackground};

        &:active {
            background-image: linear-gradient(transparent, rgba(0,0,0,.05) 40%, rgba(0,0,0,.1));
        }
    }

    > svg {
        margin: 1px 0 2px;
    }
`;

const ConfigContainer = styled.div`
    user-select: text;
`;

@inject('interceptorStore')
@inject('accountStore')
@observer
class ExistingTerminalConfig extends React.Component<{
    interceptor: Interceptor,
    activateInterceptor: (options: { dockerEnabled: boolean }) => Promise<{ port: number }>,
    reportStarted: () => void,
    reportSuccess: (options?: { showRequests?: boolean }) => void,
    closeSelf: () => void,
    interceptorStore?: InterceptorStore,
    accountStore?: AccountStore
}> {

    @observable reportedActivated = false;

    @observable serverPort?: number;

    @computed
    get interceptCommand() {
        return `. <(curl -sS localhost:${this.serverPort || '....'}/setup)`;
    }

    @action.bound
    reportActivated() {
        if (this.reportedActivated) return;

        this.reportedActivated = true;
        this.props.reportStarted();
    }

    async componentDidMount() {
        const { port } = await this.props.activateInterceptor({
            dockerEnabled: this.props.accountStore!.featureFlags.includes('docker')
        });

        runInAction(() => {
            this.serverPort = port;
        });

        if (!this.props.interceptor.isActive) {
            // While we wait for activation, increase the interval refresh frequency
            const intervalId = setInterval(() => {
                this.props.interceptorStore!.refreshInterceptors()
            }, 2000);
            disposeOnUnmount(this, () => clearInterval(intervalId));

            when(() => this.props.interceptor.isActive, () => {
                this.reportActivated(); // Mark as activated, if it wasn't already
                this.props.reportSuccess();
                clearInterval(intervalId);
            });
        } else {
            this.reportedActivated = true;
        }
    }

    render() {
        return <ConfigContainer>
            <p>
                Run the command below in any terminal on this machine, to immediately
                enable interception for all new processes started there.
            </p>
            <CopyableCommand
                onCopy={this.reportActivated}
                disabled={this.serverPort === undefined}
            >
                { this.interceptCommand }
            </CopyableCommand>
        </ConfigContainer>;
    }

}

export const ExistingTerminalCustomUi = {
    columnWidth: 2,
    rowHeight: 1,
    configComponent: ExistingTerminalConfig
};