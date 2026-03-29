# Storacha Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Configure Guardian to use Storacha (web3.storage) as its IPFS provider, giving all Verifiable Credentials automatic Filecoin mainnet persistence, and add frontend UI to surface the decentralized storage layer.

**Architecture:** Guardian stores VCs on IPFS. By switching `IPFS_PROVIDER` to `"web3storage"`, all IPFS uploads go through Storacha, which automatically creates Filecoin mainnet storage deals. No custom backend upload code needed — Guardian handles it. Frontend adds Storacha gateway links and a storage status card.

**Tech Stack:** Next.js 16, react-query, Tailwind CSS v4, Storacha CLI (VPS setup only)

**CRITICAL:** All pushes go to `pl-genesis` remote ONLY. NEVER push to `origin`.

---

### Task 0: Guardian VPS — Storacha Configuration

This is VPS config, run from your local terminal via SSH. No code changes.

**Step 1: Install Storacha CLI locally**

```bash
npm install -g @storacha/cli
```

**Step 2: Login and create space**

```bash
storacha login <your-email>
storacha space create "coppice-guardian"
```

**Step 3: Generate key and delegation proof**

```bash
storacha key create
# Output: MgC... (save this as IPFS_STORAGE_KEY)

# Get the agent DID from the key output, then:
storacha delegation create <did:key:z6Mk...> --base64
# Output: base64 string (save this as IPFS_STORAGE_PROOF)
```

**Step 4: SSH into Guardian VPS and configure**

```bash
ssh guardian.coppice.cc
```

Edit `./configs/.env.<env>.guardian.system`:
```
IPFS_PROVIDER="web3storage"
IPFS_STORAGE_KEY="MgC..."
IPFS_STORAGE_PROOF="<base64>"
```

**Step 5: Restart Guardian**

```bash
docker compose down && docker compose up -d
```

**Step 6: Verify — create a test allocation and check that the IPFS hash resolves via Storacha gateway**

```bash
# After creating an allocation via the Issuer page:
curl -I "https://<ipfs-hash>.ipfs.w3s.link"
# Should return 200 OK
```

**Step 7: No commit needed** — this is VPS-only config.

---

### Task 1: Storacha Constants + Gateway URL Helper

**Files:**
- Modify: `frontend/lib/constants.ts`
- Create: `frontend/lib/storacha.ts`
- Test: `frontend/__tests__/lib/storacha.test.ts`

**Step 1: Write the failing test**

```typescript
// frontend/__tests__/lib/storacha.test.ts
import { describe, it, expect } from "vitest";
import { storachaGatewayUrl, isStorachaConfigured } from "@/lib/storacha";

describe("storachaGatewayUrl", () => {
  it("builds correct gateway URL from IPFS CID", () => {
    const url = storachaGatewayUrl("QmTest123abc");
    expect(url).toBe("https://QmTest123abc.ipfs.w3s.link");
  });

  it("returns null for empty CID", () => {
    expect(storachaGatewayUrl("")).toBeNull();
  });
});

describe("isStorachaConfigured", () => {
  it("returns a boolean", () => {
    expect(typeof isStorachaConfigured()).toBe("boolean");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run __tests__/lib/storacha.test.ts
```

Expected: FAIL — module not found.

**Step 3: Write the implementation**

```typescript
// frontend/lib/storacha.ts

const STORACHA_GATEWAY = "https://{cid}.ipfs.w3s.link";

/**
 * Build a Storacha gateway URL for an IPFS CID.
 * Storacha persists IPFS content to Filecoin mainnet automatically.
 */
export function storachaGatewayUrl(cid: string): string | null {
  if (!cid) return null;
  return STORACHA_GATEWAY.replace("{cid}", cid);
}

/**
 * Whether Storacha is configured as the Guardian IPFS provider.
 * This is a build-time flag — set NEXT_PUBLIC_STORACHA_ENABLED=true
 * after configuring Guardian VPS with IPFS_PROVIDER="web3storage".
 */
export function isStorachaConfigured(): boolean {
  return process.env.NEXT_PUBLIC_STORACHA_ENABLED === "true";
}
```

**Step 4: Add env var to constants files**

Append to `frontend/.env.local`:
```
# Storacha (Filecoin-backed IPFS) — set to true after Guardian VPS config
NEXT_PUBLIC_STORACHA_ENABLED=true
```

