import { expect } from "../../test-setup";

import { Headers } from '../../../src/types';
import { isProbablyProtobuf, parseRawProtobuf, extractProtobufFromGrpc } from "../../../src/util/protobuf";

const bufferFromHex = (hex: string) => Buffer.from(hex.replace(/:/g, ''), 'hex');
const uint32HexLengthFromHexColon = (hex: string) => ((hex.length + 1) / 3).toString(16).padStart(8, '0');  // no overflow check

const _M1 = `syntax = "proto2";
message M1 {
    optional string msg = 1;
}`;

const m1 = '0a:0b:48:65:6c:6c:6f:20:57:6f:72:6c:64';
const m1Js = { "1": "Hello World" };

const mLastFieldNb = `fa:ff:ff:ff:0f:${m1.slice(3)}`; // #536870911(=2^29-1): "Hello World"

const m1b = '0a:09:46:72:6f:6d:20:67:52:50:43';
const m1bJs = { "1": "From gRPC" };

const m1Deflate = '78:9c:05:80:31:09:00:00:08:04:77:2d:61:1c:1b:58:40:b7:83:07:fb:0f:4f:64:1f:a8:46:cf:1a:19:13:04:32';
const m1bDeflate = '78:5e:e3:e2:74:2b:ca:cf:55:48:0f:0a:70:06:00:10:85:03:14';

const _M2 = `syntax = "proto3";
message M2 {
    uint64 id = 3;
    string name = 42;
    double timestamp = 99;
}`;

const m2 = '18:7b:d2:02:19:48:65:6c:6c:6f:20:57:6f:72:6c:64:20:77:69:74:68:20:55:54:46:38:20:e2:86:90:99:06:b9:c7:ad:df:47:bd:d9:41';
const m2Js = {
    "3": 123,
    "42": "Hello World with UTF8 ←",
    "99": bufferFromHex(m2.slice(-8 * 3 + 1)), // 1727340414.715315 as double (<!> often interpreted as fixed64 instead of double without schema)
}

// Fixed Huffman coding (with checksum)
const m2Gzip = '1f:8b:08:02:88:94:f5:66:00:ff:f2:8f:93:a8:be:c4:24:e9:91:9a:93:93:af:10:9e:5f:94:93:a2:50:9e:59:92:a1:10:1a:e2:66:a1:f0:a8:6d:c2:4c:b6:9d:c7:d7:de:77:df:7b:d3:11:00:7f:e5:0c:b7:28:00:00:00';

describe("isProbablyProtobuf", () => {

    it("should not recognize empty data as Protobuf", () => {
        expect(
            isProbablyProtobuf(Buffer.from(''))
        ).to.equal(false);
    });

    it("should not recognize JSON dict as Protobuf", () => {
        expect(
            isProbablyProtobuf(Buffer.from('{}', 'utf8'))
        ).to.equal(false);
    });

    it("should not recognize JSON array as Protobuf", () => {
        expect(
            isProbablyProtobuf(Buffer.from('[]', 'utf8'))
        ).to.equal(false);
    });

    it("should not recognize HTML as Protobuf", () => {
        expect(
            isProbablyProtobuf(Buffer.from('<!DOCTYPE html>', 'utf8'))
        ).to.equal(false);
    });

    it("should recognize basic protobuf", () => {
        expect(
            isProbablyProtobuf(bufferFromHex(m1))
        ).to.equal(true);
    });

    it("should recognize more complex protobuf", () => {
        expect(
            isProbablyProtobuf(bufferFromHex(m2))
        ).to.equal(true);
    });

    it("should not recognize protobuf with first field number too high", () => {
        expect(
            isProbablyProtobuf(bufferFromHex(mLastFieldNb))
        ).to.equal(false);
    });

});

