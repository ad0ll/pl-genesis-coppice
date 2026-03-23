// Populate CDM AMS-I.F policy with demo data on Guardian Instance 2
// Drives the full workflow: PP profile → project → monitoring report → VVB verify → CER mint
// Run: cd scripts && npx tsx guardian/cdm-populate.ts
// Fallback: cd scripts && npx tsx guardian/cdm-populate.ts --irec

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { GuardianClient } from "./api-client.js";
import {
  CDM_PP_PROFILE,
  CDM_VVB_PROFILE,
  CDM_PROJECT_DESCRIPTION,
  CDM_MONITORING_REPORT,
  IREC_APPLICATION,
  IREC_DEVICE,
  IREC_ISSUE_REQUEST,
} from "./cdm-demo-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.cdm") });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postToTag(
  client: GuardianClient,
  policyId: string,
  tag: string,
  data: Record<string, unknown>,
  label: string,
) {
  console.log(`   POST /tag/${tag}/blocks — ${label}`);
  try {
    const result = await client.post(
      `/api/v1/policies/${policyId}/tag/${tag}/blocks`,
      { document: data, ref: null },
    );
    console.log(`   -> OK`);
    return result;
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`   -> FAILED: ${msg.slice(0, 500)}`);
    throw err;
  }
}

async function getFromTag(
  client: GuardianClient,
  policyId: string,
  tag: string,
  label: string,
) {
  console.log(`   GET /tag/${tag}/blocks — ${label}`);
  const result = await client.get<unknown>(
    `/api/v1/policies/${policyId}/tag/${tag}/blocks`,
  );
  return result;
}