Append to `frontend/.env.local.example`:
```
# Storacha (Filecoin-backed IPFS via Guardian) — set to true after configuring Guardian
NEXT_PUBLIC_STORACHA_ENABLED=false
```

**Step 5: Run test to verify it passes**

```bash
cd frontend && npx vitest run __tests__/lib/storacha.test.ts
```

**Step 6: Commit**

```bash
git add frontend/lib/storacha.ts frontend/__tests__/lib/storacha.test.ts frontend/.env.local.example
git commit -m "feat: add Storacha gateway URL helper and config flag"
```

---

### Task 2: Add Storacha Gateway Link to VCEvidenceRow

**Files:**
- Modify: `frontend/components/guardian/vc-evidence.tsx`

**Step 1: Read the file to understand current state**

Read `frontend/components/guardian/vc-evidence.tsx`.

**Step 2: Add Storacha gateway link**

After the existing "View on IPFS" and "View on HashScan" links (line 41-49), add a conditional "View on Storacha" link:

```tsx
// Add import at top:
import { storachaGatewayUrl, isStorachaConfigured } from "@/lib/storacha";

// In the links div (after the HashScan link):
{isStorachaConfigured() && storachaGatewayUrl(evidence.hash) && (
  <a href={storachaGatewayUrl(evidence.hash)!}
    target="_blank" rel="noopener noreferrer"
    className="text-[11px] sm:text-xs text-bond-green hover:text-bond-green/80 transition-colors">
    View on Storacha
  </a>
)}
```

**Step 3: Run lint + build**

```bash
cd /Users/adoll/projects/hedera-green-bonds/.worktrees/feat-filecoin && npm run lint && npm run build
```

**Step 4: Commit**

```bash
git add frontend/components/guardian/vc-evidence.tsx
git commit -m "feat: add Storacha gateway link on VC evidence rows"
```

---

### Task 3: StorageStatusCard Component on Impact Page

**Files:**
- Create: `frontend/components/filecoin/storage-status-card.tsx`
- Modify: `frontend/app/impact/page.tsx`

**Step 1: Build the StorageStatusCard component**

A "Decentralized Storage" card for the Impact page showing the storage architecture. Uses Guardian data (which we already fetch via `useGuardian()`) to count documents with IPFS hashes.

```tsx
// frontend/components/filecoin/storage-status-card.tsx
"use client";

import { useGuardian } from "@/hooks/use-guardian";
import { isStorachaConfigured, storachaGatewayUrl } from "@/lib/storacha";

export function StorageStatusCard() {
  const { data } = useGuardian();

  // Count all VCs that have IPFS evidence hashes
  const evidenceHashes: { label: string; hash: string }[] = [];
  if (data) {
    if (data.bondFrameworkEvidence?.hash) {
      evidenceHashes.push({ label: "Bond Framework", hash: data.bondFrameworkEvidence.hash });
    }
    for (const p of data.projects) {
      if (p.registrationEvidence?.hash)
        evidenceHashes.push({ label: `${p.registration.ProjectName} — Registration`, hash: p.registrationEvidence.hash });
      if (p.allocationEvidence?.hash)
        evidenceHashes.push({ label: `${p.registration.ProjectName} — Allocation`, hash: p.allocationEvidence.hash });
      if (p.mrvEvidence?.hash)
        evidenceHashes.push({ label: `${p.registration.ProjectName} — MRV Report`, hash: p.mrvEvidence.hash });
      if (p.verificationEvidence?.hash)
        evidenceHashes.push({ label: `${p.registration.ProjectName} — Verification`, hash: p.verificationEvidence.hash });
    }
  }

  const storachaEnabled = isStorachaConfigured();

  return (
    <section>
      <h2 className="card-title">Decentralized Storage</h2>
      <div className="card-static">
        {/* Stats row */}
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

        {/* How it works */}
        <div className="text-xs text-text-muted mb-4 p-3 bg-surface-2/50 rounded-lg">
          <p>
            {storachaEnabled
              ? "All Verifiable Credentials are stored on IPFS via Storacha, which automatically creates Filecoin mainnet storage deals for long-term persistence. Each document is content-addressed (CID) and verifiable."
              : "Verifiable Credentials are stored on IPFS via Guardian. Configure Storacha for automatic Filecoin mainnet persistence."}
          </p>
          <p className="mt-2">
            Data integrity chain: <span className="text-text">Hedera HCS</span> (timestamps)
            {" → "}<span className="text-text">IPFS</span> (content addressing)
            {storachaEnabled && <>{" → "}<span className="text-text">Filecoin</span> (persistent storage deals)</>}
          </p>
        </div>

        {/* Recent documents */}
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
```