const GRPCFixtures: { [key: string]: [string, Headers, any[]] } = {
    // No compression
    "should handle simplest gRPC payload (basic mono-message, uncompressed)": [
        `00:${uint32HexLengthFromHexColon(m1)}:${m1}`,
        { 'grpc-encoding': 'identity' },
        [m1Js],
    ],
    "should handle usual gRPC payload (more complex mono-message, uncompressed without explicit encoding)": [
        `00:${uint32HexLengthFromHexColon(m2)}:${m2}`,
        {}, // no grpc-encoding (identity by default)
        [m2Js],
    ],
    "should handle multiple uncompressed gRPC messages": [
        `00:${uint32HexLengthFromHexColon(m1)}:${m1}:00:${uint32HexLengthFromHexColon(m1b)}:${m1b}`, // 2 uncompressed messages
        { 'grpc-encoding': 'identity' },
        [m1Js, m1bJs],
    ],
    // Compressed
    "should handle basic compressed (with deflate) gRPC payload": [
        `01:${uint32HexLengthFromHexColon(m1Deflate)}:${m1Deflate}`,
        { 'grpc-encoding': 'deflate' },
        [m1Js],
    ],
    "should handle basic compressed (with gzip) gRPC payload": [
        `01:${uint32HexLengthFromHexColon(m2Gzip)}:${m2Gzip}`,
        { 'grpc-encoding': 'gzip' },
        [m2Js],
    ],
    "should handle multiple compressed gRPC messages": [
        `00:${uint32HexLengthFromHexColon(m1)}:${m1}:01:${uint32HexLengthFromHexColon(m1bDeflate)}:${m1bDeflate}`, // per-message compression is optional
        { 'grpc-encoding': 'deflate' },
        [m1Js, m1bJs],
    ],

};

describe("extractProtobufFromGrpc", () => {

    Object.entries(GRPCFixtures).forEach(([testName, [hexGrpc, headers, expectedMsgs]]) => it(testName, () => {
        const protoMsgs = extractProtobufFromGrpc(bufferFromHex(hexGrpc), headers).map((msg) => parseRawProtobuf(msg, { prefix: '' }));
        expect(protoMsgs).to.deep.equal(expectedMsgs);
    }));

    it("should fail for compression flag != {0,1}", () => {
        const f = extractProtobufFromGrpc.bind(null, bufferFromHex(`02:${uint32HexLengthFromHexColon(m1)}:${m1}`), {});
        expect(f).to.throw(Error);
    });

    it("should reject compressed payload when grpc-encoding is identity", () => {
        const f = extractProtobufFromGrpc.bind(
            null,
            bufferFromHex(`01:${uint32HexLengthFromHexColon(m1)}:${m1}`),
            { 'grpc-encoding': 'identity' },
        );
        expect(f).to.throw(Error);
    });

    it("should reject compressed payload when grpc-encoding is not provided", () => {
        const f = extractProtobufFromGrpc.bind(null, bufferFromHex(`01:${uint32HexLengthFromHexColon(m1)}:${m1}`), {});
        expect(f).to.throw(Error);
    });

    it("should fail for wrongly declared grpc-encoding (gzip)", () => {
        const f = extractProtobufFromGrpc.bind(
            null,
            bufferFromHex(`01:${uint32HexLengthFromHexColon(m1Deflate)}:${m1Deflate}`),
            { 'grpc-encoding': 'gzip' },
        );
        expect(f).to.throw(Error);
    });

    it("should fail for wrongly declared grpc-encoding (deflate)", () => {
        const f = extractProtobufFromGrpc.bind(
            null,
            bufferFromHex(`01:${uint32HexLengthFromHexColon(m2Gzip)}:${m2Gzip}`),
            { 'grpc-encoding': 'deflate' },
        );
        expect(f).to.throw(Error);
    });

    it("should fail for corrupted deflate payload", () => {
        const f = extractProtobufFromGrpc.bind(
            null,
            bufferFromHex(`01:${uint32HexLengthFromHexColon(m1Deflate.slice(0, -6))}:${m1Deflate}`),
            { 'grpc-encoding': 'deflate' },
        );
        expect(f).to.throw(Error);
    });

    it("should fail for corrupted gzip payload", () => {
        const f = extractProtobufFromGrpc.bind(
            null,
            bufferFromHex(`01:${uint32HexLengthFromHexColon(m2Gzip.slice(0, -6))}:${m2Gzip}`),
            { 'grpc-encoding': 'gzip' },
        );
        expect(f).to.throw(Error);
    });

});