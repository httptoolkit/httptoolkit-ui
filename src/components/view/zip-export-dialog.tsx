/**
 * Modal dialog for selecting ZIP export formats.
 *
 * Reads formats dynamically from `zip-export-formats.ts` (single source of
 * truth). Keeps the selection in `UiStore` (persisted) so it remains stable
 * across sessions.
 */
import * as React from 'react';
import { action, computed, observable } from 'mobx';
import { inject, observer } from 'mobx-react';

import { styled, css } from '../../styles';
import { UiStore } from '../../model/ui/ui-store';
import { CollectedEvent } from '../../types';

import {
    ZIP_EXPORT_CATEGORIES,
    ZIP_EXPORT_FORMATS_BY_CATEGORY,
    DEFAULT_SELECTED_FORMAT_IDS,
    ALL_FORMAT_IDS,
    sanitizeFormatIds
} from '../../model/ui/zip-export-formats';
import { ZipExportController } from '../../model/ui/zip-export-service';
import { prewarmZipExport } from '../../services/ui-worker-api';

import { Button, ButtonLink, SecondaryButton } from '../common/inputs';
import { Icon } from '../../icons';

const Overlay = styled.div`
    position: fixed;
    inset: 0;

    /* Subtle dark scrim + blur. No full-color gradient that completely
     * covers the rest of the app — just hinted so the dialog frame stands
     * out clearly while the app remains visible (cf. VS Code / GitHub
     * Command Palette). */
    background: rgba(8, 10, 16, 0.62);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);

    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;

    animation: zipOverlayFadeIn 0.14s ease-out both;

    @keyframes zipOverlayFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
    }
`;

const Modal = styled.div`
    position: relative;
    width: min(760px, 92vw);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    background: ${p => p.theme.mainBackground};
    color: ${p => p.theme.mainColor};

    border-radius: 8px;
    box-shadow: 0 0 0 1px ${p => p.theme.containerBorder} inset,
                0 20px 60px rgba(0, 0, 0, 0.55);

    font-family: ${p => p.theme.fontFamily};
    line-height: 1.5;

    animation: zipModalPop 0.18s cubic-bezier(0.2, 0.9, 0.35, 1) both;

    @keyframes zipModalPop {
        from { transform: translateY(6px) scale(0.985); opacity: 0; }
        to   { transform: translateY(0)    scale(1);     opacity: 1; }
    }
`;

/**
 * YouTube-inspired progress line. Sits between TopBar and
 * StatusBanner/ModalBody and shows export progress as a slim 2px line.
 * Fixed reservation slot via min-height so the layout does not jump
 * when the line toggles between visible and hidden.
 */
const TopProgressBar = styled.div<{ percent: number, indeterminate: boolean }>`
    flex-shrink: 0;
    height: 2px;
    width: 100%;
    background: transparent;
    pointer-events: none;
    overflow: hidden;
    opacity: ${p => p.percent > 0 || p.indeterminate ? 1 : 0};
    transition: opacity 0.2s ease;

    &::after {
        content: '';
        display: block;
        height: 100%;
        background: ${p => p.theme.primaryInputBackground};
        box-shadow: 0 0 8px ${p => p.theme.primaryInputBackground};

        ${p => p.indeterminate ? css`
            width: 40%;
            animation: zipIndeterminate 1.1s ease-in-out infinite;
        ` : css`
            width: ${Math.min(100, Math.max(0, p.percent))}%;
            transition: width 0.18s ease-out;
        `}
    }

    @keyframes zipIndeterminate {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(350%); }
    }
`;

const ModalHeader = styled.header`
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 60px 18px 28px;
    flex-shrink: 0;

    background: ${p => p.theme.mainLowlightBackground};
    border-bottom: 1px solid ${p => p.theme.containerBorder};
    border-radius: 8px 8px 0 0;

    font-family: ${p => p.theme.titleTextFamily};
    font-size: ${p => p.theme.headingSize};
    font-weight: bold;

    > svg:first-child {
        color: ${p => p.theme.popColor};
        font-size: ${p => p.theme.subHeadingSize};
    }
`;

