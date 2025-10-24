import parseRawProto from 'rawprotoparse';
import { gunzipSync, inflateSync } from 'zlib';

import { Headers } from '../types';
import { getHeaderValue } from '../model/http/headers';

export function isProbablyProtobuf(input: Uint8Array) {
    // Protobuf data starts with a varint, consisting of a
    // field number in [1, 2^29[ and a field type in [0, 5]*.
    // Unfortunately, that matches a very wide set of values,
    // including things like '<', '[' and '{' that are widely
    // used in other contexts.
    // * Hopefully, field types 3 & 4 have been deprecated for a while,
    // we thus consider them as invalid for this quick inference.

    // To handle that, we're more strict here, and we assume that
    // first field is tiny (<= 3) (very common, but not guaranteed).
    // This is a best-efforts check for messages with no other
    // indicators (no matching content-type) so that's OK.

    // This implies a first byte from 08 to 1D, which is not
    // in range of printable ASCII characters and has no obvious
    // conflicts in https://en.wikipedia.org/wiki/List_of_file_signatures
    // but does notably conflict with tab/cr/lf.
    // That makes this good as a very quick first check, but confirming
    // actual parsing is required to check more thoroughly.
    if (input.length < 2) {
        return false;
    }

    const fieldNumberTrunc = input[0] >>> 3;
    const fieldType = input[0] & 0b111;

    return fieldNumberTrunc >= 1 &&
        fieldNumberTrunc <= 3 &&
        [0, 1, 2, 5].includes(fieldType);
}

export const parseRawProtobuf = parseRawProto;

// GRPC message structure:
// Ref: https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md
//
// The repeated sequence of Length-Prefixed-Message items is delivered in DATA frames
// Length-Prefixed-Message → Compressed-Flag Message-Length Message
// Compressed-Flag → 0 / 1 ; encoded as 1 byte unsigned integer
// Message-Length → {length of Message} ; encoded as 4 byte unsigned integer (big endian)
// Message → *{binary octet}
//
// A Compressed-Flag value of 1 indicates that the binary octet sequence of Message is
// compressed using the mechanism declared by the Message-Encoding header.
// A value of 0 indicates that no encoding of Message bytes has occurred.
// If the Message-Encoding header is omitted then the Compressed-Flag must be 0.
export const extractProtobufFromGrpc = (input: Buffer, headers: Headers) => {
    const grpcEncoding = (
        getHeaderValue(headers, 'grpc-encoding') ?? 'identity'
    ).toLocaleLowerCase();
    const grpcDecoder = grpcEncoding == 'gzip' ? gunzipSync : grpcEncoding == 'deflate' ? inflateSync : undefined;
    const protobufMessages: Buffer[] = [];

    // useful indices for debugging
    let offset = 0;
    let msgIndex = 0;

    while (input.length > 0) {
        const errorPrefix = `gRPC message #${msgIndex} @${offset}: `
        const compressionFlag = input.readUInt8();
        const length = input.readUInt32BE(1);
        let message = input.subarray(5, 5 + length);
        if (message.length != length) {
            throw new Error(`${errorPrefix}length of message is corrupted`);
        }

        switch (compressionFlag) {
            case 0:  // may happen even if grpc-encoding != identity according to specs
                break;
            case 1:
                if (!grpcDecoder) {
                    throw new Error(`${errorPrefix}not expected to be compressed`);
                }
                try {
                    message = grpcDecoder(message);
                } catch (err) {
                    throw new Error(`${errorPrefix}failed decompression (from ${grpcEncoding})`);
                }
                break;
            default:
                throw new Error(`${errorPrefix}unsupported compression flag (0x${compressionFlag.toString(16).padStart(2, '0')})`);
        }

        protobufMessages.push(message);
        input = input.subarray(5 + length);
        offset += 5 + length;
        msgIndex++;
    }

    return protobufMessages;
}

export const isProbablyGrpcProto = (input: Buffer, headers: Headers) => {
    if (input.byteLength < 7) {
        return false;
    }
    const compressionFlag = input.readUInt8();
    const length = input.readUInt32BE(1);
    const firstMessage = input.subarray(5, 5 + length);
    return length >= 2 &&  // at least two bytes for Protobuf message (tag & value)
        firstMessage.length == length &&
        (
            (compressionFlag == 0 && isProbablyProtobuf(firstMessage)) ||
            (compressionFlag == 1 && Object.keys(headers).includes('grpc-encoding'))
        )
}

export const isValidProtobuf = (input: Uint8Array) => {
    try {
        parseRawProtobuf(input);
        return true;
    } catch (e) {
        return false;
    }
}

export const isValidGrpcProto = (input: Buffer, headers: Headers) => {
    try {
        const protobufMessages = extractProtobufFromGrpc(input, headers);
        protobufMessages.forEach((msg) => parseRawProtobuf(msg));
        return true;
    } catch (e) {
        return false;
    }
}