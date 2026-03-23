import { CDM_GUARDIAN_API_URL, CDM_GUARDIAN_POLICY_ID, CDM_CER_TOKEN_ID, MIRROR_NODE_URL } from "@/lib/constants";
import type {
  CDMProjectCS,
  CDMProject,
  CDMMonitoringReport,
  CDMData,
  VCEvidence,
  ViewerBlockResponse,
  GuardianVCDocument,
} from "@/lib/guardian-types";

const SR_USERNAME = process.env.CDM_GUARDIAN_SR_USERNAME || "CdmSR";
const SR_PASSWORD = process.env.CDM_GUARDIAN_SR_PASSWORD || "CdmSR2026!";

async function cdmLogin(): Promise<string> {
  const loginRes = await fetch(`${CDM_GUARDIAN_API_URL}/api/v1/accounts/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: SR_USERNAME, password: SR_PASSWORD }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!loginRes.ok) throw new Error(`CDM Guardian login failed: ${loginRes.status}`);
  const { refreshToken } = (await loginRes.json()) as { refreshToken: string };

  const tokenRes = await fetch(`${CDM_GUARDIAN_API_URL}/api/v1/accounts/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenRes.ok) throw new Error(`CDM Guardian token exchange failed: ${tokenRes.status}`);
  const { accessToken } = (await tokenRes.json()) as { accessToken: string };
  return accessToken;
}

function extractEvidence(doc: GuardianVCDocument<CDMProjectCS>): VCEvidence {
  return {
    hash: doc.hash,
    topicId: doc.topicId,
    messageId: doc.messageId,
    issuer: doc.document.issuer,
    issuanceDate: doc.document.issuanceDate,
    proofType: doc.document.proof?.type ?? "Ed25519Signature2018",
  };
}

function parseProject(doc: GuardianVCDocument<CDMProjectCS>): CDMProject {
  const cs = doc.document.credentialSubject[0];
  const details = cs.field0;

  return {
    description: details.field0,
    methodology: details.field18?.[0] ?? "AMS-I.F",
    technology: details.field2?.[0] ?? "Solar PV",
    projectParticipant: details.field9,
    location: {
      lat: parseFloat(details.field5) || 0,
      lon: parseFloat(details.field6) || 0,
    },
    startDate: details.field19,
    creditingPeriod: {
      start: details.field20?.[0]?.field0 ?? "",
      end: details.field20?.[0]?.field1 ?? "",
    },
    monitoringPeriod: {
      start: details.field21?.[0]?.field0 ?? "",
      end: details.field21?.[0]?.field1 ?? "",
    },
    netElectricityMWh: cs.field11 ?? 0,
    sdgContributions: details.field24 ?? "",
    status: doc.option?.status ?? "Unknown",
    evidence: extractEvidence(doc),
  };
}

function parseReport(doc: GuardianVCDocument<CDMProjectCS>): CDMMonitoringReport {
  const cs = doc.document.credentialSubject[0];
  const details = cs.field0;

  return {
    description: details.field0,
    monitoringPeriod: {
      start: details.field21?.[0]?.field0 ?? "",
      end: details.field21?.[0]?.field1 ?? "",
    },
    netElectricityMWh: cs.field11 ?? 0,
    monitoringPlan: details.field22 ?? "",
    status: doc.option?.status ?? "Unknown",
    evidence: extractEvidence(doc),
  };
}

async function fetchCerTokenInfo(): Promise<CDMData["cerToken"]> {
  try {
    const [tokenRes, nftRes] = await Promise.all([
      fetch(`${MIRROR_NODE_URL}/api/v1/tokens/${CDM_CER_TOKEN_ID}`, {
        signal: AbortSignal.timeout(5_000),
      }),
      fetch(`${MIRROR_NODE_URL}/api/v1/tokens/${CDM_CER_TOKEN_ID}/nfts?limit=1`, {
        signal: AbortSignal.timeout(5_000),
      }),
    ]);

    if (!tokenRes.ok) return null;

    const token = (await tokenRes.json()) as { name: string; symbol: string; total_supply?: string };
    const nfts = nftRes.ok
      ? ((await nftRes.json()) as { nfts?: unknown[] })
      : { nfts: [] };

    return {
      tokenId: CDM_CER_TOKEN_ID,
      tokenName: token.name ?? "CER",
      tokenSymbol: token.symbol ?? "CER",
      nftsMinted: nfts.nfts?.length ?? 0,
    };
  } catch {
    return null;
  }
}

export async function fetchCDMData(): Promise<CDMData | null> {
  const policyId = CDM_GUARDIAN_POLICY_ID;
  if (!policyId) return null;

  const token = await cdmLogin();

  // Fetch project grid (SR view — shows validated projects)
  const projectRes = await fetch(
    `${CDM_GUARDIAN_API_URL}/api/v1/policies/${policyId}/tag/project_grid_sr/blocks`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    },
  );

  const projects: CDMProject[] = [];
  const reports: CDMMonitoringReport[] = [];

  if (projectRes.ok) {
    const body = (await projectRes.json()) as ViewerBlockResponse<CDMProjectCS>;
    const docs = body.data ?? [];

    // Deduplicate by description (we may have submitted the same project multiple times)
    const seen = new Set<string>();
    for (const doc of docs) {
      const cs = doc.document?.credentialSubject?.[0];
      if (!cs?.field0) continue;
      const key = cs.field0.field9; // PP name as dedup key
      if (seen.has(key)) continue;
      seen.add(key);

      if (doc.type === "report" || doc.tag?.includes("report")) {
        reports.push(parseReport(doc));
      } else {
        projects.push(parseProject(doc));
      }
    }
  }

  // Fetch policy metadata for topic ID
  let policyTopicId = "";
  let policyName = "CDM AMS-I.F";
  try {
    const policyRes = await fetch(
      `${CDM_GUARDIAN_API_URL}/api/v1/policies/${policyId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (policyRes.ok) {
      const policy = (await policyRes.json()) as { name?: string; topicId?: string };
      policyName = policy.name ?? policyName;
      policyTopicId = policy.topicId ?? "";
    }
  } catch {
    // Non-critical
  }

  const cerToken = await fetchCerTokenInfo();

  return {
    projects,
    reports,
    cerToken,
    policyName,
    policyTopicId,
  };
}
