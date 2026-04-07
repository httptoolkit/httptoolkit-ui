import { styled } from '../../../styles';
import { Icon } from '../../../icons';
import {
    getSummaryColor,
    EventCategory
} from '../../../model/events/categorization';

import { filterProps } from '../../component-utils';
import { StatusCode } from '../../common/status-code';

// --- Common row props passed from EventRow to each row type ---

export interface CommonRowProps {
    'aria-rowindex': number;
    'aria-selected': boolean;
    id: string;
    'data-event-id': string;
    className: string;
    style: {};
}

// --- Column components ---

export const Column = styled.div<{ role: 'gridcell' | 'columnheader' }>`
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 3px 0;
`;

export const RowMarker = styled(Column)`
    transition: color 0.2s;
    color: ${(p: { category: EventCategory }) => getSummaryColor(p.category)};

    background-color: currentColor;

    flex-basis: 5px;
    flex-shrink: 0;
    flex-grow: 0;
    height: 100%;
    padding: 0;

    border-left: 5px solid ${p => p.theme.containerBackground};
    box-sizing: content-box;
`;

// --- Base row containers ---

export const EventListRow = styled.div<{ role: 'row' }>`
    display: flex;
    flex-direction: row;
    align-items: center;

    user-select: none;
    cursor: pointer;

    &.selected {
        background-color: ${p => p.theme.highlightBackground};
        font-weight: bold;

        color: ${p => p.theme.highlightColor};
        fill: ${p => p.theme.highlightColor};
        * {
            /* Override status etc colours to ensure contrast & give row max visibility */
            color: ${p => p.theme.highlightColor};
            fill: ${p => p.theme.highlightColor};
        }
    }
`;

export const TrafficEventListRow = styled(EventListRow)`
    background-color: ${props => props.theme.mainBackground};

    border-width: 2px 0;
    border-style: solid;
    border-color: transparent;
    background-clip: padding-box;
    box-sizing: border-box;

    &:hover ${RowMarker}, &.selected ${RowMarker} {
        border-color: currentColor;
    }

    > * {
        margin-right: 10px;
    }
`;

export const TlsListRow = styled(EventListRow)`
    height: 28px !important; /* Important required to override react-window's style attr */
    margin: 2px 0;

    font-style: italic;
    justify-content: center;
    text-align: center;

    opacity: 0.7;

    &:hover {
        opacity: 1;
    }

    &.selected {
        opacity: 1;
        color: ${p => p.theme.mainColor};
        background-color: ${p => p.theme.mainBackground};
    }
`;

export const RowPin = styled(
    filterProps(Icon, 'pinned')
).attrs((p: { pinned: boolean }) => ({
    icon: ['fas', 'thumbtack'],
    title: p.pinned ? "This exchange is pinned, and won't be deleted by default" : ''
}))`
    font-size: 90%;
    box-sizing: content-box;
    background-color: ${p => p.theme.containerBackground};

    /* Without this, 0 width pins create a large & invisible but still clickable icon */
    overflow: hidden;

    transition: width 0.1s, padding 0.1s, margin 0.1s;

    ${(p: { pinned: boolean }) =>
        p.pinned
        ? `
            width: auto;
            padding: 8px 7px;
            && { margin-right: -3px; }
        `
        : `
            padding: 8px 0;
            width: 0 !important;
            margin: 0 !important;

            > path {
                display: none;
            }
        `
    }
`;

export const MarkerHeader = styled.div<{ role: 'columnheader' }>`
    flex-basis: 10px;
    flex-shrink: 0;
`;

export const Method = styled(Column)`
    transition: flex-basis 0.1s;
    ${(p: { pinned?: boolean }) =>
        p.pinned
        ? 'flex-basis: 50px;'
        : 'flex-basis: 71px;'
    }

    flex-shrink: 0;
    flex-grow: 0;
`;

export const Status = styled(Column)`
    flex-basis: 45px;
    flex-shrink: 0;
    flex-grow: 0;
`;

export const Source = styled(Column)`
    flex-basis: 49px;
    flex-shrink: 0;
    flex-grow: 0;

    display: flex;
    align-items: center;
    justify-content: center;
`;

export const Host = styled(Column)`
    flex-shrink: 1;
    flex-grow: 0;
    flex-basis: 500px;
`;

export const PathAndQuery = styled(Column)`
    flex-shrink: 1;
    flex-grow: 0;
    flex-basis: 1000px;
`;

// Match Method + Status, but shrink right margin slightly so that
// spinner + "WebRTC Media" fits OK.
export const EventTypeColumn = styled(Column)`
    transition: flex-basis 0.1s;
    ${(p: { pinned?: boolean }) =>
        p.pinned
        ? 'flex-basis: 109px;'
        : 'flex-basis: 130px;'
    }

    margin-right: 6px !important;

    flex-shrink: 0;
    flex-grow: 0;
`;

// Match Host column:
export const RTCEventLabel = styled(Column)`
    flex-shrink: 1;
    flex-grow: 0;
    flex-basis: 500px;

    > svg {
        padding-right: 0; /* Right, not left - it's rotated */
    }
`;

// Match PathAndQuery column:
export const RTCEventDetails = styled(Column)`
    flex-shrink: 1;
    flex-grow: 0;
    flex-basis: 1000px;
`;

export const RTCConnectionDetails = styled(RTCEventDetails)`
    text-align: center;
`;

// Host + Path + Query columns:
export const BuiltInApiRequestDetails = styled(Column)`
    flex-shrink: 1;
    flex-grow: 0;
    flex-basis: 1000px;
`;

export const ConnectedSpinnerIcon = styled(Icon).attrs(() => ({
    icon: ['fas', 'spinner'],
    spin: true,
    title: 'Connected'
}))`
    margin: 0 5px 0 0;
    box-sizing: content-box;
`;

export const TableHeaderRow = styled.div<{ role: 'row' }>`
    height: 38px;
    overflow: hidden;
    width: 100%;

    display: flex;
    flex-direction: row;
    align-items: center;

    background-color: ${props => props.theme.mainBackground};
    color: ${props => props.theme.mainColor};
    font-weight: bold;

    border-bottom: 1px solid ${props => props.theme.containerBorder};
    box-shadow: 0 0 30px rgba(0,0,0,0.2);

    padding-right: 18px;
    box-sizing: border-box;

    > div[role=columnheader] {
        padding: 5px 0;
        margin-right: 10px;
        min-width: 0px;

        &:first-of-type {
            margin-left: 0;
        }
    }
`;

// --- Preview row components (used by multi-selection summary) ---

export const SourceIcon = styled(Icon)`
    flex-shrink: 0;
`;

export const InlineStatus = styled(StatusCode)`
    flex-shrink: 0;
`;

export const RowDetail = styled.span`
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
`;
