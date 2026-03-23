// Import CDM AMS-I.F methodology policy onto Guardian Instance 2
// Registers SR, imports policy from IPFS, publishes, creates users
// Run: cd scripts && npx tsx guardian/cdm-import.ts
// Fallback: cd scripts && npx tsx guardian/cdm-import.ts --irec

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Client, AccountCreateTransaction, PrivateKey, Hbar, AccountId } from "@hashgraph/sdk";
import { GuardianClient } from "./api-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load CDM env (Instance 2) FIRST so GUARDIAN_API_URL points at port 3200
dotenv.config({ path: path.join(__dirname, ".env.cdm") });
// Also load parent scripts/.env for Hedera funding account
dotenv.config({ path: path.join(__dirname, "../.env") });

const AMS_IF_TIMESTAMP = "1720103781.743732003";
const IREC7_TIMESTAMP = "1707130249.448431277";

const SR_USERNAME = "CdmSR";
const SR_PASSWORD = "CdmSR2026!";
const PP_USERNAME = "CdmPP";
const PP_PASSWORD = "CdmPP2026!";
const VVB_USERNAME = "CdmVVB";
const VVB_PASSWORD = "CdmVVB2026!";

async function createHederaAccount(funderId: string, funderKey: string): Promise<{ accountId: string; privateKey: string }> {
  const client = Client.forTestnet();
  const keyHex = funderKey.startsWith("0x") ? funderKey.slice(2) : funderKey;
  client.setOperator(AccountId.fromString(funderId), PrivateKey.fromStringECDSA(keyHex));

  const newKey = PrivateKey.generateED25519();
  const tx = await new AccountCreateTransaction()
    .setKey(newKey.publicKey)
    .setInitialBalance(new Hbar(10))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const accountId = receipt.accountId!.toString();
  client.close();

  return { accountId, privateKey: newKey.toStringDer() };
}

type PolicyEntry = { id: string; name: string; status: string; uuid: string; topicId: string };

