import * as _ from 'lodash';
import React from "react";
import { observable, action } from "mobx";
import { inject, observer } from "mobx-react";
import * as HTTPSnippet from "httpsnippet";

import { Omit } from "../../types";
import { styled } from '../../styles';
import { FontAwesomeIcon } from '../../icons';
import { saveFile } from '../../util';

import { AccountStore } from "../../model/account/account-store";
import { HttpExchange } from "../../model/exchange";
import { generateHarRequest, generateHar } from "../../model/har";

import { ProHeaderPill, CardSalesPitch } from "../account/pro-placeholders";
import { CollapsibleCardHeading } from '../common/card';
import { PillSelector, PillButton } from "../common/pill";
import { CopyButtonPill } from '../common/copy-button';
import { DocsLink } from '../common/docs-link';
import { ExchangeCard, ExchangeCardProps } from "./exchange-card";
import { ThemedSelfSizedEditor } from '../editor/base-editor';

interface SnippetOption {
    target: HTTPSnippet.Target,
    client: HTTPSnippet.Client,
    name: string,
    description: string,
    link: string
}

const snippetExportOptions: _.Dictionary<SnippetOption[]> = _(HTTPSnippet.availableTargets())
    .keyBy(target => target.title)
    .mapValues(target =>
        target.clients.map((client) => ({
            target: target.key,
            client: client.key,
            name: client.title,
            description: client.description,
            link: client.link
        }))
    ).value();

const KEY_SEPARATOR = '~~';

const getExportOptionKey = (option: SnippetOption) =>
    option.target + KEY_SEPARATOR + option.client;

// Show the client name, or an overridden name in some ambiguous cases
const getExportOptionName = (option: SnippetOption) => ({
    'php~~curl': 'PHP ext-cURL',
    'php~~http1': 'PHP HTTP v1',
    'php~~http2': 'PHP HTTP v2',
    'node~~native': 'Node.js HTTP'
} as _.Dictionary<string>)[getExportOptionKey(option)] || option.name;

interface ExportCardProps extends Omit<ExchangeCardProps, 'children'>  {
    exchange: HttpExchange;
    accountStore?: AccountStore;
}

const SnippetDescriptionContainer = styled.div`
    p {
        margin-bottom: 10px;
    }
`;

const SnippetEditorContainer = styled.div`
    margin: 0 -20px -20px -20px;
    border-top: solid 1px ${p => p.theme.containerBorder};
    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};
`;

const snippetEditorOptions = {
    readOnly: true,
    hover: { enabled: false }
};

const ExportSnippetEditor = observer((p: {
    exchange: HttpExchange
    exportOption: SnippetOption
}) => {
    const { target, client, link, description } = p.exportOption;
    const harRequest = generateHarRequest(p.exchange.request);
    const snippet = new HTTPSnippet(harRequest).convert(target, client);

    return <>
        <SnippetDescriptionContainer>
            <p>
                <strong>{
                    getExportOptionName(p.exportOption)
                }</strong>: { description }
            </p>
            <p>
                <DocsLink href={link}>
                    Find out more
                </DocsLink> <CopyButtonPill content={snippet}>
                    {' '}Copy snippet
                </CopyButtonPill>
            </p>
        </SnippetDescriptionContainer>
        <SnippetEditorContainer>
            <ThemedSelfSizedEditor
                value={snippet}
                language={
                    ({
                        'javascript': 'javascript',
                        'node': 'javascript',
                        'shell': 'shell',
                    } as _.Dictionary<string>)[target] || 'text'
                }
                options={snippetEditorOptions}
            />
        </SnippetEditorContainer>
    </>;
});

const exportHar = async (exchange: HttpExchange) => {
    const harContent = JSON.stringify(
        await generateHar([exchange])
    );
    const filename = `${
        exchange.request.method
    } ${
        exchange.request.parsedUrl.hostname
    }.har`;

    saveFile(filename, 'application/har+json;charset=utf-8', harContent);
};

const ExportHarPill = styled(observer((p: {
    className?: string,
    exchange: HttpExchange
}) =>
    <PillButton
        className={p.className}
        onClick={() => exportHar(p.exchange)}
        disabled={!p.exchange.response || p.exchange.response === 'aborted'}
    >
        <FontAwesomeIcon icon={['fas', 'download']} /> Save as HAR
    </PillButton>
))`
    margin-right: auto;
    padding: 2px 8px 3px;
`;

@inject('accountStore')
@observer
export class ExchangeExportCard extends React.Component<ExportCardProps> {

    render() {
        const { exchange, accountStore } = this.props;
        const { isPaidUser } = accountStore!;

        return <ExchangeCard {...this.props}>
            <header>
                { isPaidUser
                    ? <ExportHarPill exchange={exchange} />
                    : <ProHeaderPill />
                }

                <PillSelector<SnippetOption>
                    onChange={this.setSnippetOption}
                    value={this.snippetOption}
                    optGroups={snippetExportOptions}
                    keyFormatter={getExportOptionKey}
                    nameFormatter={getExportOptionName}
                />

                <CollapsibleCardHeading onCollapseToggled={this.props.onCollapseToggled}>
                    Export
                </CollapsibleCardHeading>
            </header>

            { isPaidUser ?
                <div>
                    <ExportSnippetEditor
                        exchange={exchange}
                        exportOption={this.snippetOption}
                    />
                </div>
            :
                <CardSalesPitch>
                    <p>
                        Instantly export requests as code, for languages and tools including cURL, wget, JS
                        (XHR, Node HTTP, Request, ...), Python (native or Requests), Ruby, Java (OkHttp
                        or Unirest), Go, PHP, Swift, HTTPie, and a whole lot more.
                    </p>
                    <p>
                        Want to save the exchange itself? Export one or all requests as HAR (the{' '}
                        <a href="https://en.wikipedia.org/wiki/.har">HTTP Archive Format</a>), to import
                        and examine elsewhere, share with your team, or store for future reference.
                    </p>
                </CardSalesPitch>
            }
        </ExchangeCard>;
    }

    @observable.ref
    private snippetOption: SnippetOption =
        _.find(snippetExportOptions['Shell'], { client: 'curl' }) as SnippetOption;

    @action.bound
    setSnippetOption(optionKey: string) {
        const [target, client] = optionKey.split(KEY_SEPARATOR) as
            [HTTPSnippet.Target, HTTPSnippet.Client];

        this.snippetOption = _(snippetExportOptions)
            .values()
            .flatten()
            .find({ target, client }) as SnippetOption;
    }
};