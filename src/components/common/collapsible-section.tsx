import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';
import { observable, action } from 'mobx';

import { styled, css } from "../../styles";
import { isReactElement } from '../../util';
import { FontAwesomeIcon } from '../../icons';

interface CollapsibleSectionProps {
    children: React.ReactNode;
    prefix: boolean;
    className?: string;
}

const SummaryWrapper = styled.span`
    margin-right: 10px;
`;

const SummaryAsSpacer = styled.div`
    visibility: hidden;
    margin-top: -2px;
    margin-bottom: 6px;
    display: inline-block;

    max-height: 31px;
    overflow: hidden;
`;

@observer
export class CollapsibleSection extends React.Component<CollapsibleSectionProps> {

    @observable
    open = false;

    render() {
        const { children, prefix } = this.props;

        const [ sectionSummary, sectionBody, ...otherChildren ] = React.Children.toArray(children);

        if (otherChildren.length) {
            throw new Error(`Collapsible section has extra children: ${otherChildren}`);
        } else if (!isReactElement(sectionSummary)) {
            throw new Error('Collapsible section 1st child must be a summary element');
        } else if (!isReactElement(sectionBody)) {
            if (sectionBody) {
                throw new Error('Collapsible section 2nd child must be a body element');
            } else {
                return <section>{ sectionSummary }</section>;
            }
        }

        // Inject a plus/minus button into the summary section
        const summary = React.cloneElement(
            sectionSummary,
            { open: this.open },
            prefix ? <>
                <CollapsibleTrigger open={this.open} onClick={this.toggleOpen} />
                <SummaryWrapper>{ sectionSummary.props.children }</SummaryWrapper>
            </> : <>
                <SummaryWrapper>{ sectionSummary.props.children }</SummaryWrapper>
                <CollapsibleTrigger open={this.open} onClick={this.toggleOpen} />
            </>
        );

        // Inject a header spacer into the body section
        const body = this.open ? React.cloneElement(
            sectionBody as React.ReactElement,
            {},
            <>
                <SummaryAsSpacer>{ summary }</SummaryAsSpacer>
                { sectionBody.props.children }
            </>
        ) : null;

        return <section>
            { summary }
            { body }
        </section>;
    }

    @action.bound
    toggleOpen(e: React.SyntheticEvent) {
        e.preventDefault();
        this.open = !this.open;
    }
}

const CollapsibleTrigger = styled((p: {
    open: boolean,
    onClick: (e: React.SyntheticEvent) => void
}) =>
    <button {..._.omit(p, 'open')}>
        <FontAwesomeIcon icon={[
            'fas',
            p.open ? 'minus' : 'plus'
        ]} />
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

    padding: 5px 10px;
    margin: -5px 0 -5px -10px;
    vertical-align: baseline;

    scale: 0.7;
    color: ${p => p.theme.mainColor};
`;

export const CollapsibleSectionSummary = styled.header`
    display: inline-block;
    margin: -6px 0 0 0;
    padding: 9px 0 12px;

    box-sizing: border-box;

    list-style: none;
    &::-webkit-details-marker {
        display: none;
    }

    ${(p: { open?: boolean }) => p.open && css`
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
            box-shadow: 1px 1px 5px rgba(0,0,0,0.2);
        }

        &:after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0;
            right: 0;
            height: 1px;
            background-color: rgba(0,0,0,0.1);
            box-shadow: 1px 1px 5px rgba(0,0,0,0.2);
        }
    `}
`;

export const CollapsibleSectionBody = styled.div`
    background-color: ${p => p.theme.mainLowlightBackground};
    box-shadow:
        inset 0px 11px 8px -10px rgba(0,0,0,0.15),
        inset 0px -11px 8px -10px rgba(0,0,0,0.15);

    padding: 8px 10px 10px 10px;
    margin-top: -37px;
    margin-bottom: 10px;

    word-break: break-word;

    position: relative;
`;