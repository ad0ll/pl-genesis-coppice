import type { VCEvidence } from "@/lib/guardian-types";
import { hashScanTxUrl } from "@/components/ui/hashscan-link";

function abbreviateDid(did: string): string {
  const parts = did.split("_");
  const accountId = parts.length > 1 ? parts[parts.length - 1] : "";
  return accountId ? `did:hedera:...${accountId}` : did.slice(0, 20) + "...";
}

function ipfsUrl(hash: string): string {
  return `/api/guardian/ipfs/${hash}`;
}

interface VCEvidenceRowProps {
  label: string;
  evidence: VCEvidence;
  children?: React.ReactNode;
}

export function VCEvidenceRow({ label, evidence, children }: VCEvidenceRowProps) {
  return (
    <div className="py-3 border-b border-border/30 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-text uppercase tracking-wider">{label}</p>
        <p className="text-[11px] sm:text-xs text-text-muted font-mono">{evidence.proofType}</p>
      </div>
      <div className="space-y-1 text-xs text-text-muted">
        <p>
          <span className="text-text-muted">Signed by </span>
          <span className="font-mono text-text-muted">{abbreviateDid(evidence.issuer)}</span>
        </p>
        <p>
          <span className="text-text-muted">Date: </span>
          {new Date(evidence.issuanceDate).toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </p>
        {children}
      </div>
      <div className="flex gap-3 mt-2">
        <a href={ipfsUrl(evidence.hash)} target="_blank" rel="noopener noreferrer"
          className="text-[11px] sm:text-xs text-bond-green hover:text-bond-green/80 transition-colors">
          View on IPFS
        </a>
        <a href={hashScanTxUrl(evidence.messageId)} target="_blank" rel="noopener noreferrer"
          className="text-[11px] sm:text-xs text-bond-green hover:text-bond-green/80 transition-colors">
          View on HashScan
        </a>
      </div>
    </div>
  );
}
