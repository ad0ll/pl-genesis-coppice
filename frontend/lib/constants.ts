// ATS deployment (Hedera testnet)
export const ATS_RESOLVER = process.env.NEXT_PUBLIC_ATS_RESOLVER || "0.0.7707874";
export const ATS_FACTORY = process.env.NEXT_PUBLIC_ATS_FACTORY || "0.0.7708432";

// CPC Bond Token — created via ATS factory
// Update after running scripts/ats-setup.ts
export const CPC_SECURITY_ID: string =
  process.env.NEXT_PUBLIC_CPC_SECURITY_ID || "0x0000000000000000000000000000000000000000";

// CPC Bond Token Hedera account ID (for Mirror Node queries)
export const CPC_TOKEN_ID = process.env.NEXT_PUBLIC_CPC_TOKEN_ID || "0.0.8254921";

// eUSD HTS token EVM address (long-zero format per HIP-218)
// HTS token 0.0.8214937 -> 8214937 decimal -> 0x7D5999 hex -> padded to 20 bytes
export const EUSD_EVM_ADDRESS: string =
  process.env.NEXT_PUBLIC_EUSD_EVM_ADDRESS || "0x00000000000000000000000000000000007D5999";

export const MIRROR_NODE_URL =
  process.env.NEXT_PUBLIC_HEDERA_MIRROR_NODE || "https://testnet.mirrornode.hedera.com";

export const JSON_RPC_URL =
  process.env.NEXT_PUBLIC_HEDERA_JSON_RPC || "https://testnet.hashio.io/api";


export const EUSD_TOKEN_ID = process.env.NEXT_PUBLIC_EUSD_TOKEN_ID || "";

export const DEMO_WALLETS: Record<string, { label: string; country: string; role: string }> = {
  "0xeb974ba96c4912499c3b3bbd5a40617e1f6eecee": { label: "Deployer/Issuer", country: "DE", role: "issuer" },
  "0x4f9ad4fd6623b23bed45e47824b1f224da21d762": { label: "Alice", country: "DE", role: "verified" },
  "0xad33bd43bd3c93ec956f00c2d9782b7ae929e2f7": { label: "Bob", country: "US", role: "unverified" },
  "0xff3a3d1fec979bb1c6b3b368752b61b249a76f90": { label: "Charlie", country: "CN", role: "verified" },
  "0x35bccfff4fcafd35ff5b3c412d85fba6ee04bcdf": { label: "Diana", country: "FR", role: "freeze-demo" },
};

// Deployed contract addresses (Hedera testnet)
export const CONTRACT_ADDRESSES = {
  token: process.env.NEXT_PUBLIC_TOKEN_ADDRESS || "0xcFbB4b74EdbEB4FE33cD050d7a1203d1486047d9",
  identityRegistry: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "0x03ecdB8673d65b81752AC14dAaCa797D846c1B31",
  compliance: process.env.NEXT_PUBLIC_COMPLIANCE_ADDRESS || "0xb6F624B66731AFeEE1443b3F857Cd73b682af4cf",
  claimIssuer: process.env.NEXT_PUBLIC_CLAIM_ISSUER_ADDRESS || "0x6746C2A65b834F3A83Aa95eCAc9C80dF9Bf2AB7A",
};

// CountryRestrictModule deployed address
export const COUNTRY_RESTRICT_MODULE_ADDRESS: string =
  process.env.NEXT_PUBLIC_COUNTRY_RESTRICT_MODULE_ADDRESS || "0x0000000000000000000000000000000000000000";

// Guardian API — Instance 1 (CPC bond MRV policy, server-side only)
export const GUARDIAN_API_URL = (process.env.GUARDIAN_API_URL || "https://guardian.coppice.cc").trim();
export const GUARDIAN_POLICY_ID = (process.env.GUARDIAN_POLICY_ID || "").trim();

// Guardian API — Instance 2 (CDM AMS-I.F methodology, server-side only)
export const CDM_GUARDIAN_API_URL = (process.env.CDM_GUARDIAN_API_URL || "http://195.201.8.147:3200").trim();
export const CDM_GUARDIAN_POLICY_ID = (process.env.CDM_GUARDIAN_POLICY_ID || "").trim();
export const CDM_CER_TOKEN_ID = process.env.CDM_CER_TOKEN_ID || "0.0.8350484";

// Bond details — display defaults (will be supplemented by on-chain data from ATS)
export const BOND_DETAILS = {
  name: "Coppice Green Bond",
  symbol: "CPC",
  couponRate: "4.25%",
  maturity: "2028-03-15",
  issuer: "Coppice Finance",
  currency: "eUSD",
};