const CloseIconButton = styled.button.attrs(() => ({
    type: 'button' as const,
    'aria-label': 'Close dialog'
}))`
    position: absolute;
    top: 50%;
    right: 18px;
    transform: translateY(-50%);

    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;

    color: ${p => p.theme.mainColor};
    font-size: ${p => p.theme.headingSize};
    line-height: 1;
    opacity: 0.65;

    &:hover:not([disabled]) {
        opacity: 1;
        background: ${p => p.theme.containerBackground};
    }

    &:focus {
        outline: 2px solid ${p => p.theme.primaryInputBackground};
        outline-offset: 1px;
    }

    &[disabled] {
        opacity: 0.3;
        cursor: default;
    }
`;

const TopBar = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;

    padding: 10px 28px;
    flex-shrink: 0;

    background: ${p => p.theme.containerBackground};
    border-bottom: 1px solid ${p => p.theme.containerBorder};

    font-size: ${p => p.theme.textSize};
`;

const TopBarInfo = styled.span`
    color: ${p => p.theme.mainColor};
`;

const TopBarActions = styled.div`
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
`;

const ModalBody = styled.div`
    padding: 20px 28px;
    overflow-y: auto;
    flex: 1 1 auto;
`;

const ModalFooter = styled.footer`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 16px 28px;
    flex-shrink: 0;

    background: ${p => p.theme.mainLowlightBackground};
    border-top: 1px solid ${p => p.theme.containerBorder};
    border-radius: 0 0 8px 8px;
`;

const CategoryBlock = styled.section`
    margin-bottom: 20px;

    &:last-child {
        margin-bottom: 0;
    }
`;

const CategoryHeading = styled.h4`
    margin: 0 0 10px 0;

    font-family: ${p => p.theme.titleTextFamily};
    font-size: ${p => p.theme.subHeadingSize};
    font-weight: bold;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: ${p => p.theme.mainColor};

    padding-bottom: 6px;
    border-bottom: 1px solid ${p => p.theme.containerBorder};
`;

const FormatGrid = styled.div`
    display: grid;
    /* Slightly wider columns so long client names like
     * "Invoke-WebRequest" or "HttpClient" do not wrap to two lines. */
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 4px 16px;
`;

const FormatLabel = styled.label`
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 4px;
    min-width: 0; /* grid children otherwise never shrink below content */

    font-size: ${p => p.theme.textSize};
    color: ${p => p.theme.mainColor};

    &:hover {
        background: ${p => p.theme.containerBackground};
    }

    input[type='checkbox'] {
        margin: 0;
        accent-color: ${p => p.theme.primaryInputBackground};
        cursor: pointer;
        flex-shrink: 0;
    }
`;

const FormatLabelText = styled.span`
    flex: 1 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const TinyButton = styled(SecondaryButton).withConfig({
    shouldForwardProp: (prop: any) => prop !== 'active'
})<{ active?: boolean }>`
    padding: 3px 10px;
    font-size: ${p => p.theme.textInputFontSize};
    border-width: 1px;
    border-radius: 3px;

    ${p => p.active && css`
        &:not([disabled]) {
            background-color: ${p.theme.primaryInputBackground};
            border-color: ${p.theme.primaryInputBackground};
            color: ${p.theme.primaryInputColor};
        }
        &:not([disabled]), &:not([disabled]):visited {
            color: ${p.theme.primaryInputColor};
        }
    `}
`;

const primaryButtonShellStyles = css`
    padding: 10px 22px;
    font-size: ${p => p.theme.subHeadingSize};
    border-radius: 4px;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 42px;
    /* Fixed minimum width for all primary-button states. Prevents
     * the button from growing/shrinking as the label changes from
     * "Download ZIP" (init) through "0 %" ... "100 %" (running) to
     * "Save archive (X MB)" (done). Without min-width the flex container
     * jerks the Cancel button to the left during the running phase.
     * 200px comfortably covers the widest label case
     * ("Save archive (999 KB)"). */
    min-width: 200px;

    transition: background-color 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
`;

const PrimaryButton = styled(Button)`
    ${primaryButtonShellStyles}
`;