async function main() {
  const useIrec = process.argv.includes("--irec");
  const timestamp = useIrec ? IREC7_TIMESTAMP : AMS_IF_TIMESTAMP;
  const label = useIrec ? "iREC 7" : "CDM AMS-I.F";

  const baseUrl = process.env.GUARDIAN_API_URL;
  if (!baseUrl || !baseUrl.includes("3200")) {
    throw new Error(`GUARDIAN_API_URL should point at Instance 2 (port 3200), got: ${baseUrl}`);
  }

  const operatorId = process.env.GUARDIAN_OPERATOR_ID;
  const operatorKey = process.env.GUARDIAN_OPERATOR_KEY;
  if (!operatorId || !operatorKey) {
    throw new Error("GUARDIAN_OPERATOR_ID and GUARDIAN_OPERATOR_KEY must be set in .env.cdm");
  }

  const client = new GuardianClient(baseUrl);

  console.log(`=== CDM Guardian Setup (${label}) ===`);
  console.log(`Instance: ${baseUrl}\n`);

  // 1. Register Standard Registry
  console.log("1. Registering Standard Registry...");
  try {
    await client.register(SR_USERNAME, SR_PASSWORD, "STANDARD_REGISTRY");
    console.log("   Registered successfully");
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("already") || msg.includes("409")) {
      console.log("   Already registered, continuing...");
    } else {
      throw err;
    }
  }

  await client.login(SR_USERNAME, SR_PASSWORD);
  console.log("   Logged in as SR\n");

  // 2. Configure SR profile with Hedera credentials
  console.log("2. Configuring SR profile...");
  const existingProfile = await client.get<{ confirmed?: boolean }>(`/api/v1/profiles/${SR_USERNAME}`);

  if (existingProfile.confirmed) {
    console.log("   Profile already confirmed\n");
  } else {
    console.log("   Setting profile (creates DID + HCS topics on testnet)...");
    await client.putAsync(`/api/v1/profiles/push/${SR_USERNAME}`, {
      hederaAccountId: operatorId,
      hederaAccountKey: operatorKey,
    }, 600_000);

    let confirmed = false;
    for (let i = 0; i < 60; i++) {
      const profile = await client.get<{ confirmed: boolean }>(`/api/v1/profiles/${SR_USERNAME}`);
      if (profile.confirmed) { confirmed = true; break; }
      await new Promise((r) => setTimeout(r, 5000));
      process.stdout.write(".");
    }
    if (!confirmed) throw new Error("SR profile initialization timed out");
    console.log("\n   SR profile confirmed\n");
  }

  // 3. Import policy from IPFS
  console.log(`3. Importing ${label} from IPFS (timestamp: ${timestamp})...`);

  // Check if we already have the policy imported
  const existingPolicies = await client.get<PolicyEntry[]>("/api/v1/policies");
  let policy = existingPolicies.find(
    (p) => p.status !== "DISCONTINUED"
  );

  let policyId: string;

  if (policy && (policy.status === "PUBLISH" || policy.status === "PUBLISHED")) {
    policyId = policy.id;
    console.log(`   Found published policy: ${policy.name} (${policyId})\n`);
  } else if (policy && policy.status === "DRAFT") {
    policyId = policy.id;
    console.log(`   Found existing DRAFT policy: ${policy.name} (${policyId})`);
    console.log("   Will publish...\n");
  } else {
    // Import via async POST — this downloads from IPFS and creates a DRAFT policy
    console.log("   Importing...");
    const importResult = await client.postAsync<{ policies: PolicyEntry[] }>(
      "/api/v1/policies/push/import/message",
      { messageId: timestamp },
      600_000, // 10 min — IPFS download can be slow
    );

    // The result may be the policies array directly or wrapped
    const policies = Array.isArray(importResult)
      ? importResult as unknown as PolicyEntry[]
      : importResult.policies;

    if (!policies || policies.length === 0) {
      throw new Error("Import returned no policies");
    }

    policy = policies[0];
    policyId = policy.id;
    console.log(`   Imported: ${policy.name} (${policyId}, status: ${policy.status})\n`);
  }

  // 4. Publish policy
  const currentPolicy = await client.get<PolicyEntry>(`/api/v1/policies/${policyId}`);
  if (currentPolicy.status === "PUBLISH" || currentPolicy.status === "PUBLISHED") {
    console.log("4. Policy already published\n");
  } else {
    console.log("4. Publishing policy to Hedera testnet (may take 10-30 min)...");
    try {
      await client.putAsync(
        `/api/v1/policies/push/${policyId}/publish`,
        { policyVersion: "1.0.0" },
        1_800_000, // 30 min
      );
      console.log("   Policy published\n");
    } catch (err) {
      console.error(`   Publish error: ${(err as Error).message.slice(0, 500)}`);
      // Check if it published despite error
      const check = await client.get<PolicyEntry>(`/api/v1/policies/${policyId}`);
      if (check.status === "PUBLISH" || check.status === "PUBLISHED") {
        console.log("   Policy is actually published (task may have timed out)\n");
      } else {
        throw new Error(`Policy publish failed. Status: ${check.status}`);
      }
    }
  }

  // 5. Verify policy engine health
  console.log("5. Verifying policy engine...");
  let engineHealthy = false;
  for (let i = 0; i < 10; i++) {
    try {
      await client.get(`/api/v1/policies/${policyId}/blocks`);
      engineHealthy = true;
      break;
    } catch {
      await new Promise(r => setTimeout(r, 10_000));
      process.stdout.write(".");
    }
  }
  if (engineHealthy) {
    console.log("   Policy engine responding\n");
  } else {
    console.log("   WARNING: Policy engine not responding\n");
  }

  // 6. Register user accounts
  console.log("6. Registering user accounts...\n");

  const srProfile = await client.get<{ did: string }>(`/api/v1/profiles/${SR_USERNAME}`);
  const srDid = srProfile.did;
  if (!srDid) throw new Error("SR has no DID");
  console.log(`   SR DID: ${srDid}\n`);

  const funderId = process.env.HEDERA_ACCOUNT_ID;
  const funderKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!funderId || !funderKey) {
    throw new Error("Missing HEDERA_ACCOUNT_ID or DEPLOYER_PRIVATE_KEY in scripts/.env");
  }

  // For iREC 7: only one user role (Registrant). For AMS-I.F: PP + VVB.
  const users = useIrec
    ? [{ username: PP_USERNAME, password: PP_PASSWORD }]
    : [
        { username: PP_USERNAME, password: PP_PASSWORD },
        { username: VVB_USERNAME, password: VVB_PASSWORD },
      ];

  for (const { username, password } of users) {
    try {
      await client.register(username, password, "USER");
      console.log(`   Registered: ${username}`);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("already") || msg.includes("409")) {
        console.log(`   ${username} already registered`);
      } else {
        throw err;
      }
    }

    const userClient = new GuardianClient(baseUrl);
    await userClient.login(username, password);

    const profile = await userClient.get<{ confirmed?: boolean; did?: string }>(
      `/api/v1/profiles/${username}`
    );

    if (profile.confirmed) {
      console.log(`   ${username} profile already confirmed (DID: ${profile.did})`);
    } else {
      console.log(`   Creating Hedera account for ${username}...`);
      const { accountId, privateKey } = await createHederaAccount(funderId, funderKey);
      console.log(`   -> ${accountId}`);

      console.log(`   Configuring profile (linked to SR)...`);
      try {
        await userClient.putAsync(`/api/v1/profiles/push/${username}`, {
          entity: "USER",
          hederaAccountId: accountId,
          hederaAccountKey: privateKey,
          parent: srDid,
        }, 600_000);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes("Invalid DID")) {
          console.log(`   (benign: Invalid DID — profile may still confirm)`);
        } else {
          throw err;
        }
      }

      let confirmed = false;
      for (let i = 0; i < 60; i++) {
        const p = await userClient.get<{ confirmed: boolean }>(`/api/v1/profiles/${username}`);
        if (p.confirmed) { confirmed = true; break; }
        await new Promise((r) => setTimeout(r, 5000));
        process.stdout.write(".");
      }
      if (!confirmed) throw new Error(`${username} profile timed out`);
      console.log(`\n   ${username} profile confirmed`);
    }
  }
  console.log("");

  // 7. Assign policy to users
  console.log("7. Assigning policy...");
  for (const { username } of users) {
    try {
      await client.post(`/api/v1/permissions/users/${username}/policies/assign`, {
        policyIds: [policyId],
        assign: true,
      });
      console.log(`   Assigned to ${username}`);
    } catch (err) {
      console.log(`   Assignment for ${username}: ${(err as Error).message.slice(0, 200)}`);
    }
  }
  console.log("");

  // 8. Save credentials to .env.cdm
  saveEnv(policyId);
}

