# NeuroShield — Soulbound Token (SBT) Implementation

> _"In Web2, your reputation lives on a server someone else owns. They can delete it. They can sell it. In NeuroShield, your reputation is permanently encoded on-chain, bound to your wallet forever — impossible to transfer, impossible to fake, impossible to take down."_

---

## What We Built

A **full-stack Soulbound Token system** that encodes a user's on-chain reputation as a non-transferable ERC-721 token on Monad Testnet. The trust score is computed from four real, verifiable data sources and stored permanently as Base64-encoded JSON directly inside the smart contract — no IPFS, no server, no external dependency.

---

## Trust Score Formula

```
+40  Are you a verified human?         (Civic Pass)
+20  Do you have transaction history?   (floor(txCount / 5), capped at 20)
+20  Do you vote correctly in the DAO?  (floor(accuracy × 0.2), capped at 20)
+20  Do you actually participate?       (min(20, participation × 2))
────
100  Your permanent on-chain reputation
```

Implemented **identically** in three places — Solidity decomposition, TypeScript frontend, and Go backend — so the score is verifiable from any layer.

---

## Architecture Overview

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  React UI    │────▶│  sbt.ts Service   │────▶│  Monad Testnet       │
│  SBT Tab     │     │  (ethers.js v6)   │     │  Chain ID: 10143     │
└──────────────┘     └──────────────────┘     │                      │
                                               │  ┌────────────────┐ │
┌──────────────┐     ┌──────────────────┐     │  │  CivicSBT.sol  │ │
│  Go Backend  │────▶│  sbt.go Service   │────▶│  │  (ERC-721)     │ │
│  REST API    │     │  (go-ethereum)    │     │  └────────────────┘ │
└──────────────┘     └──────────────────┘     │  ┌────────────────┐ │
                                               │  │ CivicVerifier  │ │
                                               │  │  .sol          │ │
                                               │  └────────────────┘ │
                                               └──────────────────────┘
```

---

## Smart Contracts (Solidity)

### CivicSBT.sol — `hardhat/contracts/civic/CivicSBT.sol` (~230 lines)

The core token contract. ERC-721 with soulbound enforcement.

| Function                                                             | Description                                                |
| -------------------------------------------------------------------- | ---------------------------------------------------------- |
| `mint(address, level, trustScore, accuracy, participation)`          | Mints a new SBT (authorized callers only, one per address) |
| `updateMetadata(holder, level, trustScore, accuracy, participation)` | Updates existing SBT metadata                              |
| `hasSBT(address)`                                                    | Check if an address holds an SBT                           |
| `getTokenMetadata(address)`                                          | Read the full on-chain metadata struct                     |
| `generateTokenURI(tokenId)`                                          | Build Base64-encoded JSON metadata entirely on-chain       |
| `addAuthorizedUpdater(address)` / `removeAuthorizedUpdater(address)` | Admin controls who can mint/update                         |

**Soulbound enforcement** — all four transfer vectors revert:

```solidity
function _transfer(address, address, uint256) internal pure override {
    revert("SBTs cannot be transferred");
}
function transferFrom(address, address, uint256) public pure override {
    revert("SBTs cannot be transferred");
}
function safeTransferFrom(address, address, uint256) public pure override {
    revert("SBTs cannot be transferred");
}
function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
    revert("SBTs cannot be transferred");
}
```

**On-chain metadata struct:**

```solidity
struct TokenMetadata {
    uint256 issuedAt;
    uint256 verificationLevel;  // 1=Basic, 2=Advanced, 3=Premium
    uint256 trustScore;         // 0-100
    uint256 votingAccuracy;     // 0-100%
    uint256 doiParticipation;   // DAO vote count
}
```

### CivicVerifier.sol — `hardhat/contracts/civic/CivicVerifier.sol` (~175 lines)

Bridges Civic Pass identity verification → SBT minting.

| Function                                                                 | Description                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `registerVerification(user, level, trustScore, accuracy, participation)` | Checks Civic Pass validity → calls `sbtContract.mint()` or `.updateMetadata()` |
| `isVerified(address)`                                                    | Check if address has passed Civic verification                                 |
| `getVerificationLevel(address)`                                          | Get user's verification tier                                                   |

---

## Frontend (React + TypeScript)

### sbt.ts — `src/web3/civic/sbt.ts` (~626 lines)

The core frontend service. Talks to both contracts via ethers.js v6.

**Read functions:**

- `hasSBT(address)` → boolean
- `getOnChainMetadata(address)` → `SBTMetadata | null`
- `getOnChainTokenURI(address)` → raw Base64 token URI string
- `getSBTProfile(address)` → composite: metadata + trust breakdown + decoded token URI

**Write functions:**

- `mintSBT(params)` → calls `CivicVerifier.registerVerification()` which triggers SBT mint
- `updateSBT(params)` → calls `CivicVerifier.registerVerification()` which triggers metadata update

**Trust computation:**

- `computeLiveTrustScore(address)` → real-time score from CivicVerifier + QuadraticVoting + tx count
- `decomposeOnChainTrustScore(metadata)` → pure function splitting stored score into 4 components
- `determineVerificationLevel(address, hasCivicPass)` → maps score to level 1/2/3

**Event listeners:**

- `onSBTMinted(callback)` → fires when a new SBT is minted
- `onMetadataUpdated(callback)` → fires when metadata is updated

### auth.ts — `src/web3/civic/auth.ts` (~370 lines)

Trust score calculation with SBT integration.

`calculateTrustScore(address)` has two paths:

1. **Priority 1:** Read from `CivicSBT.getTokenMetadata()` — authoritative on-chain data
2. **Priority 2:** Compute live from CivicVerifier + QuadraticVoting + provider (fallback when no SBT exists)

### SoulboundToken.tsx — `src/components/SoulboundToken.tsx` (~518 lines)

The React UI component.

**When SBT exists:**

- Animated SVG trust score circle
- 4-bar breakdown (purple/blue/green/amber) with animated progress
- Verification badge (Basic/Advanced/Premium)
- On-chain metadata grid
- Collapsible raw Base64 token URI viewer
- "Refresh Trust Score On-Chain" button

**When no SBT exists:**

- Live preview of projected trust score
- "What is a Soulbound Token?" explainer
- "Mint Your Soulbound Token" gradient button

**States handled:**

- Loading (skeleton animation)
- Wallet not connected (connect prompt)
- Minting in progress (spinner)
- Error/success alerts

### Index.tsx — SBT Tab in Main Navigation

The SBT tab lives in the top nav bar alongside Overview, Analytics, DAO, Reports, Recovery, and Settings. Uses the `Fingerprint` icon. Renders three cards:

1. The `<SoulboundToken />` component
2. Trust Score Formula explanation
3. Technical Details panel

---

## Backend (Go + Gin + GORM)

### models/sbt.go — `backend/models/sbt.go` (~85 lines)

PostgreSQL models via GORM:

```go
type SBTRecord struct {
    WalletAddress     string    // unique, indexed
    TokenID           uint64
    VerificationLevel uint8
    TrustScore        uint8
    VotingAccuracy    uint8
    DOIParticipation  uint16
    MintedAt          time.Time
    LastSyncedAt      time.Time
    TxHash            string
    BlockNumber       uint64
}

