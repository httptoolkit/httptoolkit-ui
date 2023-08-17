import * as _ from 'lodash';
import * as React from 'react';
import { action, computed } from 'mobx';
import { inject, observer } from 'mobx-react';
import * as portals from 'react-reverse-portal';
import { Method } from 'mockttp';

import { RawHeaders } from '../../types';
import { styled } from '../../styles';
import { Icon } from '../../icons';

import { RulesStore } from '../../model/rules/rules-store';
import { UiStore } from '../../model/ui/ui-store';
import { RequestInput } from '../../model/send/send-request-model';

import { Button, Select, TextInput } from '../common/inputs';
import { ContainerSizedEditor } from '../editor/base-editor';
import { SendRequestHeadersCard } from './send-request-headers-card';
import { SendRequestBodyCard } from './send-request-body-card';

const RequestPaneContainer = styled.section`
    display: flex;
    flex-direction: column;
    height: 100%;
`;

// Layout here is tricky. Current setup seems to work (flex hrink everywhere, grow bodies,
// card basis: auto, and min-height: 0, with editor 50% + min-height, and then
// overflow-y: auto and basis: auto on the card contents too).
//
// It's worth reiterating the UI goals here explicitly for reference
// - When multiple areas are open & full+, the area is split even-ish with scrolling
//   in any areas required
// - When areas are closed, body areas expand to the space, otherwise it collapses upwards
// - When multiple areas are open, if there is spare space (e.g. few headers), the
//   other areas that need it (body editor) expand and use the space.

type MethodName = keyof typeof Method;
const validMethods = Object.values(Method)
    .filter(
        value => typeof value === 'string'
    ) as Array<MethodName>;

const MethodSelect = styled(Select)`
    font-size: ${p => p.theme.textSize};
    display: inline-block;
    width: auto;
`;

const UrlInput = styled(TextInput)`
`;

@inject('rulesStore')
@inject('uiStore')
@observer
export class RequestPane extends React.Component<{
    rulesStore?: RulesStore,
    uiStore?: UiStore,

    editorNode: portals.HtmlPortalNode<typeof ContainerSizedEditor>,

    requestInput: RequestInput,
    sendRequest: (requestInput: RequestInput) => void
}> {

    get cardProps() {
        return this.props.uiStore!.sendCardProps;
    }

    render() {
        const { requestInput, editorNode } = this.props;

        return <RequestPaneContainer>
            <MethodSelect value={requestInput.method} onChange={this.updateMethod}>
                { validMethods.map((methodOption) =>
                    <option
                        key={methodOption}
                        value={methodOption}
                    >
                        { methodOption }
                    </option>
                ) }
            </MethodSelect>
            <UrlInput
                placeholder='https://example.com/hello?name=world'
                value={requestInput.url}
                onChange={this.updateUrl}
            />
            <Button
                onClick={this.sendRequest}
            >
                Send <Icon icon={['far', 'paper-plane']} />
            </Button>
            <SendRequestHeadersCard
                {...this.cardProps.requestHeaders}
                headers={requestInput.headers}
                updateHeaders={this.updateHeaders}
            />
            <SendRequestBodyCard
                {...this.cardProps.requestBody}
                body={requestInput.rawBody}
                onBodyUpdated={this.updateBody}
                editorNode={editorNode}
            />
        </RequestPaneContainer>;
    }

    @action.bound
    updateMethod(event: React.ChangeEvent<HTMLSelectElement>) {
        const { requestInput } = this.props;
        requestInput.method = event.target.value;
    }

    @action.bound
    updateUrl(changeEvent: React.ChangeEvent<HTMLInputElement>) {
        const { requestInput } = this.props;
        requestInput.url = changeEvent.target.value;
    }

    @action.bound
    updateHeaders(headers: RawHeaders) {
        const { requestInput } = this.props;
        requestInput.headers = headers;
    }

    @action.bound
    updateBody(input: Buffer) {
        const { requestInput } = this.props;
        requestInput.rawBody = input;
    }

    @action.bound
    async sendRequest() {
        this.props.sendRequest(this.props.requestInput);
    }

}