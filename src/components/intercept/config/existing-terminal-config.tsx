import * as React from 'react';
import { observer } from 'mobx-react';
import { observable, runInAction, computed, when } from 'mobx';

import { styled, css } from '../../../styles';
import { trackEvent } from '../../../tracking';

import { Interceptor } from '../../../model/interception/interceptors';

import { CopyButtonIcon } from '../../common/copy-button';

const CopyableCommand = styled((p) =>
    <div className={p.className}>
        <code>{ p.children }</code>
        <CopyButtonIcon content={ p.children } />
    </div>
)<{
    className?: string,
    disabled: boolean,
    children: string
}>`
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

@observer
class ExistingTerminalConfig extends React.Component<{
    interceptor: Interceptor,
    activateInterceptor: () => Promise<{ port: number }>,
    showRequests: () => void,
    closeSelf: () => void
}> {

    @observable serverPort?: number;

    @computed
    get interceptCommand() {
        return `. <(curl -sS localhost:${this.serverPort || '....'}/setup)`;
    }

    async componentDidMount() {
        const { port } = await this.props.activateInterceptor();

        runInAction(() => {
            this.serverPort = port;
        });

        if (!this.props.interceptor.isActive) {
            // When a terminal is first activated for real, jump to the requests
            when(() => this.props.interceptor.isActive, () => {
                this.props.showRequests();

                trackEvent({
                    category: 'Interceptors',
                    action: 'Successfully Activated',
                    label: this.props.interceptor.id
                });
            });
        }
    }

    render() {
        return <ConfigContainer>
            <p>
                Run the command below in any terminal on this machine, to immediately
                enable interception for all new processes started there.
            </p>
            <CopyableCommand disabled={this.serverPort === undefined}>
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