type SBTMintEvent struct { ... }   // audit log
type SBTUpdateEvent struct { ... } // audit log
```

`DecomposeTrustScore()` method mirrors the frontend formula exactly.

### services/sbt.go — `backend/services/sbt.go` (~432 lines)

Go service using go-ethereum to read contracts and PostgreSQL for caching.

| Method                           | Description                                                      |
| -------------------------------- | ---------------------------------------------------------------- |
| `HasSBT(address)`                | Direct RPC call to CivicSBT                                      |
| `GetOnChainMetadata(address)`    | Direct RPC call returning parsed metadata                        |
| `GetSBTProfile(address)`         | Cache-first read, triggers background sync if stale (>5 min TTL) |
| `SyncFromChain(address)`         | Reads chain → upserts DB cache                                   |
| `IsVerified(address)`            | Calls CivicVerifier.isVerified() on-chain                        |
| `ProcessSBTMintedLog(log)`       | Event handler → stores audit record + triggers sync              |
| `ProcessMetadataUpdatedLog(log)` | Event handler → stores audit record + triggers sync              |
| `GetLeaderboard(limit)`          | Top N by trust score                                             |
| `GetStats()`                     | Aggregate: totalMinted, avgTrustScore, premiumHolders            |
| `ExportSBTData()`                | Full JSON export with score breakdowns                           |

### handlers/sbt.go — `backend/handlers/sbt.go` (~210 lines)

REST API endpoints:

| Method | Endpoint                        | Description                               |
| ------ | ------------------------------- | ----------------------------------------- |
| GET    | `/api/sbt/profile/:address`     | Full profile + trust breakdown            |
| GET    | `/api/sbt/trust/:address`       | Decomposed score with formula explanation |
| GET    | `/api/sbt/check/:address`       | On-chain hasSBT + isVerified check        |
| POST   | `/api/sbt/sync/:address`        | Force re-sync from chain                  |
| GET    | `/api/sbt/leaderboard?limit=20` | Top users by trust score                  |
| GET    | `/api/sbt/stats`                | Aggregate statistics                      |
| GET    | `/api/sbt/export`               | Full data export                          |

### routes/routes.go — Route Wiring

- Creates `SBTService` and `SBTHandler` during app init
- Gracefully degrades: if `CIVIC_SBT_ADDRESS` / `CIVIC_VERIFIER_ADDRESS` env vars aren't set, SBT routes simply don't register (no 500s)
- All 7 endpoints wired under `api.Group("/sbt")`

---

## Deployment

### Deploy Script — `hardhat/scripts/deploy-civic.js` (~90 lines)

Deploys contracts in order:

1. `MockCivicPass` — test stand-in for real Civic Pass
2. `CivicSBT` — the SBT contract
3. `CivicVerifier(mockCivicPassAddr, civicSBTAddr)` — the bridge
4. `civicSBT.addAuthorizedUpdater(civicVerifierAddr)` — **critical: authorizes Verifier to mint**
5. `CivicGatedWallet(civicVerifierAddr, threshold)` — gated wallet
6. Saves addresses to `src/web3/addresses.json`
7. Prints `.env` snippet for frontend + backend

**Run:** `npx hardhat run scripts/deploy-civic.js --network monad_testnet`

### Environment Variables

**Frontend (.env):**

```
VITE_CIVIC_SBT_ADDRESS=0x...
VITE_CIVIC_VERIFIER_ADDRESS=0x...
```

**Backend (.env):**

```
CIVIC_SBT_ADDRESS=0x...
CIVIC_VERIFIER_ADDRESS=0x...
```

---

## Data Flow

```
User clicks "Mint Your Soulbound Token"
  → SoulboundToken.tsx calls handleMint()
    → determineVerificationLevel(address) computes live score
    → mintSBT({ level, trustScore, accuracy, participation })
      → CivicVerifier.registerVerification() on-chain tx
        → CivicVerifier checks ICivicPass.isValid()
        → CivicVerifier calls CivicSBT.mint()
          → ERC-721 token minted (soulbound)
          → generateTokenURI() encodes Base64 JSON on-chain
          → SBTMinted event emitted
            → Frontend onSBTMinted listener fires → refreshes UI
            → Backend ProcessSBTMintedLog → SyncFromChain → PostgreSQL
              → GET /api/sbt/profile/:address serves cached data
