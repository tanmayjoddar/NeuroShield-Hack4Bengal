# Soulbound Token (SBT) — Technical Wiring Document

> **"In Web2, your reputation lives on a server someone else owns. They can delete it. They can sell it.
> In NeuroShield, your reputation is permanently encoded on-chain, bound to your wallet forever,
> impossible to transfer, impossible to fake, impossible to take down."**

---

## What The SBT Is

An ERC-721 token that **cannot be transferred**. Every `transferFrom`, `safeTransferFrom`, and internal `_transfer` reverts with `"SBTs cannot be transferred"`. The token metadata — your trust score, verification level, DAO voting accuracy, and participation count — is encoded as **Base64 JSON directly on-chain**. No IPFS. No server. If every server on earth goes offline, your reputation still exists on the blockchain.

## The Trust Score Formula

```
+40  Are you a verified human?       (Civic Pass valid)
+20  Do you have transaction history? (min(20, floor(txCount / 5)))
+20  Do you vote correctly in the DAO? (floor(votingAccuracy × 0.2))
+20  Do you actually participate?     (min(20, daoParticipation × 2))
────
100  Your permanent on-chain reputation
```

Every component is **independently verifiable** from on-chain data. No single entity controls any part of the score.

---

## Architecture: How It's Wired

```
┌───────────────────────────────────────────────────────────────────────┐
│                        SMART CONTRACTS (Monad)                        │
│                                                                       │
│  ┌─────────────┐      ┌────────────────┐      ┌───────────────────┐  │
│  │ MockCivicPass│─────▶│ CivicVerifier  │─────▶│ CivicSBT (ERC721)│  │
│  │ isValid()   │      │ registerVerif()│      │ mint()            │  │
│  └─────────────┘      │ isVerified()   │      │ updateMetadata()  │  │
│                        └──────┬─────────┘      │ getTokenMetadata()│  │
│                               │                │ hasSBT()          │  │
│  ┌──────────────────┐         │                │ tokenURI() → B64  │  │
│  │ QuadraticVoting   │         │                └───────────────────┘  │
│  │ getVoterStats()   │─────────┘ (feeds accuracy                      │
│  │ voterAccuracy()   │    & participation into                        │
│  │ voterParticipation│    trust score computation)                     │
│  └──────────────────┘                                                 │
├───────────────────────────────────────────────────────────────────────┤
│                        FRONTEND (React + ethers.js)                   │
│                                                                       │
│  src/web3/civic/sbt.ts          ◀── Core SBT service                  │
│    ├─ hasSBT(addr)              Read: does user have SBT?             │
│    ├─ getOnChainMetadata(addr)  Read: full trust score from chain     │
│    ├─ getOnChainTokenURI(addr)  Read: Base64 JSON (works offline)     │
│    ├─ getSBTProfile(addr)       Read: combined profile + breakdown    │
│    ├─ mintSBT(params)           Write: CivicVerifier → SBT.mint()    │
│    ├─ updateSBT(params)         Write: CivicVerifier → SBT.update()  │
│    ├─ computeLiveTrustScore()   Compute: fresh score from contracts   │
│    └─ onSBTMinted / onMetadataUpdated  Events: real-time listeners   │
│                                                                       │
│  src/web3/civic/auth.ts                                               │
│    └─ calculateTrustScore(addr)                                       │
│         Priority 1: Read SBT on-chain data (sbt.getOnChainMetadata)  │
│         Priority 2: Compute live from CivicVerifier + QuadraticVoting│
│                                                                       │
│  src/web3/civic/dualVerification.ts                                   │
│    └─ dualVerification()                                              │
│         Calls calculateTrustScore() → automatically uses SBT data    │
│         Civic trust discount: -10 risk points for verified users      │
│                                                                       │
│  src/components/SoulboundToken.tsx   ◀── UI Component                 │
│    ├─ Trust score circle with animated ring                           │
│    ├─ 4-bar breakdown (+40/+20/+20/+20)                              │
│    ├─ On-chain metadata viewer                                        │
│    ├─ Raw Base64 token URI inspector                                  │
│    ├─ Mint SBT button (connects to CivicVerifier)                    │
│    └─ Refresh Trust Score button (updates on-chain metadata)          │
│                                                                       │
│  src/pages/SBTPage.tsx              ◀── Full page at /sbt             │
│  src/App.tsx                        ◀── Route: /sbt → SBTPage        │
├───────────────────────────────────────────────────────────────────────┤
│                        BACKEND (Go + Gin + PostgreSQL)                │
│                                                                       │
│  backend/models/sbt.go                                                │
│    ├─ SBTRecord (cached on-chain data, 5-min TTL)                     │
│    ├─ SBTMintEvent (audit trail of all mint events)                   │
│    ├─ SBTUpdateEvent (audit trail of all metadata updates)            │
│    └─ DecomposeTrustScore() → TrustScoreBreakdown                    │
│                                                                       │
│  backend/services/sbt.go                                              │
│    ├─ HasSBT(addr)           go-ethereum → CivicSBT.hasSBT()        │
│    ├─ GetOnChainMetadata()   go-ethereum → CivicSBT.getTokenMeta()  │
│    ├─ GetSBTProfile()        DB cache (5-min TTL) + on-chain fallback│
│    ├─ SyncFromChain()        Refresh cache from contract              │
│    ├─ IsVerified()           go-ethereum → CivicVerifier.isVerified()│
│    ├─ GetLeaderboard(n)      Top N by trust score                     │
│    ├─ GetStats()             Aggregate: total, avg, premium count     │
│    └─ ExportSBTData()        JSON export for analytics                │
│                                                                       │
│  backend/handlers/sbt.go                                              │
│    ├─ GET  /api/sbt/profile/:address  Full SBT profile + breakdown   │
│    ├─ GET  /api/sbt/trust/:address    Trust score + formula           │
│    ├─ GET  /api/sbt/check/:address    On-chain SBT check             │
│    ├─ POST /api/sbt/sync/:address     Force chain resync              │
│    ├─ GET  /api/sbt/leaderboard       Top reputed users               │
│    ├─ GET  /api/sbt/stats             Global SBT statistics           │
│    └─ GET  /api/sbt/export            JSON data export                │
│                                                                       │
│  backend/routes/routes.go   ◀── All SBT routes registered            │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Flow

```
npx hardhat run scripts/deploy-civic.js --network monad_testnet
```

The deploy script does the following in order:

1. **Deploy MockCivicPass** — Test Civic Pass contract (would be real Civic Pass on mainnet)
2. **Deploy CivicSBT** — The soulbound token contract (no constructor args)
3. **Deploy CivicVerifier** — Bridges Civic Pass → SBT minting (takes MockCivicPass + CivicSBT addresses)
4. **Authorize CivicVerifier** — Calls `civicSBT.addAuthorizedUpdater(civicVerifierAddr)` so CivicVerifier can mint SBTs
5. **Deploy CivicGatedWallet** — Requires CivicVerifier for high-value transactions
6. **Save addresses** — Writes all 4 addresses to `src/web3/addresses.json`
7. **Print .env snippet** — Shows what to add to both frontend (.env) and backend (.env)

### Environment Variables After Deploy

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

## How Every Piece Connects

### 1. User Visits `/sbt` Page

```
SBTPage.tsx → SoulboundToken.tsx
  → getSBTProfile(address)        // sbt.ts
    → hasSBT(address)             // CivicSBT.hasSBT() on-chain
    → getOnChainMetadata(address) // CivicSBT.getTokenMetadata() on-chain
    → decomposeOnChainTrustScore  // Pure function: breakdown into 4 bars
  → computeLiveTrustScore(address)  // Parallel reads from CivicVerifier + QV + provider
