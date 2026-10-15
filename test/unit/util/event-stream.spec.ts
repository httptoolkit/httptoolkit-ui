import { expect } from "chai";

import { parseEventStream, formatEventStreamAsJson } from "../../../src/util/event-stream";

describe("Event stream parsing", () => {

    it("should parse a simple event", () => {
        const events = parseEventStream('event: message\ndata: hello\n\n');

        expect(events).to.have.length(1);
        expect(events[0].comments).to.deep.equal([]);
        expect(Array.from(events[0].fields)).to.deep.equal([['event', 'message']]);
        expect(events[0].data).to.equal('hello');
    });

    it("should split events on blank lines, with any line ending", () => {
        const events = parseEventStream('data: a\r\n\r\ndata: b\r\rdata: c\n\n');
        expect(events.map(e => e.data)).to.deep.equal(['a', 'b', 'c']);
    });

    it("should join multiple data lines with newlines", () => {
        const events = parseEventStream('data: a\ndata: b\ndata:\n\n');
        expect(events[0].data).to.equal('a\nb\n');
    });

    it("should only strip a single leading space from values", () => {
        const events = parseEventStream('data:  two spaces\nid:none\n\n');
        expect(events[0].data).to.equal(' two spaces');
        expect(events[0].fields.get('id')).to.equal('none');
    });

    it("should treat lines without a colon as fields with empty values", () => {
        const events = parseEventStream('data\nevent\n\n');
        expect(events[0].data).to.equal('');
        expect(events[0].fields.get('event')).to.equal('');
    });

    it("should keep values containing colons intact", () => {
        const events = parseEventStream('data: a: b: c\n\n');
        expect(events[0].data).to.equal('a: b: c');
    });

    it("should collect comments", () => {
        const events = parseEventStream(':keepalive\n\n: hello\ndata: x\n\n');
        expect(events.map(e => e.comments)).to.deep.equal([['keepalive'], ['hello']]);
    });

    it("should use the last value for repeated fields", () => {
        const events = parseEventStream('id: 1\nid: 2\n\n');
        expect(Array.from(events[0].fields)).to.deep.equal([['id', '2']]);
    });

    it("should ignore repeated blank lines", () => {
        const events = parseEventStream('\n\ndata: a\n\n\n\ndata: b\n\n');
        expect(events.map(e => e.data)).to.deep.equal(['a', 'b']);
    });

    it("should include a final event without a trailing blank line", () => {
        const events = parseEventStream('data: a\n\ndata: b');
        expect(events.map(e => e.data)).to.deep.equal(['a', 'b']);
    });

    it("should skip a leading BOM", () => {
        const events = parseEventStream('﻿event: x\n\n');
        expect(Array.from(events[0].fields)).to.deep.equal([['event', 'x']]);
    });

    it("should return no events for empty content", () => {
        expect(parseEventStream('')).to.deep.equal([]);
    });
});

describe("Event stream formatting", () => {

    it("should format JSON data as JSON", () => {
        const input = 'event: delta\nid: 1\ndata: {"type":"delta","text":"hi"}\n\n';
        expect(formatEventStreamAsJson(input)).to.equal(`[
  {
    "event": "delta",
    "id": "1",
    "data": {
      "type": "delta",
      "text": "hi"
    }
  }
]`);
    });

    it("should format non-JSON data as strings", () => {
        const input = 'data: [DONE]\n\ndata: "quoted\n\ndata: {"partial": tru';
        expect(formatEventStreamAsJson(input)).to.equal(`[
  {
    "data": "[DONE]"
  },
  {
    "data": "\\"quoted"
  },
  {
    "data": "{\\"partial\\": tru"
  }
]`);
    });

    it("should format primitive JSON data as JSON", () => {
        const input = 'data: 123\n\ndata: true\n\ndata: "str"\n\n';
        expect(formatEventStreamAsJson(input)).to.equal(`[
  {
    "data": 123
  },
  {
    "data": true
  },
  {
    "data": "str"
  }
]`);
    });

    it("should format JSON data split across multiple data lines", () => {
        const input = 'data: {"a":\ndata: [1, 2]}\n\n';
        expect(formatEventStreamAsJson(input)).to.equal(`[
  {
    "data": {
      "a": [
        1,
        2
      ]
    }
  }
]`);
    });

    it("should preserve large numbers in JSON data exactly", () => {
        const input = 'data: {"id":12345678901234567890123}\n\n';
        expect(formatEventStreamAsJson(input)).to.include('"id": 12345678901234567890123');
    });

    it("should include comments and fields without data", () => {
        const input = ': keepalive\n\nretry: 3000\n\n';
        expect(formatEventStreamAsJson(input)).to.equal(`[
  {
    "comment": "keepalive"
  },
  {
    "retry": "3000"
  }
]`);
    });

    it("should escape unusual field names and values", () => {
        const input = 'my "field": a\\b\ndata: x\n\n';
        const result = formatEventStreamAsJson(input);
        expect(JSON.parse(result)).to.deep.equal([{ 'my "field"': 'a\\b', data: 'x' }]);
    });

    it("should always produce valid JSON", () => {
        const input = [
            ': comment with "quotes"',
            'event: a',
            'data: {"valid": [1, 2, 3]}',
            '',
            'data: not json at all',
            'data: {"broken": ',
            '',
            'data:  \t\u0000',
            ''
        ].join('\n');

        expect(() => JSON.parse(formatEventStreamAsJson(input))).not.to.throw();
    });

    it("should format empty content as an empty array", () => {
        expect(formatEventStreamAsJson('')).to.equal('[]');
    });
});