```

---

## File Manifest

| Layer    | File                                        | Lines | Purpose                       |
| -------- | ------------------------------------------- | ----- | ----------------------------- |
| Contract | `hardhat/contracts/civic/CivicSBT.sol`      | ~230  | Soulbound ERC-721 token       |
| Contract | `hardhat/contracts/civic/CivicVerifier.sol` | ~175  | Civic Pass → SBT bridge       |
| Frontend | `src/web3/civic/sbt.ts`                     | ~626  | Contract interaction service  |
| Frontend | `src/web3/civic/auth.ts`                    | ~370  | Trust score with SBT priority |
| Frontend | `src/components/SoulboundToken.tsx`         | ~518  | React UI component            |
| Frontend | `src/pages/Index.tsx` (SBT section)         | ~70   | Main nav SBT tab              |
| Frontend | `src/web3/abi/CivicSBT.json`                | —     | Compiled ABI                  |
| Frontend | `src/web3/abi/CivicVerifier.json`           | —     | Compiled ABI                  |
| Backend  | `backend/models/sbt.go`                     | ~85   | GORM DB models                |
| Backend  | `backend/services/sbt.go`                   | ~432  | Go service (chain + cache)    |
| Backend  | `backend/handlers/sbt.go`                   | ~210  | REST API handlers             |
| Backend  | `backend/routes/routes.go` (SBT section)    | ~20   | Route wiring                  |
| Deploy   | `hardhat/scripts/deploy-civic.js`           | ~90   | Deployment script             |
| Config   | `src/web3/addresses.json`                   | —     | Contract address registry     |

**Total:** ~2,800+ lines of production SBT code across 14 files spanning Solidity, TypeScript, Go, and deployment infrastructure.

---

## Why This Matters

1. **Fully on-chain metadata** — Base64 JSON stored in the contract itself. If every server on earth goes offline, the reputation data still exists.

2. **Soulbound by design** — Four transfer overrides, all revert. The token is permanently bound to the wallet that earned it.

3. **Verifiable trust score** — Every component (+40/+20/+20/+20) is independently auditable from on-chain data. No one can inflate their score without actual Civic verification, real transactions, and genuine DAO participation.

4. **Three-layer consistency** — The same formula is implemented in Solidity (contract), TypeScript (frontend), and Go (backend). Any layer can independently verify the score.

5. **Graceful degradation** — When contracts aren't deployed yet, the frontend shows a live preview and the backend simply doesn't register SBT routes. No crashes, no 500s.
