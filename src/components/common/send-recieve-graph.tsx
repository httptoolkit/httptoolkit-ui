import _ from 'lodash';
import React from 'react';

import { ScaleLinear, scaleLinear } from 'd3-scale';
import { AreaClosed, LinePath } from '@vx/shape';
import { curveMonotoneX } from '@vx/curve';
import { Group } from '@vx/group';
import { AxisLeft } from '@vx/axis';

import { styled } from '../../styles';

import { getSummaryColour } from '../../model/events/categorization';
import { getReadableSize } from '../../util/buffer';

// Somewhat arbitrary colour selections, but picking from our existing category
// pallet for vaugely related colours, that work together and which don't have
// accessibility issues for colourblind usersL
export const SentDataColour = getSummaryColour('data');
export const ReceivedDataColour = getSummaryColour('rtc-media');

const GraphSvg = styled.svg`
    background-color: ${p => p.theme.mainLowlightBackground};
    color: ${p => p.theme.mainColor};

    .axis-label {
        font-size: 15px;
    }

    .axis-tick text {
        font-size: 12px;
    }
`;

export const SendReceiveGraph = ({
    width,
    height,
    graphPaddingPx,
    data
}: {
    width: number,
    height: number,
    graphPaddingPx: number
    data: Array<{ sent: number, received: number }>
}) => {
    const top = graphPaddingPx;
    const bottom = height - graphPaddingPx;
    const innerHeight = bottom - top;

    const axisMargin = 85 + graphPaddingPx;
    const innerWidth = width - axisMargin;
    // ^ Note we don't subtract right-edge padding: we go fully up to the right edge

    const xScale = scaleLinear()
        .domain([0, data.length - 1])
        .range([0, innerWidth]);

    const dataMax = _.max(data.map(d => Math.max(d.sent, d.received))) ?? 0;

    const sentYScale = scaleLinear()
        .domain([0, dataMax])
        .range([innerHeight / 2, top]);

    const receivedYScale = scaleLinear()
        .domain([0, dataMax])
        .range([innerHeight / 2, bottom]);

    const sentData = data.map(d => d.sent);
    const receivedData = data.map(d => d.received);

    return <GraphSvg
        width={width}
        height={height}
    >
        <Group left={axisMargin}>
            <GraphArea
                label='Received'
                data={receivedData}
                xScale={xScale}
                yScale={receivedYScale}
                fill={ReceivedDataColour}
            />
            <GraphArea
                label='Sent'
                data={sentData}
                xScale={xScale}
                yScale={sentYScale}
                fill={SentDataColour}
            />
        </Group>
    </GraphSvg>;
};

const GraphArea = (props: {
    label: string,
    data: Array<number>,
    xScale: ScaleLinear<number, number>,
    yScale: ScaleLinear<number, number>,
    fill: string
}) => {
    return <>
        <AxisLeft
            scale={props.yScale}

            label={props.label}
            labelOffset={55}
            labelClassName='axis-label'

            tickFormat={d => getReadableSize(d.valueOf())}
            tickClassName='axis-tick'
            numTicks={6}
        />

        <AreaClosed
            data={props.data}

            x={(d, i) => props.xScale(i)!}
            y={d => props.yScale(d) ?? 0}
            yScale={props.yScale}

            fill={props.fill}
            curve={curveMonotoneX}
        />
        <LinePath
            data={props.data}

            x={(d, i) => props.xScale(i)!}
            y={d => props.yScale(d) ?? 0}

            stroke="#222"
            strokeWidth={1.5}
            curve={curveMonotoneX}

        />
    </>
};