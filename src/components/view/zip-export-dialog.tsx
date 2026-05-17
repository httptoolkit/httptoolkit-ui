import * as React from 'react';
import { observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';

import { ViewableEvent } from '../../types';
import { styled } from '../../styles';
import { Icon } from '../../icons';
import { getReadableSize } from '../../util/buffer';

import { UiStore } from '../../model/ui/ui-store';
import { ZipExportController } from '../../model/ui/zip-export-service';
import {
    ALL_ZIP_EXPORT_FORMATS,
    ZIP_EXPORT_FORMATS_BY_CATEGORY,
    ZIP_EXPORT_CATEGORIES,
    DEFAULT_SELECTED_FORMAT_IDS,
    ALL_FORMAT_IDS,
    resolveFormats
} from '../../model/ui/zip-export-formats';

import { Button, SecondaryButton, UnstyledButton } from '../common/inputs';
import { ModalOverlay } from '../account/modal-overlay';

const Dialog = styled.dialog`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

    bottom: auto;
    right: auto;

    z-index: 9999;

    background-color: ${p => p.theme.mainBackground};
    color: ${p => p.theme.mainColor};
    border: 1px solid ${p => p.theme.containerBorder};
    border-radius: 4px;

    box-shadow: 0 2px 30px rgba(0, 0, 0, 0.3);

    width: 90%;
    max-width: 680px;
    max-height: 85vh;

    padding: 0;
    margin: 0;

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

const SelectionControls = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;

    padding: 12px 24px;
    border-bottom: 1px solid ${p => p.theme.containerBorder};

    font-size: ${p => p.theme.textSize};
`;

const SelectionSummary = styled.span`
    margin-right: auto;
    opacity: 0.8;
`;

const SelectionButton = styled(SecondaryButton)`
    padding: 4px 10px;
    font-size: ${p => p.theme.textSize};
`;

const Body = styled.div`
    padding: 8px 24px 16px;
    overflow-y: auto;

    font-size: ${p => p.theme.textSize};
`;

const CategoryTitle = styled.h2`
    font-size: ${p => p.theme.subHeadingSize};
    font-weight: bold;
    text-transform: uppercase;
    opacity: 0.7;

    margin: 16px 0 8px;
`;

const FormatGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 4px 16px;
`;

const FormatOption = styled.label`
    display: flex;
    align-items: center;
    gap: 8px;

    padding: 4px 6px;
    border-radius: 3px;
    cursor: pointer;

    &:hover {
        background-color: ${p => p.theme.mainLowlightBackground};
    }

    input {
        cursor: pointer;
    }
`;

const Footer = styled.footer`
    display: flex;
    align-items: center;
    gap: 10px;

    padding: 16px 24px;
    border-top: 1px solid ${p => p.theme.containerBorder};
`;

const FooterStatus = styled.div`
    margin-right: auto;
    font-size: ${p => p.theme.textSize};

    display: flex;
    flex-direction: column;
    gap: 6px;

    flex-grow: 1;
`;

const ErrorStatus = styled(FooterStatus)`
    color: ${p => p.theme.warningColor};
`;

const ProgressTrack = styled.div`
    height: 6px;
    border-radius: 3px;
    background-color: ${p => p.theme.containerWatermark};
    overflow: hidden;
    max-width: 300px;
`;

const ProgressFill = styled.div<{ percent: number }>`
    height: 100%;
    width: ${p => p.percent}%;
    background-color: ${p => p.theme.popColor};
    transition: width 0.2s ease-out;
`;

interface ZipExportDialogProps {
    uiStore?: UiStore;
    events: ReadonlyArray<ViewableEvent>;
    onClose: () => void;
}

@inject('uiStore')
@observer
export class ZipExportDialog extends React.Component<ZipExportDialogProps> {

    private readonly controller = new ZipExportController();

    @observable
    private selected: Set<string>;

    constructor(props: ZipExportDialogProps) {
        super(props);

        // Start from the persisted selection (ignoring any format ids that
        // no longer exist), or from the popular defaults:
        const persisted = resolveFormats(props.uiStore!.zipExportSelectedFormatIds);
        this.selected = new Set(
            persisted.length
                ? persisted.map(f => f.id)
                : DEFAULT_SELECTED_FORMAT_IDS
        );
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') this.props.onClose();
    };

    componentDidMount() {
        window.addEventListener('keydown', this.onKeyDown);
    }

    componentWillUnmount() {
        window.removeEventListener('keydown', this.onKeyDown);
        this.controller.dispose(); // Aborts any ongoing export
    }

    @action.bound
    private toggleFormat(id: string) {
        if (this.selected.has(id)) {
            this.selected.delete(id);
        } else {
            this.selected.add(id);
        }
    }

    @action.bound
    private selectPopular() {
        this.selected = new Set(DEFAULT_SELECTED_FORMAT_IDS);
    }

    @action.bound
    private selectAll() {
        this.selected = new Set(ALL_FORMAT_IDS);
    }

    @action.bound
    private selectNone() {
        this.selected = new Set();
    }

    @action.bound
    private startExport() {
        this.props.uiStore!.setZipExportSelectedFormatIds(Array.from(this.selected));
        this.controller.run({
            events: this.props.events,
            formatIds: this.selected
        });
    }

    render() {
        const { events, onClose } = this.props;
        const { state } = this.controller;

        const requestCount = events.length;
        const selectedCount = this.selected.size;

        return <>
            <ModalOverlay opacity={0.6} onClick={onClose} />
            <Dialog open aria-modal aria-labelledby='zip-export-title'>
                <Header>
                    <h1 id='zip-export-title'>Export as ZIP</h1>
                    <CloseButton title='Close' onClick={onClose}>
                        <Icon icon={['fas', 'times']} />
                    </CloseButton>
                </Header>

                <SelectionControls>
                    <SelectionSummary>
                        { selectedCount } of { ALL_ZIP_EXPORT_FORMATS.length } formats selected
                    </SelectionSummary>
                    <SelectionButton onClick={this.selectPopular}>Popular</SelectionButton>
                    <SelectionButton onClick={this.selectAll}>All</SelectionButton>
                    <SelectionButton onClick={this.selectNone}>None</SelectionButton>
                </SelectionControls>

                <Body>
                    { ZIP_EXPORT_CATEGORIES.map(category =>
                        <React.Fragment key={category}>
                            <CategoryTitle>{ category }</CategoryTitle>
                            <FormatGrid>
                                { ZIP_EXPORT_FORMATS_BY_CATEGORY[category].map(format =>
                                    <FormatOption key={format.id}>
                                        <input
                                            type='checkbox'
                                            checked={this.selected.has(format.id)}
                                            onChange={() => this.toggleFormat(format.id)}
                                        />
                                        { format.label }
                                    </FormatOption>
                                ) }
                            </FormatGrid>
                        </React.Fragment>
                    ) }
                </Body>

                <Footer>
                    { (state.kind === 'idle' || state.kind === 'cancelled') && <>
                        <FooterStatus>
                            { state.kind === 'cancelled'
                                ? 'Export cancelled.'
                                : `${requestCount} request${requestCount === 1 ? '' : 's'} to export`
                            }
                        </FooterStatus>
                        <Button
                            disabled={selectedCount === 0}
                            onClick={this.startExport}
                        >
                            Download ZIP
                        </Button>
                    </> }

                    { (state.kind === 'preparing' || state.kind === 'running') && <>
                        <FooterStatus role='status'>
                            <span>
                                { state.kind === 'running' && state.currentRequest
                                    ? `Exporting request ${state.currentRequest} of ${
                                        state.totalRequests ?? requestCount
                                    }...`
                                    : 'Preparing export...'
                                }
                            </span>
                            <ProgressTrack>
                                <ProgressFill percent={
                                    state.kind === 'running' ? state.percent : 0
                                } />
                            </ProgressTrack>
                        </FooterStatus>
                        <SecondaryButton onClick={this.controller.cancel}>
                            Cancel
                        </SecondaryButton>
                    </> }

                    { state.kind === 'done' && <>
                        <FooterStatus role='status'>
                            Saved { state.downloadName } ({
                                getReadableSize(state.downloadBytes)
                            }): { state.snippetSuccessCount } snippet{
                                state.snippetSuccessCount === 1 ? '' : 's'
                            } exported{
                                state.snippetErrorCount > 0
                                    ? `, ${state.snippetErrorCount} failed (see manifest.json)`
                                    : ''
                            }.
                        </FooterStatus>
                        <Button onClick={onClose}>Done</Button>
                    </> }

                    { state.kind === 'error' && <>
                        <ErrorStatus role='alert'>
                            Export failed: { state.message }
                        </ErrorStatus>
                        <Button
                            disabled={selectedCount === 0}
                            onClick={this.startExport}
                        >
                            Try again
                        </Button>
                    </> }
                </Footer>
            </Dialog>
        </>;
    }
}
