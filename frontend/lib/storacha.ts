const STORACHA_GATEWAY_TEMPLATE = "https://{cid}.ipfs.w3s.link";

/**
 * Build a Storacha gateway URL for an IPFS CID.
 * Storacha persists IPFS content to Filecoin mainnet automatically.
 */
export function storachaGatewayUrl(cid: string): string | null {
  if (!cid) return null;
  return STORACHA_GATEWAY_TEMPLATE.replace("{cid}", cid);
}

/**
 * Whether Storacha is configured as the Guardian IPFS provider.
 * Set NEXT_PUBLIC_STORACHA_ENABLED=true after configuring Guardian VPS
 * with IPFS_PROVIDER="web3storage".
 */
export function isStorachaConfigured(): boolean {
  return process.env.NEXT_PUBLIC_STORACHA_ENABLED === "true";
}
