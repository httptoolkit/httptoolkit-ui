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

@observer
export class CollapsibleSection extends React.Component<CollapsibleSectionProps> {

    @observable
    open = false;

    render() {
        const { children, prefix } = this.props;

        const [ summaryChild, ...contentChildren ] = React.Children.toArray(children);

        const summary = contentChildren.length && isReactElement(summaryChild) ?
            React.cloneElement(
                summaryChild,
                { open: this.open },
                prefix ? <>
                    <CollapsibleTrigger open={this.open} onClick={this.toggleOpen} />
                    <SummaryWrapper>{ summaryChild.props.children }</SummaryWrapper>
                </> : <>
                    <SummaryWrapper>{ summaryChild.props.children }</SummaryWrapper>
                    <CollapsibleTrigger open={this.open} onClick={this.toggleOpen} />
                </>
            )
            : summaryChild;

        return <section>
            { summary }
            { this.open && contentChildren }
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
    margin-left: -10px;
`;

export const CollapsibleSectionSummary = styled.header`
    display: inline-block;
    margin: -6px 0 4px 0;
    padding: 6px 0;

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
            top: 2px;
            bottom: 0;
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

    padding: 46px 10px 10px 10px;
    margin-top: -40px;
    margin-bottom: 10px;

    word-break: break-word;
`;