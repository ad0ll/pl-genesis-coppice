"use client";

import { useGuardian } from "@/hooks/use-guardian";
import { isStorachaConfigured, storachaGatewayUrl } from "@/lib/storacha";

export function StorageStatusCard() {
  const { data } = useGuardian();

  const evidenceHashes: { label: string; hash: string }[] = [];
  if (data) {
    if (data.bondFrameworkEvidence?.hash) {
      evidenceHashes.push({ label: "Bond Framework", hash: data.bondFrameworkEvidence.hash });
    }
    for (const p of data.projects) {
      const name = p.registration.ProjectName;
      if (p.registrationEvidence?.hash)
        evidenceHashes.push({ label: `${name} — Registration`, hash: p.registrationEvidence.hash });
      if (p.allocationEvidence?.hash)
        evidenceHashes.push({ label: `${name} — Allocation`, hash: p.allocationEvidence.hash });
      if (p.mrvEvidence?.hash)
        evidenceHashes.push({ label: `${name} — MRV Report`, hash: p.mrvEvidence.hash });
      if (p.verificationEvidence?.hash)
        evidenceHashes.push({ label: `${name} — Verification`, hash: p.verificationEvidence.hash });
    }
  }

  const storachaEnabled = isStorachaConfigured();

  return (
    <section>
      <h2 className="card-title">Decentralized Storage</h2>
      <div className="card-static">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="stat-label mb-1">Documents</p>
            <p className="font-mono text-lg text-text">{evidenceHashes.length}</p>
          </div>
          <div>
            <p className="stat-label mb-1">IPFS Provider</p>
            <p className="text-sm text-text">{storachaEnabled ? "Storacha" : "Local Node"}</p>
          </div>
          <div>
            <p className="stat-label mb-1">Persistence</p>
            <p className="text-sm text-text">{storachaEnabled ? "Filecoin Mainnet" : "Guardian IPFS"}</p>
          </div>
        </div>

        <div className="text-xs text-text-muted mb-4 p-3 bg-surface-2/50 rounded-lg">
          <p>
            {storachaEnabled
              ? "All Verifiable Credentials are stored on IPFS via Storacha, which automatically creates Filecoin mainnet storage deals for long-term persistence. Each document is content-addressed (CID) and verifiable."
              : "Verifiable Credentials are stored on IPFS via Guardian. Configure Storacha for automatic Filecoin mainnet persistence."}
          </p>
          <p className="mt-2">
            Data integrity chain: <span className="text-text">Hedera HCS</span> (timestamps)
            {" \u2192 "}<span className="text-text">IPFS</span> (content addressing)
            {storachaEnabled && <>{" \u2192 "}<span className="text-text">Filecoin</span> (persistent storage deals)</>}
          </p>
        </div>

        {evidenceHashes.length > 0 && (
          <div>
            <p className="stat-label mb-2">Archived Documents</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {evidenceHashes.map((item) => (
                <div key={item.hash} className="flex items-center justify-between text-xs py-1.5 border-b border-border/20 last:border-0">
                  <span className="text-text-muted truncate mr-3">{item.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-text/60 text-[11px]">
                      {item.hash.slice(0, 8)}...{item.hash.slice(-4)}
                    </span>
                    {storachaEnabled && storachaGatewayUrl(item.hash) && (
                      <a
                        href={storachaGatewayUrl(item.hash)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-bond-green hover:text-bond-green/80 transition-colors"
                      >
                        View
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
