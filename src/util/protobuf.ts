import parseRawProto from 'rawprotoparse';

export function isProbablyProtobuf(input: Uint8Array) {
    // Protobuf data starts with a varint, consisting of a field
    // number (1 - 2^29-1) and a field type (0, 1, 2, 3, 4, 5)
    // Unfortunately, that matches a very wide set of values,
    // including things like '<' and '{' that are widely used
    // elsewhere.

    // To handle that, we're more strict here, and we assume that
    // field 1 will be first (very common, but not guaranteed).
    // This is a best-efforts check for messages with no other
    // indicators (no matching content-type) so that's OK.

    // This implies a first byte from 08 to 0D, which has no obvious
    // conflicts in https://en.wikipedia.org/wiki/List_of_file_signatures
    // but does notably conflict with tab/cr/lf.
    // That makes this good as a very quick first check, but confirming
    // actual parsing is required to check more thoroughly.

    const fieldNumber = input[0] >>> 3;
    const fieldType = input[0] & 0b111;

    return fieldNumber === 1 &&
        fieldType >= 1 &&
        fieldType <= 6;
}

export const parseRawProtobuf = parseRawProto;

// GRPC message structure:
// The repeated sequence of Length-Prefixed-Message items is delivered in DATA frames
// Length-Prefixed-Message → Compressed-Flag Message-Length Message
// Compressed-Flag → 0 / 1 ; encoded as 1 byte unsigned integer
// Message-Length → {length of Message} ; encoded as 4 byte unsigned integer (big endian)
// Message → *{binary octet}
export const extractProtobufFromGrpc = (input: Buffer) => {
    const protobufMessasges: Buffer[] = [];

    while (input.length > 0) {
        if (input.readInt8() != 0) {
            throw new Error("Compressed gRPC messages not yet supported")
        }

        const length = input.readInt32BE(1);
        protobufMessasges.push(input.slice(5, 5 + length));
        input = input.subarray(5 + length);
    }

    return protobufMessasges;
}

export const isValidProtobuf = (input: Uint8Array) => {
    try {
        parseRawProtobuf(input);
        return true;
    } catch (e) {
        return false;
    }
}