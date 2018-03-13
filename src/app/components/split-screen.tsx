import * as React from "react";
import styled, { StyledComponentClass } from 'styled-components';
import * as _ from 'lodash';

import { DomWithProps } from "../types";

const SplitScreenContainer = styled.div`
    display: flex;
    height: 100%;
    width: 100%;
`;

const SplitScreenElement = styled.div`
    flex-grow: 1;
    overflow: auto;

    flex-basis: 0;
` as DomWithProps<HTMLDivElement, { innerRef: (elem: HTMLElement) => void }>;

class Draggable extends React.Component<{
    className?: string,
    onDragStart: () => void,
    onDrag: (x: number, y: number) => void
}, {
    startX: number | null,
    startY: number | null
}> {

    startDrag = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();

        this.props.onDragStart();

        document.addEventListener('mouseup', this.endDrag);
        document.addEventListener('mousemove', this.drag);
    }
    
    drag = (e: MouseEvent) => {
        this.props.onDrag(e.movementX, e.movementY);
    };

    endDrag = (e: MouseEvent) => {
        document.removeEventListener('mouseup', this.endDrag);
        document.removeEventListener('mousemove', this.drag);
    }

    render() {
        return <div className={this.props.className} onMouseDown={this.startDrag} />
    }
}

const Separator = styled(Draggable)`
    width: 2px;
    height: 100%;
    position: relative;
    background-color: ${props => props.theme.containerBorder};
    cursor: col-resize;
`;

export class SplitScreen extends React.Component<{
    children: JSX.Element[],
    minWidth?: number
}, { }> {
    private childElements: { [index: string]: HTMLElement } = {};
    private weights: { [index: string]: number } = {};

    constructor(props: { children: JSX.Element[], minWidth?: number }) {
        super(props);
    }
    
    componentDidMount() {
        this.weights = _.mapValues(this.childElements, (c: HTMLElement) => c.offsetWidth);
        _.forEach(this.childElements, (child, i) => {
            child.style.flexBasis = this.weights[i] + 'px';
        });
    }

    render() {
        return <SplitScreenContainer>
            { 
                this.props.children
                .map((child, i) => (
                    <SplitScreenElement key={i} innerRef={(elem: any) => this.childElements[i] = elem}>
                        { child }
                    </SplitScreenElement>
                ))
                .reduce((result: JSX.Element[], element: JSX.Element, i: number) => result.concat(element, 
                    <Separator
                        key={i + '-separator'}
                        onDragStart={() => {
                            this.weights = _.mapValues(this.childElements, (c: HTMLElement) => c.offsetWidth);
                        }}
                        onDrag={(x) => {
                            this.weights[i]! += x;
                            this.weights[i+1]! -= x;

                            let minWidth = this.props.minWidth || 0;

                            if (this.weights[i] < minWidth || this.weights[i + 1] < minWidth) {
                                return;
                            }

                            this.childElements[i].style.flexBasis = this.weights[i] + 'px';
                            this.childElements[i + 1].style.flexBasis = this.weights[i + 1] + 'px';
                        }}
                    />
                ), [])
                .slice(0, -1) // Drop the final separator
            }
        </SplitScreenContainer>
    }

}