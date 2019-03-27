import * as _ from 'lodash';
import * as React from 'react';
import { observer, inject } from 'mobx-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { styled } from '../../styles';
import { Omit, ExchangeMessage } from '../../types';
import { asHeaderArray, joinAnd } from '../../util';
import { WarningIcon, SuggestionIcon } from '../../icons';

import { HttpExchange } from '../../model/exchange';
import { AccountStore } from '../../model/account/account-store';
import { getDecodedBody, getReadableSize, testEncodings } from '../../model/bodies';
import {
    explainCacheability,
    explainCacheLifetime,
    explainCacheMatching,
    explainValidCacheTypes
} from '../../model/caching';

import {
    ExchangeCard,
    ExchangeCardProps,
    ContentLabelBlock,
    ExchangeCollapsibleSummary,
    ExchangeCollapsibleBody
} from './exchange-card';
import { ProPill, Pill } from '../common/pill';
import { CollapsibleSection } from '../common/collapsible-section';
import { Markdown } from '../common/external-content';


interface ExchangePerformanceCardProps extends Omit<ExchangeCardProps, 'children'> {
    exchange: HttpExchange;
    accountStore?: AccountStore;
}

const PerformanceProPill = styled(ProPill)`
    margin-right: auto;
`;

function sigFig(num: number, figs: number): number {
    return parseFloat(num.toFixed(figs));
}

const TimingPill = observer((p: { className?: string, exchange: HttpExchange }) => {
    const { timingEvents } = p.exchange;

    // We can't show timing info if the request is still going
    const doneTimestamp = timingEvents.responseSentTimestamp || timingEvents.abortedTimestamp;
    if (!doneTimestamp) return null;

    const durationMs = doneTimestamp - timingEvents.startTimestamp;

    return <Pill className={p.className}>{
        durationMs < 100 ? sigFig(durationMs, 2) + 'ms' : // 22.34ms
        durationMs < 1000 ? sigFig(durationMs, 1) + 'ms' : // 999.5ms
        durationMs < 10000 ? sigFig(durationMs / 1000, 2) + ' seconds' : // 3.04 seconds
        sigFig(durationMs / 1000, 1) + ' seconds' // 11.2 seconds
    }</Pill>;
});

export const ExchangePerformanceCard = inject('accountStore')(observer((props: ExchangePerformanceCardProps) => {
    const { exchange, accountStore } = props;
    const { isPaidUser, getPro } = accountStore!;

    return <ExchangeCard {...props}>
        <header>
            { isPaidUser ?
                <TimingPill exchange={exchange} /> :
                <PerformanceProPill />
            }
            <h1>Performance</h1>
        </header>

        { isPaidUser ?
            <div>
                <CompressionPerformance exchange={exchange} />
                <CachingPerformance exchange={exchange} />
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

    return asHeaderArray(message.headers['content-encoding'])
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
            compressed with <strong>{joinAnd(encodings, ', ', ' and then ')}</strong>,
            making it {
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

const CompressionPerformance = observer((p: { exchange: HttpExchange }) => {
    const messageTypes: Array<'request' | 'response'> = ['request', 'response'];
    const clientAcceptedEncodings = asHeaderArray(p.exchange.request.headers['accept-encoding'])
        .map(getEncodingName);

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
                <CompressionOptionsTips>{
                    !!betterEncodingAvailable && <>
                        <SuggestionIcon />
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
                }{
                    !!decodedBodySize &&
                    !betterEncodingAvailable &&
                    decodedBodySize < encodedBody.byteLength && <>
                        <WarningIcon />
                        This { messageType } would be smaller without compression.
                    </>
                }</CompressionOptionsTips>
            </CompressionOptionsContainer>
        </React.Fragment>
    }) }</>;
});

const CachingPerformance = observer((p: { exchange: HttpExchange }) => {
    if (typeof p.exchange.response !== 'object') return null;

    const cacheability = explainCacheability(p.exchange);

    if (!cacheability) return null;

    const cacheDetails = cacheability.cacheable ? [
        cacheability,
        explainCacheMatching(p.exchange)!,
        explainValidCacheTypes(p.exchange)!,
        explainCacheLifetime(p.exchange)!
    ] : [
        cacheability
    ];

    return <>
        <ContentLabelBlock>
            Caching
        </ContentLabelBlock>
        { cacheDetails.map((details, i) =>
            <CollapsibleSection prefixTrigger={true} key={i}>
                <ExchangeCollapsibleSummary>
                    { details.summary }{' '}
                    { details.type === 'warning' && <WarningIcon /> }
                    { details.type === 'suggestion' && <SuggestionIcon /> }
                </ExchangeCollapsibleSummary>
                <ExchangeCollapsibleBody>
                    <Markdown content={ details.explanation } />
                </ExchangeCollapsibleBody>
            </CollapsibleSection>
        ) }
    </>;
});