async function runAmsIfWorkflow(policyId: string) {
  const baseUrl = process.env.GUARDIAN_API_URL;
  if (!baseUrl) throw new Error("GUARDIAN_API_URL not set");

  const srUser = process.env.GUARDIAN_SR_USERNAME;
  const srPass = process.env.GUARDIAN_SR_PASSWORD;
  const ppUser = process.env.GUARDIAN_PP_USERNAME;
  const ppPass = process.env.GUARDIAN_PP_PASSWORD;
  const vvbUser = process.env.GUARDIAN_VVB_USERNAME;
  const vvbPass = process.env.GUARDIAN_VVB_PASSWORD;

  if (!srUser || !srPass || !ppUser || !ppPass || !vvbUser || !vvbPass) {
    throw new Error("Missing credentials in .env.cdm (run cdm-import.ts first)");
  }

  const srClient = new GuardianClient(baseUrl);
  const ppClient = new GuardianClient(baseUrl);
  const vvbClient = new GuardianClient(baseUrl);

  // Phase 1: PP submits profile
  console.log("\n--- Phase 1: PP Profile ---");
  await ppClient.login(ppUser, ppPass);

  // First, PP must choose their role
  console.log("   Checking role selection...");
  const rootBlock = await ppClient.get<{ id: string }>(`/api/v1/policies/${policyId}/blocks`);
  console.log(`   Root block: ${rootBlock.id}`);

  // Try posting to role selection first
  try {
    await ppClient.post(
      `/api/v1/policies/${policyId}/tag/Choose_Roles/blocks`,
      { role: "Project Participant" },
    );
    console.log("   PP role selected: Project Participant");
  } catch {
    console.log("   PP role already selected or not available");
  }
  await sleep(3000);

  await postToTag(ppClient, policyId, "create_pp_profile", CDM_PP_PROFILE, "PP profile");
  await sleep(5000);

  // Phase 2: SR approves PP
  console.log("\n--- Phase 2: SR Approves PP ---");
  await srClient.login(srUser, srPass);

  // Check PP grid for pending documents
  const ppGrid = await getFromTag(srClient, policyId, "pp_grid_sr", "PP documents grid");
  console.log(`   PP grid response: ${JSON.stringify(ppGrid).slice(0, 300)}`);
  await sleep(2000);

  await postToTag(srClient, policyId, "approve_pp_documents_btn", {}, "Approve PP");
  await sleep(5000);

  // Phase 3: VVB submits profile
  console.log("\n--- Phase 3: VVB Profile ---");
  await vvbClient.login(vvbUser, vvbPass);

  try {
    await vvbClient.post(
      `/api/v1/policies/${policyId}/tag/Choose_Roles/blocks`,
      { role: "VVB" },
    );
    console.log("   VVB role selected: VVB");
  } catch {
    console.log("   VVB role already selected or not available");
  }
  await sleep(3000);

  await postToTag(vvbClient, policyId, "create_new_vvb", CDM_VVB_PROFILE, "VVB profile");
  await sleep(5000);

  // Phase 4: SR approves VVB
  console.log("\n--- Phase 4: SR Approves VVB ---");
  await postToTag(srClient, policyId, "approve_documents_btn", {}, "Approve VVB");
  await sleep(5000);

  // Phase 5: PP submits project (MAKE-OR-BREAK: Tool 16 runs here)
  console.log("\n--- Phase 5: PP Submits Project (Tool 16 runs here) ---");
  await ppClient.login(ppUser, ppPass);
  await postToTag(ppClient, policyId, "add_project_bnt", CDM_PROJECT_DESCRIPTION, "Project Description");
  console.log("   Waiting for Tool 16 + customLogicBlock...");
  await sleep(15000);

  // Phase 6: SR validates project
  console.log("\n--- Phase 6: SR Validates Project ---");
  await srClient.login(srUser, srPass);

  const projectGrid = await getFromTag(srClient, policyId, "project_grid_sr", "Project grid");
  console.log(`   Project grid: ${JSON.stringify(projectGrid).slice(0, 300)}`);
  await sleep(2000);

  await postToTag(srClient, policyId, "sr_validate_project_btn", {}, "Validate project");
  await sleep(5000);

  // Phase 7: PP submits monitoring report
  console.log("\n--- Phase 7: PP Submits Monitoring Report ---");
  await ppClient.login(ppUser, ppPass);
  await postToTag(ppClient, policyId, "add_report_bnt", CDM_MONITORING_REPORT, "Monitoring Report");
  console.log("   Waiting for Tool 16 + customLogicBlock...");
  await sleep(15000);

  // Phase 8: PP assigns VVB to report
  console.log("\n--- Phase 8: PP Assigns VVB ---");
  try {
    // The assign_vvb block may need the VVB document reference
    const reportGrid = await getFromTag(ppClient, policyId, "report_grid_pp", "PP report grid");
    console.log(`   Report grid: ${JSON.stringify(reportGrid).slice(0, 300)}`);
    await sleep(2000);

    await postToTag(ppClient, policyId, "assign_vvb", {}, "Assign VVB to report");
  } catch (err) {
    console.log(`   VVB assignment: ${(err as Error).message.slice(0, 200)}`);
    console.log("   (may need specific document reference — continuing)");
  }
  await sleep(5000);

  // Phase 9: VVB verifies report
  console.log("\n--- Phase 9: VVB Verifies Report ---");
  await vvbClient.login(vvbUser, vvbPass);

  const vvbReportGrid = await getFromTag(vvbClient, policyId, "report_grid_vvb", "VVB report grid");
  console.log(`   VVB report grid: ${JSON.stringify(vvbReportGrid).slice(0, 300)}`);
  await sleep(2000);

  await postToTag(vvbClient, policyId, "approve_report_btn", {}, "VVB verify report");
  await sleep(5000);

  // Phase 10: SR approves report -> CER mint triggered
  console.log("\n--- Phase 10: SR Approves Report (CER mint) ---");
  await srClient.login(srUser, srPass);

  const srReportGrid = await getFromTag(srClient, policyId, "report_grid_sr", "SR report grid");
  console.log(`   SR report grid: ${JSON.stringify(srReportGrid).slice(0, 300)}`);
  await sleep(2000);

  await postToTag(srClient, policyId, "sr_approve_report_btn", {}, "SR approve report → mint CER");
  await sleep(10000);

  // Verification
  console.log("\n--- Verification ---");
  const vpGrid = await getFromTag(srClient, policyId, "vp_grid", "Verifiable Presentations");
  console.log(`   VP grid: ${JSON.stringify(vpGrid).slice(0, 500)}`);
}

