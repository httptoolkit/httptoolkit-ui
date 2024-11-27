import { expect } from "../../test-setup";

import { getReadableIP } from "../../../src/model/network";

describe("IP formatting", () => {
    it("should return unrecognized ips untouched", () => {
        expect(getReadableIP('93.184.216.34')).to.equal('93.184.216.34');
    });

    it("should mark local network IPv4s", () => {
        expect(getReadableIP('10.0.0.1')).to.equal('10.0.0.1 (a local network device)');
    });

    it("should mark IPv4 localhost addresses", () => {
        expect(getReadableIP('127.1.1.1')).to.equal('127.1.1.1 (this machine)');
        expect(getReadableIP('127.0.0.1')).to.equal('127.0.0.1 (this machine)');
    });

    it("should mark IPv6 localhost addresses", () => {
        expect(getReadableIP('::1')).to.equal('0:0:0:0:0:0:0:1 (this machine)');
        expect(getReadableIP('::ffff:127.0.0.1')).to.equal('127.0.0.1 (this machine)');
    });

    it("should return IPv6 mapped address as IPv4", () => {
        expect(getReadableIP('::ffff:10.0.0.1')).to.equal('10.0.0.1 (a local network device)');
    });

    it("should return full IPv6 addresses untouched", () => {
        expect(
            getReadableIP('fe80:1:2:3:42:abff:fe08:7e77')
        ).to.equal('fe80:1:2:3:42:abff:fe08:7e77 (link local)');
    });

    it("should normalize shortened IPv6 addresses", () => {
        expect(
            getReadableIP('fc00::7e77')
        ).to.equal('fc00:0:0:0:0:0:0:7e77 (a local network device)');
    });
});