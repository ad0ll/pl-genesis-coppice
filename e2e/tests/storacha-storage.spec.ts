import { test, expect } from "@playwright/test";

const MOCK_GUARDIAN_DATA = {
  bondFramework: {
    BondName: "Coppice Green Bond",
    TotalIssuanceAmount: 100000,
    SustainabilityPerformanceTarget: "Avoid 10,000 tCO2e per period",
    EligibleICMACategories: "Renewable Energy",
    ReportingStandard: "ICMA Green Bond Principles (June 2025)",
    BondContractAddress: "0xcFbB4b74EdbEB4FE33cD050d7a1203d1486047d9",
    LCCFContractAddress: "0xC36cd7a8C15B261C1e6D348fB1247D8eCBB8c350",
  },
  bondFrameworkEvidence: {
    hash: "QmBondFrameworkHash123",
    topicId: "0.0.8214934",
    messageId: "0.0.8214934-1234567890-000",
    issuer: "did:hedera:testnet_0.0.8213176",
    issuanceDate: "2026-03-15T00:00:00Z",
    proofType: "Ed25519Signature2018",
  },
  projects: [
    {
      registration: {
        ProjectName: "Sunridge Solar Farm",
        ICMACategory: "Renewable Energy",
        SubCategory: "Solar PV",
        Location: "Berlin, Germany",
        Capacity: 50,
        CapacityUnit: "MW",
      },
      registrationEvidence: {
        hash: "QmRegistrationHash456",
        topicId: "0.0.8214934",
        messageId: "0.0.8214934-1234567891-000",
        issuer: "did:hedera:testnet_0.0.8213176",
        issuanceDate: "2026-03-15T01:00:00Z",
        proofType: "Ed25519Signature2018",
      },
      allocation: {
        AllocatedAmountEUSD: 50000,
        ShareofFinancingPercent: 50,
        ProjectName: "Sunridge Solar Farm",
      },
      allocationEvidence: {
        hash: "QmAllocationHash789",
        topicId: "0.0.8214934",
        messageId: "0.0.8214934-1234567892-000",
        issuer: "did:hedera:testnet_0.0.8213176",
        issuanceDate: "2026-03-16T00:00:00Z",
        proofType: "Ed25519Signature2018",
      },
      isVerified: true,
      verifiedCO2e: 4700,
      verification: { Opinion: "Approved", VerifiedGHGReduced: 4700 },
      verificationEvidence: {
        hash: "QmVerificationHashABC",
        topicId: "0.0.8214934",
        messageId: "0.0.8214934-1234567893-000",
        issuer: "did:hedera:testnet_0.0.456",
        issuanceDate: "2026-03-17T00:00:00Z",
        proofType: "Ed25519Signature2018",
      },
    },
  ],
  totalAllocatedEUSD: 50000,
  totalIssuanceEUSD: 100000,
  allocationPercent: 50,
  totalVerifiedCO2e: 4700,
  sptTarget: 10000,
  sptMet: false,
};

test.describe("Storacha Decentralized Storage", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/guardian/data", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_GUARDIAN_DATA),
      }),
    );
  });

  test("should display Decentralized Storage section on Impact page", async ({ page }) => {
    await page.goto("/impact");
    await expect(page.getByText("Decentralized Storage")).toBeVisible({ timeout: 10000 });
  });

  test("should show correct document count", async ({ page }) => {
    await page.goto("/impact");
    await expect(page.getByText("Decentralized Storage")).toBeVisible({ timeout: 10000 });
    // 1 bond framework + 1 registration + 1 allocation + 1 verification = 4
    const documentsSection = page.locator("section", { hasText: "Decentralized Storage" });
    await expect(documentsSection.locator(".stat-label", { hasText: "Documents" })).toBeVisible();
    await expect(documentsSection.getByText("4")).toBeVisible();
  });

  test("should show IPFS provider and persistence info", async ({ page }) => {
    await page.goto("/impact");
    await expect(page.getByText("Decentralized Storage")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".stat-label", { hasText: "IPFS Provider" })).toBeVisible();
    await expect(page.locator(".stat-label", { hasText: "Persistence" })).toBeVisible();
  });

  test("should show archived documents list", async ({ page }) => {
    await page.goto("/impact");
    await expect(page.getByText("Decentralized Storage")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Archived Documents")).toBeVisible();
    await expect(page.getByText("Bond Framework")).toBeVisible();
    await expect(page.getByText(/Sunridge Solar Farm — Registration/)).toBeVisible();
  });

  test("should show data integrity chain description", async ({ page }) => {
    await page.goto("/impact");
    await expect(page.getByText("Decentralized Storage")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Data integrity chain/)).toBeVisible();
    await expect(page.getByText(/Hedera HCS/)).toBeVisible();
  });
});
