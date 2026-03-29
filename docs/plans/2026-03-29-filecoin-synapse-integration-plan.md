# Filecoin Synapse SDK Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Filecoin Calibration testnet storage for Guardian VCs via Synapse SDK, with frontend UI showing storage proofs and an archive button.

**Architecture:** Next.js API route (`/api/filecoin/store`) wraps Synapse SDK to upload VC JSON documents to Filecoin Calibration. Records stored in `frontend/data/filecoin-records.json` (committed to git). Frontend hook + components display archive status inline on evidence rows and in a dedicated storage card.

**Tech Stack:** `@filoz/synapse-sdk`, ethers v6, Next.js 16 API routes, react-query, Zod, vitest

**CRITICAL:** All pushes go to `pl-genesis` remote ONLY. NEVER push to `origin`.

---

### Task 0: Pre-requisites — USDFC + SDK Verification

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/.env.local.example`
- Create: `frontend/.env.local` (add Filecoin vars — NOT committed)

**Step 1: Install Synapse SDK**

```bash
cd frontend && npm install @filoz/synapse-sdk
```

**Step 2: Add env vars to `.env.local`**

Add to existing `frontend/.env.local`:
```
# Filecoin Calibration (Synapse SDK — server-side only)
FILECOIN_WALLET_PRIVATE_KEY=0x5d8f93f6816f8b70556b9a77628c90083d713e802af708b34f7041dc350b6e66
FILECOIN_RPC=https://rpc.ankr.com/filecoin_testnet
```

**Step 3: Update `.env.local.example`**

Append to `frontend/.env.local.example`:
```
# Filecoin Calibration (Synapse SDK — server-side only)
FILECOIN_WALLET_PRIVATE_KEY=0x...
FILECOIN_RPC=https://rpc.ankr.com/filecoin_testnet
```

**Step 4: Get tUSDFC**

Mint tUSDFC from tFIL at https://stg.usdfc.net or drip from faucet at https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc (5 tUSDFC per request, 1 req/60s). We need USDFC to pay for storage — tFIL only covers gas.

**Step 5: Verify Synapse SDK works — write a test script**

Create a quick Node.js test (not committed) to verify the SDK connects and can upload:

```bash
cd frontend && node -e "
const { Synapse, RPC_URLS } = require('@filoz/synapse-sdk');
// ... quick connection test
"
```

If the SDK import pattern differs (ESM, different API), adjust the plan before proceeding. The SDK docs are at https://docs.filecoin.cloud/getting-started/ — use Context7 MCP to verify the current API.

**Step 6: Commit dependency + env example**

```bash
git add frontend/package.json frontend/package-lock.json frontend/.env.local.example
git commit -m "chore: add @filoz/synapse-sdk dependency and Filecoin env vars"
```

---

### Task 1: Filecoin Types — Zod Schemas

**Files:**
- Create: `frontend/lib/filecoin-types.ts`
- Test: `frontend/__tests__/lib/filecoin-types.test.ts`

**Step 1: Write the failing test**

```typescript
// frontend/__tests__/lib/filecoin-types.test.ts
import { describe, it, expect } from "vitest";
import {
  filecoinStorageRecordSchema,
  filecoinStoreRequestSchema,
  filecoinStoreResponseSchema,
  filecoinRecordsFileSchema,
  type FilecoinStorageRecord,
} from "@/lib/filecoin-types";

describe("filecoinStorageRecordSchema", () => {
  it("validates a complete record", () => {
    const record = {
      vcType: "bond-framework",
      projectName: "Solar Farm Alpha",
      ipfsHash: "QmTest123",
      pieceCid: "baga6ea4seaq...",
      txHash: "0xabc123",
      storedAt: "2026-03-29T12:00:00Z",
      sizeBytes: 1234,
      filecoinNetwork: "calibration",
    };
    const result = filecoinStorageRecordSchema.safeParse(record);
    expect(result.success).toBe(true);
  });

  it("rejects record with missing pieceCid", () => {
    const record = {
      vcType: "bond-framework",
      projectName: "Solar Farm Alpha",
      ipfsHash: "QmTest123",
      storedAt: "2026-03-29T12:00:00Z",
      sizeBytes: 1234,
      filecoinNetwork: "calibration",
    };
    const result = filecoinStorageRecordSchema.safeParse(record);
    expect(result.success).toBe(false);
  });
});

