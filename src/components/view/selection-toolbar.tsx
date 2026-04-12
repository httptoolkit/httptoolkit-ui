import * as React from 'react';
import { inject } from 'mobx-react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import * as dateFns from 'date-fns';

import { styled } from '../../styles';
import { Icon } from '../../icons';

import { AccountStore } from '../../model/account/account-store';
import { EventsStore } from '../../model/events/events-store';
import { UiStore } from '../../model/ui/ui-store';
import { generateHar } from '../../model/http/har';
import { buildZipMetadata } from '../../model/ui/zip-metadata';
import { resolveFormats } from '../../model/ui/snippet-formats';
import { generateZipInWorker, ZipProgressInfo } from '../../services/ui-worker-api';
import { downloadBlob } from '../../util/download';
import { buildZipArchiveName } from '../../util/export-filenames';
import { saveFile } from '../../util/ui';
import { logError } from '../../errors';

const ToolbarContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background-color: ${p => p.theme.popColor};
    color: ${p => p.theme.mainBackground};
    font-size: ${p => p.theme.textSize};
    font-weight: 600;
    flex-shrink: 0;
`;

const ToolbarButton = styled.button`
    padding: 4px 12px;
    background: ${p => p.theme.mainBackground};
    color: ${p => p.theme.popColor};
    border: 1px solid ${p => p.theme.popColor};
    border-radius: 3px;
    font-size: ${p => p.theme.textSize};
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;

    &:hover { opacity: 0.85; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ToolbarSpacer = styled.div`
    flex: 1;
`;

const ErrorLabel = styled.span`
    color: ${p => p.theme.warningColor};
    font-weight: normal;
    font-size: ${p => p.theme.textSize};
    cursor: help;
`;

const ClearButton = styled(ToolbarButton)`
    border-color: transparent;
    background: transparent;
    color: ${p => p.theme.mainBackground};

    &:hover { opacity: 0.7; }
`;

interface SelectionToolbarProps {
    eventsStore: EventsStore;
    accountStore?: AccountStore;
    uiStore?: UiStore;
}

export const SelectionToolbar = inject('accountStore', 'uiStore')(observer((props: SelectionToolbarProps) => {
    const { eventsStore, accountStore, uiStore } = props;
    const count = eventsStore.selectedExchangeCount;
    const isPaidUser = accountStore!.user.isPaidUser();

    const [isExporting, setIsExporting] = React.useState(false);
    const [exportError, setExportError] = React.useState<string | null>(null);
    const [zipProgress, setZipProgress] = React.useState<ZipProgressInfo | null>(null);

    // Guard against setState on unmounted component during async operations
    const mountedRef = React.useRef(true);
    React.useEffect(() => {
        return () => { mountedRef.current = false; };
    }, []);

    // ALL hooks must be called unconditionally (React rules of hooks).
    // The early return below only controls rendering, not hook execution.
    const handleExportHar = React.useCallback(async () => {
        setIsExporting(true);
        setExportError(null);
        try {
            const exchanges = eventsStore.selectedExchanges.slice();
            if (exchanges.length === 0) return;

            const harContent = JSON.stringify(
                await generateHar(exchanges)
            );
            if (!mountedRef.current) return;

            const filename = `HTTPToolkit_${
                dateFns.format(Date.now(), 'YYYY-MM-DD_HH-mm')
            }_${exchanges.length}-requests.har`;
            saveFile(filename, 'application/har+json;charset=utf-8', harContent);
        } catch (err) {
            logError(err);
            if (!mountedRef.current) return;
            setExportError(err instanceof Error ? err.message : 'HAR export failed');
        } finally {
            if (mountedRef.current) setIsExporting(false);
        }
    }, [eventsStore]);

    const handleExportZip = React.useCallback(async () => {
        setIsExporting(true);
        setExportError(null);
        setZipProgress(null);
        try {
            const exchanges = eventsStore.selectedExchanges.slice();
            if (exchanges.length === 0) return;

            const har = await generateHar(exchanges);
            const harEntries = toJS(har.log.entries);
            // Use the same format selection as the Export card's ZIP picker
            const formats = resolveFormats(uiStore!.zipFormatIds);
            const metadata = buildZipMetadata(exchanges.length, formats);

            const result = await generateZipInWorker(
                harEntries, formats, metadata,
                (info) => { if (mountedRef.current) setZipProgress(info); }
            );

            if (!mountedRef.current) return;
            const blob = new Blob([result.buffer], { type: 'application/zip' });
            downloadBlob(blob, buildZipArchiveName(exchanges.length));

            if (result.snippetErrors > 0) {
                setExportError(
                    `${result.snippetErrors} of ${result.totalSnippets} snippets failed (see _errors.json)`
                );
            }
        } catch (err) {
            logError(err);
            if (!mountedRef.current) return;
            setExportError(err instanceof Error ? err.message : 'ZIP export failed');
        } finally {
            if (mountedRef.current) {
                setIsExporting(false);
                setZipProgress(null);
            }
        }
    }, [eventsStore, uiStore]);

    const handleClearSelection = React.useCallback(() => {
        eventsStore.clearSelection();
    }, [eventsStore]);

    if (count <= 1) return null; // Only show for multi-selection

    return <ToolbarContainer role="toolbar" aria-label="Batch actions for selected exchanges">
        <span aria-live="polite">{count} exchanges selected</span>
        {exportError && <ErrorLabel title={exportError} role="alert">
            {exportError.includes('snippets failed') ? 'Partial export' : 'Export failed'}
        </ErrorLabel>}

        <ToolbarButton
            onClick={handleExportHar}
            disabled={!isPaidUser || isExporting}
            title="Export selected exchanges as HAR"
        >
            <Icon icon={['fas', 'save']} />
            Export HAR
        </ToolbarButton>

        <ToolbarButton
            onClick={handleExportZip}
            disabled={!isPaidUser || isExporting}
            title="Export selected exchanges as ZIP with popular snippet formats"
        >
            <Icon icon={['fas', 'download']} />
            {isExporting
                ? (zipProgress ? `Exporting ${zipProgress.percent}%` : 'Exporting...')
                : 'Export ZIP'
            }
        </ToolbarButton>

        <ToolbarSpacer />

        <ClearButton
            onClick={handleClearSelection}
            title="Clear selection (Escape)"
        >
            Clear selection
        </ClearButton>
    </ToolbarContainer>;
}));
