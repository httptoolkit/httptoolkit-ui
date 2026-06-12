import * as React from 'react';
import { observable, action, computed } from 'mobx';
import { observer, inject } from 'mobx-react';

import { styled, css } from '../../styles';
import { Icon } from '../../icons';
import { trackEvent } from '../../metrics';
import { WithInjected } from '../../types';
import { ProxyStore } from '../../model/proxy-store';
import { AccountStore } from '../../model/account/account-store';

import { UnstyledButton } from '../common/inputs';
import { CopyButtonIcon } from '../common/copy-button';
import { AppModal } from '../common/modal';

interface IntegrationConfig {
    id: string;
    name: string;
    /** One-line instruction shown above the snippet, ending with a colon. */
    description: string;
    /** Build the copyable snippet from the resolved MCP command (command + args). */
    buildSnippet: (mcpCommand: { command: string; args: string[] }) => string;
    /** Documentation/setup link for this client. */
    docsUrl?: string;
}

const jsonClientConfig = (mcpCommand: { command: string; args: string[] }) =>
    JSON.stringify({
        mcpServers: {
            'http-toolkit': {
                command: mcpCommand.command,
                ...(mcpCommand.args.length > 0 ? { args: mcpCommand.args } : {})
            }
        }
    }, null, 2);

const vscodeClientConfig = (mcpCommand: { command: string; args: string[] }) =>
    JSON.stringify({
        servers: {
            'http-toolkit': {
                type: 'stdio',
                command: mcpCommand.command,
                ...(mcpCommand.args.length > 0 ? { args: mcpCommand.args } : {})
            }
        }
    }, null, 2);

const shellEscape = (arg: string) =>
    /^[A-Za-z0-9_\-./:=@%+,]+$/.test(arg)
        ? arg
        : `'${arg.replace(/'/g, `'\\''`)}'`;

const INTEGRATIONS: IntegrationConfig[] = [
    {
        id: 'claude-code',
        name: 'Claude Code',
        description: 'Register HTTP Toolkit as an MCP server in Claude Code by running this command in your terminal:',
        buildSnippet: ({ command, args }) =>
            `claude mcp add http-toolkit -- ${[command, ...args].map(shellEscape).join(' ')}`,
        docsUrl: 'https://docs.claude.com/en/docs/claude-code/mcp'
    },
    {
        id: 'claude-desktop',
        name: 'Claude Desktop',
        description: 'Give Claude Desktop access to your intercepted traffic by adding the following to claude_desktop_config.json (Settings → Developer → Edit Config):',
        buildSnippet: jsonClientConfig,
        docsUrl: 'https://modelcontextprotocol.io/quickstart/user'
    },
    {
        id: 'vscode',
        name: 'VS Code',
        description: 'Use HTTP Toolkit from GitHub Copilot in VS Code by adding the following to .vscode/mcp.json in your project (or your user mcp.json):',
        buildSnippet: vscodeClientConfig,
        docsUrl: 'https://code.visualstudio.com/docs/copilot/customization/mcp-servers'
    },
    {
        id: 'cursor',
        name: 'Cursor',
        description: 'Use HTTP Toolkit from Cursor\'s AI features by adding the following to ~/.cursor/mcp.json (or .cursor/mcp.json in your project):',
        buildSnippet: jsonClientConfig,
        docsUrl: 'https://docs.cursor.com/context/mcp'
    },
    {
        id: 'windsurf',
        name: 'Windsurf',
        description: 'Use HTTP Toolkit from Windsurf\'s Cascade by adding the following to ~/.codeium/windsurf/mcp_config.json:',
        buildSnippet: jsonClientConfig,
        docsUrl: 'https://docs.windsurf.com/windsurf/cascade/mcp'
    },
    {
        id: 'generic',
        name: 'Other MCP clients',
        description: 'HTTP Toolkit speaks the standard Model Context Protocol over stdio — configure your client to spawn the following command:',
        buildSnippet: ({ command, args }) =>
            [command, ...args].map(shellEscape).join(' ')
    }
];

const Dialog = styled(AppModal)`
    background-color: ${p => p.theme.mainBackground};
    color: ${p => p.theme.mainColor};
    border: 1px solid ${p => p.theme.containerBorder};
    border-radius: 4px;

    box-shadow: 0 2px 30px rgba(0, 0, 0, 0.3);

    width: 90%;
    max-width: 760px;
    max-height: 85vh;

    display: flex;
    flex-direction: column;
`;

const Header = styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 20px 24px;
    border-bottom: 1px solid ${p => p.theme.containerBorder};

    h1 {
        font-size: ${p => p.theme.loudHeadingSize};
        font-weight: bold;
        letter-spacing: -0.5px;
    }
`;

const CloseButton = styled(UnstyledButton)`
    color: ${p => p.theme.mainColor};
    opacity: 0.7;
    font-size: 20px;
    padding: 4px 8px;

    &:hover, &:focus {
        opacity: 1;
        outline: none;
    }
`;

