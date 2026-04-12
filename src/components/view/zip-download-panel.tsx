import * as React from 'react';
import { inject } from 'mobx-react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';

import { styled, css } from '../../styles';
import { Icon } from '../../icons';

import { HttpExchangeView } from '../../types';
import { UiStore } from '../../model/ui/ui-store';
import { generateHar } from '../../model/http/har';
import { buildZipMetadata } from '../../model/ui/zip-metadata';
import {
    ALL_SNIPPET_FORMATS,
    FORMAT_CATEGORIES,
    FORMATS_BY_CATEGORY,
    DEFAULT_SELECTED_FORMAT_IDS,
    ALL_FORMAT_IDS,
    resolveFormats
} from '../../model/ui/snippet-formats';
import { generateZipInWorker, ZipProgressInfo } from '../../services/ui-worker-api';
import { downloadBlob } from '../../util/download';
import { buildZipArchiveName } from '../../util/export-filenames';
import { logError } from '../../errors';

type ZipPanelState = 'idle' | 'generating' | 'error';

interface ZipDownloadPanelProps {
    exchanges: HttpExchangeView[];
    uiStore?: UiStore;
}

// ── Styled components ────────────────────────────────────────────────────────

const PanelContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 20px;
`;

const FormatPickerContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid ${p => p.theme.containerBorder};
    border-radius: 4px;
    padding: 10px 12px;
    background: ${p => p.theme.mainLowlightBackground};
`;

const PickerHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0 8px 0;
    margin: 0 -12px 4px -12px;
    padding-left: 12px;
    padding-right: 12px;
    border-bottom: 1px solid ${p => p.theme.containerBorder};
    position: sticky;
    top: -10px;
    z-index: 1;
    background: ${p => p.theme.mainLowlightBackground};
    padding-top: 10px;
`;

const PickerTitle = styled.span`
    font-weight: 600;
    font-size: ${p => p.theme.textSize};
    color: ${p => p.theme.mainColor};
`;

const PickerActions = styled.div`
    display: flex;
    gap: 8px;
`;

const PickerActionLink = styled.button`
    background: none;
    border: none;
    color: ${p => p.theme.popColor};
    font-size: 12px;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    opacity: 0.85;
    &:hover { opacity: 1; }
`;

const CategoryGroup = styled.div`
    margin-bottom: 4px;
`;

const CategoryHeader = styled.div.attrs({ role: 'button', tabIndex: 0 })`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    cursor: pointer;
    user-select: none;

    &:hover { opacity: 0.8; }
    &:focus-visible { outline: 2px solid ${p => p.theme.popColor}; outline-offset: 1px; border-radius: 2px; }
`;

const CategoryLabel = styled.span`
    font-weight: 600;
    font-size: 12px;
    color: ${p => p.theme.mainColor};
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const CategoryCount = styled.span`
    font-size: 11px;
    color: ${p => p.theme.mainColor};
    opacity: 0.4;
`;

const FormatList = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    padding-left: 4px;
    margin-bottom: 4px;
`;

const FormatCheckbox = styled.label<{ isChecked: boolean }>`
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 2px 4px;
    border-radius: 3px;
    cursor: pointer;
    font-size: ${p => p.theme.textSize};
    color: ${p => p.theme.mainColor};
    min-width: 130px;
    transition: background-color 0.1s;

    ${p => p.isChecked && css`
        color: ${p.theme.popColor};
    `}

    &:hover {
        background: ${p => p.theme.containerBackground};
    }

    input {
        accent-color: ${p => p.theme.popColor};
        cursor: pointer;
    }
`;

const BottomBar = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
`;

const SelectionSummary = styled.span`
    font-size: ${p => p.theme.textSize};
    color: ${p => p.theme.mainColor};
    opacity: 0.6;
`;

const DownloadButton = styled.button`
    padding: 10px 20px;
    background: ${p => p.theme.popColor};
    color: ${p => p.theme.mainBackground};
    border: none;
    border-radius: 4px;
    font-size: ${p => p.theme.textSize};
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;

    &:hover { opacity: 0.9; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ProgressContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px 20px;
    gap: 12px;
`;

