import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock constants
vi.mock("@/lib/constants", () => ({
  CDM_GUARDIAN_API_URL: "http://mock-cdm-guardian:3200",
  CDM_GUARDIAN_POLICY_ID: "test-cdm-policy-id",
  CDM_CER_TOKEN_ID: "0.0.9999999",
  MIRROR_NODE_URL: "https://testnet.mirrornode.hedera.com",
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const originalEnv = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env = {
    ...originalEnv,
    CDM_GUARDIAN_SR_USERNAME: "TestSR",
    CDM_GUARDIAN_SR_PASSWORD: "TestSR2026!",
  };
});

function makeCDMProjectVC(overrides?: Partial<{
  description: string;
  methodology: string;
  technology: string;
  participant: string;
  lat: string;
  lon: string;
  netMWh: number;
  status: string;
}>) {
  return {
    hash: "cdmHash123",
    topicId: "0.0.8350506",
    messageId: "1774305412.468656513",
    type: "project",
    option: { status: overrides?.status ?? "Validated" },
    document: {
      credentialSubject: [
        {
          field0: {
            field0: overrides?.description ?? "50MW solar PV plant in Nairobi",
            field2: [overrides?.technology ?? "Solar PV"],
            field5: overrides?.lat ?? "-1.2921",
            field6: overrides?.lon ?? "36.8219",
            field9: overrides?.participant ?? "Sunridge Solar Ltd",
            field18: [overrides?.methodology ?? "AMS-I.F: Renewable electricity generation"],
            field19: "2026-01-01",
            field20: [{ field0: "2026-01-01", field1: "2033-12-31" }],
            field21: [{ field0: "2026-01-01", field1: "2026-12-31" }],
            field22: "Monthly meter readings",
            field24: "SDG 7, SDG 13",
          },
          field1: "Other Systems",
          field2: "Other Renewable Energy",
          field11: overrides?.netMWh ?? 4200,
          field12: 0,
        },
      ],
      issuer: "did:hedera:testnet:mock_0.0.8350437",
      issuanceDate: "2026-03-23T22:36:50.519Z",
      proof: {
        type: "Ed25519Signature2018",
        created: "2026-03-23T22:36:50.519Z",
        verificationMethod: "did:hedera:testnet:mock#key",
        proofPurpose: "assertionMethod",
        jws: "mock-jws",
      },
    },
  };
}

function mockCDMResponses(overrides?: {
  projects?: ReturnType<typeof makeCDMProjectVC>[];
  policyName?: string;
  cerTokenOk?: boolean;
}) {
  const projects = overrides?.projects ?? [makeCDMProjectVC()];

  mockFetch.mockImplementation((url: string) => {
    const urlStr = typeof url === "string" ? url : "";

    // Login
    if (urlStr.includes("/accounts/login")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ refreshToken: "mock-refresh" }),
      });
    }

    // Token exchange
    if (urlStr.includes("/accounts/access-token")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ accessToken: "mock-token" }),
      });
    }

    // Project grid (SR view)
    if (urlStr.includes("project_grid_sr")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: projects }),
      });
    }

    // Policy metadata
    if (urlStr.includes("/policies/") && !urlStr.includes("/tag/")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            name: overrides?.policyName ?? "CDM AMS-I.F Policy",
            topicId: "0.0.8350456",
          }),
      });
    }

    // CER token info from Mirror Node
    if (urlStr.includes("/tokens/0.0.9999999/nfts")) {
      return Promise.resolve({
        ok: overrides?.cerTokenOk !== false,
        json: () => Promise.resolve({ nfts: [] }),
      });
    }
    if (urlStr.includes("/tokens/0.0.9999999")) {
      return Promise.resolve({
        ok: overrides?.cerTokenOk !== false,
        json: () =>
          Promise.resolve({
            name: "CER",
            symbol: "CER",
            total_supply: "0",
          }),
      });
    }

    return Promise.resolve({ ok: false, status: 404 });
  });
}

