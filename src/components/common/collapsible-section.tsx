import * as _ from 'lodash';
import * as React from 'react';
import { inject, observer } from 'mobx-react';
import { observable, action } from 'mobx';

import { styled, css } from "../../styles";
import { CollapsibleSectionKey, UiStore } from '../../model/ui/ui-store';

import { isReactElement } from '../../util/ui';
import { Icon, IconProp } from '../../icons';

interface CollapsibleSectionProps {
    children: React.ReactNode;
    className?: string;
    withinGrid?: boolean;
    prefixTrigger?: boolean;
    contentName: string;

    collapsePersistKey?: CollapsibleSectionKey;
    uiStore?: UiStore;
}

const CollapsibleSectionWrapper = styled.section`
    ${(p: { withinGrid: boolean}) => p.withinGrid && css`
        display: contents;
    `}
`;

const SummaryWrapper = styled.span`
    margin-right: 10px;

    ${(p: { withinGrid: boolean}) => p.withinGrid && css`
        display: contents;
    `}
`;

const SummaryAsSpacer = styled.div`
    visibility: hidden;
    margin-top: -2px;
    margin-bottom: 6px;
    display: inline-block;

    max-height: 31px;
    overflow: hidden;
`;

/**
 * This component lets us create collapsible sections. It takes always 1 or 2 children,
 * the 1st a collapsible summary, and the 2nd a body to show when expanded. The expand
 * toggle button & behaviour are injected automatically. This works either in a automatic
 * 'normal' layout, or as part of an existing grid layout (using display: contents, if
 * withinGrid is true).
 *
 * Outside a grid, the body area wraps around its summary, and sufficiently small
 * content from the body can fit into the wraparound area, if there's space.
 * This establishes a hierarchy, and provides a nice space for non-essential metadata.
 * That should look something like this:
 *  ____________________   ____________
 * [      summary       ] [ wraparound ]
 *  --------------------  [            ]
 * [           Body                    ]
 *  -----------------------------------
 *
 * Where the wraparound & body are only visible when the section is expanded. In a grid
 * we don't do this, primarily just because it's very hard.
 *
 * This component also works if there is no body provided - it falls back to just
 * showing the summary without the expand/collapse toggle.
 */
@inject('uiStore')
@observer
export class CollapsibleSection extends React.Component<CollapsibleSectionProps> {

    static idCounter = 0;
    id = `collapsible-${CollapsibleSection.idCounter++}`;

    @observable
    open = this.props.collapsePersistKey
        ? !!this.props.uiStore?.collapsibleSectionStates[this.props.collapsePersistKey]
        : false;

    render() {
        const {
            children,
            withinGrid = false,
        } = this.props;
        const prefixTrigger = withinGrid || this.props.prefixTrigger;

        const [ sectionSummary, sectionBody, ...otherChildren ] = React.Children.toArray(children);

        if (otherChildren.length) {
            throw new Error(`Collapsible section has extra children: ${otherChildren}`);
        } else if (!isReactElement(sectionSummary)) {
            throw new Error('Collapsible section 1st child must be a summary element');
        }

        const hasBody = !!sectionBody;
        if (hasBody && !isReactElement(sectionBody)) {
            throw new Error('Collapsible section 2nd child must be a body element');
        }
        // Undefined (if !hasBody) or a proper React element. Only really necessary
        // to make the types here a bit clearer.
        const bodyElement = (sectionBody as React.ReactElement);
        const bodyId = this.id + '-body';

        const trigger = <CollapsibleTrigger
            open={this.open}
            canOpen={hasBody}
            withinGrid={withinGrid}
            onClick={this.toggleOpen}
            targetId={bodyId}
            targetName={this.props.contentName}
        />;

        const summary = React.cloneElement(
            sectionSummary,
            { open: this.open, withinGrid: withinGrid },

            // In a grid or if requested, we always prepend the trigger (but it may be hidden)
            prefixTrigger ? <>
                { trigger }
                <SummaryWrapper withinGrid={withinGrid}>
                    { sectionSummary.props.children }
                </SummaryWrapper>
            </>

            // Outside the grid we append triggers by default, and only if they're usable.
            : <>
                <SummaryWrapper withinGrid={withinGrid}>
                    { sectionSummary.props.children }
                </SummaryWrapper>
                { hasBody && trigger }
            </>
        );

        const body = hasBody && this.open ? React.cloneElement(
            bodyElement,
            { withinGrid, id: bodyId },
            withinGrid ?
                // Grid body is a simple full width block
                bodyElement.props.children
            :
                // Non-grid body copies the summary (invisibly), to allow content to
                // wrap around the summary into the wraparound section.
                <>
                    <SummaryAsSpacer aria-hidden='true'>{ summary }</SummaryAsSpacer>
                    { bodyElement.props.children }
                </>
        ) : null;

        return <CollapsibleSectionWrapper withinGrid={withinGrid}>
            { summary }
            { body }
        </CollapsibleSectionWrapper>;
    }

