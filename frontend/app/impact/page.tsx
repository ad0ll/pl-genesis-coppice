"use client";

import { useMemo } from "react";
import { useGuardian } from "@/hooks/use-guardian";
import { formatNumber } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProjectCard } from "@/components/guardian/project-card";
import { SptStatus } from "@/components/guardian/spt-status";
import { AllocationBar } from "@/components/guardian/allocation-bar";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { DualTrustChain } from "@/components/guardian/dual-trust-chain";
import { AddressLink } from "@/components/ui/hashscan-link";
import { entranceProps } from "@/lib/animation";

function MetricsSkeleton() {
  return (
    <div role="status" aria-label="Loading impact data" className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 py-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <div className="h-3 w-20 skeleton-shimmer rounded mb-2" />
          <div className="h-8 w-24 skeleton-shimmer rounded mb-1" />
          <div className="h-3 w-12 skeleton-shimmer rounded" />
        </div>
      ))}
    </div>
  );
}

export default function ImpactPage() {
  const { data, isLoading, error } = useGuardian();

  const metrics = useMemo(() => data
    ? [
        {
          label: "tCO\u2082e Verified",
          value: formatNumber(data.totalVerifiedCO2e),
          unit: "tonnes",
        },
        {
          label: "Proceeds Allocated",
          value: `${data.allocationPercent}%`,
          unit: `${formatNumber(data.totalAllocatedEUSD)} eUSD`,
        },
        {
          label: "Projects Funded",
          value: String(data.projects.length),
          unit: "active",
        },
        {
          label: "SPT Status",
          value: data.sptMet ? "Met" : "Below",
          unit: `${formatNumber(data.totalVerifiedCO2e)} / ${formatNumber(data.sptTarget)} tCO₂e`,
        },
      ]
    : [], [data]);

  return (
    <div className="space-y-8">
      <h1 {...entranceProps(0, "page-title")}>
        Environmental Impact
      </h1>

      {/* Metrics banner */}
      <div
        {...entranceProps(1, "bg-surface-2 border-y border-border full-bleed pb-2")}
      >
        {isLoading ? (
          <MetricsSkeleton />
        ) : (
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 py-6">
            {metrics.map((m) => (
              <div key={m.label}>
                <p className="stat-label mb-1.5">{m.label}</p>
                <p className="font-display text-3xl text-text">
                  <span className="font-mono">{m.value}</span>
                </p>
                <p className="text-xs text-text-muted mt-1">{m.unit}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          {...entranceProps(2, "card-static border-bond-amber/30")}
        >
          <p className="text-sm text-bond-amber">
            Guardian MRV data unavailable. Showing cached data if available.
          </p>
        </div>
      )}

      {/* SPT + Allocation */}
      {data && (
        <div
          {...entranceProps(2, "grid grid-cols-1 sm:grid-cols-2 gap-4")}
        >
          <SectionErrorBoundary section="impact data">
            <SptStatus
              totalVerified={data.totalVerifiedCO2e}
              target={data.sptTarget}
              met={data.sptMet}
            />
            <AllocationBar
              allocated={data.totalAllocatedEUSD}
              total={data.totalIssuanceEUSD}
              percent={data.allocationPercent}
              projects={data.projects}
            />
          </SectionErrorBoundary>
        </div>
      )}

      {/* Project Portfolio */}
      <section {...entranceProps(3)}>
        <h2 className="card-title">Project Portfolio</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card-static h-32">
                <div className="h-4 w-32 skeleton-shimmer rounded mb-3" />
                <div className="h-3 w-24 skeleton-shimmer rounded mb-2" />
                <div className="h-3 w-40 skeleton-shimmer rounded" />
              </div>
            ))}
          </div>
        ) : data && data.projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...data.projects]
              .sort((a, b) => a.registration.ProjectName.localeCompare(b.registration.ProjectName))
              .map((p, idx) => (
                <div key={p.registration.ProjectName} {...entranceProps(idx + 4)}>
                  <ProjectCard project={p} />
                </div>
              ))}
          </div>
        ) : (
          <div className="card-static text-sm text-text-muted">
            No projects registered yet.
          </div>
        )}
      </section>

      {/* Dual Trust Chain — CDM Methodology (Instance 2) */}
      <section {...entranceProps(4)}>
        <SectionErrorBoundary section="CDM methodology data">
          <DualTrustChain />
        </SectionErrorBoundary>
      </section>

      {/* ICMA Compliance Evidence */}
      {data && data.bondFramework && (
        <section {...entranceProps(5)}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title mb-0">ICMA Compliance Evidence</h2>
            <div className="flex items-center gap-2">
              {data.bondFrameworkEvidence && (
                <a
                  href={`/api/guardian/ipfs/${data.bondFrameworkEvidence.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] sm:text-xs text-bond-green hover:text-bond-green/80 transition-colors"
                >
                  View VC
                </a>
              )}
              <StatusBadge label="Guardian Verified" variant="green" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Use of Proceeds */}
            <div className="card-static">
              <p className="stat-label mb-2">Use of Proceeds</p>
              <p className="text-sm text-text mb-1">{data.bondFramework.EligibleICMACategories}</p>
              <p className="text-xs text-text-muted">
                {data.allocationPercent}% allocated ({formatNumber(data.totalAllocatedEUSD)} / {formatNumber(data.totalIssuanceEUSD)} eUSD) across {data.projects.length} projects
              </p>
            </div>

            {/* Project Evaluation & Selection */}
            <div className="card-static">
              <p className="stat-label mb-2">Project Evaluation</p>
              <p className="text-sm text-text mb-1">
                {data.projects.filter(p => p.isVerified).length} of {data.projects.length} projects independently verified
              </p>
              <p className="text-xs text-text-muted">
                External review: {data.bondFramework.ExternalReviewProvider ?? "Not specified"}
              </p>
            </div>

            {/* Management of Proceeds */}
            <div className="card-static">
              <p className="stat-label mb-2">Management of Proceeds</p>
              <p className="text-sm text-text mb-1">On-chain treasury with smart contract controls</p>
              <div className="flex gap-3 mt-1">
                <AddressLink address={data.bondFramework.BondContractAddress} type="contract" label="Bond Contract"
                  className="text-[11px] sm:text-xs text-bond-green hover:text-bond-green/80 inline-flex items-center gap-1" />
                <AddressLink address={data.bondFramework.LCCFContractAddress} type="contract" label="Payout Contract"
                  className="text-[11px] sm:text-xs text-bond-green hover:text-bond-green/80 inline-flex items-center gap-1" />
              </div>
            </div>

            {/* Reporting */}
            <div className="card-static">
              <p className="stat-label mb-2">Reporting &amp; Frameworks</p>
              <p className="text-sm text-text mb-1">{data.bondFramework.ReportingStandard}</p>
              {data.bondFramework.RegulatoryFrameworks && (
                <p className="text-xs text-text-muted">{data.bondFramework.RegulatoryFrameworks}</p>
              )}
              {data.bondFramework.EUTaxonomyAlignmentPercent != null && (
                <p className="text-xs text-text-muted mt-1">
                  EU Taxonomy alignment: {data.bondFramework.EUTaxonomyAlignmentPercent}%
                  {" "}
                  <a
                    href="https://www.icmagroup.org/sustainable-finance/the-principles-guidelines-and-handbooks/green-bond-principles-gbp/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-bond-green hover:text-bond-green/80 transition-colors"
                  >
                    (ICMA GBP)
                  </a>
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