/**
 * Primary-styled anchor — for the "Save archive" button in the done state,
 * which must be a real `<a download>` (programmatic downloads only work in
 * Chrome with an active gesture trust).
 */
const PrimaryDownloadLink = styled(ButtonLink)`
    ${primaryButtonShellStyles}

    &:hover:not([disabled]) {
        filter: brightness(1.08);
    }
`;

/**
 * Small round spinner for the running state of the primary button.
 * Intentionally lightweight and library-free (no extra bundle).
 */
const ButtonSpinner = styled.span`
    display: inline-block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid ${p => p.theme.primaryInputColor};
    border-top-color: transparent;
    animation: zipSpin 0.75s linear infinite;

    @keyframes zipSpin {
        to { transform: rotate(360deg); }
    }
`;

const ButtonProgressLabel = styled.span`
    font-variant-numeric: tabular-nums;
    font-weight: bold;
    letter-spacing: 0.01em;
    /* Width cap so "0 %" and "100 %" render at the same width
     * (tabular-nums unifies digits but overall label length still
     * changes with 1 vs 2 vs 3 digits). Combined with min-width on
     * the shell, this prevents any layout jump. */
    min-width: 5ch;
    text-align: center;
`;

const ButtonFileSize = styled.span`
    font-variant-numeric: tabular-nums;
    opacity: 0.85;
    font-weight: normal;
    font-size: ${p => p.theme.textSize};
`;

const FooterButton = styled(SecondaryButton)`
    padding: 10px 20px;
    font-size: ${p => p.theme.subHeadingSize};
    border-width: 1px;
    border-radius: 4px;
`;

const ProgressRow = styled.div`
    margin-top: 20px;
    padding: 12px 14px;
    background: ${p => p.theme.containerBackground};
    border-radius: 4px;
    border: 1px solid ${p => p.theme.containerBorder};
`;

const ProgressBarOuter = styled.div`
    width: 100%;
    /* Modern, very slim progress bar. */
    height: 4px;
    background: ${p => p.theme.mainLowlightBackground};
    border-radius: 2px;
    overflow: hidden;
`;

const ProgressBarInner = styled.div<{ percent: number }>`
    height: 100%;
    width: ${p => Math.min(100, Math.max(0, p.percent))}%;
    background: ${p => p.theme.primaryInputBackground};
    transition: width 0.18s ease-out;
`;

const StatusLine = styled.div`
    margin-top: 8px;
    display: flex;
    justify-content: space-between;
    gap: 12px;

    font-family: ${p => p.theme.monoFontFamily};
    font-size: ${p => p.theme.textInputFontSize};
    color: ${p => p.theme.mainLowlightColor};

    > span:last-child {
        font-variant-numeric: tabular-nums;
    }
`;

/**
 * Sticky status banner between TopBar and ModalBody. Stays visible
 * even when the user has scrolled the format list (common with many
 * formats). Three variants:
 *  - success  (done)
 *  - warning  (error)
 *  - neutral  (cancelled)
 * Intentionally without a redundant download button or reload hint —
 * that is the footer button's job (bottom-right).
 */
const StatusBanner = styled.div<{ tone: 'success' | 'warning' | 'neutral' }>`
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;

    padding: 10px 28px;
    font-size: ${p => p.theme.textSize};
    color: ${p => p.theme.mainColor};

    background: ${p => p.tone === 'warning'
        ? p.theme.warningBackground
        : p.theme.containerBackground};
    border-top: 1px solid ${p => p.theme.containerBorder};
    border-bottom: 1px solid ${p => p.theme.containerBorder};
    border-left: 3px solid ${p => {
        if (p.tone === 'success') return p.theme.primaryInputBackground;
        if (p.tone === 'warning') return p.theme.warningColor;
        return p.theme.containerBorder;
    }};

    > svg:first-child {
        flex-shrink: 0;
        color: ${p => {
            if (p.tone === 'success') return p.theme.primaryInputBackground;
            if (p.tone === 'warning') return p.theme.warningColor;
            return p.theme.mainLowlightColor;
        }};
    }
`;

