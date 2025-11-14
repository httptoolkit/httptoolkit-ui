import { expect } from "chai";

import {
  PROXY_HOST_REGEXES,
  normalizeProxyHost,
  CRED_PATTERN,
} from "../../../../src/model/http/proxy";

describe("Proxy host regexes and normalization", () => {
  describe("CRED_PATTERN", () => {
    const credRegex = new RegExp(`^${CRED_PATTERN}$`);

    it("matches valid username", () => {
      expect(credRegex.test("user")).to.be.true;
    });

    it("matches username with dots, underscores, commas, plus, and minus", () => {
      expect(credRegex.test("user_123,type_residential.tag+info-v1")).to.be
        .true;
    });

    it("does not match if contains @", () => {
      expect(credRegex.test("user@name")).to.be.false;
    });

    it("does not match if contains /", () => {
      expect(credRegex.test("user/name")).to.be.false;
    });

    it("does not match if contains :", () => {
      expect(credRegex.test("user:name")).to.be.false;
    });

    it("does not match empty string", () => {
      expect(credRegex.test("")).to.be.false;
    });
  });

  describe("PROXY_HOST_REGEXES", () => {
    it("case 0 matches host", () => {
      expect(PROXY_HOST_REGEXES[0].test("example.com")).to.be.true;
    });

    it("case 0 matches host:port", () => {
      expect(PROXY_HOST_REGEXES[0].test("example.com:8080")).to.be.true;
    });

    it("case 1 matches user:pass@host:port", () => {
      expect(PROXY_HOST_REGEXES[1].test("user:pass@example.com:8080")).to.be
        .true;
    });

    it("case 1 matches user@host:port (no password)", () => {
      expect(PROXY_HOST_REGEXES[1].test("user@example.com:8080")).to.be.true;
    });

    it("case 1 matches user:pass@host (no port)", () => {
      expect(PROXY_HOST_REGEXES[1].test("user:pass@example.com")).to.be.true;
    });

    it("case 1 matches user@host (no password and no port)", () => {
      expect(PROXY_HOST_REGEXES[1].test("user@example.com")).to.be.true;
    });

    it("case 1 matches username with allowed special characters", () => {
      expect(
        PROXY_HOST_REGEXES[1].test(
          "user_123,type_residential:pass@example.com:8080"
        )
      ).to.be.true;
    });

    it("case 2 matches host:port@user:pass", () => {
      expect(PROXY_HOST_REGEXES[2].test("example.com:8080@user:pass")).to.be
        .true;
    });

    it("case 3 matches host:port:user:pass", () => {
      expect(PROXY_HOST_REGEXES[3].test("example.com:8080:user:pass")).to.be
        .true;
    });

    it("case 4 matches user:pass:host:port", () => {
      expect(PROXY_HOST_REGEXES[4].test("user:pass:example.com:8080")).to.be
        .true;
    });
  });

  describe("normalizeProxyHost", () => {
    it("keeps host unchanged (no credentials and no port)", () => {
      const result = normalizeProxyHost("example.com");
      expect(result).to.equal("example.com");
    });

    it("keeps host:port unchanged", () => {
      const result = normalizeProxyHost("example.com:8080");
      expect(result).to.equal("example.com:8080");
    });

    it("keeps user:pass@host:port unchanged", () => {
      const result = normalizeProxyHost("user:pass@example.com:8080");
      expect(result).to.equal("user:pass@example.com:8080");
    });

    it("keeps user@host:port unchanged (no password)", () => {
      const result = normalizeProxyHost("user@example.com:8080");
      expect(result).to.equal("user@example.com:8080");
    });

    it("keeps user:pass@host unchanged (no port)", () => {
      const result = normalizeProxyHost("user:pass@example.com");
      expect(result).to.equal("user:pass@example.com");
    });

    it("keeps user@host unchanged (no password and no port)", () => {
      const result = normalizeProxyHost("user@example.com");
      expect(result).to.equal("user@example.com");
    });

    it("converts host:port@user:pass to standard format", () => {
      const result = normalizeProxyHost("example.com:8080@user:pass");
      expect(result).to.equal("user:pass@example.com:8080");
    });

    it("converts host:port:user:pass to standard format", () => {
      const result = normalizeProxyHost("example.com:8080:user:pass");
      expect(result).to.equal("user:pass@example.com:8080");
    });

    it("converts user:pass:host:port to standard format", () => {
      const result = normalizeProxyHost("user:pass:example.com:8080");
      expect(result).to.equal("user:pass@example.com:8080");
    });

    it("normalizes complex example", () => {
      const result = normalizeProxyHost(
        "proxy.domain.com:1234:user_12345,type_residential,session_123:pass"
      );
      expect(result).to.equal(
        "user_12345,type_residential,session_123:pass@proxy.domain.com:1234"
      );
    });

    it("throws for too many colons in user:pass:host:port format", () => {
      expect(() =>
        normalizeProxyHost(
          "user_12345,type_residential,session_123:pass:proxy.host.com:1234:extra"
        )
      ).to.throw("Proxy format does not match expected patterns");
    });

    it("throws for too many @ in host:port@user:pass format", () => {
      expect(() =>
        normalizeProxyHost(
          "user_12345,type_residential,session_123:pass@proxy.host.com@1234"
        )
      ).to.throw("Proxy format does not match expected patterns");
    });

    it("throws when host contains protocol (e.g. https://)", () => {
      expect(() =>
        normalizeProxyHost(
          "user_12345,type_residential,session_123:pass:https://proxy.host.com:1080"
        )
      ).to.throw("Proxy format does not match expected patterns");
    });

    it("throws for invalid format", () => {
      expect(() => normalizeProxyHost("not a valid proxy")).to.throw(
        "Proxy format does not match expected patterns"
      );
    });
  });
});