**Step 2: Add StorageStatusCard to Impact page**

In `frontend/app/impact/page.tsx`, after the ICMA Compliance Evidence section (after the closing `)}` around line 222), add:

```tsx
// Add import at top:
import { StorageStatusCard } from "@/components/filecoin/storage-status-card";

// After ICMA section, before closing </div>:
<div {...entranceProps(5)}>
  <StorageStatusCard />
</div>
```

**Step 3: Run lint + build**

```bash
cd /Users/adoll/projects/hedera-green-bonds/.worktrees/feat-filecoin && npm run lint && npm run build
```

**Step 4: Commit**

```bash
git add frontend/components/filecoin/storage-status-card.tsx frontend/app/impact/page.tsx
git commit -m "feat: add Decentralized Storage card to Impact page"
```

---

### Task 4: Documentation Updates

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Update README.md**

Add a "Decentralized Storage — Storacha + Filecoin" section after the existing architecture description. Cover:
- How Storacha works (IPFS hot storage + automatic Filecoin mainnet deals)
- Data integrity chain: Hedera HCS → IPFS/Storacha → Filecoin
- Guardian configuration (IPFS_PROVIDER="web3storage")
- Storacha gateway links (w3s.link)
- Setup instructions for new contributors

**Step 2: Update CLAUDE.md**

Add to Key Files section:
- `frontend/lib/storacha.ts` — Storacha gateway URL helper
- `frontend/components/filecoin/storage-status-card.tsx` — Decentralized storage UI

Add to environment section:
- `NEXT_PUBLIC_STORACHA_ENABLED` — set to `true` after Guardian VPS Storacha config

Add note about Guardian IPFS provider configuration.

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: add Storacha/Filecoin integration documentation"
```

---

### Task 5: Unit Tests for StorageStatusCard

**Files:**
- Create: `frontend/__tests__/components/storage-status-card.test.tsx`

**Step 1: Write tests**

Test that:
1. Card renders "Decentralized Storage" heading
2. Document count matches Guardian evidence hashes
3. "Storacha" provider shown when `NEXT_PUBLIC_STORACHA_ENABLED=true`
4. "Local Node" shown when Storacha is not configured
5. Storacha gateway links appear when enabled

Mock `useGuardian()` to return test data.

**Step 2: Run tests**

```bash
cd frontend && npx vitest run __tests__/components/storage-status-card.test.tsx
```

**Step 3: Commit**

```bash
git add frontend/__tests__/components/storage-status-card.test.tsx
git commit -m "test: add StorageStatusCard unit tests"
```

---

### Task 6: E2E Test for Storacha Integration

**Files:**
- Create: `e2e/storacha-storage.spec.ts`

**Step 1: Write E2E test**

Test that:
1. Impact page renders "Decentralized Storage" section
2. Document count is visible
3. Storacha gateway links appear (if enabled)
4. Evidence rows show "View on Storacha" links

Follow existing E2E patterns from `e2e/` directory. This is a read-only test — no wallet mocking needed.

**Step 2: Run E2E locally**

```bash
cd e2e && npx playwright test storacha-storage.spec.ts
```

**Step 3: Commit**

```bash
git add e2e/storacha-storage.spec.ts
git commit -m "test: add Storacha storage E2E test"
```

---

### Task 7: Final Build + Push to pl-genesis

**Step 1: Run full test suite**

```bash
cd /Users/adoll/projects/hedera-green-bonds/.worktrees/feat-filecoin
npm run lint && npm run build && npm run test:unit
```

**Step 2: Push to pl-genesis remote ONLY**

```bash
git push pl-genesis feat/filecoin
```

**CRITICAL: Do NOT run `git push origin`. The `origin` remote points to the Apex/Synthesis hackathon repo.**

**Step 3: Verify on GitHub**

Check https://github.com/ad0ll/pl-genesis-coppice to confirm the branch is there.