const BannerText = styled.span`
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    font-variant-numeric: tabular-nums;
`;

const SmallMuted = styled.span`
    font-size: ${p => p.theme.textInputFontSize};
    color: ${p => p.theme.mainLowlightColor};
`;

const PopularBadge = styled.span`
    font-size: ${p => p.theme.smallPrintSize};
    padding: 1px 6px;
    border-radius: 3px;
    background: ${p => p.theme.primaryInputBackground};
    color: ${p => p.theme.primaryInputColor};
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.04em;
`;

interface ZipExportDialogProps {
    uiStore?: UiStore;
    events: ReadonlyArray<CollectedEvent>;
    onClose: () => void;
    titleSuffix?: string;
}

/**
 * Formats bytes as a short, human-readable size using binary divisors
 * (1024) with common SI-style labels (KB/MB/GB) — the convention most
 * users expect in a download UX.
 */
function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx++;
    }
    const rounded = value >= 100 || idx === 0
        ? Math.round(value).toString()
        : value.toFixed(value >= 10 ? 1 : 2);
    return `${rounded} ${units[idx]}`;
}

/** Stable DOM IDs for aria-labelledby / aria-describedby. */
let ZIP_DIALOG_SEQ = 0;

@inject('uiStore')
@observer
export class ZipExportDialog extends React.Component<ZipExportDialogProps> {
    private readonly controller = new ZipExportController();
    private readonly titleId = `zip-export-dialog-title-${++ZIP_DIALOG_SEQ}`;
    private readonly descId  = `zip-export-dialog-desc-${ZIP_DIALOG_SEQ}`;
    private readonly previouslyFocused: HTMLElement | null = (
        typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null
    );
    private submitButtonRef = React.createRef<HTMLButtonElement>();

    @observable
    private selected: Set<string> = (() => {
        const persisted = this.props.uiStore!.zipExportSelectedFormatIds;
        if (persisted && persisted.length) {
            const cleaned = sanitizeFormatIds(persisted);
            if (cleaned.length) return new Set<string>(cleaned);
        }
        return new Set<string>(DEFAULT_SELECTED_FORMAT_IDS);
    })();

    @computed
    private get selectedCount(): number {
        return this.selected.size;
    }

    private setsEqual(a: Iterable<string>, b: Set<string>): boolean {
        let count = 0;
        for (const id of a) {
            if (!b.has(id)) return false;
            count++;
        }
        return count === b.size;
    }

    @computed
    private get isAllSelected(): boolean {
        return this.setsEqual(ALL_FORMAT_IDS, this.selected);
    }

    @computed
    private get isNoneSelected(): boolean {
        return this.selected.size === 0;
    }

    @computed
    private get isPopularSelected(): boolean {
        return this.setsEqual(DEFAULT_SELECTED_FORMAT_IDS, this.selected);
    }