function saveEnv(policyId: string) {
  const envPath = path.join(__dirname, ".env.cdm");
  let content = fs.readFileSync(envPath, "utf-8");
  content = content.replace(/GUARDIAN_POLICY_ID=.*/, `GUARDIAN_POLICY_ID="${policyId}"`);
  content = content.replace(/GUARDIAN_SR_USERNAME=.*/, `GUARDIAN_SR_USERNAME="${SR_USERNAME}"`);
  content = content.replace(/GUARDIAN_SR_PASSWORD=.*/, `GUARDIAN_SR_PASSWORD="${SR_PASSWORD}"`);
  content = content.replace(/GUARDIAN_PP_USERNAME=.*/, `GUARDIAN_PP_USERNAME="${PP_USERNAME}"`);
  content = content.replace(/GUARDIAN_PP_PASSWORD=.*/, `GUARDIAN_PP_PASSWORD="${PP_PASSWORD}"`);
  content = content.replace(/GUARDIAN_VVB_USERNAME=.*/, `GUARDIAN_VVB_USERNAME="${VVB_USERNAME}"`);
  content = content.replace(/GUARDIAN_VVB_PASSWORD=.*/, `GUARDIAN_VVB_PASSWORD="${VVB_PASSWORD}"`);
  fs.writeFileSync(envPath, content);

  console.log("=== Setup Complete ===");
  console.log(`Policy ID: ${policyId}`);
  console.log("Credentials saved to scripts/guardian/.env.cdm");
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
