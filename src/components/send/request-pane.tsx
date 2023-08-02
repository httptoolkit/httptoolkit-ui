import * as _ from 'lodash';
import * as React from 'react';
import { action, computed } from 'mobx';
import { inject, observer } from 'mobx-react';
import { Method } from 'mockttp';

import { RawHeaders } from '../../types';
import { styled } from '../../styles';
import { Icon } from '../../icons';
import { bufferToString, isProbablyUtf8, stringToBuffer } from '../../util';

import { RulesStore } from '../../model/rules/rules-store';
import { UiStore } from '../../model/ui/ui-store';
import { RequestInput } from '../../model/send/send-request-model';

import { Button, Select, TextInput } from '../common/inputs';
import { SendRequestHeadersCard } from './send-request-headers-card';
import { SendRequestBodyCard } from './send-request-body-card';

const RequestPaneContainer = styled.section`
    display: flex;
    flex-direction: column;
    height: 100%;
`;

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

    requestInput: RequestInput,
    sendRequest: (requestInput: RequestInput) => void
}> {

    get cardProps() {
        return this.props.uiStore!.sendCardProps;
    }

    @computed
    private get bodyTextEncoding() {
        // If we're handling text data, we want to show & edit it as UTF8.
        // If it's binary, that's a lossy operation, so we use binary (latin1) instead.
        const { requestInput } = this.props;
        return isProbablyUtf8(requestInput.rawBody)
            ? 'utf8'
            : 'binary';
    }

    render() {
        const { requestInput } = this.props;
        const bodyString = bufferToString(
            requestInput.rawBody,
            this.bodyTextEncoding
        );

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
            <SendRequestHeadersCard
                {...this.cardProps.requestHeaders}
                headers={requestInput.headers}
                updateHeaders={this.updateHeaders}
            />
            <SendRequestBodyCard
                {...this.cardProps.requestBody}
                body={bodyString}
                updateBody={this.updateBody}
            />
            <Button
                onClick={this.sendRequest}
            >
                Send <Icon icon={['far', 'paper-plane']} />
            </Button>
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
    updateBody(input: string) {
        const { requestInput } = this.props;
        requestInput.rawBody = stringToBuffer(input, this.bodyTextEncoding);
    }

    @action.bound
    async sendRequest() {
        this.props.sendRequest(this.props.requestInput);
    }

}