async function runIrecWorkflow(policyId: string) {
  const baseUrl = process.env.GUARDIAN_API_URL;
  if (!baseUrl) throw new Error("GUARDIAN_API_URL not set");

  const srUser = process.env.GUARDIAN_SR_USERNAME;
  const srPass = process.env.GUARDIAN_SR_PASSWORD;
  const ppUser = process.env.GUARDIAN_PP_USERNAME;
  const ppPass = process.env.GUARDIAN_PP_PASSWORD;

  if (!srUser || !srPass || !ppUser || !ppPass) {
    throw new Error("Missing credentials in .env.cdm");
  }

  const srClient = new GuardianClient(baseUrl);
  const regClient = new GuardianClient(baseUrl);

  // Phase 1: Registrant submits application
  console.log("\n--- Phase 1: Registrant Application ---");
  await regClient.login(ppUser, ppPass);

  try {
    await regClient.post(
      `/api/v1/policies/${policyId}/tag/choose_role/blocks`,
      { role: "Registrant" },
    );
    console.log("   Role selected: Registrant");
  } catch {
    console.log("   Role already selected");
  }
  await sleep(3000);

  await postToTag(regClient, policyId, "create_application", IREC_APPLICATION, "Application");
  await sleep(5000);

  // Phase 2: SR approves registrant
  console.log("\n--- Phase 2: SR Approves Registrant ---");
  await srClient.login(srUser, srPass);
  await postToTag(srClient, policyId, "approve_registrant_btn", {}, "Approve registrant");
  await sleep(5000);

  // Phase 3: Registrant submits device
  console.log("\n--- Phase 3: Device Registration ---");
  await regClient.login(ppUser, ppPass);
  await postToTag(regClient, policyId, "create_device_form", IREC_DEVICE, "Device registration");
  await sleep(5000);

  // Phase 4: SR approves device
  console.log("\n--- Phase 4: SR Approves Device ---");
  await srClient.login(srUser, srPass);
  await postToTag(srClient, policyId, "approve_device_btn", {}, "Approve device");
  await sleep(5000);

  // Phase 5: Registrant submits issue request
  console.log("\n--- Phase 5: Issue Request ---");
  await regClient.login(ppUser, ppPass);
  await postToTag(regClient, policyId, "create_issue_request_form", IREC_ISSUE_REQUEST, "Issue request");
  await sleep(5000);

  // Phase 6: SR approves issue -> I-REC token mint
  console.log("\n--- Phase 6: SR Approves Issue (I-REC mint) ---");
  await srClient.login(srUser, srPass);
  await postToTag(srClient, policyId, "approve_issue_requests_btn", {}, "Approve issue → mint I-REC");
  await sleep(10000);

  // Verification
  console.log("\n--- Verification ---");
  const vpGrid = await getFromTag(srClient, policyId, "vp_grid", "Verifiable Presentations");
  console.log(`   VP grid: ${JSON.stringify(vpGrid).slice(0, 500)}`);
}

async function main() {
  const useIrec = process.argv.includes("--irec");
  const policyId = process.env.GUARDIAN_POLICY_ID;
  if (!policyId) throw new Error("GUARDIAN_POLICY_ID not set in .env.cdm (run cdm-import.ts first)");

  console.log(`=== CDM Populate (${useIrec ? "iREC 7" : "AMS-I.F"}) ===`);
  console.log(`Policy: ${policyId}`);
  console.log(`Instance: ${process.env.GUARDIAN_API_URL}`);

  if (useIrec) {
    await runIrecWorkflow(policyId);
  } else {
    await runAmsIfWorkflow(policyId);
  }

  console.log("\n=== Populate Complete ===");
}

main().catch((err) => {
  console.error("\nPopulate failed:", err.message);
  console.error("\nIf this was AMS-I.F Tool 16 failure, try: npx tsx guardian/cdm-populate.ts --irec");
  process.exit(1);
});
