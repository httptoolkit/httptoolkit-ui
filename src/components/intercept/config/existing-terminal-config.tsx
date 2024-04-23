import * as React from 'react';
import { disposeOnUnmount, inject, observer } from 'mobx-react';
import { observable, runInAction, computed, when, action } from 'mobx';

import { styled, css } from '../../../styles';

import {
    serverVersion,
    versionSatisfies,
    MULTIPLE_EXISTING_TERMINAL_RANGE
} from '../../../services/service-versions';

import { AccountStore } from '../../../model/account/account-store';
import { UiStore } from '../../../model/ui/ui-store';
import { InterceptorStore } from '../../../model/interception/interceptor-store';
import { Interceptor } from '../../../model/interception/interceptors';

import { CopyButtonIcon } from '../../common/copy-button';
import { PillSelector } from '../../common/pill';

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
    margin-top: 20px;

    ${p => p.disabled && css`
        opacity: 0.5;
        pointer-events: none;
    `}

    background-color: ${p => p.theme.inputBackground};
    &:hover {
        background-color: ${p => p.theme.inputHoverBackground};
    }
    border: solid 1px ${p => p.theme.inputBorder};
    color: ${p => p.theme.inputColor};

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

    > select {
        display: block;
        margin-top: 20px;
        margin-left: 0;
    }
`;

const PLACEHOLDER_SHELL = "...";

type ShellDefinition = { command: string, description: string };

@inject('interceptorStore')
@inject('accountStore')
@inject('uiStore')
@observer
class ExistingTerminalConfig extends React.Component<{
    interceptor: Interceptor,
    activateInterceptor: () => Promise<{
        port: number,
        commands?: {
            [shellName: string]: ShellDefinition
        }
    }>,
    reportStarted: () => void,
    reportSuccess: (options?: { showRequests?: boolean }) => void,
    closeSelf: () => void,
    interceptorStore?: InterceptorStore,
    accountStore?: AccountStore,
    uiStore?: UiStore
}> {

    @observable reportedActivated = false;

    @observable shellCommands: { [shellName: string]: ShellDefinition } = {
        // Placeholder string, similar to the default, while we wait (v briefly) for server startup:
        [PLACEHOLDER_SHELL]: {
            command: 'eval "$(curl -sS localhost:..../setup)"',
            description: ''
        }
    };

    @observable
    selectedShell = PLACEHOLDER_SHELL; // Updated to first key when list of shells arrives

    @computed
    get interceptCommand() {
        return this.shellCommands[this.selectedShell].command;
    }

    @computed
    get shellDescription() {
        return this.shellCommands[this.selectedShell].description;
    }

    @computed
    get shouldShowDropdown() {
        const multipleShellsMaybeSupported = serverVersion.state !== 'fulfilled' ||
            versionSatisfies(serverVersion.value as string, MULTIPLE_EXISTING_TERMINAL_RANGE);

        const multipleShellsMaybeAvailable = this.selectedShell === PLACEHOLDER_SHELL ||
            Object.keys(this.shellCommands).length > 1;

        // We show the dropdown unless we're sure (old server, or new server but only one shell
        // returned) that there's only one option available.
        return multipleShellsMaybeSupported && multipleShellsMaybeAvailable;
    }

    @action.bound
    selectShell(shell: string) {
        this.selectedShell = shell;
        this.props.uiStore!.preferredShell = shell;
    }

    @action.bound
    reportActivated() {
        if (this.reportedActivated) return;

        this.reportedActivated = true;
        this.props.reportStarted();
    }

    async componentDidMount() {
        const { port, commands } = await this.props.activateInterceptor();

        runInAction(() => {
            if (!commands) {
                // Backward compat for servers that only support bash:
                this.shellCommands = {
                    'Bash': {
                        command: `eval "$(curl -sS localhost:${port}/setup)"`,
                        description: 'Bash-compatible'
                    }
                };
            } else {
                this.shellCommands = commands;
            }

            // Remember which shell you prefer:
            const { preferredShell } = this.props.uiStore!;
            if (preferredShell && preferredShell in this.shellCommands) {
                this.selectedShell = preferredShell;
            }

            // Make sure selected shell always refers to a valid command:
            if (!this.shellCommands[this.selectedShell]) {
                this.selectedShell = Object.keys(this.shellCommands)[0];
            }
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
                Run the command below in any {this.shellDescription} terminal on this machine to
                intercept all new processes & containers launched there.
            </p>
            { this.shouldShowDropdown
                ? <PillSelector<string>
                    onChange={this.selectShell}
                    value={this.selectedShell}
                    options={Object.keys(this.shellCommands)}
                />
                : null
            }
            <CopyableCommand
                onCopy={this.reportActivated}
                disabled={this.selectedShell === PLACEHOLDER_SHELL}
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