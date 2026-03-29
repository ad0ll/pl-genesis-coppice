# Filecoin + Storacha Integration Design

**Date:** 2026-03-29
**Hackathon:** PL Genesis: Frontiers of Collaboration
**Track:** Existing Code
**Bounties targeted:** Filecoin, Storacha
**Deadline:** March 31, 2026
**Repo:** ad0ll/pl-genesis-coppice (remote: pl-genesis)

## Problem

Coppice stores Guardian Verifiable Credentials (VCs) on IPFS via Hedera Consensus Service. While HCS provides immutable timestamping and IPFS provides content addressing, there is no verifiable persistent storage layer with on-chain proofs. For a green bond platform handling environmental compliance data, provable long-term data integrity is critical.

## Solution

Two-layer Filecoin integration:

1. **Storacha** (Guardian IPFS provider) — Hot decentralized storage with automatic Filecoin mainnet deal persistence. Config-only change on Guardian VPS.
2. **Synapse SDK** (Coppice backend) — Direct Filecoin Calibration testnet storage with on-chain cryptographic proofs. Custom integration in Next.js API routes.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Coppice Frontend                  │
│  (Impact page, Issuer page, Evidence components)    │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
    /api/guardian/data    /api/filecoin/store
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────────────────┐
│  Guardian API    │   │  Filecoin Synapse SDK         │
│  (VPS, Storacha) │   │  (Calibration testnet)        │
│  IPFS_PROVIDER=  │   │  Wallet: 0x4F12...889F0       │
│  "web3storage"   │   │  Payment: USDFC               │
└──────────────────┘   └──────────────────────────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐   ┌──────────────────────────────┐
│ Storacha (IPFS   │   │ Filecoin Calibration         │
│ + Filecoin       │   │ (on-chain storage proofs)    │
│ mainnet deals)   │   │                              │
└──────────────────┘   └──────────────────────────────┘
```

Data integrity chain: Hedera HCS (timestamps) + IPFS/Storacha (content addressing + hot storage) + Filecoin (verifiable persistent storage with proofs).

## Backend Design

### New files

**`frontend/lib/filecoin.ts`** — Synapse SDK client wrapper
- `getFilecoinClient()` — initializes Synapse with wallet private key + Calibration RPC
- `storeDocument(vcType, document)` — uploads JSON, returns `{ pieceCid, txHash, timestamp, size }`
- `storeAllDocuments(guardianData)` — iterates all VCs, stores each, returns array of results
- Deduplication via IPFS hash lookup in records file

**`frontend/lib/filecoin-types.ts`** — Zod schemas + derived types
- `FilecoinStorageRecord`: `{ vcType, projectName, ipfsHash, pieceCid, txHash, storedAt, sizeBytes, filecoinNetwork }`
- `FilecoinStoreRequest` / `FilecoinStoreResponse` schemas

**`frontend/app/api/filecoin/store/route.ts`** — POST + GET endpoint
- GET: returns all stored records from `frontend/data/filecoin-records.json`
- POST `{ mode: "all" }`: bulk archive all Guardian VCs
- POST `{ mode: "single", vcType, document }`: archive individual VC
- Dedup: skips documents already stored (by IPFS hash)
- Returns array of `FilecoinStorageRecord`

### Storage persistence

- **`frontend/data/filecoin-records.json`** — checked into git
- Structure: `{ records: FilecoinStorageRecord[], lastUpdated: string }`
- API reads/writes on every request (small JSON)
- On Vercel: read-only from committed file; writes work locally
- Workflow: archive locally → commit updated JSON → push to pl-genesis → Vercel deploys with pre-populated data

### Auto-trigger

Modify `/api/issuer/allocate/route.ts`: after successful Guardian submission, fire-and-forget Filecoin store of the FundAllocationCS document. Non-blocking — allocation succeeds even if Filecoin fails.

## Frontend Design

### New hook

**`frontend/hooks/use-filecoin.ts`** — `useFilecoin()`
- GET `/api/filecoin/store` to fetch records
- `storeAll()` / `storeSingle()` POST mutations
- react-query, 30s stale time

### New components

**`frontend/components/filecoin/storage-status-card.tsx`** — Impact page
- "Decentralized Storage" card
- Stats: Documents Archived, Total Size, Networks (Storacha + Filecoin)
- Recent archives list with PieceCID links to Blockscout

**`frontend/components/filecoin/archive-button.tsx`** — Issuer page
- "Archive to Filecoin" button triggers `storeAll()`
- Progress spinner, count of newly archived docs on completion

### Modified components

**`vc-evidence.tsx`** (VCEvidenceRow)
- Optional `filecoinRecord` prop
- Shows Filecoin icon + truncated PieceCID + Blockscout link
- "Not archived" if absent

**`project-card.tsx`** (ProjectCard)
- Passes filecoin records to VCEvidenceRow
- Includes PieceCIDs in "Download Evidence Chain" JSON export

### Modified pages

- **Impact page** — Add StorageStatusCard
- **Issuer page** — Add ArchiveButton in operations area

## Storacha / Guardian Configuration

- SSH into Guardian VPS
- Set `IPFS_PROVIDER="web3storage"` in Guardian env config
- Generate key + proof via `storacha` CLI
- Restart Guardian services
- No code changes — config only
- Risk: independent of Synapse build, can be done last

## Environment Variables

New in `frontend/.env.local`:
```
FILECOIN_WALLET_PRIVATE_KEY=0x5d8f93...
FILECOIN_RPC=https://rpc.ankr.com/filecoin_testnet
```

## Documentation Updates

- **README.md** — "Filecoin Integration" section: dual-layer architecture, setup instructions, env vars
- **CLAUDE.md** — Filecoin wallet, Calibration testnet, Synapse SDK, new API routes, new env vars

## Testing

- **Unit** (vitest): mock Synapse SDK, test storeDocument(), dedup logic, JSON read/write, error handling
- **E2E** (Playwright): archive button, PieceCID in UI, storage status card renders
- **Manual**: real Calibration testnet upload, confirm PieceCID on Blockscout

## Pre-requisites

1. Mint tUSDFC from tFIL (stg.usdfc.net or faucet)
2. Verify Synapse SDK works with test upload
3. Generate Storacha key + proof via CLI

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Documents to store | All Guardian VCs | Broadest coverage, same upload logic regardless of type |
| Storage trigger | Auto on allocation + manual "Archive All" button | Auto for seamless flow, manual for demo moment |
| Persistence | JSON file checked into git | Survives restarts, works on Vercel as read-only |
| UI placement | Inline on evidence rows + dedicated storage card | Visible to judges at multiple touchpoints |
| Storacha setup | Guardian VPS config change | Zero code, targets Storacha bounty separately |
