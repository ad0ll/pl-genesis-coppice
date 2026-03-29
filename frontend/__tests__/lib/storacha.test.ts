import { describe, it, expect, vi, afterEach } from "vitest";
import { storachaGatewayUrl, isStorachaConfigured } from "@/lib/storacha";

describe("storachaGatewayUrl", () => {
  it("builds correct gateway URL from IPFS CID", () => {
    const url = storachaGatewayUrl("QmTest123abc");
    expect(url).toBe("https://QmTest123abc.ipfs.w3s.link");
  });

  it("returns null for empty CID", () => {
    expect(storachaGatewayUrl("")).toBeNull();
  });

  it("handles base32 CIDv1", () => {
    const cid = "bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq";
    expect(storachaGatewayUrl(cid)).toBe(`https://${cid}.ipfs.w3s.link`);
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
