// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

const mockUseGuardianCDM = vi.fn();
vi.mock("@/hooks/use-guardian-cdm", () => ({
  useGuardianCDM: () => mockUseGuardianCDM(),
}));

import { DualTrustChain } from "@/components/guardian/dual-trust-chain";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

const MOCK_CDM_DATA = {
  projects: [
    {
      description: "50MW solar PV plant in Nairobi",
      methodology: "AMS-I.F: Renewable electricity generation",
      technology: "Solar PV",
      projectParticipant: "Sunridge Solar Ltd",
      location: { lat: -1.2921, lon: 36.8219 },
      startDate: "2026-01-01",
      creditingPeriod: { start: "2026-01-01", end: "2033-12-31" },
      monitoringPeriod: { start: "2026-01-01", end: "2026-12-31" },
      netElectricityMWh: 4200,
      sdgContributions: "SDG 7 (Affordable and Clean Energy), SDG 13 (Climate Action)",
      status: "Validated",
      evidence: {
        hash: "cdmHash123",
        topicId: "0.0.8350506",
        messageId: "1774305412.468656513",
        issuer: "did:hedera:testnet:mock",
        issuanceDate: "2026-03-23T22:36:50.519Z",
        proofType: "Ed25519Signature2018",
      },
    },
  ],
  reports: [
    {
      description: "Monitoring report for Q1 2026",
      monitoringPeriod: { start: "2026-01-01", end: "2026-03-31" },
      netElectricityMWh: 1050,
      monitoringPlan: "Monthly meter readings",
      status: "Verified",
      evidence: {
        hash: "reportHash456",
        topicId: "0.0.8350506",
        messageId: "1774305500.000000000",
        issuer: "did:hedera:testnet:mock",
        issuanceDate: "2026-03-23T23:00:00.000Z",
        proofType: "Ed25519Signature2018",
      },
    },
  ],
  cerToken: {
    tokenId: "0.0.8350484",
    tokenName: "CER",
    tokenSymbol: "CER",
    nftsMinted: 0,
  },
  policyName: "CDM AMS-I.F Policy",
  policyTopicId: "0.0.8350456",
};

describe("DualTrustChain", () => {
  it("shows loading skeleton while data loads", () => {
    mockUseGuardianCDM.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { container } = render(<DualTrustChain />, { wrapper });
    expect(container.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThan(0);
  });

  it("shows error message when CDM Guardian is unavailable", () => {
    mockUseGuardianCDM.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("CDM Guardian API returned 503"),
    });
    render(<DualTrustChain />, { wrapper });
    expect(screen.getByText(/CDM Guardian data unavailable/)).toBeInTheDocument();
  });

  it("renders section heading and policy name badge", () => {
    mockUseGuardianCDM.mockReturnValue({ data: MOCK_CDM_DATA, isLoading: false, error: null });
    render(<DualTrustChain />, { wrapper });
    expect(screen.getByText("Dual Trust Chain")).toBeInTheDocument();
    expect(screen.getByText("CDM AMS-I.F Policy")).toBeInTheDocument();
  });

  it("renders trust chain diagram with three nodes", () => {
    mockUseGuardianCDM.mockReturnValue({ data: MOCK_CDM_DATA, isLoading: false, error: null });
    render(<DualTrustChain />, { wrapper });
    expect(screen.getByText("Bond Issuance")).toBeInTheDocument();
    expect(screen.getByText("CDM Methodology")).toBeInTheDocument();
    expect(screen.getByText("Hedera Testnet")).toBeInTheDocument();
  });

  it("shows CER token details", () => {
    mockUseGuardianCDM.mockReturnValue({ data: MOCK_CDM_DATA, isLoading: false, error: null });
    render(<DualTrustChain />, { wrapper });
    expect(screen.getByText("CER")).toBeInTheDocument();
    expect(screen.getByText("0.0.8350484")).toBeInTheDocument();
  });

  it("renders CDM project card with details", () => {
    mockUseGuardianCDM.mockReturnValue({ data: MOCK_CDM_DATA, isLoading: false, error: null });
    render(<DualTrustChain />, { wrapper });
    expect(screen.getByText("Sunridge Solar Ltd")).toBeInTheDocument();
    expect(screen.getByText("Solar PV")).toBeInTheDocument();
    expect(screen.getByText("Validated")).toBeInTheDocument();
    expect(screen.getByText(/4,200/)).toBeInTheDocument();
  });

  it("renders monitoring report card", () => {
    mockUseGuardianCDM.mockReturnValue({ data: MOCK_CDM_DATA, isLoading: false, error: null });
    render(<DualTrustChain />, { wrapper });
    expect(screen.getByText("Monitoring Report")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText(/1,050/)).toBeInTheDocument();
  });

  it("shows project count in section heading", () => {
    mockUseGuardianCDM.mockReturnValue({ data: MOCK_CDM_DATA, isLoading: false, error: null });
    render(<DualTrustChain />, { wrapper });
    expect(screen.getByText("CDM Verified Projects (1)")).toBeInTheDocument();
    expect(screen.getByText("Monitoring Reports (1)")).toBeInTheDocument();
  });

  it("toggles VC evidence on project card", () => {
    mockUseGuardianCDM.mockReturnValue({ data: MOCK_CDM_DATA, isLoading: false, error: null });
    render(<DualTrustChain />, { wrapper });

    const button = screen.getByText("View VC Evidence");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(screen.getByText("Hide Evidence")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/CDM Project Registration/)).toBeInTheDocument();
  });

  it("hides project/report sections when empty", () => {
    mockUseGuardianCDM.mockReturnValue({
      data: { ...MOCK_CDM_DATA, projects: [], reports: [] },
      isLoading: false,
      error: null,
    });
    render(<DualTrustChain />, { wrapper });
    expect(screen.queryByText(/CDM Verified Projects/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Monitoring Reports/)).not.toBeInTheDocument();
  });

  it("links CER Token to HashScan", () => {
    mockUseGuardianCDM.mockReturnValue({ data: MOCK_CDM_DATA, isLoading: false, error: null });
    render(<DualTrustChain />, { wrapper });
    const link = screen.getByRole("link", { name: "CER Token" });
    expect(link).toHaveAttribute("href", "https://hashscan.io/testnet/token/0.0.8350484");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
