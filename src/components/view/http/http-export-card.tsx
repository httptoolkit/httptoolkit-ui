import React from "react";
import { action, computed } from "mobx";
import { inject, observer } from "mobx-react";
import dedent from 'dedent';

import { HttpExchangeView } from '../../../types';
import { styled } from '../../../styles';
import { Icon } from '../../../icons';
import { logError } from '../../../errors';

import { AccountStore } from '../../../model/account/account-store';
import { UiStore } from '../../../model/ui/ui-store';
import {
    exportHar,
    generateCodeSnippet,
    getCodeSnippetFormatKey,
    getCodeSnippetFormatName,
    getCodeSnippetOptionFromKey,
    DEFAULT_SNIPPET_FORMAT_KEY,
    snippetExportOptions,
    SnippetOption
} from '../../../model/ui/export';

import { ProHeaderPill, CardSalesPitch } from '../../account/pro-placeholders';
import {
    CollapsibleCard,
    CollapsibleCardProps,
    CollapsibleCardHeading
} from '../../common/card';
import { PillSelector, PillButton } from '../../common/pill';
import { CopyButtonPill } from '../../common/copy-button';
import { DocsLink } from '../../common/docs-link';
import { SelfSizedEditor } from '../../editor/base-editor';

interface ExportCardProps extends CollapsibleCardProps  {
    exchange: HttpExchangeView;
    accountStore?: AccountStore;
    uiStore?: UiStore;
}

const SnippetDescriptionContainer = styled.div`
    p {
        margin-bottom: 10px;
    }
`;

const SnippetDetailButtons = styled.div`
    display: flex;
    align-items: center;

    gap: 10px;
    margin-bottom: 10px;
`;

const SnippetEditorContainer = styled.div`
    margin: 0 -20px -20px -20px;

    border: solid 1px ${p => p.theme.containerBorder};
    padding-right: 1px;
    border-radius: 0 0 3px 3px;

    background-color: ${p => p.theme.highlightBackground};
    color: ${p => p.theme.highlightColor};
`;

const snippetEditorOptions = {
    readOnly: true,
    hover: { enabled: false }
};

const ExportSnippetEditor = observer((p: {
    exchange: HttpExchangeView
    exportOption: SnippetOption
}) => {
    const { target, client, link, description } = p.exportOption;

    let snippet: string;
    try {
        snippet = generateCodeSnippet(p.exchange, p.exportOption);
    } catch (e) {
        console.log(`Failed to export request for ${target}--${client}`);
        logError(e);
        snippet = dedent`
            Could not generate a snippet for this request

            Is this unexpected? Please file a bug at github.com/httptoolkit/httptoolkit.
        `;
    }

    return <>
        <SnippetDescriptionContainer>
            <p>
                <strong>{
                    getCodeSnippetFormatName(p.exportOption)
                }</strong>: { description }
            </p>
            <SnippetDetailButtons>
                <DocsLink href={link}>
                    Find out more
                </DocsLink>
                <CopyButtonPill content={snippet}>
                    {' '}Copy snippet
                </CopyButtonPill>
            </SnippetDetailButtons>
        </SnippetDescriptionContainer>
        <SnippetEditorContainer>
            <SelfSizedEditor
                contentId={null}
                value={snippet}
                language={
                    ({
                        'javascript': 'javascript',
                        'node': 'javascript',
                        'shell': 'shell',
                    } as Record<string, string>)[target] || 'text'
                }
                options={snippetEditorOptions}
            />
        </SnippetEditorContainer>
    </>;
});

const ExportHarPill = styled(observer((p: {
    className?: string,
    exchange: HttpExchangeView
}) =>
    <PillButton
        className={p.className}
        onClick={() => exportHar(p.exchange)}
        disabled={!p.exchange.response || p.exchange.response === 'aborted'}
    >
        <Icon icon={['fas', 'download']} /> Save as HAR
    </PillButton>
))`
    margin-right: auto;
`;

@inject('accountStore')
@inject('uiStore')
@observer
export class HttpExportCard extends React.Component<ExportCardProps> {

    render() {
        const { exchange, accountStore } = this.props;
        const { isPaidUser } = accountStore!;

        return <CollapsibleCard {...this.props}>
            <header>
                { isPaidUser
                    ? <ExportHarPill exchange={exchange} />
                    : <ProHeaderPill />
                }

                <PillSelector<SnippetOption>
                    onChange={this.setSnippetOption}
                    value={this.snippetOption}
                    optGroups={snippetExportOptions}
                    keyFormatter={getCodeSnippetFormatKey}
                    nameFormatter={getCodeSnippetFormatName}
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
                <CardSalesPitch source='export'>
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
        </CollapsibleCard>;
    }

    @computed
    private get snippetOption(): SnippetOption {
        let exportSnippetFormat = this.props.uiStore!.exportSnippetFormat ||
            DEFAULT_SNIPPET_FORMAT_KEY;
        return getCodeSnippetOptionFromKey(exportSnippetFormat);
    }

    @action.bound
    setSnippetOption(optionKey: string) {
        this.props.uiStore!.exportSnippetFormat = optionKey;
    }
};