```

### 2. User Mints an SBT

```
SoulboundToken.tsx → "Mint Your Soulbound Token" button
  → determineVerificationLevel(address, true)   // sbt.ts
    → computeLiveTrustScore(address)             // reads all 4 components live
  → mintSBT({level, trustScore, accuracy, participation})
    → CivicVerifier.registerVerification()       // on-chain tx
      → CivicSBT.mint(to, level, trust, acc, part)  // called internally
        → _safeMint(to, tokenId)                  // ERC721 mint
        → generateTokenURI(tokenId)               // Base64 JSON generated
        → emit SBTMinted(to, tokenId)             // event emitted
```

### 3. Dual-Layer Risk Fusion Uses SBT

```
dualVerification.ts → dualVerification(address, transaction)
  → calculateTrustScore(address)    // auth.ts
    → [PRIORITY 1] getOnChainMetadata(address)  // sbt.ts → CivicSBT
      → If SBT exists: use on-chain trust score directly
    → [PRIORITY 2] Compute live from contracts (fallback)
  → Trust discount: if verified, risk -= min(10, trustScore/10)
```

### 4. Backend API Reads SBT

```
GET /api/sbt/profile/0x123
  → sbt.go handler → GetSBTProfile(address)
    → Check PostgreSQL cache (5-min TTL)
    → If stale → go-ethereum → CivicSBT.getTokenMetadata()
    → Upsert record → Return with trust breakdown
```

### 5. On-Chain Events → PostgreSQL

When an SBT is minted or updated on-chain:

```
CivicSBT emits SBTMinted(to, tokenId)
  → Event listener can pick this up (same pattern as QuadraticVoting events)
  → SBTService.ProcessSBTMintedLog(log)
    → Save SBTMintEvent to audit trail
    → SyncFromChain(address) → Update cached SBTRecord
