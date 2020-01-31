import { expect } from '../../test-setup';

import {
    dereference
} from '../../../src/util/json-schema';

describe("JSON dereferencing", () => {
    it("does nothing given no references", () => {
        expect(
            dereference({
                a: { b: [{ c: 1 }] }
            })
        ).to.deep.equal({
            a: { b: [{ c: 1 }] }
        });
    });

    it("looks up content using $refs", () => {
        expect(
            dereference({
                a: { b: [{ c: { $ref: '#/c' } }] },
                c: 1
            })
        ).to.deep.equal({
            a: { b: [{ c: 1 }] },
            c: 1
        });
    });

    it("handles sequences of backward $refs", () => {
        expect(
            dereference({
                d: 1,
                c: { $ref: '#/d' },
                a: { b: [{ c: { $ref: '#/c' } }] }
            })
        ).to.deep.equal({
            d: 1,
            c: 1,
            a: { b: [{ c: 1 }] },
        });
    });

    it("handles sequences of forward $refs", () => {
        expect(
            dereference({
                a: { b: [{ c: { $ref: '#/c' } }] },
                c: { $ref: '#/d' },
                d: 1
            })
        ).to.deep.equal({
            a: { b: [{ c: 1 }] },
            c: 1,
            d: 1
        });
    });

    it("handles circular $refs in place", () => {
        const result = dereference({
            a: { b: { $ref: '#/a' } }
        })

        expect(result.a.b).to.equal(result.a);
    });
});