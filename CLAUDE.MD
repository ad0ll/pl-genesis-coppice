# Coppice - ERC-3643 Green Bond Tokenization on Hedera

## Project Overview

Compliant green bond tokenization using ERC-3643 (via Hedera ATS) on Hedera for the Hello Future Apex Hackathon 2026 (Sustainability track). Guardian integration for anti-greenwashing MRV verification.

## Architecture

- **contracts/**: Hardhat project with T-REX v4.1.6 + OnchainID v2.0.0. Solidity 0.8.17.
- **scripts/**: One-time Hedera setup scripts (HCS topics, HTS eUSD stablecoin).
- **frontend/**: Next.js 16 App Router + Tailwind CSS v4. MetaMask wallet integration via ethers v6. API routes handle purchase/allocate. On-chain events read from Mirror Node contract logs. Fund allocations submitted to Guardian API.
- **e2e/**: Playwright E2E tests with MetaMask mocking.

## Critical Constraints

- CPC bond is deployed via ATS (Asset Tokenization Studio) diamond proxy — NOT raw T-REX contracts
- T-REX v4.1.6 and OnchainID v2.0.0 ABIs are still in contracts/ for Hardhat compilation but are NOT the deployed bond
- ATS uses `issue()` (ERC1594), NOT `mint()` — purchase API must call `issue(address, uint256, bytes)`
- ATS API differs from T-REX: `isPaused()` not `paused()`, `isFrozen()` reverts on unregistered addresses, coupons are 1-indexed
- Token starts paused after deployment — must call unpause()
- Always verify contracts on HashScan after deploying
- Only the deployer (token agent) can issue CPC tokens — purchase flow uses backend API
- Frontend uses ethers v6 with custom AtsContext — NOT wagmi or viem

## Key Files

- Reference fixture: reference/deploy-full-suite.fixture.ts
- Accounts & keys: each workspace has its own .env (contracts, frontend, scripts, e2e)
- ATS context: frontend/contexts/ats-context.tsx
- Shared ABIs: packages/common/ (generated via wagmi CLI from contract artifacts)
- Constants: frontend/lib/constants.ts
- Guardian types: frontend/lib/guardian-types.ts
- Purchase API: frontend/app/api/purchase/route.ts
- Allocate API (Guardian): frontend/app/api/issuer/allocate/route.ts
- Guardian data proxy: frontend/app/api/guardian/data/route.ts
- Hedera server utils: frontend/lib/hedera.ts
- Guardian scripts: scripts/guardian/
- Storacha helper: frontend/lib/storacha.ts (gateway URL builder, config flag)
- Storage status card: frontend/components/filecoin/storage-status-card.tsx

## Deployed Contracts & Topics

- CPC Bond (ATS): 0xcFbB4b74EdbEB4FE33cD050d7a1203d1486047d9 (account 0.0.8254921)
- LifeCycleCashFlow: 0xC36cd7a8C15B261C1e6D348fB1247D8eCBB8c350 (account 0.0.8254941)
- Token (old T-REX CPC): 0x17e19B53981370a904d0003Ba2D336837a43cbf0
- IdentityRegistry: 0x03ecdB8673d65b81752AC14dAaCa797D846c1B31
- ModularCompliance: 0xb6F624B66731AFeEE1443b3F857Cd73b682af4cf
- ClaimIssuer: 0x6746C2A65b834F3A83Aa95eCAc9C80dF9Bf2AB7A
- Audit HCS Topic: 0.0.8214934
- Impact HCS Topic: 0.0.8214935 (deprecated — allocations now go through Guardian API)
- eUSD Token (HTS): 0.0.8214937

## Storacha / Filecoin Integration

- Guardian IPFS provider set to `"web3storage"` (Storacha) on VPS
- Storacha auto-persists IPFS content to Filecoin mainnet storage deals
- Gateway: `https://<cid>.ipfs.w3s.link`
- Frontend flag: `NEXT_PUBLIC_STORACHA_ENABLED=true` (set after Guardian VPS config)
- Guardian VPS config: `IPFS_PROVIDER`, `IPFS_STORAGE_KEY`, `IPFS_STORAGE_PROOF` in `./configs/.env.<env>.guardian.system`

## Demo Wallets

| Role                 | Account     | Country  |
| -------------------- | ----------- | -------- |
| Deployer/Issuer      | 0.0.8213176 | —        |
| Alice (Verified)     | 0.0.8213185 | DE (276) |
| Bob (Unverified)     | 0.0.8214040 | US (840) |
| Charlie (Restricted) | 0.0.8214051 | CN (156) |
| Diana (Freeze demo)  | 0.0.8214895 | FR (250) |

## Commands

```bash
# Monorepo (Turborepo) — run from root
npm run build          # builds contracts + frontend
npm run lint           # lints frontend
npm run test           # runs contract tests
npm run test:unit      # runs frontend vitest
npm run dev            # starts frontend dev server

# Contracts (direct)
cd contracts && npx hardhat compile
cd contracts && npx hardhat test
cd contracts && npx hardhat run scripts/deploy.ts --network hederaTestnet
cd contracts && npx hardhat run scripts/verify-contracts.ts --network hederaTestnet

# Scripts (one-time Hedera setup)
cd scripts && npx tsx hcs-setup.ts
cd scripts && npx tsx hts-setup.ts

# Frontend (Next.js — includes API routes for purchase/allocate)
cd frontend && npm run dev

# E2E (requires frontend running — API routes are built-in)
cd e2e && npx playwright test
```

## Best practices/Standards

### React standards

- Avoid using `use client` when possible
- Prefer functional components over class components
- Use `npm run lint` from the repo root to check for linting errors after you're done

### Testing standards

- For each test, you MUST be able to name the specific code change that would make this test fail. If you can't, don't write it.
- Mock dependencies, NEVER the subject under test. If testing component X, you may mock X's dependencies — you must NOT mock X itself.
- If every assertion checks a mock return value you set up yourself, the test verifies nothing. Rewrite it.
- Test the critical user path first, not whatever was built most recently.
- Prefer testing real behavior over implementation details. A test coupled to internal state (e.g. checking a specific useState value) breaks on refactors without catching bugs.

### Typescript standards

- Do not use `any` unless explicitly instructed otherwise
- Do not type cast unless explicitly instructed otherwise. If you must typecast, any usage must have a clear and convincing comment explaining why
- Avoid type casting as a solution to type errors unless it's absolutely necessary or explicitly instructed otherwise
- Avoid using @ts-expect-error, @ts-ignore, or @ts-nocheck unless absolutely necessary or explicitly instructed otherwise. Fix things instead
- Never do hot imports in code function bodies
- When using Zod schemas, derive TypeScript types using `z.infer<typeof schema>` rather than defining types separately - this prevents type drift where the schema and type diverge
- Prefer vitest for testing when able
- After making significant changes (adding functions, renaming files and functions, significant logic changes, etc), run `npm run lint`, `npm run build`, and `npm run test:unit` from the repo root (these use Turborepo)

### Solidity standards

- Always follow best practices for solidity development.
- Prefer foundry to hardhat when you're able to choose (may be restricted by vendor tech in rare cases)
- Prefer viem to ethers always when you're able to choose
- Always verify contracts after deploying. Always set up contract deployment scripts/plugins to automatically verify contracts when they're deployed
- Always analyze changes to the contracts for security vulnerabilities and fix them if detected

#### Foundry guidelines

- Confirm any significant changes compile w/ `forge build` after you're done
- Test any significant changes w/ `forge test` after you're done
- Check tests for compatibility w/ any new contract changes
- New public functions should have a corresponding script in the `script` folder
- Always prefer Error types over inline revert messages
- You may use Foundry's `console2.log` in scripts liberally and in contracts conservatively for debugging purposes and clarity
- When writing a new script or changing inputs and/or outputs of a script, you should update the README.md file to reflect the changes
- After deploying to a real environment (Base Mainnet, Base Sepolia, etc), you should run `forge verify` to verify the contracts on the blockchain.

### Other standards

- When you make a change to what environment variables are supported, be sure to update .env.example for the relevant code, and if you have access, update the relevant code's .env too
- CLAUDE.MD and README.MD are living docs that should be reviewed for accuracy after major changes. Do not fill these with fluff, just make sure they're current.
- The year is 2026. If you search for "recent" information in the web and choose to include the year in your search, you should use the year 2025 or 2026. Avoid using 2024, 2023, or other years before 2025 when searching for up to date information
- According to <https://github.com/anthropics/claude-code/issues/13137>, bash permission wildcards don't match commands with redirects or special shell characters. To avoid me having to manually approve commands excessively, structure your commands to avoid the use of special characters when possible (esp ">", "&&", "||")
- You should always write e2e tests and unit tests for your work. When relevant, e2e tests should be configurable to run against, or should just outright run against real chains/frontends/backends/agents etc, and you should always test against real systems before claiming work is complete. Aim for high test coverage.
- Avoid using inline environment variables in commands you run, as this requires me to manually approve the command. Everything has a .env file you can source, or use dotenv or similar to load, for secrets
- Always opt out of optional telemetry. Don't remove code that disables it. Whenever you set up a new project or onboard a new package, search web to see if it has telemetry enabled, and take action to deprecate
- When deprecating code, you don't have to worry about backwards compatibility or leaving a comment trail unless explicitly instructed otherwise, just remove the code.
- Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
- Always think and do research to make sure you're confident before taking action, it's important for you to not code reflexively

## Design Context

### Users
Institutional investors (portfolio managers, fund analysts) evaluating compliant green bond instruments. They need confidence, precision, and trust from the interface. Secondary audience: Hedera hackathon judges evaluating technical depth and UX polish — the interface should demonstrate Hedera integration naturally through the UI (HCS event feeds, HTS balances, HashScan links) without heavy-handed branding.

### Brand Personality
**Trustworthy, precise, calm.** Institutional finance meets sustainability. Confidence communicated through restraint, data clarity, and visual consistency — not through decoration or excess.

### Aesthetic Direction
- **Visual tone:** Dark, minimal, precise. Inspired by Linear and Vercel — clean typography, subtle animations, generous spacing, data-forward layouts.
- **Theme:** Dark-only. Layered surface system (`surface` → `surface-2` → `surface-3`) creates depth without borders. Green accent (`#10b981`, emerald) used sparingly for active/success states and the brand leaf motif.
- **Typography:** Instrument Serif for display/headings, Bricolage Grotesque for body/UI, Geist Mono for data values (balances, addresses, timestamps). Uppercase tracked labels for stat categories.
- **Cards:** Flush cards for data-heavy sections (no padding on header), padded cards for forms. Hover glow only on interactive cards (forms), not display-only cards.
- **Color semantics:** Green = pass/active/approval. Red = fail/restriction/freeze. Amber = pending/allocation/warning. Never use color alone to convey status — always pair with icons (checkmark/X) or text.
- **Anti-references:** Avoid generic "crypto dashboard" aesthetics — no neon gradients, no excessive glassmorphism, no particle effects, no oversized hero sections. This is a financial instrument, not a meme coin.
- **Hackathon consideration:** Let Hedera integration speak through functionality (HCS feeds, HTS balances, Mirror Node data, HashScan transaction links) rather than logos or badges.

### Design Principles
1. **Data first** — Every pixel should serve the investor's decision. Show balances, compliance status, and event history with clarity and precision. Decoration that doesn't aid comprehension gets cut.
2. **Earned trust** — Use consistent visual patterns, predictable interactions, and clear status communication. The interface should feel like it was built by people who understand regulated finance.
3. **Quiet confidence** — Restrained color palette, subtle hover effects, minimal animation. Let the quality of the typography and spacing communicate craftsmanship.
4. **Progressive disclosure** — Don't overwhelm. Show summary states, reveal detail on interaction. Compliance checks load sequentially. Purchase flow shows step-by-step progress.
5. **Accessibility as baseline** — WCAG AA compliance. Focus-visible outlines, reduced-motion support, semantic HTML, aria-live for dynamic content. Shape + text always accompanies color for status indicators.
