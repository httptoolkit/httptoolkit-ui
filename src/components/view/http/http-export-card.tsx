import React from "react";
import { action, computed, observable } from "mobx";
import { inject, observer } from "mobx-react";
import dedent from 'dedent';

import { CollectedEvent, HttpExchangeView } from '../../../types';
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
    getSafeCodeSnippetOptionFromKey,
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
import { ZipExportDialog } from '../zip-export-dialog';

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
                    Copy snippet
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

    @observable
    private zipDialogOpen = false;

    @action.bound
    private openZipDialog() { this.zipDialogOpen = true; }

    @action.bound
    private closeZipDialog() { this.zipDialogOpen = false; }

    render() {
        const { exchange, accountStore } = this.props;
        const isPaidUser = accountStore!.user.isPaidUser();

        return <>
            <CollapsibleCard {...this.props}>
                <header>
                    { isPaidUser
                        ? <>
                            <ExportHarPill exchange={exchange} />
                            {/*
                             * ZIP PillButton is active immediately (even when
                             * the card is collapsed). The click stops propagation
                             * so a header click underneath does not inadvertently
                             * toggle the card.
                             */}
                            <PillButton
                                onClick={(e) => {
                                    e.stopPropagation();
                                    this.openZipDialog();
                                }}
                            >
                                <Icon icon={['fas', 'file-archive']} /> ZIP
                            </PillButton>
                        </>
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
            </CollapsibleCard>
            {/*
             * Dialog intentionally rendered OUTSIDE the CollapsibleCard.
             * `CollapsibleCard.renderChildren()` discards all children
             * after child 0 when the card is collapsed; placed there the
             * dialog JSX would never appear in the DOM when the card is
             * closed. The modal component uses a portal internally anyway,
             * so its position in the React tree does not matter.
             */}
            {this.zipDialogOpen && <ZipExportDialog
                events={[exchange as unknown as CollectedEvent]}
                onClose={this.closeZipDialog}
                titleSuffix='1 request'
            />}
        </>;
    }

    @computed
    private get snippetOption(): SnippetOption {
        let exportSnippetFormat = this.props.uiStore!.exportSnippetFormat ||
            DEFAULT_SNIPPET_FORMAT_KEY;
        return getSafeCodeSnippetOptionFromKey(exportSnippetFormat);
    }

    @action.bound
    setSnippetOption(optionKey: string) {
        this.props.uiStore!.exportSnippetFormat = optionKey;
    }
};
