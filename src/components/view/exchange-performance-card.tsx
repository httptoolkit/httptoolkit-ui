import * as _ from 'lodash';
import * as React from 'react';
import { observer, inject } from 'mobx-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { styled } from '../../styles';
import { Omit, ExchangeMessage } from '../../types';

import { HttpExchange } from '../../model/exchange';
import { AccountStore } from '../../model/account/account-store';

import { ExchangeCard, ExchangeCardProps, ContentLabelBlock } from './exchange-card';
import { ProPill } from '../common/pill';
import { Content } from '../common/external-content';
import { getDecodedBody, getReadableSize } from '../../model/bodies';

interface ExchangePerformanceCardProps extends Omit<ExchangeCardProps, 'children'> {
    exchange: HttpExchange;
    accountStore?: AccountStore;
}

const PerformanceProPill = styled(ProPill)`
    margin-right: auto;
`;

export const ExchangePerformanceCard = inject('accountStore')(observer((props: ExchangePerformanceCardProps) => {
    const { exchange, accountStore } = props;
    const { isPaidUser, getPro } = accountStore!;

    return <ExchangeCard {...props}>
        <header>
            { !isPaidUser && <PerformanceProPill /> }
            <h1>Performance</h1>
        </header>

        { isPaidUser ?
            <div>
                <CompressionPerformance exchange={exchange} />
            </div>
        :
            <div>
                <button onClick={getPro}>Buy HTTP Toolkit Pro</button>
            </div>
        }
    </ExchangeCard>;
}));

function getEncodingName(key: string): string {
    if (key === 'br') return 'brotli';
    if (key === 'gzip' || key === 'x-gzip') {
        return 'gzip';
    }
    if (key === 'deflate' || key === 'x-deflate') {
        return 'DEFLATE';
    }

    return _.upperFirst(key);
}

function getEncodings(message: ExchangeMessage | 'aborted' | undefined) {
    if (!message || message === 'aborted') return;

    const encodings = (message.headers['content-encoding'] || '')
        .split(', ')
        .filter((encoding) => !!encoding && encoding !== 'identity')
        .map(getEncodingName);

    return _.isEmpty(encodings) ? undefined : encodings;
}

const CompressionDescription = observer((p: {
    encodings: string[] | undefined,
    message: ExchangeMessage
}) => {
    const encodedBody = p.message.body.buffer;
    const decodedBody = getDecodedBody(p.message);

    const compressionRatio = decodedBody ? Math.round(100 * (
        1 - (encodedBody.byteLength / decodedBody.byteLength)
    )) : undefined;

    return <>
        { p.encodings ? <>
            compressed with <strong>{
                p.encodings.length > 1 ?
                    `${p.encodings.slice(0, -1).join(', ')} and then ${p.encodings.slice(-1)[0]} encodings`
                : `${p.encodings[0]} encoding`
            }</strong>, making it {
                compressionRatio !== undefined && decodedBody ? <>
                    <strong>
                        { compressionRatio >= 0 ?
                            `${compressionRatio}% smaller`
                        :
                            `${-compressionRatio}% bigger`
                        }
                    </strong> ({
                        getReadableSize(decodedBody.byteLength)
                    } to {
                        getReadableSize(encodedBody.byteLength)
                    })
                </> : <FontAwesomeIcon icon={['fas', 'spinner']} spin />
            }
        </> :
            <strong>not compressed</strong>
        }
    </>;
});

export const CompressionPerformance = observer((p: { exchange: HttpExchange }) => {
    const requestEncodings = getEncodings(p.exchange.request);
    const responseEncodings = getEncodings(p.exchange.response);

    return <>
        { p.exchange.request.body && <>
            <ContentLabelBlock>Request Compression</ContentLabelBlock>
            <Content>
                <p>
                    The request body was <CompressionDescription
                        encodings={requestEncodings}
                        message={p.exchange.request}
                    />.
                </p>
            </Content>
        </> }

        { typeof p.exchange.response === 'object' && p.exchange.response.body.buffer && <>
            <ContentLabelBlock>Response Compression</ContentLabelBlock>
            <Content>
                <p>
                    The response body was <CompressionDescription
                        encodings={responseEncodings}
                        message={p.exchange.response}
                    />.
                </p>
            </Content>
        </> }
    </>;
});