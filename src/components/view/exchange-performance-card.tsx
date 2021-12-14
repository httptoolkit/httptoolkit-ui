import * as _ from 'lodash';
import * as React from 'react';
import { observer, inject } from 'mobx-react';
import { get } from 'typesafe-get';

import { styled } from '../../styles';
import {
    Omit,
    HttpExchange,
    TimingEvents,
    ExchangeMessage
} from '../../types';
import { asHeaderArray, joinAnd } from '../../util';
import { Icon, WarningIcon, SuggestionIcon } from '../../icons';

import { AccountStore } from '../../model/account/account-store';
import { getReadableSize, testEncodings } from '../../model/http/bodies';
import {
    explainCacheability,
    explainCacheLifetime,
    explainCacheMatching,
    explainValidCacheTypes
} from '../../model/http/caching';

import { CollapsibleCardHeading } from '../common/card';
import {
    ExchangeCard,
    ExchangeCardProps,
    ExchangeCollapsibleSummary,
    ExchangeCollapsibleBody
} from './exchange-card';
import { Pill } from '../common/pill';
import { CollapsibleSection } from '../common/collapsible-section';
import { ContentLabelBlock, Markdown } from '../common/text-content';
import { ProHeaderPill, CardSalesPitch } from '../account/pro-placeholders';

interface ExchangePerformanceCardProps extends Omit<ExchangeCardProps, 'children'> {
    exchange: HttpExchange;
    accountStore?: AccountStore;
}

function sigFig(num: number, figs: number): number {
    return parseFloat(num.toFixed(figs));
}

const TimingPill = observer((p: { className?: string, timingEvents: TimingEvents }) => {
    // We can't show timing info if the request is still going
    const doneTimestamp = p.timingEvents.responseSentTimestamp || p.timingEvents.abortedTimestamp;
    if (!doneTimestamp) return null;

    const durationMs = doneTimestamp - p.timingEvents.startTimestamp;

    return <Pill className={p.className}>{
        durationMs < 100 ? sigFig(durationMs, 2) + 'ms' : // 22.34ms
        durationMs < 1000 ? sigFig(durationMs, 1) + 'ms' : // 999.5ms
        durationMs < 10000 ? sigFig(durationMs / 1000, 3) + ' seconds' : // 3.045 seconds
        sigFig(durationMs / 1000, 1) + ' seconds' // 11.2 seconds
    }</Pill>;
});

export const ExchangePerformanceCard = inject('accountStore')(observer((props: ExchangePerformanceCardProps) => {
    const { exchange, accountStore } = props;
    const { isPaidUser } = accountStore!;

    return <ExchangeCard {...props}>
        <header>
            { isPaidUser
                ? ('startTime' in exchange.timingEvents
                    ? <TimingPill timingEvents={exchange.timingEvents} />
                    : null)
                : <ProHeaderPill />
            }
            <CollapsibleCardHeading onCollapseToggled={props.onCollapseToggled}>
                Performance
            </CollapsibleCardHeading>
        </header>

        { isPaidUser ?
            <div>
                <CompressionPerformance exchange={exchange} />
                <CachingPerformance exchange={exchange} />
            </div>
        :
            <CardSalesPitch source='performance'>
                <p>
                    See timing info, dive into the real and potential compression of every
                    exchange, and understand how &amp; where this response could
                    be cached, for a full performance overview.
                </p>
            </CardSalesPitch>
        }
    </ExchangeCard>;
}));

function getEncodingName(key: string): string {
    if (key === 'br') return 'brotli';
    if (key === 'zstd') return 'zstandard';
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
    encodedBodyLength: number,
    decodedBodyLength: number | undefined
}) => {
    const { encodings, encodedBodyLength, decodedBodyLength } = p;

    const compressionRatio = decodedBodyLength ? Math.round(100 * (
        1 - (encodedBodyLength / decodedBodyLength)
    )) : undefined;

    return <>
        { encodings.length ? <>
            compressed with <strong>{joinAnd(encodings, ', ', ' and then ')}</strong>,
            making it {
                compressionRatio !== undefined && decodedBodyLength ? <>
                    <strong>
                        { compressionRatio >= 0 ?
                            `${compressionRatio}% smaller`
                        :
                            `${-compressionRatio}% bigger`
                        }
                    </strong> ({
                        getReadableSize(decodedBodyLength)
                    } to {
                        getReadableSize(encodedBodyLength)
                    })
                </> : <Icon icon={['fas', 'spinner']} spin />
            }
        </> :
            <strong>not compressed</strong>
        }
    </>;
});

const CompressionOptions = observer((p: {
    encodings: string[],
    encodedBodyLength: number,
    decodedBodyLength: number | undefined,
    encodingTestResults: { [encoding: string]: number } | undefined
}) => {
    const { encodings, encodedBodyLength, decodedBodyLength, encodingTestResults } = p;

    if (!_.isEmpty(encodingTestResults) && decodedBodyLength) {
        const realCompressionRatio = Math.round(100 * (
            1 - (encodedBodyLength / decodedBodyLength)
        ));

        return <>{
            _(encodingTestResults)
            .omitBy((_size, encoding) =>
                encodings.length === 1 && encoding === encodings[0]
            ).map((size, encoding) => {
                const testedCompressionRatio = Math.round(100 * (
                    1 - (size / decodedBodyLength)
                ));

                return <Pill key={encoding} title={
                        `${
                            getReadableSize(decodedBodyLength)
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
        return <Icon icon={['fas', 'spinner']} spin />;
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
    line-height: 1.3;

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

        if (typeof message !== 'object' || !message.body.encoded.byteLength) return null;

        const encodedBody = message.body.encoded;
        const decodedBody = message.body.decoded;
        const decodedBodySize = decodedBody ? decodedBody.byteLength : 0;
        const encodedBodySize = encodedBody.byteLength;

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
            encodingTestResults[bestOtherEncoding] < Math.min(encodedBodySize, decodedBodySize);

        return <React.Fragment key={messageType}>
            <ContentLabelBlock>{ _.upperFirst(messageType) } Compression</ContentLabelBlock>
            <PerformanceExplanation>
                The {messageType} body was <CompressionDescription
                    encodings={encodings}
                    encodedBodyLength={encodedBodySize}
                    decodedBodyLength={get(decodedBody, 'byteLength')}
                />.
            </PerformanceExplanation>
            <CompressionOptionsContainer>
                <CompressionOptions
                    encodings={encodings}
                    encodedBodyLength={encodedBodySize}
                    decodedBodyLength={get(decodedBody, 'byteLength')}
                    encodingTestResults={encodingTestResults}
                />
                <CompressionOptionsTips>{
                    !!betterEncodingAvailable && <>
                        <SuggestionIcon />
                        This would be {
                            Math.round(100 * (
                                1 - (encodingTestResults[bestOtherEncoding!] / encodedBodySize)
                            ))
                        }% smaller { decodedBodySize !== encodedBodySize &&
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
                    decodedBodySize < encodedBodySize && <>
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