    @action.bound
    toggleOpen(e: React.SyntheticEvent) {
        e.preventDefault();
        this.open = !this.open;

        if (this.props.collapsePersistKey) {
            this.props.uiStore!.collapsibleSectionStates[this.props.collapsePersistKey] = this.open;
        }
    }
}

const OPEN_ICON: IconProp = ['fas', 'minus'];
const CLOSED_ICON: IconProp = ['fas', 'plus'];

const CollapsibleTrigger = styled((p: {
    targetName: string,
    targetId: string,
    open: boolean,
    canOpen: boolean,
    withinGrid: boolean,
    onClick: (e: React.SyntheticEvent) => void
}) =>
    <button
        aria-hidden={!p.canOpen}
        aria-label={`${p.open ? 'Hide' : 'Show'} ${p.targetName}`}
        aria-expanded={p.open}
        aria-controls={p.targetId}
        {..._.omit(p, ['open', 'canOpen', 'withinGrid', 'targetName', 'targetId'])}
    >
        <Icon icon={p.open ? OPEN_ICON : CLOSED_ICON} />
    </button>
)`
    border: none;
    background: none;

    position: relative;
    top: -1px;

    cursor: pointer;
    user-select: none;

    outline: none;
    &:focus {
        color: ${p => p.theme.popColor};
    }
    &:hover {
        color: ${p => p.theme.mainColor};
    }

    box-sizing: content-box;
    padding: 5px 10px;

    ${p => p.withinGrid ? css`
        margin: -3px 0 -5px -10px;
        align-self: baseline;
    ` : css`
        margin: -5px 0 -5px -10px;
        vertical-align: baseline;
    `}

    scale: 0.7;
    color: ${p => p.theme.containerWatermark};

    ${p => !p.canOpen && css`
        visibility: hidden;
    `}
`;

interface CollapsibleSectionSummaryProps {
    open?: boolean;
    withinGrid?: boolean;
}

export const CollapsibleSectionSummary = styled.header`
    ${(p: CollapsibleSectionSummaryProps) => p.withinGrid ? css`
        display: contents;
    ` : css`
        display: inline-block;
    `}

    margin: -6px 0 0 -20px;
    padding: 9px 0 12px 20px;

    box-sizing: border-box;

    ${(p: CollapsibleSectionSummaryProps) => p.open && !p.withinGrid && css`
        z-index: 1;
        position: relative;

        background-color: ${p => p.theme.mainBackground};

        &:before {
            content: '';
            position: absolute;
            right: -1px;
            bottom: 0;
            height: 35px;
            width: 1px;
            background-color: rgba(0,0,0,0.1);
            box-shadow: 1px 1px 5px rgba(0,0,0,${p => p.theme.boxShadowAlpha});
        }

        &:after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0;
            right: 0;
            height: 1px;
            background-color: rgba(0,0,0,0.1);
            box-shadow: 1px 1px 5px rgba(0,0,0,${p => p.theme.boxShadowAlpha});
        }
    `}
`;

export const CollapsibleSectionBody = styled.div`
    ${(p: { withinGrid?: boolean }) => p.withinGrid ? css`
        grid-column: 1 / -1; /* Full width grid row */
    ` : css`
        margin-top: -37px; /* Pull up behind the summary section */
        margin-bottom: 10px; /* Spacing below (grid uses grid-gap) */
    `}

    background-color: ${p => p.theme.mainLowlightBackground};
    box-shadow:
        inset 0px 12px 8px -10px rgba(0,0,0,${p => p.theme.boxShadowAlpha}),
        inset 0px -8px 8px -10px rgba(0,0,0,${p => p.theme.boxShadowAlpha});

    padding: 8px 10px 10px 10px;

    word-break: break-all; /* Fallback for anybody without break-word */
    word-break: break-word;

    line-height: 1.3;

    position: relative;

    margin-left: -20px;
    margin-right: -20px;
    padding-left: 20px;
    padding-right: 20px;
`;