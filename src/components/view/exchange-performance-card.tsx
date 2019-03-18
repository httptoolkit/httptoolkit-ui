import * as _ from 'lodash';
import * as React from 'react';
import { observer, inject } from 'mobx-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { styled } from '../../styles';
import { Omit, ExchangeMessage } from '../../types';
import { join } from '../../util';

import { HttpExchange } from '../../model/exchange';
import { AccountStore } from '../../model/account/account-store';

import { ExchangeCard, ExchangeCardProps, ContentLabelBlock } from './exchange-card';
import { ProPill, Pill } from '../common/pill';
import { getDecodedBody, getReadableSize, testEncodings } from '../../model/bodies';

interface ExchangePerformanceCardProps extends Omit<ExchangeCardProps, 'children'> {
    exchange: HttpExchange;
    accountStore?: AccountStore;
}

const PerformanceProPill = styled(ProPill)`
    margin-right: auto;
`;

const Suggestion = styled(
    (p) => <FontAwesomeIcon icon={['fas', 'lightbulb']} {...p} />
)`
    margin-right: 6px;
    color: #f1971f;
`;

const Warning = styled(
    (p) => <FontAwesomeIcon icon={['fas', 'exclamation-triangle']} {...p} />
)`
    margin-right: 6px;
    color: #f1971f;
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
        return 'zlib';
    }

    return _.upperFirst(key);
}

function getEncodings(message: ExchangeMessage | 'aborted' | undefined) {
    if (!message || message === 'aborted') return [];

    return join(message.headers['content-encoding'] || '')
        .split(', ')
        .filter((encoding) => !!encoding && encoding !== 'identity')
        .map(getEncodingName);
}

const CompressionDescription = observer((p: {
    encodings: string[],
    encodedBody: Buffer,
    decodedBody: Buffer | undefined
}) => {
    const { encodings, encodedBody, decodedBody } = p;

    const compressionRatio = decodedBody ? Math.round(100 * (
        1 - (encodedBody.byteLength / decodedBody.byteLength)
    )) : undefined;

    return <>
        { encodings.length ? <>
            compressed with <strong>{
                encodings.length > 1 ?
                    `${encodings.slice(0, -1).join(', ')} and then ${encodings.slice(-1)[0]}`
                : `${encodings[0]}`
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

const CompressionOptions = observer((p: {
    encodings: string[],
    encodedBodySize: number,
    decodedBodySize: number | undefined,
    encodingTestResults: { [encoding: string]: number } | undefined
}) => {
    const { encodings, encodedBodySize, decodedBodySize, encodingTestResults } = p;

    if (!_.isEmpty(encodingTestResults) && decodedBodySize) {
        const realCompressionRatio = Math.round(100 * (
            1 - (encodedBodySize / decodedBodySize)
        ));

        return <>{
            _(encodingTestResults)
            .omitBy((_size, encoding) =>
                encodings.length === 1 && encoding === encodings[0]
            ).map((size, encoding) => {
                const testedCompressionRatio = Math.round(100 * (
                    1 - (size / decodedBodySize)
                ));

                return <Pill key={encoding} title={
                        `${
                            getReadableSize(decodedBodySize)
                        } would compress to ${
                            getReadableSize(size)
                        } using ${encoding}`
                    }
                    color={
                        testedCompressionRatio > realCompressionRatio! &&
                        testedCompressionRatio > 0 ?
                            '#4caf7d' : '#888'
                    }
                >
                    { _.upperFirst(encoding) }: { testedCompressionRatio }%
                </Pill>
            }).valueOf()
        }</>
    } else {
        return <FontAwesomeIcon icon={['fas', 'spinner']} spin />;
    }
});

const CompressionOptionsContainer = styled.div`
    display: flex;
    align-items: center;

    margin-bottom: 10px;
    &:last-child {
        margin-bottom: 0;
    }
`;

const PerformanceExplanation = styled.p`
    margin-bottom: 10px;
    line-height: 1.2;

    &:last-child {
        margin-bottom: 0;
    }
`;

const CompressionOptionsTips = styled(PerformanceExplanation)`
    font-style: italic;
`;

export const CompressionPerformance = observer((p: { exchange: HttpExchange }) => {
    const messageTypes: Array<'request' | 'response'> = ['request', 'response'];
    const clientAcceptedEncodings = join(p.exchange.request.headers['accept-encoding'] || '')
        .split(', ').map(getEncodingName);

    return <>{ messageTypes.map((messageType) => {
        const message = p.exchange[messageType];
        const encodings = getEncodings(message);

        if (typeof message !== 'object' || !message.body || !message.body.buffer) return null;

        const encodedBody = message.body.buffer;
        const decodedBody = getDecodedBody(message);
        const decodedBodySize = decodedBody ? decodedBody.byteLength : 0;

        const encodingTestResults = _.mapKeys(testEncodings(message),
            (_size, encoding) => getEncodingName(encoding)
        );

        let bestOtherEncoding = _.minBy(
            Object.keys(encodingTestResults),
            (encoding) => encodingTestResults[encoding]
        );

        const betterEncodingAvailable =
            decodedBodySize &&
            bestOtherEncoding &&
            !(encodings.length === 1 && bestOtherEncoding === encodings[0]) &&
            encodingTestResults[bestOtherEncoding] < Math.min(encodedBody.byteLength, decodedBodySize);

        return <React.Fragment key={messageType}>
            <ContentLabelBlock>{ _.upperFirst(messageType) } Compression</ContentLabelBlock>
            <PerformanceExplanation>
                The {messageType} body was <CompressionDescription
                    encodings={encodings}
                    encodedBody={encodedBody}
                    decodedBody={decodedBody}
                />.
            </PerformanceExplanation>
            <CompressionOptionsContainer>
                <CompressionOptions
                    encodings={encodings}
                    encodedBodySize={encodedBody.byteLength}
                    decodedBodySize={decodedBodySize}
                    encodingTestResults={encodingTestResults}
                />
                <CompressionOptionsTips> {
                    betterEncodingAvailable && <>
                        <Suggestion />
                        This would be {
                            Math.round(100 * (
                                1 - (encodingTestResults[bestOtherEncoding!] / encodedBody.byteLength)
                            ))
                        }% smaller { decodedBodySize !== encodedBody.byteLength &&
                            `(${
                                Math.round(100 * (
                                    1 - (encodingTestResults[bestOtherEncoding!] / decodedBodySize)
                                ))
                            }% total compression)`
                        } with { bestOtherEncoding }{
                            messageType === 'response' &&
                            clientAcceptedEncodings &&
                            !_.includes(clientAcceptedEncodings, bestOtherEncoding) &&
                                ` (not supported by this client)`
                        }.
                    </>
                } {
                    decodedBodySize &&
                    !betterEncodingAvailable &&
                    decodedBodySize < encodedBody.byteLength && <>
                        <Warning />
                        This { messageType } would be smaller without compression.
                    </>
                } </CompressionOptionsTips>
            </CompressionOptionsContainer>
        </React.Fragment>
    }) }</>;
});