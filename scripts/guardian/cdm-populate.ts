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

// Button blocks require { document: <doc from grid>, tag: <internal button tag> }
// The internal button tag (e.g. "Button_0") is found by GET on the block's uiMetaData.buttons
async function clickButton(
  client: GuardianClient,
  policyId: string,
  buttonTag: string,
  document: unknown,
  label: string,
  action: "approve" | "reject" = "approve",
) {
  // First, discover the internal button tag by reading the block
  const blockData = await client.get<{
    uiMetaData?: {
      buttons?: Array<{ tag: string; name: string; uiClass?: string }>;
    };
  }>(`/api/v1/policies/${policyId}/tag/${buttonTag}/blocks`);

  const buttons = blockData?.uiMetaData?.buttons;
  let internalTag = "Button_0"; // default
  if (buttons && buttons.length > 0) {
    const target = action === "approve"
      ? buttons.find(b => b.uiClass?.includes("approve") || b.name?.toLowerCase() === "approve")
      : buttons.find(b => b.uiClass?.includes("reject") || b.name?.toLowerCase() === "reject");
    if (target) internalTag = target.tag;
    console.log(`   Button "${buttonTag}" has ${buttons.length} actions, using "${internalTag}" (${target?.name || "default"})`);
  }

  console.log(`   POST /tag/${buttonTag}/blocks — ${label}`);
  try {
    const result = await client.post(
      `/api/v1/policies/${policyId}/tag/${buttonTag}/blocks`,
      { document, tag: internalTag },
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

  // Check if PP is already past the profile step
  const ppStep = await ppClient.get<{ blocks: Array<{ blockType: string; id: string } | null> }>(
    `/api/v1/policies/${policyId}/blocks`
  );
  const activeBlocks = (ppStep.blocks || []).filter(Boolean);
  const hasStep = activeBlocks.some(b => b?.blockType === "interfaceStepBlock");
  const hasTabs = activeBlocks.some(b => b?.blockType === "interfaceContainerBlock");

  if (hasTabs) {
    console.log("   PP already approved — skipping profile and approval phases");
  } else {
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

    try {
      await postToTag(ppClient, policyId, "create_pp_profile", CDM_PP_PROFILE, "PP profile");
    } catch {
      console.log("   PP profile already submitted or step passed");
    }
    await sleep(5000);
  }

  // Phase 2: SR approves PP
  if (!hasTabs) {
    console.log("\n--- Phase 2: SR Approves PP ---");
    await srClient.login(srUser, srPass);

    let ppDoc: unknown = null;
    for (let i = 0; i < 20; i++) {
      const ppGrid = await getFromTag(srClient, policyId, "pp_grid_sr", "PP documents grid") as { data?: unknown[] };
      const dataLen = Array.isArray(ppGrid?.data) ? ppGrid.data.length : 0;
      console.log(`   PP grid: ${dataLen} documents`);
      if (dataLen > 0) {
        ppDoc = ppGrid.data?.[0];
        break;
      }
      await sleep(5000);
    }

    await clickButton(srClient, policyId, "approve_pp_documents_btn", ppDoc, "Approve PP");
    await sleep(10000);
  } else {
    console.log("\n--- Phase 2: SR Approves PP (skipped — already approved) ---");
    await srClient.login(srUser, srPass);
  }

  // Phase 3: VVB submits profile
  console.log("\n--- Phase 3: VVB Profile ---");
  await vvbClient.login(vvbUser, vvbPass);

  // Check if VVB already has tabs (approved)
  const vvbStep = await vvbClient.get<{ blocks: Array<{ blockType: string } | null> }>(
    `/api/v1/policies/${policyId}/blocks`
  );
  const vvbActiveBlocks = (vvbStep.blocks || []).filter(Boolean);
  const vvbHasTabs = vvbActiveBlocks.some(b => b?.blockType === "interfaceContainerBlock");

  if (vvbHasTabs) {
    console.log("   VVB already approved — skipping profile and approval phases");
  } else {
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

    try {
      await postToTag(vvbClient, policyId, "create_new_vvb", CDM_VVB_PROFILE, "VVB profile");
    } catch {
      console.log("   VVB profile already submitted or step passed");
    }
    await sleep(5000);
  }

  // Phase 4: SR approves VVB
  if (!vvbHasTabs) {
    console.log("\n--- Phase 4: SR Approves VVB ---");
    await srClient.login(srUser, srPass);

    // Poll VVB grid until document appears
    let vvbDoc: unknown = null;
    for (let i = 0; i < 20; i++) {
      const vvbGrid = await getFromTag(srClient, policyId, "vvb_grid_sr", "VVB documents grid") as { data?: unknown[] };
      const dataLen = Array.isArray(vvbGrid?.data) ? vvbGrid.data.length : 0;
      console.log(`   VVB grid: ${dataLen} documents`);
      if (dataLen > 0) {
        vvbDoc = vvbGrid.data?.[0];
        break;
      }
      await sleep(5000);
    }

    await clickButton(srClient, policyId, "approve_documents_btn", vvbDoc, "Approve VVB");
    await sleep(10000);
  } else {
    console.log("\n--- Phase 4: SR Approves VVB (skipped — already approved) ---");
  }

  // Phase 5: PP submits project (MAKE-OR-BREAK: Tool 16 runs here)
  console.log("\n--- Phase 5: PP Submits Project (Tool 16 runs here) ---");
  await ppClient.login(ppUser, ppPass);
  try {
    await postToTag(ppClient, policyId, "add_project_bnt", CDM_PROJECT_DESCRIPTION, "Project Description");
    console.log("   Waiting for Tool 16 + customLogicBlock...");
    await sleep(15000);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("422") || msg.includes("Unavailable")) {
      console.log("   Project already submitted — skipping");
    } else {
      throw err;
    }
  }

  // Phase 6: SR validates project
  console.log("\n--- Phase 6: SR Validates Project ---");
  await srClient.login(srUser, srPass);

  // Poll project grid until document appears
  let projectDoc: unknown = null;
  for (let i = 0; i < 30; i++) {
    const projectGrid = await getFromTag(srClient, policyId, "project_grid_sr", "Project grid") as { data?: unknown[] };
    const dataLen = Array.isArray(projectGrid?.data) ? projectGrid.data.length : 0;
    console.log(`   Project grid: ${dataLen} documents`);
    if (dataLen > 0) {
      projectDoc = projectGrid.data?.[0];
      console.log(`   Project: ${JSON.stringify(projectDoc).slice(0, 200)}`);
      break;
    }
    await sleep(5000);
  }

  try {
    await clickButton(srClient, policyId, "sr_validate_project_btn", projectDoc, "Validate project");
    await sleep(10000);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("422") || msg.includes("Unavailable")) {
      console.log("   Project already validated — skipping");
    } else {
      throw err;
    }
  }

  // Phase 7: PP submits monitoring report
  console.log("\n--- Phase 7: PP Submits Monitoring Report ---");
  await ppClient.login(ppUser, ppPass);
  await postToTag(ppClient, policyId, "add_report_bnt", CDM_MONITORING_REPORT, "Monitoring Report");
  console.log("   Waiting for Tool 16 + customLogicBlock...");
  await sleep(15000);

  // Phase 8: PP assigns VVB to report
  console.log("\n--- Phase 8: PP Assigns VVB ---");
  await ppClient.login(ppUser, ppPass);

  // Wait for report to appear in PP's grid
  let ppReportDoc: unknown = null;
  for (let i = 0; i < 30; i++) {
    const ppReportGrid = await getFromTag(ppClient, policyId, "report_grid_pp", "PP report grid") as { data?: unknown[] };
    const dataLen = Array.isArray(ppReportGrid?.data) ? ppReportGrid.data.length : 0;
    console.log(`   PP report grid: ${dataLen} documents`);
    if (dataLen > 0) {
      ppReportDoc = ppReportGrid.data?.[0];
      console.log(`   Report: ${JSON.stringify(ppReportDoc).slice(0, 200)}`);
      break;
    }
    await sleep(5000);
  }

  if (!ppReportDoc) {
    console.log("   WARNING: No report found in PP grid — VVB assignment may fail");
  }

  // Get the assign_vvb block to understand its structure
  const assignBlock = await getFromTag(ppClient, policyId, "assign_vvb", "Assign VVB block");
  console.log(`   assign_vvb block: ${JSON.stringify(assignBlock).slice(0, 500)}`);

  // The interfaceActionBlock typically needs { document: <report doc>, assignedTo: <vvb did> }
  // or it may use a dropdown selection. Try posting the report document to it.
  try {
    await ppClient.post(
      `/api/v1/policies/${policyId}/tag/assign_vvb/blocks`,
      ppReportDoc,
    );
    console.log("   -> VVB assignment OK");
  } catch (err) {
    console.log(`   VVB assignment attempt 1: ${(err as Error).message.slice(0, 300)}`);
    // Try alternative format with document wrapper
    try {
      await ppClient.post(
        `/api/v1/policies/${policyId}/tag/assign_vvb/blocks`,
        { document: ppReportDoc },
      );
      console.log("   -> VVB assignment OK (document wrapper)");
    } catch (err2) {
      console.log(`   VVB assignment attempt 2: ${(err2 as Error).message.slice(0, 300)}`);
    }
  }
  await sleep(10000);

  // Phase 9: VVB verifies report
  console.log("\n--- Phase 9: VVB Verifies Report ---");
  await vvbClient.login(vvbUser, vvbPass);

  let vvbReportDoc: unknown = null;
  for (let i = 0; i < 20; i++) {
    const vvbReportGrid = await getFromTag(vvbClient, policyId, "report_grid_vvb", "VVB report grid") as { data?: unknown[] };
    const dataLen = Array.isArray(vvbReportGrid?.data) ? vvbReportGrid.data.length : 0;
    console.log(`   VVB report grid: ${dataLen} documents`);
    if (dataLen > 0) {
      vvbReportDoc = vvbReportGrid.data?.[0];
      break;
    }
    await sleep(5000);
  }

  await clickButton(vvbClient, policyId, "approve_report_btn", vvbReportDoc, "VVB verify report");
  await sleep(10000);

  // Phase 10: SR approves report -> CER mint triggered
  console.log("\n--- Phase 10: SR Approves Report (CER mint) ---");
  await srClient.login(srUser, srPass);

  let srReportDoc: unknown = null;
  for (let i = 0; i < 20; i++) {
    const srReportGrid = await getFromTag(srClient, policyId, "report_grid_sr", "SR report grid") as { data?: unknown[] };
    const dataLen = Array.isArray(srReportGrid?.data) ? srReportGrid.data.length : 0;
    console.log(`   SR report grid: ${dataLen} documents`);
    if (dataLen > 0) {
      srReportDoc = srReportGrid.data?.[0];
      break;
    }
    await sleep(5000);
  }

  await clickButton(srClient, policyId, "sr_approve_report_btn", srReportDoc, "SR approve report → mint CER");
  await sleep(15000);

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
  let regDoc: unknown = null;
  for (let i = 0; i < 20; i++) {
    const regGrid = await getFromTag(srClient, policyId, "registrants_grid", "Registrants grid") as { data?: unknown[] };
    const dataLen = Array.isArray(regGrid?.data) ? regGrid.data.length : 0;
    if (dataLen > 0) { regDoc = regGrid.data?.[0]; break; }
    await sleep(5000);
  }
  await clickButton(srClient, policyId, "approve_registrant_btn", regDoc, "Approve registrant");
  await sleep(10000);

  // Phase 3: Registrant submits device
  console.log("\n--- Phase 3: Device Registration ---");
  await regClient.login(ppUser, ppPass);
  await postToTag(regClient, policyId, "create_device_form", IREC_DEVICE, "Device registration");
  await sleep(5000);

  // Phase 4: SR approves device
  console.log("\n--- Phase 4: SR Approves Device ---");
  await srClient.login(srUser, srPass);
  let deviceDoc: unknown = null;
  for (let i = 0; i < 20; i++) {
    const deviceGrid = await getFromTag(srClient, policyId, "approve_devices_grid", "Devices grid") as { data?: unknown[] };
    const dataLen = Array.isArray(deviceGrid?.data) ? deviceGrid.data.length : 0;
    if (dataLen > 0) { deviceDoc = deviceGrid.data?.[0]; break; }
    await sleep(5000);
  }
  await clickButton(srClient, policyId, "approve_device_btn", deviceDoc, "Approve device");
  await sleep(10000);

  // Phase 5: Registrant submits issue request
  console.log("\n--- Phase 5: Issue Request ---");
  await regClient.login(ppUser, ppPass);
  await postToTag(regClient, policyId, "create_issue_request_form", IREC_ISSUE_REQUEST, "Issue request");
  await sleep(5000);

  // Phase 6: SR approves issue -> I-REC token mint
  console.log("\n--- Phase 6: SR Approves Issue (I-REC mint) ---");
  await srClient.login(srUser, srPass);
  let issueDoc: unknown = null;
  for (let i = 0; i < 20; i++) {
    const issueGrid = await getFromTag(srClient, policyId, "issue_requests_grid(evident)", "Issue requests grid") as { data?: unknown[] };
    const dataLen = Array.isArray(issueGrid?.data) ? issueGrid.data.length : 0;
    if (dataLen > 0) { issueDoc = issueGrid.data?.[0]; break; }
    await sleep(5000);
  }
  await clickButton(srClient, policyId, "approve_issue_requests_btn", issueDoc, "Approve issue → mint I-REC");
  await sleep(15000);

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
