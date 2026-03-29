import { describe, it, expect, afterEach } from "vitest";
import { storachaGatewayUrl, isStorachaConfigured } from "@/lib/storacha";

describe("storachaGatewayUrl", () => {
  it("builds correct proxy URL from IPFS CID", () => {
    const url = storachaGatewayUrl("QmTest123abc");
    expect(url).toBe("/api/guardian/ipfs/QmTest123abc");
  });

  it("returns null for empty CID", () => {
    expect(storachaGatewayUrl("")).toBeNull();
  });

  it("handles base58btc multihash from Guardian", () => {
    const cid = "9rCGZCnJeUJhpmoBqgrTMCWCJiApXreyJGhjYm9bW3p6";
    expect(storachaGatewayUrl(cid)).toBe(`/api/guardian/ipfs/${cid}`);
  });
});

describe("isStorachaConfigured", () => {
  const originalEnv = process.env.NEXT_PUBLIC_STORACHA_ENABLED;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_STORACHA_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_STORACHA_ENABLED = originalEnv;
    }
  });

  it("returns true when env var is 'true'", () => {
    process.env.NEXT_PUBLIC_STORACHA_ENABLED = "true";
    expect(isStorachaConfigured()).toBe(true);
  });

  it("returns false when env var is 'false'", () => {
    process.env.NEXT_PUBLIC_STORACHA_ENABLED = "false";
    expect(isStorachaConfigured()).toBe(false);
  });

  it("returns false when env var is not set", () => {
    delete process.env.NEXT_PUBLIC_STORACHA_ENABLED;
    expect(isStorachaConfigured()).toBe(false);
  });
});
