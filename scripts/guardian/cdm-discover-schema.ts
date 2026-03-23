// Preview CDM methodology policy from IPFS and dump schema + block tree to JSON
// Uses Instance 1 (production) for preview — preview is read-only, does not import anything
//
// Usage:
//   cd scripts && npx tsx guardian/cdm-discover-schema.ts          # AMS-I.F
//   cd scripts && npx tsx guardian/cdm-discover-schema.ts --irec   # iREC 7 (fallback)

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { GuardianClient } from "./api-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load Instance 1 credentials — preview is safe (read-only IPFS fetch)
dotenv.config({ path: path.join(__dirname, ".env") });

const AMS_IF_TIMESTAMP = "1720103781.743732003";
const IREC7_TIMESTAMP = "1707130249.448431277";

interface PolicyPreview {
  policy: {
    name: string;
    description: string;
    version: string;
    policyRoles: string[];
    config: unknown;
  };
  schemas: Array<{
    name: string;
    description: string;
    fields: Array<{ name: string; description: string; required: boolean; type: string }>;
  }>;
  tokens: Array<{ tokenName: string; tokenSymbol: string }>;
  tools: Array<{ name: string; description: string }>;
}

interface BlockNode {
  blockType: string;
  tag: string;
  permissions?: string[];
  schema?: string;
  tokenId?: string;
  children?: BlockNode[];
}

function extractBlockTree(block: unknown): BlockNode | null {
  if (!block || typeof block !== "object") return null;
  const b = block as Record<string, unknown>;
  const node: BlockNode = {
    blockType: String(b.blockType || ""),
    tag: String(b.tag || ""),
  };
  if (b.permissions) node.permissions = b.permissions as string[];
  if (typeof b.schema === "string") node.schema = b.schema.slice(0, 60);
  if (b.tokenId) node.tokenId = String(b.tokenId);
  if (Array.isArray(b.children) && b.children.length > 0) {
    node.children = b.children
      .map((c: unknown) => extractBlockTree(c))
      .filter((c): c is BlockNode => c !== null);
  }
  return node;
}

async function main() {
  const useIrec = process.argv.includes("--irec");
  const timestamp = useIrec ? IREC7_TIMESTAMP : AMS_IF_TIMESTAMP;
  const label = useIrec ? "iREC 7" : "AMS-I.F";
  const outFile = useIrec ? "cdm-irec7-schema.json" : "cdm-ams-if-schema.json";

  const client = new GuardianClient();
  const srUser = process.env.GUARDIAN_SR_USERNAME || "CoppiceSR";
  const srPass = process.env.GUARDIAN_SR_PASSWORD || "CoppiceSR2026!";

  console.log(`Logging in as ${srUser}...`);
  await client.login(srUser, srPass);

  console.log(`Previewing ${label} (timestamp: ${timestamp})...`);
  const preview = await client.post<PolicyPreview>(
    "/api/v1/policies/import/message/preview",
    { messageId: timestamp },
  );

  const output = {
    policy: {
      name: preview.policy?.name,
      description: preview.policy?.description,
      version: preview.policy?.version,
      policyRoles: preview.policy?.policyRoles,
    },
    schemas: preview.schemas,
    tokens: preview.tokens,
    tools: preview.tools,
    blockTree: extractBlockTree(preview.policy?.config),
  };

  const outPath = path.join(__dirname, outFile);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nWritten to ${outPath}`);
  console.log(`Policy: ${output.policy.name} v${output.policy.version}`);
  console.log(`Roles: ${output.policy.policyRoles?.join(", ")}`);
  console.log(`Schemas: ${preview.schemas?.length ?? 0}`);
  console.log(`Tools: ${preview.tools?.length ?? 0}`);
  console.log(`Tokens: ${preview.tokens?.length ?? 0}`);

  // Print block tags for quick reference
  const tags: string[] = [];
  function collectTags(node: BlockNode | null) {
    if (!node) return;
    if (node.tag) tags.push(`${node.blockType}: ${node.tag}`);
    node.children?.forEach(collectTags);
  }
  collectTags(output.blockTree);
  console.log(`\nBlock tags (${tags.length}):`);
  tags.forEach((t) => console.log(`  ${t}`));
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
