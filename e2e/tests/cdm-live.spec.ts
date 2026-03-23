import { test, expect } from "@playwright/test";

/**
 * CDM Guardian E2E tests — run against the real CDM Guardian Instance 2.
 * These tests verify end-to-end integration: Next.js API route → Guardian API
 * → real VC documents → Hedera testnet.
 *
 * Prerequisites:
 *   - Frontend dev server running
 *   - CDM Guardian Instance 2 accessible (CDM_GUARDIAN_API_URL in .env)
 *   - CDM policy populated with demo data (scripts/guardian/cdm-populate.ts)
 *
 * Run:
 *   npx playwright test cdm-live
 */
test.describe("CDM Guardian Live Integration", () => {
  test.describe.configure({ mode: "serial" });

  let cdmAvailable = false;

  test("CDM API route is reachable", async ({ request }) => {
    try {
      const response = await request.get("/api/guardian/cdm", { timeout: 20000 });
      if (response.status() !== 200) {
        test.skip(true, `CDM API unavailable (status ${response.status()})`);
        return;
      }
      const data = await response.json();
      expect(data).toHaveProperty("projects");
      expect(data).toHaveProperty("policyName");
      cdmAvailable = true;
    } catch {
      test.skip(true, "CDM API request timed out");
    }
  });

  test("CDM API returns valid project data", async ({ request }) => {
    test.skip(!cdmAvailable, "CDM API unavailable");
    const response = await request.get("/api/guardian/cdm", { timeout: 15000 });
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.projects.length).toBeGreaterThanOrEqual(1);
    expect(data.policyName).toContain("CDM");

    const project = data.projects[0];
    expect(project.projectParticipant).toBeTruthy();
    expect(project.methodology).toContain("AMS-I.F");
    expect(project.technology).toBeTruthy();
    expect(project.netElectricityMWh).toBeGreaterThan(0);
    expect(project.location.lat).not.toBe(0);
    expect(project.location.lon).not.toBe(0);
  });

  test("CDM API returns VC evidence with Hedera anchoring", async ({ request }) => {
    test.skip(!cdmAvailable, "CDM API unavailable");
    const response = await request.get("/api/guardian/cdm", { timeout: 15000 });
    const data = await response.json();

    const evidence = data.projects[0].evidence;
    expect(evidence.hash).toBeTruthy();
    expect(evidence.topicId).toMatch(/^0\.0\.\d+$/);
    expect(evidence.messageId).toMatch(/^\d+\.\d+$/);
    expect(evidence.issuer).toContain("did:hedera:testnet:");
    expect(evidence.proofType).toBe("Ed25519Signature2018");
  });

  test("CDM API returns CER token info from Mirror Node", async ({ request }) => {
    test.skip(!cdmAvailable, "CDM API unavailable");
    const response = await request.get("/api/guardian/cdm", { timeout: 15000 });
    const data = await response.json();

    expect(data.cerToken).toBeTruthy();
    expect(data.cerToken.tokenId).toMatch(/^0\.0\.\d+$/);
    expect(data.cerToken.tokenSymbol).toBeTruthy();
    expect(typeof data.cerToken.nftsMinted).toBe("number");
  });

  test("Impact page renders Dual Trust Chain section", async ({ page }) => {
    test.skip(!cdmAvailable, "CDM API unavailable");
    await page.goto("/impact");

    // Wait for CDM data to load
    await expect(page.getByText("Dual Trust Chain")).toBeVisible({ timeout: 20000 });

    // Trust chain diagram nodes
    await expect(page.getByText("Bond Issuance")).toBeVisible();
    await expect(page.getByText("CDM Methodology")).toBeVisible();
    await expect(page.getByText("Hedera Testnet", { exact: true }).first()).toBeVisible();

    // Policy badge
    await expect(page.getByText(/CDM AMS-I\.F/)).toBeVisible();
  });

  test("Impact page shows CDM project card with real data", async ({ page }) => {
    test.skip(!cdmAvailable, "CDM API unavailable");
    await page.goto("/impact");

    await expect(page.getByText("Dual Trust Chain")).toBeVisible({ timeout: 20000 });

    // Should show at least one CDM project heading
    await expect(page.getByText(/CDM Verified Projects/)).toBeVisible();

    // Project card details
    await expect(page.getByText("Solar PV").last()).toBeVisible();
    await expect(page.getByText("AMS-I.F", { exact: true })).toBeVisible();
    await expect(page.getByText(/\d+,?\d* MWh/)).toBeVisible();
  });

  test("CDM project card expands to show VC evidence", async ({ page }) => {
    test.skip(!cdmAvailable, "CDM API unavailable");
    await page.goto("/impact");

    await expect(page.getByText("Dual Trust Chain")).toBeVisible({ timeout: 20000 });

    // Click "View VC Evidence" on the CDM project card
    const evidenceButton = page.getByText("View VC Evidence");
    await expect(evidenceButton).toBeVisible();
    await evidenceButton.click();

    // Evidence section should expand
    await expect(page.getByText("CDM Project Registration")).toBeVisible();
    await expect(page.getByText("Hide Evidence")).toBeVisible();
  });

  test("CER Token links to HashScan", async ({ page }) => {
    test.skip(!cdmAvailable, "CDM API unavailable");
    await page.goto("/impact");

    await expect(page.getByText("Dual Trust Chain")).toBeVisible({ timeout: 20000 });

    const cerLink = page.getByRole("link", { name: "CER Token" });
    await expect(cerLink).toBeVisible();
    const href = await cerLink.getAttribute("href");
    expect(href).toContain("hashscan.io/testnet/token/");
  });
});