    componentDidMount() {
        document.addEventListener('keydown', this.onKeyDown);
        // Fire-and-forget prewarm: initializes HTTPSnippet + fflate in
        // the worker while the user is still selecting formats. The first
        // real export click then starts on an already JIT-compiled hot
        // path instead of incurring module-init costs.
        void prewarmZipExport();
        // Initial focus only after the next paint so React has actually
        // rendered the button. setTimeout(0) previously caused a race
        // with the first user click (first click didn't register because
        // gesture trust was already consumed).
        requestAnimationFrame(() => {
            requestAnimationFrame(() => this.submitButtonRef.current?.focus());
        });
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.onKeyDown);
        // Clean up blob URL + running run to prevent memory leaks.
        try { this.controller.dispose(); } catch { /* noop */ }
        // Return focus to the element that opened the dialog.
        try { this.previouslyFocused?.focus?.(); } catch { /* noop */ }
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        const state = this.controller.state;
        if (state.kind === 'running' || state.kind === 'preparing') {
            this.controller.cancel();
        } else {
            this.props.onClose();
        }
    };

    @action.bound
    private toggle(id: string) {
        if (this.selected.has(id)) this.selected.delete(id);
        else this.selected.add(id);
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
    private selectPopular() {
        this.selected = new Set(DEFAULT_SELECTED_FORMAT_IDS);
    }

    @action.bound
    private async startExport() {
        this.props.uiStore!.setZipExportSelectedFormatIds(Array.from(this.selected));
        await this.controller.run({
            events: this.props.events,
            formatIds: this.selected
        });
        // No auto-close: the dialog stays open after done so the visible
        // fallback download link remains clickable in case Chrome rejected
        // the programmatic download.
    }

    @action.bound
    private onCancelRunning() {
        this.controller.cancel();
    }

    @action.bound
    private onRetry() {
        this.controller.reset();
    }

    /**
     * Sorts formats per category: popular first (in overlay definition
     * order), then alphabetically by label. The result is computed once
     * per render — the source data is static, so no memoization needed.
     */
    private sortCategoryFormats(
        formats: ReadonlyArray<{ id: string; label: string; popular: boolean }>
    ): ReadonlyArray<{ id: string; label: string; popular: boolean }> {
        return [...formats].sort((a, b) => {
            if (a.popular !== b.popular) return a.popular ? -1 : 1;
            return a.label.localeCompare(b.label);
        });
    }

    render() {
        const { events, titleSuffix, onClose } = this.props;
        const state = this.controller.state;
        const running = state.kind === 'running' || state.kind === 'preparing';
        const percent = state.kind === 'running' ? state.percent : 0;
        const indeterminate = state.kind === 'preparing';

        return <Overlay
            role='dialog'
            aria-modal
            aria-labelledby={this.titleId}
            aria-describedby={this.descId}
            onClick={running ? undefined : onClose}
        >
            <Modal onClick={e => e.stopPropagation()}>
                <ModalHeader id={this.titleId}>
                    <Icon icon={['fas', 'file-archive']} />
                    Export as ZIP{titleSuffix ? ` (${titleSuffix})` : ''}
                    <CloseIconButton
                        onClick={running ? this.onCancelRunning : onClose}
                        disabled={false}
                    >
                        <Icon icon={['fas', 'times']} />
                    </CloseIconButton>
                </ModalHeader>
                <TopBar id={this.descId}>
                    <TopBarInfo>
                        {events.length} request{events.length !== 1 ? 's' : ''}
                        {' · '}
                        {this.selectedCount} / {ALL_FORMAT_IDS.size} formats
                    </TopBarInfo>
                    <TopBarActions>
                        <TinyButton
                            active={this.isPopularSelected}
                            onClick={this.selectPopular}
                            disabled={running}
                        >Popular</TinyButton>
                        <TinyButton
                            active={this.isAllSelected}
                            onClick={this.selectAll}
                            disabled={running}
                        >Select all</TinyButton>
                        <TinyButton
                            active={this.isNoneSelected}
                            onClick={this.selectNone}
                            disabled={running}
                        >Select none</TinyButton>
                    </TopBarActions>
                </TopBar>

                {/*
                 * Slim progress line: sits between TopBar and status
                 * banner, shows current export progress or pulses during
                 * `preparing`. Hidden when no run is active.
                 */}
                <TopProgressBar
                    percent={percent}
                    indeterminate={indeterminate}
                />

                {/*
                 * Sticky status banner: always directly below the progress
                 * line, never in the scrollable body. The user sees "Done"
                 * even if they scrolled the format list before.
                 */}
                {state.kind === 'done' && <StatusBanner tone='success' role='status'>
                    <Icon icon={['fas', 'check']} />
                    <BannerText>
                        {state.autoDownloadAttempted ? 'Saved' : 'Ready'}
                        {' — '}
                        {state.snippetSuccessCount} snippet{state.snippetSuccessCount !== 1 ? 's' : ''} generated
                        {state.snippetErrorCount > 0 && `, ${state.snippetErrorCount} failed`}
                        {' · '}
                        {formatBytes(state.downloadBytes)}
                    </BannerText>
                </StatusBanner>}
                {state.kind === 'error' && <StatusBanner tone='warning' role='alert'>
                    <Icon icon={['fas', 'exclamation-triangle']} />
                    <BannerText>{state.message}</BannerText>
                </StatusBanner>}
                {state.kind === 'cancelled' && <StatusBanner tone='neutral' role='status'>
                    <Icon icon={['fas', 'ban']} />
                    <BannerText>Export cancelled.</BannerText>
                </StatusBanner>}

                <ModalBody>
                    {ZIP_EXPORT_CATEGORIES.map(cat => (
                        <CategoryBlock key={cat}>
                            <CategoryHeading>{cat}</CategoryHeading>
                            <FormatGrid>
                                {this.sortCategoryFormats(
                                    ZIP_EXPORT_FORMATS_BY_CATEGORY[cat]
                                ).map(fmt => (
                                    <FormatLabel key={fmt.id}>
                                        <input
                                            type='checkbox'
                                            checked={this.selected.has(fmt.id)}
                                            disabled={running}
                                            onChange={() => this.toggle(fmt.id)}
                                        />
                                        <FormatLabelText title={fmt.label}>
                                            {fmt.label}
                                        </FormatLabelText>
                                        {fmt.popular && <PopularBadge>popular</PopularBadge>}
                                    </FormatLabel>
                                ))}
                            </FormatGrid>
                        </CategoryBlock>
                    ))}

                    {running && <ProgressRow>
                        <ProgressBarOuter
                            role='progressbar'
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={percent}
                            aria-label='ZIP export progress'
                        >
                            <ProgressBarInner percent={percent} />
                        </ProgressBarOuter>
                        <StatusLine aria-live='polite'>
                            <span>
                                {state.kind === 'running'
                                    ? `${state.stage} · ${state.currentRequest ?? 0} / ${state.totalRequests ?? 0}`
                                    : 'preparing…'}
                            </span>
                            <span>
                                {state.kind === 'running' ? `${Math.round(state.percent)} %` : ''}
                            </span>
                        </StatusLine>
                    </ProgressRow>}

                </ModalBody>
                <ModalFooter>
                    <SmallMuted>
                        HAR + manifest.json are included in every archive.
                    </SmallMuted>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {running
                            ? <>
                                <FooterButton onClick={this.onCancelRunning}>Cancel</FooterButton>
                                <PrimaryButton
                                    ref={this.submitButtonRef}
                                    disabled
                                    aria-busy='true'
                                    aria-live='polite'
                                >
                                    <ButtonSpinner aria-hidden='true' />
                                    <ButtonProgressLabel>
                                        {state.kind === 'running'
                                            ? `${Math.round(state.percent)} %`
                                            : 'Preparing…'
                                        }
                                    </ButtonProgressLabel>
                                </PrimaryButton>
                            </>
                            : state.kind === 'done'
                                ? <>
                                    <FooterButton onClick={onClose}>Close</FooterButton>
                                    <PrimaryDownloadLink
                                        href={state.downloadUrl}
                                        download={state.downloadName}
                                        rel='noopener'
                                        title={state.autoDownloadAttempted
                                            ? 'Click to save the archive again'
                                            : 'Save the ZIP archive'}
                                    >
                                        <Icon icon={['fas', state.autoDownloadAttempted ? 'check' : 'download']} />
                                        {state.autoDownloadAttempted ? 'Saved' : 'Save archive'}
                                        <ButtonFileSize>
                                            ({formatBytes(state.downloadBytes)})
                                        </ButtonFileSize>
                                    </PrimaryDownloadLink>
                                </>
                            : (state.kind === 'error' || state.kind === 'cancelled')
                                ? <PrimaryButton
                                    ref={this.submitButtonRef}
                                    onClick={() => { this.onRetry(); this.startExport(); }}
                                    disabled={this.selectedCount === 0 || events.length === 0}
                                >
                                    <Icon icon={['fas', 'undo']} />
                                    Retry
                                </PrimaryButton>
                            : <PrimaryButton
                                ref={this.submitButtonRef}
                                onClick={this.startExport}
                                disabled={this.selectedCount === 0 || events.length === 0}
                            >
                                <Icon icon={['fas', 'file-archive']} />
                                Download ZIP
                            </PrimaryButton>
                        }
                    </div>
                </ModalFooter>
            </Modal>
        </Overlay>;
    }
}