const Body = styled.div`
    padding: 16px 24px 24px;
    overflow-y: auto;

    font-size: ${p => p.theme.textSize};

    p {
        line-height: 1.4;
    }

    p.intro {
        margin-bottom: 16px;
    }

    a {
        color: ${p => p.theme.linkColor};
    }
`;

const TabBar = styled.nav`
    display: flex;
    gap: 4px;
    border-bottom: 1px solid ${p => p.theme.containerBorder};
    margin-bottom: 16px;
`;

const Tab = styled(UnstyledButton)<{ selected: boolean }>`
    padding: 8px 14px;
    font-family: ${p => p.theme.fontFamily};
    font-size: ${p => p.theme.textSize};
    color: ${p => p.theme.mainColor};
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;

    ${p => p.selected && css`
        color: ${p.theme.popColor};
        border-bottom-color: ${p.theme.popColor};
        font-weight: bold;
    `}

    &:hover {
        color: ${p => p.theme.popColor};
    }
`;

const SnippetBlock = styled.div`
    margin-top: 16px;

    position: relative;
    background-color: ${p => p.theme.mainLowlightBackground};
    border: 1px solid ${p => p.theme.containerBorder};
    border-radius: 3px;

    pre {
        font-family: ${p => p.theme.monoFontFamily};
        font-size: 13px;
        line-height: 1.4;
        padding: 12px 44px 12px 14px;
        margin: 0;
        white-space: pre-wrap;
        word-break: break-all;
        overflow-x: auto;
    }

    > button {
        position: absolute;
        top: 6px;
        right: 6px;
    }
`;

const FooterNote = styled.p`
    margin-top: 16px;
`;

interface McpModalProps {
    onClose: () => void;
    proxyStore: ProxyStore;
    accountStore: AccountStore;
}

@inject('proxyStore')
@inject('accountStore')
@observer
class McpModal extends React.Component<McpModalProps> {

    @observable
    private selectedId: string = INTEGRATIONS[0].id;

    @action
    private select = (id: string) => {
        this.selectedId = id;
    };

    @computed
    private get mcpCommand(): { command: string; args: string[] } {
        // Guarded by App.canUseMcp before rendering, so toolPaths.mcp is always set here.
        const path = this.props.proxyStore.toolPaths!.mcp;
        return { command: path[0], args: path.slice(1) };
    }

    componentDidMount() {
        trackEvent({ category: 'MCP', action: 'Open' });
    }

    render() {
        const integration = INTEGRATIONS.find(i => i.id === this.selectedId)!;
        const { onClose } = this.props;
        const { mcpCommand } = this;

        return (
            <Dialog
                onClose={onClose}
                backdropOpacity={0.6}
                aria-labelledby='mcp-modal-title'
            >
                <Header>
                    <h1 id='mcp-modal-title'>Connect HTTP Toolkit to your LLM</h1>
                    <CloseButton title="Close" onClick={onClose}>
                        <Icon icon={['fas', 'times']} />
                    </CloseButton>
                </Header>

                <Body>
                    <p className='intro'>
                        HTTP Toolkit exposes intercepted traffic and operations to AI agents via the{' '}
                        <a href='https://modelcontextprotocol.io/' target='_blank' rel='noreferrer'>
                            Model Context Protocol
                        </a>
                        . Pick your client below and follow the instructions to give it access.
                    </p>

                    <TabBar role='tablist'>
                        { INTEGRATIONS.map(i =>
                            <Tab
                                key={i.id}
                                role='tab'
                                aria-selected={i.id === this.selectedId}
                                selected={i.id === this.selectedId}
                                onClick={() => this.select(i.id)}
                            >
                                { i.name }
                            </Tab>
                        ) }
                    </TabBar>

                    <p>{ integration.description }</p>

                    <SnippetBlock>
                        <pre>{ integration.buildSnippet(mcpCommand) }</pre>
                        <CopyButtonIcon
                            content={integration.buildSnippet(mcpCommand)}
                            onClick={() => trackEvent({
                                category: 'MCP',
                                action: 'Copy snippet',
                                value: integration.id
                            })}
                        />
                    </SnippetBlock>

                    { integration.docsUrl && <FooterNote>
                        Need help? See the{' '}
                        <a href={integration.docsUrl} target='_blank' rel='noreferrer'>
                            { integration.name } MCP setup docs
                        </a>.
                    </FooterNote> }

                    <FooterNote>
                        HTTP Toolkit must be running for the AI client to connect.
                        { !this.props.accountStore.user.isPaidUser() && <>
                            {' '}Free accounts have per-session call limits — see{' '}
                            <a href='https://httptoolkit.com/pricing/' target='_blank' rel='noreferrer'>
                                Pro
                            </a>{' '}
                            for unlimited access.
                        </> }
                    </FooterNote>
                </Body>
            </Dialog>
        );
    }
}

const McpModalWithStoreInjected = (
    McpModal as unknown as WithInjected<typeof McpModal, 'proxyStore' | 'accountStore'>
);
export { McpModalWithStoreInjected as McpModal };