```

---

## The Soulbound Properties (Contract Level)

Every transfer function in `CivicSBT.sol` is overridden to revert:

```solidity
function _transfer(address, address, uint256) internal virtual override {
    revert("SBTs cannot be transferred");
}

function transferFrom(address, address, uint256) public virtual override {
    revert("SBTs cannot be transferred");
}

function safeTransferFrom(address, address, uint256) public virtual override {
    revert("SBTs cannot be transferred");
}

function safeTransferFrom(address, address, uint256, bytes memory) public virtual override {
    revert("SBTs cannot be transferred");
}
```

**Why this matters:** Once minted, your SBT is _physically impossible_ to send to another wallet. The EVM itself enforces this. Not admin-controlled. Not a flag. The transfer opcodes literally revert.

---

## On-Chain Token URI (Why No Server)

The `generateTokenURI` function builds JSON metadata and Base64-encodes it directly in the contract:

```solidity
function generateTokenURI(uint256 tokenId) internal view returns (string memory) {
    bytes memory dataURI = abi.encodePacked(
        '{"name": "Civic Soulbound Token #', tokenId.toString(), '",...}');
    return string(abi.encodePacked(
        "data:application/json;base64,",
        Base64.encode(dataURI)));
}
```

The resulting token URI is:

```
data:application/json;base64,eyJuYW1lIjoiQ2l2aWMgU291bGJvdW5kIFRva2VuICMx...
```

This is a **data URI**, not a URL. It's the actual data, encoded inline. Any blockchain node that serves the contract state can return this. No dependency on any server, IPFS gateway, or external service.

---

## File Manifest (Every File Touched)

| File                                        | Layer    | What It Does                                      |
| ------------------------------------------- | -------- | ------------------------------------------------- |
| `hardhat/contracts/civic/CivicSBT.sol`      | Contract | ERC-721 soulbound token, Base64 on-chain metadata |
| `hardhat/contracts/civic/CivicVerifier.sol` | Contract | Bridges Civic Pass → SBT mint/update              |
| `hardhat/scripts/deploy-civic.js`           | Deploy   | Deploys all 4 contracts, saves addresses          |
| `src/web3/abi/CivicSBT.json`                | ABI      | Full compiled ABI (regenerated from artifacts)    |
| `src/web3/abi/CivicVerifier.json`           | ABI      | Full compiled ABI (regenerated from artifacts)    |
| `src/web3/addresses.json`                   | Config   | Contract addresses for all components             |
| `src/web3/civic/sbt.ts`                     | Frontend | Core SBT service: read/write/compute/events       |
| `src/web3/civic/auth.ts`                    | Frontend | Trust score now reads SBT first (priority 1)      |
| `src/web3/civic/dualVerification.ts`        | Frontend | Risk fusion uses SBT via calculateTrustScore()    |
| `src/components/SoulboundToken.tsx`         | UI       | SBT profile card with score breakdown             |
| `src/pages/SBTPage.tsx`                     | UI       | Full page at `/sbt` route                         |
| `src/App.tsx`                               | Routing  | Added `/sbt` route                                |
| `backend/models/sbt.go`                     | Backend  | GORM models: SBTRecord, MintEvent, UpdateEvent    |
| `backend/services/sbt.go`                   | Backend  | On-chain reads via go-ethereum, DB cache, events  |
| `backend/handlers/sbt.go`                   | Backend  | 7 HTTP endpoints for SBT operations               |
| `backend/routes/routes.go`                  | Backend  | Registers `/api/sbt/*` routes                     |

---

## API Endpoints

| Method | Path                        | Auth   | Description                        |
| ------ | --------------------------- | ------ | ---------------------------------- |
| GET    | `/api/sbt/profile/:address` | Public | Full SBT profile + trust breakdown |
| GET    | `/api/sbt/trust/:address`   | Public | Trust score formula + breakdown    |
| GET    | `/api/sbt/check/:address`   | Public | On-chain SBT existence check       |
| POST   | `/api/sbt/sync/:address`    | Public | Force re-sync from chain           |
| GET    | `/api/sbt/leaderboard`      | Public | Top users by trust score           |
| GET    | `/api/sbt/stats`            | Public | Global SBT statistics              |
| GET    | `/api/sbt/export`           | Public | JSON export for analytics          |

---

## Test It

1. Deploy contracts: `cd hardhat && npx hardhat run scripts/deploy-civic.js --network monad_testnet`
2. Set env vars from the deploy output
3. Start backend: `cd backend && go run .`
4. Start frontend: `npm run dev`
5. Navigate to `http://localhost:5173/sbt`
6. Connect wallet → See live trust score preview
7. Click "Mint Your Soulbound Token" → Signs transaction → SBT minted on-chain
8. Trust breakdown appears: +40/+20/+20/+20 bars fill based on your real on-chain activity
9. Click "View Raw On-Chain Token URI" → See the Base64 JSON data that lives forever on-chain
