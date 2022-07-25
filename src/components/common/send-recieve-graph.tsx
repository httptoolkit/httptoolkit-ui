import _ from 'lodash';
import React from 'react';
import { AreaClosed } from '@vx/shape';
import { curveMonotoneX } from '@vx/curve';
import { ScaleLinear, scaleLinear } from 'd3-scale';

export const SendReceiveGraph = ({
    width,
    height,
    data
}: {
    width: number,
    height: number,
    graphPaddingPx: number
    // Pairs of sent/received bytes
    data: Array<{ sent: number, received: number }>
}) => {
    const xScale = scaleLinear()
        .domain([0, data.length - 1])
        .range([0, width]);

    const dataMax = _.max(data.map(d => Math.max(d.sent, d.received))) ?? 0;

    const sentYScale = scaleLinear()
        .domain([0, dataMax])
        .range([height / 2, height]);

    const receivedYScale = scaleLinear()
        .domain([0, dataMax])
        .range([height / 2, 0]);

    const sentData = data.map(d => d.sent);
    const receivedData = data.map(d => d.received);

    return <svg
        width={width}
        height={height}
    >
        <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="#fafafa"
        />

        <GraphArea
            data={sentData}
            xScale={xScale}
            yScale={sentYScale}
            fill='#ff0000'
        />
        <GraphArea
            data={receivedData}
            xScale={xScale}
            yScale={receivedYScale}
            fill='#00ff00'
        />
    </svg>;
};

const GraphArea = (props: {
    data: Array<number>,
    xScale: ScaleLinear<number, number>,
    yScale: ScaleLinear<number, number>,
    fill: string
}) => {
    return <AreaClosed
        data={props.data}

        x={(d, i) => props.xScale(i)!}
        y={d => props.yScale(d) ?? 0}
        yScale={props.yScale}

        fill={props.fill}
        curve={curveMonotoneX}
    />
};