// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GuardianData, VCEvidence } from "@/lib/guardian-types";

// Mock react-query
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

// Mock storacha module
vi.mock("@/lib/storacha", () => ({
  isStorachaConfigured: vi.fn(),
  storachaGatewayUrl: vi.fn(),
}));

import { useQuery } from "@tanstack/react-query";
import { isStorachaConfigured, storachaGatewayUrl } from "@/lib/storacha";
import { StorageStatusCard } from "@/components/filecoin/storage-status-card";

const mockEvidence: VCEvidence = {
  hash: "QmTestHash123456789",
  topicId: "0.0.123",
  messageId: "0.0.123-1234567890-000",
  issuer: "did:hedera:testnet_0.0.456",
  issuanceDate: "2026-03-29T12:00:00Z",
  proofType: "Ed25519Signature2018",
};

function buildGuardianData(projectCount: number): GuardianData {
  const projects = Array.from({ length: projectCount }, (_, i) => ({
    registration: { ProjectName: `Project ${i + 1}`, ICMACategory: "Renewable Energy", SubCategory: "Solar", Country: "DE", Location: "Berlin", Capacity: 100, CapacityUnit: "MW", ProjectLifetimeYears: 25, AnnualTargetCO2e: 5000 },
    registrationEvidence: { ...mockEvidence, hash: `QmReg${i}` },
    allocationEvidence: { ...mockEvidence, hash: `QmAlloc${i}` },
    allocation: { ProjectName: `Project ${i + 1}`, SignedAmountEUSD: 100000, AllocatedAmountEUSD: 50000, ShareofFinancingPercent: 50, AllocationDate: "2026-03-01", Purpose: "Solar farm", HederaTransactionID: "0.0.1-123-000" },
    isVerified: false,
    verifiedCO2e: 0,
    createDate: "2026-03-01T00:00:00Z",
  }));
  return {
    bondFramework: { BondName: "CPC", BondSymbol: "CPC", ISIN: "XS0000000009", Issuer: "Coppice", Currency: "eUSD", TotalIssuanceAmount: 1000000, CouponRate: "4.25%", MaturityDate: "2028-03-15", CouponStepUpBps: 50, SustainabilityPerformanceTarget: "5000 tCO2e", EligibleICMACategories: "Renewable Energy", ReportingStandard: "ICMA GBP 2021", BondContractAddress: "0x123", LCCFContractAddress: "0x456" },
    bondFrameworkEvidence: { ...mockEvidence, hash: "QmBondFramework" },
    projects,
    totalAllocatedEUSD: 50000 * projectCount,
    totalIssuanceEUSD: 1000000,
    allocationPercent: (50000 * projectCount) / 10000,
    totalVerifiedCO2e: 0,
    sptTarget: 5000,
    sptMet: false,
  };
}

describe("StorageStatusCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Decentralized Storage' heading", () => {
    const guardianData = buildGuardianData(1);
    vi.mocked(useQuery).mockReturnValue({ data: guardianData, isLoading: false, error: null } as ReturnType<typeof useQuery>);
    vi.mocked(isStorachaConfigured).mockReturnValue(true);
    vi.mocked(storachaGatewayUrl).mockImplementation((cid) => `/api/guardian/ipfs/${cid}`);

    render(<StorageStatusCard />);
    expect(screen.getByText("Decentralized Storage")).toBeInTheDocument();
  });

  it("shows correct document count (bond framework + 2 evidence per project)", () => {
    const guardianData = buildGuardianData(2);
    vi.mocked(useQuery).mockReturnValue({ data: guardianData, isLoading: false, error: null } as ReturnType<typeof useQuery>);
    vi.mocked(isStorachaConfigured).mockReturnValue(true);
    vi.mocked(storachaGatewayUrl).mockImplementation((cid) => `/api/guardian/ipfs/${cid}`);

    render(<StorageStatusCard />);
    // 1 bond framework + 2 projects * 2 evidence each (reg + alloc) = 5
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows 'Storacha' as IPFS provider when configured", () => {
    const guardianData = buildGuardianData(1);
    vi.mocked(useQuery).mockReturnValue({ data: guardianData, isLoading: false, error: null } as ReturnType<typeof useQuery>);
    vi.mocked(isStorachaConfigured).mockReturnValue(true);
    vi.mocked(storachaGatewayUrl).mockImplementation((cid) => `/api/guardian/ipfs/${cid}`);

    render(<StorageStatusCard />);
    expect(screen.getByText("Storacha")).toBeInTheDocument();
    expect(screen.getByText("Filecoin Mainnet")).toBeInTheDocument();
  });

  it("shows 'Local Node' when Storacha not configured", () => {
    const guardianData = buildGuardianData(1);
    vi.mocked(useQuery).mockReturnValue({ data: guardianData, isLoading: false, error: null } as ReturnType<typeof useQuery>);
    vi.mocked(isStorachaConfigured).mockReturnValue(false);

    render(<StorageStatusCard />);
    expect(screen.getByText("Local Node")).toBeInTheDocument();
    expect(screen.getByText("Guardian IPFS")).toBeInTheDocument();
  });

  it("renders View links when Storacha is configured", () => {
    const guardianData = buildGuardianData(1);
    vi.mocked(useQuery).mockReturnValue({ data: guardianData, isLoading: false, error: null } as ReturnType<typeof useQuery>);
    vi.mocked(isStorachaConfigured).mockReturnValue(true);
    vi.mocked(storachaGatewayUrl).mockImplementation((cid) => `/api/guardian/ipfs/${cid}`);

    render(<StorageStatusCard />);
    const viewLinks = screen.getAllByText("View");
    expect(viewLinks.length).toBeGreaterThan(0);
    expect(viewLinks[0].closest("a")).toHaveAttribute("href", "/api/guardian/ipfs/QmBondFramework");
  });

  it("renders zero documents when no Guardian data", () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: false, error: null } as ReturnType<typeof useQuery>);
    vi.mocked(isStorachaConfigured).mockReturnValue(true);

    render(<StorageStatusCard />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
