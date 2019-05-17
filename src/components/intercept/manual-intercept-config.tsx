import * as React from 'react';
import { action, observable } from 'mobx';
import { observer } from 'mobx-react';

import { styled, css } from '../../styles';
import { trackEvent } from '../../tracking';

import { Interceptor, MANUAL_INTERCEPT_ID } from '../../model/interceptors';
import { InterceptOption } from './intercept-option';
import { CloseButton } from '../common/close-button';
import { CopyableMonoValue } from '../common/text-content';

interface ManualInterceptOptionCardProps {
    expanded: boolean;
    index: number;
}

// We use two separate props here to make the animation play out nicely.
// If we animate width and move at once, it jumps off the screen, and then
// starts moving afterwards, very messy.
const ManualInterceptOptionCard = styled(InterceptOption)`
    ${(p: ManualInterceptOptionCardProps) => p.expanded && css`
        grid-row: ${Math.floor(p.index / 4) + 2};
        grid-column: span 4;

        > section {
            padding: 30px;
        }
    `}
`;

const InstructionsContainer = styled.div`
    display: flex;
    flex-direction: row;
    user-select: text;
    margin-top: 5px;
`;

const InstructionsStep = styled.div`
    flex: 1 1 0;

    &:not(:last-child) {
        margin-right: 40px;
    }

    > h2 {
        font-size: ${p => p.theme.headingSize};
        margin-bottom: 21px;
    }

    > ol {
        list-style: decimal;

        > li {
            margin-left: 20px;
            margin-bottom: 10px;
        }
    }

    > p {
        line-height: 1.2;

        &:not(:last-child) {
            margin-bottom: 10px;
        }
    }

    strong {
        font-weight: bold;
    }
`;

export interface ManualInterceptOptionProps {
    index: number;
    interceptor: Interceptor;
    serverPort: number;
    certPath: string;
}

@observer
export class ManualInterceptOption extends React.Component<ManualInterceptOptionProps> {

    @observable expanded = false;

    render() {
        const { interceptor, index, serverPort, certPath } = this.props;

        return <ManualInterceptOptionCard
            index={index}
            interceptor={interceptor}
            onActivate={this.expanded ? undefined : this.onExpand}
            expanded={this.expanded}
        >{ this.expanded ? <>
            <CloseButton onClose={this.onClose} />

            <InstructionsContainer>
                <InstructionsStep>
                    <p>To intercept traffic you need to:</p>
                    <ol>
                        <li><strong>send your traffic via the HTTP Toolkit proxy</strong></li>
                        <li><strong>trust the certificate authority</strong> (if using HTTPS) </li>
                    </ol>
                    <p>
                        The steps to do this manually depend
                        on the client, but all the details
                        you'll need are shown here.
                    </p>
                    <p>
                        Want your client to be supported automatically?{' '}
                        <a href='https://github.com/httptoolkit/feedback/issues/new'>
                        Let us know</a>.
                    </p>
                </InstructionsStep>

                <InstructionsStep>
                    <h2>1. Send traffic via HTTP Toolkit</h2>
                    <p>
                        To intercept an HTTP client on this machine, configure it to send traffic via{' '}
                        <CopyableMonoValue>http://localhost:{serverPort}</CopyableMonoValue>.
                    </p>
                    <p>
                        Most tools can be configured to do so by using the above address as an HTTP or
                        HTTPS proxy.
                    </p>
                    <p>
                        In other cases, it's also possible to forcibly reroute traffic
                        using networking tools like iptables.
                    </p>
                    <p>
                        Remote clients (e.g. phones) will need to use the IP address of this machine, not
                        localhost.
                    </p>
                </InstructionsStep>

                <InstructionsStep>
                    <h2>2. Trust the certificate authority</h2>
                    <p>
                        Optional: only required to intercept traffic that uses HTTPS, not plain HTTP.
                    </p>
                    <p>
                        HTTP Toolkit has generated a certificate authority (CA) on your machine,
                        and stored the certificate at <CopyableMonoValue>{ certPath }</CopyableMonoValue>.
                        All intercepted HTTPS exchanges use certificates from this CA.
                    </p>
                    <p>
                        To intercept HTTPS traffic you need to configure your HTTP client to
                        trust this certificate as a certificate authority, or temporarily
                        disable certificate checks entirely.
                    </p>
                </InstructionsStep>
            </InstructionsContainer>
        </> : null }</ManualInterceptOptionCard>
    }

    @action.bound
    onExpand() {
        trackEvent({ category: 'Interceptors', action: 'Activated', label: MANUAL_INTERCEPT_ID });
        this.expanded = true;
    }

    @action.bound
    onClose() {
        this.expanded = false;
    }
}