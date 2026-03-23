// Creates an ED25519 Hedera testnet account for the CDM Guardian operator
// Writes to .env.cdm (NOT .env — that's for Instance 1)
// Run once: cd scripts && npx tsx guardian/create-cdm-operator.ts

import { Client, AccountCreateTransaction, PrivateKey, Hbar, AccountId } from "@hashgraph/sdk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the parent scripts/.env for funding account
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  const operatorId = process.env.HEDERA_ACCOUNT_ID;
  const operatorKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!operatorId || !operatorKey) {
    throw new Error("Missing HEDERA_ACCOUNT_ID or DEPLOYER_PRIVATE_KEY in scripts/.env");
  }

  const client = Client.forTestnet();
  const keyHex = operatorKey.startsWith("0x") ? operatorKey.slice(2) : operatorKey;
  client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromStringECDSA(keyHex));

  // Generate ED25519 key pair (Guardian requirement — not ECDSA)
  const newKey = PrivateKey.generateED25519();
  const publicKey = newKey.publicKey;

  // Create account with 50 HBAR
  const tx = await new AccountCreateTransaction()
    .setKey(publicKey)
    .setInitialBalance(new Hbar(50))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const accountId = receipt.accountId!.toString();

  // DER-encoded private key (what Guardian expects)
  const derKey = newKey.toStringDer();

  console.log("CDM Guardian Operator Account Created:");
  console.log(`  Account ID: ${accountId}`);
  console.log(`  Public Key: ${publicKey.toStringDer()}`);
  console.log(`  Private Key (DER): ${derKey}`);

  // Write to guardian/.env.cdm file
  const envContent = [
    "# CDM Guardian operator (ED25519) — created by create-cdm-operator.ts",
    `GUARDIAN_OPERATOR_ID="${accountId}"`,
    `GUARDIAN_OPERATOR_KEY="${derKey}"`,
    "",
    "# CDM Guardian API (Instance 2, port 3200)",
    `GUARDIAN_API_URL="http://195.201.8.147:3200"`,
    "",
    "# Populated by cdm-import.ts",
    "GUARDIAN_POLICY_ID=",
    "GUARDIAN_SR_USERNAME=",
    "GUARDIAN_SR_PASSWORD=",
    "GUARDIAN_PP_USERNAME=",
    "GUARDIAN_PP_PASSWORD=",
    "GUARDIAN_VVB_USERNAME=",
    "GUARDIAN_VVB_PASSWORD=",
    "",
    "# Telemetry opt-out",
    "DO_NOT_TRACK=1",
  ].join("\n");

  fs.writeFileSync(path.join(__dirname, ".env.cdm"), envContent);
  console.log("\nCredentials saved to scripts/guardian/.env.cdm");

  client.close();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
