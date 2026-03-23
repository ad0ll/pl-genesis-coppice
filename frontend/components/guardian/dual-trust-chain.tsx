"use client";

import { useState } from "react";
import { useGuardianCDM } from "@/hooks/use-guardian-cdm";
import { StatusBadge } from "@/components/ui/status-badge";
import { VCEvidenceRow } from "@/components/guardian/vc-evidence";
import { formatNumber } from "@/lib/format";
import type { CDMProject, CDMMonitoringReport } from "@/lib/guardian-types";

function CDMProjectCard({ project }: { project: CDMProject }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card-static flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text">
          {project.projectParticipant}
        </h4>
        <StatusBadge
          label={project.status}
          variant={project.status === "Validated" ? "green" : "amber"}
        />
      </div>

      <p className="text-xs text-text-muted line-clamp-2">
        {project.description}
      </p>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-0.5 rounded bg-bond-green/10 text-bond-green font-medium">
          {project.technology}
        </span>
        <span className="px-2 py-0.5 rounded bg-surface-3 text-text-muted font-medium">
          {project.methodology.split(":")[0]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t border-border/30 pt-2 mt-1">
        <div>
          <span className="text-text-muted">Net Electricity</span>
          <p className="font-mono text-text">{formatNumber(project.netElectricityMWh)} MWh</p>
        </div>
        <div>
          <span className="text-text-muted">Location</span>
          <p className="font-mono text-text">
            {project.location.lat.toFixed(2)}, {project.location.lon.toFixed(2)}
          </p>
        </div>
        <div>
          <span className="text-text-muted">Crediting Period</span>
          <p className="font-mono text-text">
            {project.creditingPeriod.start} &mdash; {project.creditingPeriod.end}
          </p>
        </div>
        <div>
          <span className="text-text-muted">Start Date</span>
          <p className="font-mono text-text">{project.startDate}</p>
        </div>
      </div>

      {project.evidence && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="w-full text-left text-xs text-text-muted hover:text-text transition-colors pt-2 mt-1 border-t border-border/30 flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 chevron-rotate ${expanded ? "rotate-90" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            {expanded ? "Hide Evidence" : "View VC Evidence"}
          </button>

          {expanded && (
            <div className="mt-2 animate-expand-enter">
              <VCEvidenceRow label="CDM Project Registration" evidence={project.evidence}>
                <p>
                  <span className="text-text-muted">Methodology: </span>
                  {project.methodology}
                </p>
                {project.sdgContributions && (
                  <p>
                    <span className="text-text-muted">SDGs: </span>
                    {project.sdgContributions.slice(0, 120)}
                    {project.sdgContributions.length > 120 ? "..." : ""}
                  </p>
                )}
              </VCEvidenceRow>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CDMReportCard({ report }: { report: CDMMonitoringReport }) {
  return (
    <div className="card-static flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
          Monitoring Report
        </h4>
        <StatusBadge
          label={report.status}
          variant={report.status === "Verified" ? "green" : "amber"}
        />
      </div>
      <p className="text-xs text-text-muted line-clamp-2">
        {report.description}
      </p>
      <div className="grid grid-cols-2 gap-x-4 text-xs border-t border-border/30 pt-2 mt-1">
        <div>
          <span className="text-text-muted">Period</span>
          <p className="font-mono text-text">
            {report.monitoringPeriod.start} &mdash; {report.monitoringPeriod.end}
          </p>
        </div>
        <div>
          <span className="text-text-muted">Net Electricity</span>
          <p className="font-mono text-text">{formatNumber(report.netElectricityMWh)} MWh</p>
        </div>
      </div>
    </div>
  );
}

function TrustChainDiagram() {
  return (
    <div className="flex items-center gap-2 text-xs py-3 overflow-x-auto">
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="w-8 h-8 rounded-full bg-bond-green/15 flex items-center justify-center">
          <svg className="w-4 h-4 text-bond-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
          </svg>
        </div>
        <span className="text-text-muted whitespace-nowrap">Bond Issuance</span>
        <span className="text-[10px] text-text-muted/60">Instance 1</span>
      </div>

      <div className="h-px bg-border flex-1 min-w-4" />

      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="w-8 h-8 rounded-full bg-bond-amber/15 flex items-center justify-center">
          <svg className="w-4 h-4 text-bond-amber" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <span className="text-text-muted whitespace-nowrap">CDM Methodology</span>
        <span className="text-[10px] text-text-muted/60">Instance 2</span>
      </div>

      <div className="h-px bg-border flex-1 min-w-4" />

      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="w-8 h-8 rounded-full bg-bond-teal/15 flex items-center justify-center">
          <svg className="w-4 h-4 text-bond-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <span className="text-text-muted whitespace-nowrap">Hedera Testnet</span>
        <span className="text-[10px] text-text-muted/60">Convergence</span>
      </div>
    </div>
  );
}

export function DualTrustChain() {
  const { data, isLoading, error } = useGuardianCDM();

  if (isLoading) {
    return (
      <div className="card-static" role="status" aria-label="Loading CDM data">
        <div className="h-4 w-48 skeleton-shimmer rounded mb-3" />
        <div className="h-3 w-full skeleton-shimmer rounded mb-2" />
        <div className="h-3 w-3/4 skeleton-shimmer rounded" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card-static border-bond-amber/30">
        <p className="text-sm text-bond-amber">
          CDM Guardian data unavailable. The carbon methodology verification chain will appear here when connected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="card-title mb-0">Dual Trust Chain</h2>
        <div className="flex items-center gap-2">
          <StatusBadge label={data.policyName} variant="green" />
          {data.cerToken && (
            <a
              href={`https://hashscan.io/testnet/token/${data.cerToken.tokenId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-bond-green hover:text-bond-green/80 transition-colors"
            >
              CER Token
            </a>
          )}
        </div>
      </div>

      <p className="text-xs text-text-muted">
        Two independent Guardian policy engines verify the same project through complementary trust chains
        &mdash; bond fund allocation (Instance 1) and CDM carbon methodology (Instance 2) &mdash;
        both anchored to Hedera testnet.
      </p>

      <TrustChainDiagram />

      {data.cerToken && (
        <div className="grid grid-cols-3 gap-4 text-xs border-t border-border/30 pt-3">
          <div>
            <span className="text-text-muted">CER Token</span>
            <p className="font-mono text-text">{data.cerToken.tokenSymbol}</p>
          </div>
          <div>
            <span className="text-text-muted">Token ID</span>
            <p className="font-mono text-text">{data.cerToken.tokenId}</p>
          </div>
          <div>
            <span className="text-text-muted">NFTs Minted</span>
            <p className="font-mono text-text">{data.cerToken.nftsMinted}</p>
          </div>
        </div>
      )}

      {data.projects.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
            CDM Verified Projects ({data.projects.length})
          </h3>
          {data.projects.map((p, i) => (
            <CDMProjectCard key={i} project={p} />
          ))}
        </div>
      )}

      {data.reports.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
            Monitoring Reports ({data.reports.length})
          </h3>
          {data.reports.map((r, i) => (
            <CDMReportCard key={i} report={r} />
          ))}
        </div>
      )}
    </div>
  );
}