const ProgressBar = styled.div`
    width: 100%;
    max-width: 300px;
    height: 6px;
    background: ${p => p.theme.containerBorder};
    border-radius: 3px;
    overflow: hidden;
`;

const ProgressFill = styled.div<{ percent: number }>`
    height: 100%;
    width: ${p => p.percent}%;
    background: ${p => p.theme.popColor};
    border-radius: 3px;
    transition: width 0.2s ease;
`;

const StatusText = styled.p`
    color: ${p => p.theme.mainColor};
    font-size: ${p => p.theme.textSize};
    opacity: 0.7;
    text-align: center;
    margin: 0;
`;

const ErrorText = styled(StatusText)`
    color: ${p => p.theme.warningColor};
    opacity: 1;
`;

const WarningText = styled.span`
    font-size: 12px;
    color: ${p => p.theme.warningColor};
    opacity: 0.85;
`;

const RetryButton = styled(DownloadButton)`
    padding: 8px 16px;
`;

// ── Component ────────────────────────────────────────────────────────────────

export const ZipDownloadPanel = inject('uiStore')(observer((props: ZipDownloadPanelProps) => {
    const { exchanges, uiStore } = props;
    const [state, setState] = React.useState<ZipPanelState>('idle');
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
    const [progress, setProgress] = React.useState<ZipProgressInfo | null>(null);

    // Format selection lives in UiStore — shared with batch toolbar
    const selectedIds = uiStore!.zipFormatIds;

    // Guard against setState on unmounted component
    const mountedRef = React.useRef(true);
    React.useEffect(() => {
        return () => { mountedRef.current = false; };
    }, []);

    // ── Selection helpers (mutate UiStore directly) ─────────────────────

    const toggleFormat = React.useCallback((id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        uiStore!.setZipFormatIds(next);
    }, [selectedIds, uiStore]);

    const toggleCategory = React.useCallback((category: string) => {
        const categoryFormats = FORMATS_BY_CATEGORY[category] || [];
        const next = new Set(selectedIds);
        const allSelected = categoryFormats.every(f => selectedIds.has(f.id));
        categoryFormats.forEach(f => {
            if (allSelected) next.delete(f.id); else next.add(f.id);
        });
        uiStore!.setZipFormatIds(next);
    }, [selectedIds, uiStore]);

    const selectAll = React.useCallback(() => {
        uiStore!.setZipFormatIds(ALL_FORMAT_IDS);
    }, [uiStore]);

    const selectPopular = React.useCallback(() => {
        uiStore!.setZipFormatIds(DEFAULT_SELECTED_FORMAT_IDS);
    }, [uiStore]);

    const selectNone = React.useCallback(() => {
        uiStore!.setZipFormatIds([]);
    }, [uiStore]);

    // ── Download handler ─────────────────────────────────────────────────

    const handleDownload = React.useCallback(async () => {
        setState('generating');
        setErrorMsg(null);
        setProgress(null);
        try {
            const snapshotExchanges = exchanges.slice();
            if (snapshotExchanges.length === 0) {
                setState('idle');
                return;
            }

            const formats = resolveFormats(selectedIds);
            if (formats.length === 0) {
                throw new Error('No formats selected');
            }

            const har = await generateHar(snapshotExchanges);
            const harEntries = toJS(har.log.entries);
            const metadata = buildZipMetadata(snapshotExchanges.length, formats);

            const result = await generateZipInWorker(
                harEntries,
                formats,
                metadata,
                (info) => { if (mountedRef.current) setProgress(info); }
            );

            if (!mountedRef.current) return;

            const blob = new Blob([result.buffer], { type: 'application/zip' });
            downloadBlob(blob, buildZipArchiveName(snapshotExchanges.length));

            if (result.snippetErrors > 0) {
                setErrorMsg(
                    `ZIP saved. ${result.snippetErrors} of ${result.totalSnippets} snippets failed (see _errors.json).`
                );
            }
            setState('idle');
            setProgress(null);
        } catch (err) {
            logError(err);
            if (!mountedRef.current) return;
            setErrorMsg(err instanceof Error ? err.message : 'ZIP generation failed');
            setState('error');
            setProgress(null);
        }
    }, [exchanges, selectedIds]);

    // ── Render: Generating state ─────────────────────────────────────────

    if (state === 'generating') {
        const percent = progress?.percent ?? 0;
        const formatCount = selectedIds.size;

        return <ProgressContainer>
            <Icon icon={['fas', 'spinner']} spin />
            <StatusText>
                Generating {formatCount} format{formatCount !== 1 ? 's' : ''} for{' '}
                {exchanges.length} exchange{exchanges.length !== 1 ? 's' : ''}
                {percent > 0 ? ` — ${percent}%` : '...'}
            </StatusText>
            {percent > 0 && (
                <ProgressBar>
                    <ProgressFill percent={percent} />
                </ProgressBar>
            )}
        </ProgressContainer>;
    }

    // ── Render: Error state ──────────────────────────────────────────────

    if (state === 'error') {
        return <ProgressContainer>
            <ErrorText>{errorMsg}</ErrorText>
            <RetryButton onClick={() => setState('idle')}>
                <Icon icon={['fas', 'undo']} /> Retry
            </RetryButton>
        </ProgressContainer>;
    }

    // ── Render: Idle state (format picker + download) ────────────────────

    const totalFormats = ALL_SNIPPET_FORMATS.length;
    const selectedCount = selectedIds.size;

    return <PanelContainer>
        <FormatPickerContainer>
            <PickerHeader>
                <PickerTitle>
                    Snippet Formats
                </PickerTitle>
                <PickerActions>
                    <PickerActionLink onClick={selectAll}>All ({totalFormats})</PickerActionLink>
                    <PickerActionLink onClick={selectPopular}>Popular</PickerActionLink>
                    <PickerActionLink onClick={selectNone}>None</PickerActionLink>
                </PickerActions>
            </PickerHeader>

            {FORMAT_CATEGORIES.map(category => {
                const formats = FORMATS_BY_CATEGORY[category];
                const catSelected = formats.filter(f => selectedIds.has(f.id)).length;
                return <CategoryGroup key={category}>
                    <CategoryHeader
                        onClick={() => toggleCategory(category)}
                        onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleCategory(category);
                            }
                        }}
                        aria-label={`Toggle all ${category} formats (${catSelected}/${formats.length} selected)`}
                    >
                        <CategoryLabel>{category}</CategoryLabel>
                        <CategoryCount>
                            {catSelected}/{formats.length}
                        </CategoryCount>
                    </CategoryHeader>
                    <FormatList>
                        {formats.map(fmt => (
                            <FormatCheckbox
                                key={fmt.id}
                                isChecked={selectedIds.has(fmt.id)}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(fmt.id)}
                                    onChange={() => toggleFormat(fmt.id)}
                                />
                                {fmt.label}
                            </FormatCheckbox>
                        ))}
                    </FormatList>
                </CategoryGroup>;
            })}
        </FormatPickerContainer>

        <BottomBar>
            <div>
                <SelectionSummary>
                    {selectedCount} of {totalFormats} formats selected
                </SelectionSummary>
                {errorMsg && <><br /><WarningText>{errorMsg}</WarningText></>}
            </div>
            <DownloadButton
                onClick={handleDownload}
                disabled={exchanges.length === 0 || selectedCount === 0}
                title={selectedCount === 0
                    ? 'Select at least one format'
                    : `Download ZIP with ${selectedCount} formats for ${exchanges.length} exchange(s)`
                }
            >
                <Icon icon={['fas', 'download']} />
                Download ZIP ({exchanges.length} exchange{exchanges.length !== 1 ? 's' : ''})
            </DownloadButton>
        </BottomBar>
    </PanelContainer>;
}));