describe("filecoinStoreRequestSchema", () => {
  it("validates mode=all request", () => {
    const result = filecoinStoreRequestSchema.safeParse({ mode: "all" });
    expect(result.success).toBe(true);
  });

  it("validates mode=single request", () => {
    const result = filecoinStoreRequestSchema.safeParse({
      mode: "single",
      vcType: "allocation",
      ipfsHash: "QmTest",
      document: { ProjectName: "Test" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects mode=single without document", () => {
    const result = filecoinStoreRequestSchema.safeParse({
      mode: "single",
      vcType: "allocation",
    });
    expect(result.success).toBe(false);
  });
});

describe("filecoinRecordsFileSchema", () => {
  it("validates records file structure", () => {
    const file = {
      records: [],
      lastUpdated: "2026-03-29T12:00:00Z",
    };
    const result = filecoinRecordsFileSchema.safeParse(file);
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run __tests__/lib/filecoin-types.test.ts
```

Expected: FAIL — module not found.

**Step 3: Write the implementation**

```typescript
// frontend/lib/filecoin-types.ts
import { z } from "zod";

export const filecoinStorageRecordSchema = z.object({
  vcType: z.string(),
  projectName: z.string(),
  ipfsHash: z.string(),
  pieceCid: z.string(),
  txHash: z.string(),
  storedAt: z.string(),
  sizeBytes: z.number(),
  filecoinNetwork: z.literal("calibration"),
});

export type FilecoinStorageRecord = z.infer<typeof filecoinStorageRecordSchema>;

export const filecoinStoreRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({
    mode: z.literal("single"),
    vcType: z.string(),
    ipfsHash: z.string(),
    document: z.record(z.unknown()),
  }),
]);

export type FilecoinStoreRequest = z.infer<typeof filecoinStoreRequestSchema>;

export const filecoinStoreResponseSchema = z.object({
  stored: z.array(filecoinStorageRecordSchema),
  skipped: z.number(),
  error: z.string().optional(),
});

export type FilecoinStoreResponse = z.infer<typeof filecoinStoreResponseSchema>;

export const filecoinRecordsFileSchema = z.object({
  records: z.array(filecoinStorageRecordSchema),
  lastUpdated: z.string(),
});

export type FilecoinRecordsFile = z.infer<typeof filecoinRecordsFileSchema>;
```

**Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run __tests__/lib/filecoin-types.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/lib/filecoin-types.ts frontend/__tests__/lib/filecoin-types.test.ts
git commit -m "feat: add Filecoin storage Zod schemas and types"
```

---

### Task 2: Filecoin Client Library

**Files:**
- Create: `frontend/lib/filecoin.ts`
- Create: `frontend/data/filecoin-records.json`
- Test: `frontend/__tests__/lib/filecoin.test.ts`

**Step 1: Create the initial records file**

```json
// frontend/data/filecoin-records.json
{
  "records": [],
  "lastUpdated": "2026-03-29T00:00:00Z"
}
```

**Step 2: Write the failing test**

Test the records persistence layer (mock the Synapse SDK since we can't call Calibration in CI):

```typescript
// frontend/__tests__/lib/filecoin.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs module for JSON file operations
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));

// Mock the Synapse SDK
vi.mock("@filoz/synapse-sdk", () => ({
  Synapse: { create: vi.fn() },
}));

import { readRecords, writeRecords, isAlreadyStored } from "@/lib/filecoin";
import fs from "fs";

describe("readRecords", () => {
  it("returns empty records when file has no records", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ records: [], lastUpdated: "2026-03-29T00:00:00Z" })
    );
    const result = readRecords();
    expect(result.records).toEqual([]);
  });

  it("returns parsed records from file", () => {
    const record = {
      vcType: "allocation",
      projectName: "Solar Farm",
      ipfsHash: "QmTest",
      pieceCid: "baga...",
      txHash: "0xabc",
      storedAt: "2026-03-29T12:00:00Z",
      sizeBytes: 500,
      filecoinNetwork: "calibration",
    };
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ records: [record], lastUpdated: "2026-03-29T12:00:00Z" })
    );
    const result = readRecords();
    expect(result.records).toHaveLength(1);
    expect(result.records[0].ipfsHash).toBe("QmTest");
  });
});

describe("isAlreadyStored", () => {
  it("returns true for existing IPFS hash", () => {
    const records = [
      { vcType: "allocation", projectName: "Solar", ipfsHash: "QmExisting", pieceCid: "baga", txHash: "0x1", storedAt: "2026-03-29T12:00:00Z", sizeBytes: 100, filecoinNetwork: "calibration" as const },
    ];
    expect(isAlreadyStored(records, "QmExisting")).toBe(true);
  });

  it("returns false for new IPFS hash", () => {
    expect(isAlreadyStored([], "QmNew")).toBe(false);
  });
});
```

**Step 3: Run test to verify it fails**

```bash
cd frontend && npx vitest run __tests__/lib/filecoin.test.ts
```

**Step 4: Write the implementation**

```typescript
// frontend/lib/filecoin.ts
import fs from "fs";
import path from "path";
import {
  filecoinRecordsFileSchema,
  type FilecoinRecordsFile,
  type FilecoinStorageRecord,
} from "@/lib/filecoin-types";

const RECORDS_PATH = path.join(process.cwd(), "data", "filecoin-records.json");

export function readRecords(): FilecoinRecordsFile {
  if (!fs.existsSync(RECORDS_PATH)) {
    return { records: [], lastUpdated: new Date().toISOString() };
  }
  const raw = fs.readFileSync(RECORDS_PATH, "utf-8");
  const parsed = filecoinRecordsFileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return { records: [], lastUpdated: new Date().toISOString() };
  }
  return parsed.data;
}

export function writeRecords(file: FilecoinRecordsFile): void {
  const dir = path.dirname(RECORDS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(RECORDS_PATH, JSON.stringify(file, null, 2) + "\n");
}

export function isAlreadyStored(
  records: FilecoinStorageRecord[],
  ipfsHash: string,
): boolean {
  return records.some((r) => r.ipfsHash === ipfsHash);
}

/**
 * Store a single JSON document on Filecoin Calibration via Synapse SDK.
 * Returns the storage record on success, null on failure.
 */
export async function storeOnFilecoin(
  vcType: string,
  projectName: string,
  ipfsHash: string,
  document: Record<string, unknown>,
): Promise<FilecoinStorageRecord | null> {
  const privateKey = process.env.FILECOIN_WALLET_PRIVATE_KEY;
  const rpcUrl = process.env.FILECOIN_RPC;

  if (!privateKey || !rpcUrl) {
    console.warn("[filecoin] Missing FILECOIN_WALLET_PRIVATE_KEY or FILECOIN_RPC");
    return null;
  }

  try {
    // Dynamic import to avoid bundling issues in client components
    const { Synapse } = await import("@filoz/synapse-sdk");

    const synapse = await Synapse.create({
      privateKey,
      rpcURL: rpcUrl,
    });

    const jsonBytes = new TextEncoder().encode(JSON.stringify(document));
    const storage = await synapse.createStorage();
    const result = await storage.upload(jsonBytes);

    return {
      vcType,
      projectName,
      ipfsHash,
      pieceCid: String(result.pieceCid),
      txHash: String(result.txHash ?? "pending"),
      storedAt: new Date().toISOString(),
      sizeBytes: jsonBytes.byteLength,
      filecoinNetwork: "calibration",
    };
  } catch (err) {
    console.error("[filecoin] Upload failed:", err);
    return null;
  }
}
```

**IMPORTANT:** The Synapse SDK API may differ from what's documented here. Before implementing, use Context7 MCP or check the npm package to verify the exact import path, `Synapse.create()` signature, and `storage.upload()` return type. The `result.pieceCid` and `result.txHash` field names may be different. Adjust accordingly.

**Step 5: Run test to verify it passes**

```bash
cd frontend && npx vitest run __tests__/lib/filecoin.test.ts
```

**Step 6: Commit**

```bash
git add frontend/lib/filecoin.ts frontend/__tests__/lib/filecoin.test.ts frontend/data/filecoin-records.json
git commit -m "feat: add Filecoin client library with record persistence"
```

---

### Task 3: Filecoin Store API Route

**Files:**
- Create: `frontend/app/api/filecoin/store/route.ts`
- Test: `frontend/__tests__/api/filecoin-store.test.ts`

**Step 1: Write the failing test**

```typescript
// frontend/__tests__/api/filecoin-store.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock filecoin module
vi.mock("@/lib/filecoin", () => ({
  readRecords: vi.fn(),
  writeRecords: vi.fn(),
  isAlreadyStored: vi.fn(),
  storeOnFilecoin: vi.fn(),
}));

// Mock guardian-data module
vi.mock("@/lib/guardian-data", () => ({
  fetchGuardianData: vi.fn(),
}));

import { readRecords, writeRecords, isAlreadyStored, storeOnFilecoin } from "@/lib/filecoin";
import { GET, POST } from "@/app/api/filecoin/store/route";

describe("GET /api/filecoin/store", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns stored records", async () => {
    vi.mocked(readRecords).mockReturnValue({
      records: [
        { vcType: "allocation", projectName: "Solar", ipfsHash: "Qm1", pieceCid: "baga1", txHash: "0x1", storedAt: "2026-03-29T12:00:00Z", sizeBytes: 100, filecoinNetwork: "calibration" as const },
      ],
      lastUpdated: "2026-03-29T12:00:00Z",
    });

    const response = await GET();
    const data = await response.json();
    expect(data.records).toHaveLength(1);
    expect(data.records[0].pieceCid).toBe("baga1");
  });
});

describe("POST /api/filecoin/store", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores a single document", async () => {
    vi.mocked(readRecords).mockReturnValue({ records: [], lastUpdated: "" });
    vi.mocked(isAlreadyStored).mockReturnValue(false);
    vi.mocked(storeOnFilecoin).mockResolvedValue({
      vcType: "allocation",
      projectName: "Solar",
      ipfsHash: "QmNew",
      pieceCid: "baga_new",
      txHash: "0xnew",
      storedAt: "2026-03-29T12:00:00Z",
      sizeBytes: 200,
      filecoinNetwork: "calibration",
    });

    const request = new Request("http://localhost/api/filecoin/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "single",
        vcType: "allocation",
        ipfsHash: "QmNew",
        document: { ProjectName: "Solar" },
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.stored).toHaveLength(1);
    expect(data.skipped).toBe(0);
    expect(writeRecords).toHaveBeenCalled();
  });

  it("skips already-stored documents", async () => {
    vi.mocked(readRecords).mockReturnValue({ records: [], lastUpdated: "" });
    vi.mocked(isAlreadyStored).mockReturnValue(true);

    const request = new Request("http://localhost/api/filecoin/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "single",
        vcType: "allocation",
        ipfsHash: "QmExisting",
        document: { ProjectName: "Solar" },
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.stored).toHaveLength(0);
    expect(data.skipped).toBe(1);
    expect(storeOnFilecoin).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run __tests__/api/filecoin-store.test.ts
```

**Step 3: Write the implementation**

Create `frontend/app/api/filecoin/store/route.ts`. This route:
- GET: reads `filecoin-records.json` and returns all records
- POST with `mode: "all"`: fetches all Guardian VCs via `fetchGuardianData()`, stores each on Filecoin, deduplicates
- POST with `mode: "single"`: stores a single document

See design doc for full details. Key: use `readRecords()` / `writeRecords()` / `storeOnFilecoin()` from `@/lib/filecoin`. Use `fetchGuardianData()` from `@/lib/guardian-data` for `mode: "all"`. Extract ipfsHash from each VC's evidence wrapper. Project name from credentialSubject.

**Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run __tests__/api/filecoin-store.test.ts
```

**Step 5: Run full test suite to check for regressions**

```bash
cd .. && npm run test:unit
```

**Step 6: Commit**

```bash
git add frontend/app/api/filecoin/store/route.ts frontend/__tests__/api/filecoin-store.test.ts
git commit -m "feat: add /api/filecoin/store API route for Filecoin archival"
```

---

### Task 4: Auto-trigger on Allocation

**Files:**
- Modify: `frontend/app/api/issuer/allocate/route.ts` (line 93 area — after success response)

**Step 1: Write the failing test**

Add a test to `frontend/__tests__/api/allocate.test.ts` that verifies Filecoin store is called (fire-and-forget) after successful allocation. Read the existing test file first to follow the pattern.

**Step 2: Modify the allocate route**

After the successful Guardian submission (around line 93), add a fire-and-forget call:

```typescript
// After: return NextResponse.json({ success: true, status: "GUARDIAN_SUBMITTED" });
// Add before the return:

// Fire-and-forget: archive allocation to Filecoin
storeOnFilecoin(
  "allocation",
  project,
  `manual-${Date.now()}`, // placeholder hash — real hash comes from Guardian
  document,
).catch(() => { /* non-blocking */ });

return NextResponse.json({ success: true, status: "GUARDIAN_SUBMITTED" });
```

Import `storeOnFilecoin` from `@/lib/filecoin` at the top.

**Step 3: Run tests**

```bash
cd frontend && npx vitest run __tests__/api/allocate.test.ts
```

**Step 4: Commit**

```bash
git add frontend/app/api/issuer/allocate/route.ts frontend/__tests__/api/allocate.test.ts
git commit -m "feat: auto-archive allocations to Filecoin after Guardian submission"
```

---

### Task 5: useFilecoin Hook

**Files:**
- Create: `frontend/hooks/use-filecoin.ts`
- Test: `frontend/__tests__/hooks/use-filecoin.test.ts`

**Step 1: Write the failing test**

Follow the pattern from `frontend/__tests__/hooks/use-guardian.test.ts`.

**Step 2: Write the implementation**

```typescript
// frontend/hooks/use-filecoin.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { FilecoinStorageRecord, FilecoinStoreResponse } from "@/lib/filecoin-types";
import { filecoinStoreResponseSchema, filecoinRecordsFileSchema } from "@/lib/filecoin-types";

export function useFilecoin() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["filecoin-records"],
    queryFn: async (): Promise<FilecoinStorageRecord[]> => {
      const res = await fetch("/api/filecoin/store");
      if (!res.ok) return [];
      const json = await res.json();
      const parsed = filecoinRecordsFileSchema.safeParse(json);
      return parsed.success ? parsed.data.records : [];
    },
    staleTime: 30_000,
  });

  const storeAll = useMutation({
    mutationFn: async (): Promise<FilecoinStoreResponse> => {
      const res = await fetch("/api/filecoin/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      });
      if (!res.ok) throw new Error(`Store failed: ${res.status}`);
      const json = await res.json();
      return filecoinStoreResponseSchema.parse(json);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filecoin-records"] });
    },
  });

  return {
    records: data ?? [],
    isLoading,
    storeAll: storeAll.mutateAsync,
    isStoring: storeAll.isPending,
    lastResult: storeAll.data,
  };
}
```

**Step 3: Run test, then commit**

```bash
git add frontend/hooks/use-filecoin.ts frontend/__tests__/hooks/use-filecoin.test.ts
git commit -m "feat: add useFilecoin hook for Filecoin storage records"
```

---

### Task 6: StorageStatusCard Component

**Files:**
- Create: `frontend/components/filecoin/storage-status-card.tsx`
- Modify: `frontend/app/impact/page.tsx` (add card after ICMA Compliance Evidence section, ~line 222)

**Step 1: Build the component**

A "Decentralized Storage" card for the Impact page. Shows:
- Header: "Decentralized Storage"
- Stats row: documents archived count, total size, network badges (Storacha, Filecoin)
- Recent archives list (last 5) with truncated PieceCIDs linking to Blockscout (`https://filecoin-testnet.blockscout.com/tx/{txHash}`)
- Follow existing design system: `card-static`, `stat-label`, `font-mono`, `text-bond-green`

**Step 2: Add to Impact page**

After the ICMA Compliance Evidence section (after closing `</section>` around line 222), add:

```tsx
<StorageStatusCard />
```

Import `StorageStatusCard` at the top. The component uses `useFilecoin()` internally.

**Step 3: Run lint + build**

```bash
cd .. && npm run lint && npm run build
```

**Step 4: Commit**

```bash
git add frontend/components/filecoin/storage-status-card.tsx frontend/app/impact/page.tsx
git commit -m "feat: add Filecoin storage status card to Impact page"
```

---

### Task 7: ArchiveButton Component

**Files:**
- Create: `frontend/components/filecoin/archive-button.tsx`
- Modify: `frontend/app/issue/page.tsx` (add in operations grid, ~line 517 area)

**Step 1: Build the component**

A card with:
- Title: "Archive to Filecoin"
- InfoTooltip explaining what it does
- Button: "Archive All VCs" → calls `useFilecoin().storeAll()`
- Shows spinner during upload, then "X documents archived" on success
- Uses `Card` component, `btn-primary`, existing patterns

**Step 2: Add to Issuer page operations grid**

In `frontend/app/issue/page.tsx`, after the Register Project card (~line 517), add:

```tsx
{/* Archive to Filecoin */}
<div {...entranceProps(idx++)}>
  <ArchiveButton />
</div>
```

**Step 3: Run lint + build**

```bash
cd .. && npm run lint && npm run build
```

**Step 4: Commit**

```bash
git add frontend/components/filecoin/archive-button.tsx frontend/app/issue/page.tsx
git commit -m "feat: add Archive to Filecoin button on Issuer dashboard"
```

---

### Task 8: Inline Filecoin Links on Evidence Rows

**Files:**
- Modify: `frontend/components/guardian/vc-evidence.tsx`
- Modify: `frontend/components/guardian/project-card.tsx`

**Step 1: Extend VCEvidenceRow**

Add optional `filecoinRecord` prop to `VCEvidenceRowProps` (type `FilecoinStorageRecord | undefined`). In the links row (line 41-49), after the "View on HashScan" link, conditionally render:

```tsx
{filecoinRecord && (
  <a href={`https://filecoin-testnet.blockscout.com/tx/${filecoinRecord.txHash}`}
    target="_blank" rel="noopener noreferrer"
    className="text-[11px] sm:text-xs text-bond-green hover:text-bond-green/80 transition-colors">
    View on Filecoin
  </a>
)}
```

**Step 2: Pass records through ProjectCard**

In `project-card.tsx`, accept an optional `filecoinRecords` prop (type `FilecoinStorageRecord[]`). Look up matching record by `ipfsHash` for each VCEvidenceRow. Pass it down.

In `impact/page.tsx` and wherever `ProjectCard` is rendered, pass the filecoin records from `useFilecoin()`.

**Step 3: Update evidence download**

In the `downloadJson` handler (~line 174-180), include Filecoin PieceCIDs if available.

**Step 4: Run lint + build + tests**

```bash
cd .. && npm run lint && npm run build && npm run test:unit
```

**Step 5: Commit**

```bash
git add frontend/components/guardian/vc-evidence.tsx frontend/components/guardian/project-card.tsx frontend/app/impact/page.tsx
git commit -m "feat: add inline Filecoin proof links on VC evidence rows"
```

---

### Task 9: Filecoin Constants

**Files:**
- Modify: `frontend/lib/constants.ts`

**Step 1: Add Filecoin constants**

At the end of `frontend/lib/constants.ts`, add:

```typescript
// Filecoin Calibration testnet
export const FILECOIN_BLOCKSCOUT_URL = "https://filecoin-testnet.blockscout.com";
export const FILECOIN_CHAIN_ID = 314159;
export const FILECOIN_WALLET_ADDRESS = "0x4F12c98c004Ff28aA1e3C230946A89430F5889F0";
```

Update any hardcoded Blockscout URLs in the components to use `FILECOIN_BLOCKSCOUT_URL`.

**Step 2: Commit**

```bash
git add frontend/lib/constants.ts
git commit -m "feat: add Filecoin Calibration constants"
```

---

### Task 10: Documentation Updates

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Update README.md**

Add a "Filecoin Integration" section after the existing architecture description. Cover:
- Dual-layer storage: Storacha (Guardian IPFS) + Synapse SDK (Filecoin Calibration)
- Data flow diagram (text)
- New env vars
- How to set up (install deps, get tUSDFC, run archive)
- Links to Blockscout for verification

**Step 2: Update CLAUDE.md**

Add to Key Files section:
- `frontend/lib/filecoin.ts` — Synapse SDK client
- `frontend/lib/filecoin-types.ts` — Zod schemas
- `frontend/app/api/filecoin/store/route.ts` — Archive API
- `frontend/data/filecoin-records.json` — Persistent storage records

Add to Deployed Contracts section:
- Filecoin wallet: `0x4F12c98c004Ff28aA1e3C230946A89430F5889F0` (Calibration)

Add to Commands section:
- Archive VCs: `curl -X POST http://localhost:3000/api/filecoin/store -H 'Content-Type: application/json' -d '{"mode":"all"}'`

Add new env vars to the environment section.

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: add Filecoin integration documentation to README and CLAUDE.md"
```

---

### Task 11: End-to-End Test + Manual Verification

**Files:**
- Create: `e2e/filecoin-archive.spec.ts`

**Step 1: Write E2E test**

Test that:
1. Impact page renders the StorageStatusCard
2. Issuer page shows the "Archive to Filecoin" button
3. Clicking archive triggers the API and shows results
4. Evidence rows show Filecoin links (if records exist)

Follow existing E2E patterns from `e2e/` directory.

**Step 2: Run E2E locally**

```bash
cd e2e && npx playwright test filecoin-archive.spec.ts
```

**Step 3: Manual verification against Calibration**

Run the frontend locally, click "Archive All VCs", verify:
- PieceCIDs appear in the UI
- Records are written to `frontend/data/filecoin-records.json`
- Blockscout links resolve (https://filecoin-testnet.blockscout.com/tx/{txHash})

**Step 4: Commit records + test**

```bash
git add frontend/data/filecoin-records.json e2e/filecoin-archive.spec.ts
git commit -m "test: add Filecoin archive E2E test and populate records"
```

---

### Task 12: Final Build + Push to pl-genesis

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

---

### Task 13 (Optional): Storacha Guardian Configuration

This is VPS config, not code:

1. Install CLI: `npm install -g @storacha/cli`
2. Login: `storacha login <email>`
3. Create space: `storacha space create "coppice-guardian"`
4. Generate key: `storacha key create` → save `Mg...` as `IPFS_STORAGE_KEY`
5. Generate proof: `storacha delegation create <did> --base64` → save as `IPFS_STORAGE_PROOF`
6. SSH into Guardian VPS, edit `./configs/.env.<env>.guardian.system`:
   ```
   IPFS_PROVIDER="web3storage"
   IPFS_STORAGE_KEY="Mg..."
   IPFS_STORAGE_PROOF="<base64>"
   ```
7. Restart Guardian: `docker compose down && docker compose up -d`
8. Verify: create a test allocation, check that the IPFS hash resolves via Storacha gateway

This is independent of all other tasks and can be done at any time.
