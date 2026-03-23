// Quick verification of CDM workflow state
// Run: cd scripts && npx tsx guardian/cdm-verify.ts

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { GuardianClient } from "./api-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.cdm") });

async function main() {
  const baseUrl = process.env.GUARDIAN_API_URL;
  const policyId = process.env.GUARDIAN_POLICY_ID;
  if (!baseUrl || !policyId) throw new Error("Missing env vars");

  const client = new GuardianClient(baseUrl);
  await client.login(
    process.env.GUARDIAN_SR_USERNAME!,
    process.env.GUARDIAN_SR_PASSWORD!,
  );

  console.log("=== CDM Verification ===\n");

  // VP grid
  const vpGrid = await client.get<{ data?: unknown[] }>(
    `/api/v1/policies/${policyId}/tag/vp_grid/blocks`,
  );
  const vpCount = Array.isArray(vpGrid?.data) ? vpGrid.data.length : 0;
  console.log(`VP grid: ${vpCount} documents`);
  if (vpGrid?.data?.length) {
    console.log(`VP[0]: ${JSON.stringify(vpGrid.data[0]).slice(0, 500)}\n`);
  }

  // Tokens
  const tokens = await client.get<unknown[]>("/api/v1/tokens");
  console.log(`Tokens: ${JSON.stringify(tokens).slice(0, 500)}\n`);

  // Project grid
  const projectGrid = await client.get<{ data?: unknown[] }>(
    `/api/v1/policies/${policyId}/tag/project_grid_sr/blocks`,
  );
  const projCount = Array.isArray(projectGrid?.data) ? projectGrid.data.length : 0;
  console.log(`Project grid: ${projCount} documents`);

  // Report grid
  const reportGrid = await client.get<{ data?: unknown[] }>(
    `/api/v1/policies/${policyId}/tag/report_grid_sr/blocks`,
  );
  const repCount = Array.isArray(reportGrid?.data) ? reportGrid.data.length : 0;
  console.log(`Report grid (SR): ${repCount} documents`);
  if (reportGrid?.data?.length) {
    console.log(`Report[0]: ${JSON.stringify(reportGrid.data[0]).slice(0, 300)}`);
  }

  // Check if project_grid_sr returns full VC data
  if (projectGrid?.data?.length) {
    const proj = projectGrid.data[0] as Record<string, unknown>;
    console.log(`\nProject VC keys: ${Object.keys(proj).join(", ")}`);
    const doc = proj.document as { credentialSubject?: unknown[] } | undefined;
    if (doc?.credentialSubject?.length) {
      const cs = doc.credentialSubject[0] as Record<string, unknown>;
      const details = cs.field0 as Record<string, unknown> | undefined;
      console.log(`  CS field0.field0 (description): ${String(details?.field0).slice(0, 100)}`);
      console.log(`  CS field0.field9 (PP name): ${details?.field9}`);
      console.log(`  CS field0.field18 (methodology): ${JSON.stringify(details?.field18)}`);
    }
    console.log(`  hash: ${proj.hash}`);
    console.log(`  topicId: ${proj.topicId}`);
    console.log(`  messageId: ${proj.messageId}`);
  }

  // Check trust chain
  try {
    const trustChain = await client.get<unknown>(
      `/api/v1/policies/${policyId}/tag/trust_chain/blocks`,
    );
    console.log(`\nTrust chain: ${JSON.stringify(trustChain).slice(0, 500)}`);
  } catch {
    console.log("\nTrust chain block not available");
  }

  // Check PP report grid - also dump filter addons and full structure
  const ppClient = new GuardianClient(baseUrl);
  await ppClient.login(
    process.env.GUARDIAN_PP_USERNAME!,
    process.env.GUARDIAN_PP_PASSWORD!,
  );
  const ppReportGrid = await ppClient.get<{ data?: unknown[]; blocks?: unknown[] }>(
    `/api/v1/policies/${policyId}/tag/report_grid_pp/blocks`,
  );
  const ppRepCount = Array.isArray(ppReportGrid?.data) ? ppReportGrid.data.length : 0;
  console.log(`\nReport grid (PP): ${ppRepCount} documents`);
  console.log(`  Full grid structure: ${JSON.stringify(ppReportGrid).slice(0, 1000)}`);
  if (ppReportGrid?.data?.length) {
    for (const doc of ppReportGrid.data) {
      const d = doc as { option?: { status?: string }; createDate?: string };
      console.log(`  status=${d.option?.status}, created=${d.createDate}`);
    }
  }

  // Check each PP report grid data source addon directly
  for (const addon of [
    "report_grid_pp_reports_verified",
    "report_grid_pp_reports_waiting_for_verification",
    "report_grid_pp_reports_rejected",
  ]) {
    try {
      const addonData = await ppClient.get<{ data?: unknown[] }>(
        `/api/v1/policies/${policyId}/tag/${addon}/blocks`,
      );
      const count = Array.isArray(addonData?.data) ? addonData.data.length : 0;
      console.log(`  ${addon}: ${count} documents`);
    } catch {
      console.log(`  ${addon}: not accessible`);
    }
  }

  // Check PP project grid 2 (validated projects)
  try {
    const ppProjGrid = await ppClient.get<{ data?: unknown[] }>(
      `/api/v1/policies/${policyId}/tag/project_grid_pp_2/blocks`,
    );
    const ppProjCount = Array.isArray(ppProjGrid?.data) ? ppProjGrid.data.length : 0;
    console.log(`\n  PP project_grid_pp_2: ${ppProjCount} documents`);
    if (ppProjGrid?.data?.length) {
      console.log(`  Project[0]: ${JSON.stringify(ppProjGrid.data[0]).slice(0, 200)}`);
    }
  } catch (err) {
    console.log(`  project_grid_pp_2: ${(err as Error).message.slice(0, 200)}`);
  }

  // Check VVB report grid
  const vvbClient = new GuardianClient(baseUrl);
  await vvbClient.login(
    process.env.GUARDIAN_VVB_USERNAME!,
    process.env.GUARDIAN_VVB_PASSWORD!,
  );
  const vvbReportGrid = await vvbClient.get<{ data?: unknown[] }>(
    `/api/v1/policies/${policyId}/tag/report_grid_vvb/blocks`,
  );
  const vvbRepCount = Array.isArray(vvbReportGrid?.data) ? vvbReportGrid.data.length : 0;
  console.log(`Report grid (VVB): ${vvbRepCount} documents`);
  if (vvbReportGrid?.data?.length) {
    for (const doc of vvbReportGrid.data) {
      const d = doc as { option?: { status?: string }; createDate?: string };
      console.log(`  status=${d.option?.status}, created=${d.createDate}`);
    }
  }

  // Check CER NFTs on mirror node
  console.log("\nChecking CER token 0.0.8350484 on Mirror Node...");
  try {
    const res = await fetch("https://testnet.mirrornode.hedera.com/api/v1/tokens/0.0.8350484/nfts");
    const nftData = await res.json() as { nfts?: unknown[] };
    console.log(`CER NFTs minted: ${nftData.nfts?.length || 0}`);
    if (nftData.nfts?.length) {
      console.log(`NFT[0]: ${JSON.stringify(nftData.nfts[0]).slice(0, 300)}`);
    }
  } catch (err) {
    console.log(`Mirror Node: ${(err as Error).message.slice(0, 200)}`);
  }
}

main().catch((err) => {
  console.error("Verify failed:", err.message);
  process.exit(1);
});
