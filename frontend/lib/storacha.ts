/**
 * Build a gateway URL for an IPFS CID stored via Storacha/Guardian.
 *
 * Guardian stores IPFS content using base58btc multihash identifiers.
 * The Storacha subdomain gateway ({cid}.ipfs.w3s.link) only accepts
 * base32 CIDv1, so we route through the Guardian IPFS proxy which
 * handles the translation and retrieval.
 */
export function storachaGatewayUrl(cid: string): string | null {
  if (!cid) return null;
  return `/api/guardian/ipfs/${cid}`;
}

/**
 * Whether Storacha is configured as the Guardian IPFS provider.
 * Set NEXT_PUBLIC_STORACHA_ENABLED=true after configuring Guardian VPS
 * with IPFS_PROVIDER="web3storage".
 */
export function isStorachaConfigured(): boolean {
  return process.env.NEXT_PUBLIC_STORACHA_ENABLED === "true";
}