describe("GET /api/guardian/cdm", () => {
  it("returns CDM project data from Guardian Instance 2", async () => {
    mockCDMResponses();
    const { GET } = await import("@/app/api/guardian/cdm/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].projectParticipant).toBe("Sunridge Solar Ltd");
    expect(data.projects[0].methodology).toBe("AMS-I.F: Renewable electricity generation");
    expect(data.projects[0].technology).toBe("Solar PV");
    expect(data.projects[0].netElectricityMWh).toBe(4200);
    expect(data.projects[0].location.lat).toBeCloseTo(-1.2921);
    expect(data.projects[0].location.lon).toBeCloseTo(36.8219);
    expect(data.projects[0].status).toBe("Validated");
  });

  it("includes VC evidence metadata", async () => {
    mockCDMResponses();
    const { GET } = await import("@/app/api/guardian/cdm/route");
    const res = await GET();
    const data = await res.json();

    expect(data.projects[0].evidence.hash).toBe("cdmHash123");
    expect(data.projects[0].evidence.topicId).toBe("0.0.8350506");
    expect(data.projects[0].evidence.issuer).toContain("did:hedera:testnet:");
    expect(data.projects[0].evidence.proofType).toBe("Ed25519Signature2018");
  });

  it("deduplicates projects by participant name", async () => {
    mockCDMResponses({
      projects: [
        makeCDMProjectVC({ participant: "Sunridge Solar Ltd" }),
        makeCDMProjectVC({ participant: "Sunridge Solar Ltd", netMWh: 9999 }),
      ],
    });
    const { GET } = await import("@/app/api/guardian/cdm/route");
    const res = await GET();
    const data = await res.json();

    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].netElectricityMWh).toBe(4200); // first one wins
  });

  it("returns multiple distinct projects", async () => {
    mockCDMResponses({
      projects: [
        makeCDMProjectVC({ participant: "Sunridge Solar Ltd" }),
        makeCDMProjectVC({ participant: "WindPower Kenya", technology: "Wind", netMWh: 8000 }),
      ],
    });
    const { GET } = await import("@/app/api/guardian/cdm/route");
    const res = await GET();
    const data = await res.json();

    expect(data.projects).toHaveLength(2);
    expect(data.projects[1].projectParticipant).toBe("WindPower Kenya");
    expect(data.projects[1].technology).toBe("Wind");
  });

  it("includes CER token info from Mirror Node", async () => {
    mockCDMResponses();
    const { GET } = await import("@/app/api/guardian/cdm/route");
    const res = await GET();
    const data = await res.json();

    expect(data.cerToken).toBeTruthy();
    expect(data.cerToken.tokenId).toBe("0.0.9999999");
    expect(data.cerToken.tokenSymbol).toBe("CER");
    expect(data.cerToken.nftsMinted).toBe(0);
  });

  it("returns cerToken null when Mirror Node fails", async () => {
    mockCDMResponses({ cerTokenOk: false });
    const { GET } = await import("@/app/api/guardian/cdm/route");
    const res = await GET();
    const data = await res.json();

    expect(data.cerToken).toBeNull();
  });

  it("includes policy metadata", async () => {
    mockCDMResponses({ policyName: "Custom CDM Policy" });
    const { GET } = await import("@/app/api/guardian/cdm/route");
    const res = await GET();
    const data = await res.json();

    expect(data.policyName).toBe("Custom CDM Policy");
    expect(data.policyTopicId).toBe("0.0.8350456");
  });

  it("returns 503 when Guardian login fails", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/accounts/login")) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    const { GET } = await import("@/app/api/guardian/cdm/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("CDM Guardian API unavailable");
  });

  it("returns empty projects when grid returns no data", async () => {
    mockCDMResponses({ projects: [] });
    const { GET } = await import("@/app/api/guardian/cdm/route");
    const res = await GET();
    const data = await res.json();

    expect(data.projects).toHaveLength(0);
    expect(data.reports).toHaveLength(0);
  });
});
