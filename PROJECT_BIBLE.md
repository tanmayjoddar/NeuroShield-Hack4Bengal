# NeuroShield — Complete Project Bible

> **Purpose**: This document is the single source of truth for the entire NeuroShield project. It covers every feature, every file, setup from scratch, contract deployment, environment variables, and the full architecture. Use this to recall everything about the project.

---

## Table of Contents

1. [Quick Setup (From ZIP Download)](#1-quick-setup-from-zip-download)
2. [Environment Variables Reference](#2-environment-variables-reference)
3. [Smart Contract Deployment](#3-smart-contract-deployment)
4. [Feature 1: ML Fraud Detection (Layer 1)](#4-feature-1-ml-fraud-detection-layer-1)
5. [Feature 2: DAO Quadratic Voting (Layer 2)](#5-feature-2-dao-quadratic-voting-layer-2)
6. [Feature 3: Dual-Layer Scoring Flywheel](#6-feature-3-dual-layer-scoring-flywheel)
7. [Feature 4: Soulbound Token (SBT) On-Chain Reputation](#7-feature-4-soulbound-token-sbt-on-chain-reputation)
8. [Feature 5: Social Recovery Wallet](#8-feature-5-social-recovery-wallet)
9. [Feature 6: Civic Biometric Identity](#9-feature-6-civic-biometric-identity)
10. [Feature 7: Transaction Interceptor & On-Chain Evidence](#10-feature-7-transaction-interceptor--on-chain-evidence)
11. [Feature 8: MEV Protection](#11-feature-8-mev-protection)
12. [Feature 9: Wallet Analytics Dashboard](#12-feature-9-wallet-analytics-dashboard)
13. [Feature 10: Transaction Logs & Audit Trail](#13-feature-10-transaction-logs--audit-trail)
14. [Architecture Overview](#14-architecture-overview)
15. [Deployed Contract Addresses](#15-deployed-contract-addresses)
16. [Project History & Key Decisions](#16-project-history--key-decisions)
17. [DNS / Network Troubleshooting](#17-dns--network-troubleshooting)

---

## 1. Quick Setup (From ZIP Download)

### Step 1: Download & Extract

```bash
# Download the ZIP from GitHub (or use git clone)
# Extract to a folder, e.g., D:\NeuroShield-Hack4Bengal

# If you want a fresh git history:
# Delete the .git folder inside the extracted directory
# Then:
cd D:\NeuroShield-Hack4Bengal
git init
git add .
git commit -m "Initial commit - NeuroShield"
```

### Step 2: Install Frontend Dependencies

```bash
cd D:\NeuroShield-Hack4Bengal
npm install --legacy-peer-deps
```

### Step 3: Start the Frontend Dev Server

```bash
npm run dev
```

Opens at **http://localhost:5173**. The frontend works independently — ML detection, DAO on-chain reads, wallet connect, transaction sending all work without the backend.

### Step 4: Set Up MetaMask for Monad Testnet

Add this network to MetaMask manually or it auto-adds on wallet connect:

| Field        | Value                                |
| ------------ | ------------------------------------ |
| Network Name | Monad Testnet                        |
| RPC URL      | `https://testnet-rpc.monad.xyz`      |
| Chain ID     | `10143`                              |
| Currency     | MON                                  |
| Explorer     | `https://testnet.monadexplorer.com`  |

Get testnet MON from the Monad faucet.

### Step 5: Backend Setup (Optional — needed for Civic Auth, reports, analytics)

```bash
cd backend

# Create .env file (see Section 2 for all variables)
# At minimum you need:
#   DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
#   JWT_SECRET=<any-random-string>

# Build the server
go build -o server.exe .

# Run it (Windows)
$env:ENVIRONMENT="development"
./server.exe

# Run it (Linux/Mac)
ENVIRONMENT=development ./server
```

The backend starts on **http://localhost:8080**. It auto-migrates database tables on startup.

**Important**: If your network DNS blocks the Neon database hostname (common on college/corporate WiFi), see [Section 17](#17-dns--network-troubleshooting).

### Step 6: Smart Contract Deployment (If needed)

See [Section 3](#3-smart-contract-deployment) for full deployment guide. Contracts are already deployed on Monad Testnet — addresses are in `src/web3/addresses.json`.

### Step 7: ML API (Already Hosted)

The ML fraud detection API is hosted on Render at:
`https://ml-fraud-transaction-detection.onrender.com/predict`

The Vite dev server proxies `/ml-api/*` to this endpoint automatically (configured in `vite.config.ts`).

To run locally:
```bash
cd api
pip install -r requirements.txt
python index.py
```

---

## 2. Environment Variables Reference

### Frontend (`.env` in root, prefix `VITE_`)

| Variable                        | Purpose                              | Default / Example                      |
| ------------------------------- | ------------------------------------ | -------------------------------------- |
| `VITE_CONTRACT_ADDRESS_MONAD`   | QuadraticVoting contract override    | From `src/web3/addresses.json`         |
| `VITE_SHIELD_TOKEN_ADDRESS`     | SHIELD token address override        | From `src/web3/addresses.json`         |
| `VITE_CIVIC_CLIENT_ID`          | Civic Auth client ID                 | Get from https://dev.civic.com         |
| `VITE_CIVIC_SBT_ADDRESS`       | CivicSBT contract address            | From `src/web3/addresses.json`         |
| `VITE_CIVIC_VERIFIER_ADDRESS`  | WalletVerifier contract address      | From `src/web3/addresses.json`         |
| `VITE_API_URL`                  | Backend API base URL                 | `http://localhost:8080`                |

### Backend (`backend/.env`)

| Variable                | Purpose                              | Required |
| ----------------------- | ------------------------------------ | -------- |
| `DATABASE_URL`          | PostgreSQL connection string (Neon)  | **Yes**  |
| `JWT_SECRET`            | JWT signing key                      | **Yes**  |
| `SERVER_PORT`           | API port                             | No (default: 8080) |
| `ENVIRONMENT`           | `production` or `development`        | No (default: production) |
| `ML_MODEL_URL`          | External ML API URL                  | No (has default) |
| `ETH_RPC_URL`           | Ethereum RPC for backend services    | No |
| `CHAIN_ID`              | Target chain ID                      | No (default: 11155111) |
| `CIVIC_AUTH_KEY`        | Civic API key                        | For Civic features |
| `CIVIC_GATEKEEPER_NETWORK` | Civic gatekeeper network ID       | For Civic features |
| `SCAM_REPORT_CONTRACT`  | ScamReporting contract address       | For on-chain reports |
| `REPORTER_PRIVATE_KEY`  | Backend's signing key for tx         | For on-chain tx |

### Hardhat (`hardhat/.env`)

| Variable             | Purpose                        | Required |
| -------------------- | ------------------------------ | -------- |
| `PRIVATE_KEY`        | Deployer wallet private key    | **Yes**  |
| `ETHERSCAN_API_KEY`  | For contract verification      | No       |
| `MONADSCAN_API_KEY`  | Monad explorer verification    | No       |

---

## 3. Smart Contract Deployment

### Prerequisites

```bash
cd hardhat
npm install
```

Create `hardhat/.env`:
```
PRIVATE_KEY=your_deployer_private_key_without_0x_prefix
```

Ensure the deployer wallet has MON on Monad Testnet.

### Option A: Deploy ALL Civic Contracts (Recommended)

This deploys: MockCivicPass → CivicSBT → WalletVerifier → CivicGatedWallet

```bash
npx hardhat run scripts/deploy-civic.js --network monad_testnet
```

**What it does:**
1. Deploys `MockCivicPass` (simulates Civic gateway for testnet)
2. Deploys `CivicSBT` (Soulbound Token ERC-721)
3. Deploys `WalletVerifier` (on-chain trust score computation)
4. Deploys `CivicGatedWallet` (gates high-value tx based on trust)
5. Authorizes WalletVerifier as SBT updater
6. Saves all addresses to `src/web3/addresses.json`

### Option B: Deploy QuadraticVoting + SocialRecovery

```bash
npx hardhat run scripts/deploy.ts --network monad_testnet
```

### Option C: Deploy SocialRecovery Only

```bash
npx hardhat run scripts/deploy-social-recovery-monad.js --network monad_testnet
```

### Verify Contracts

```bash
npx hardhat verify --network monad_testnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### After Deployment

The deploy scripts automatically update `src/web3/addresses.json`. If you need to update manually:

```bash
node scripts/update-addresses.js <contract-address> <network-id>
```

### Current Deployed Addresses

See [Section 15](#15-deployed-contract-addresses).

---

## 4. Feature 1: ML Fraud Detection (Layer 1)

### What It Does

Every outgoing transaction is scanned by a machine learning model that analyzes **18 dimensions** of wallet behavior. The model returns a `Fraud` or `Not Fraud` prediction with a risk score. This is Layer 1 of the dual-layer security system.

### How It Works

1. User enters a recipient address in Send Tokens
2. `TransactionInterceptor` fetches on-chain data for **both sender and recipient** (balance, nonce, contract status)
3. Builds an 18-feature vector from real blockchain data
4. Sends features to the ML API (`/ml-api/predict` → Render-hosted Flask server)
5. ML returns `{ prediction: "Fraud"|"Not Fraud", Type: string }`
6. Score is mapped: `risk_score > 0.6` → 85 (High), `> 0.3` → 50 (Medium), else → 10 (Low)

### 18-Feature Schema

| Index | Feature Name                      | Type   | Data Source                         |
| ----- | --------------------------------- | ------ | ----------------------------------- |
| 0     | `avg_min_between_sent_tnx`        | float  | Etherscan API or 0                  |
| 1     | `avg_min_between_received_tnx`    | float  | Etherscan API or 0                  |
| 2     | `time_diff_mins`                  | float  | Etherscan API or 0                  |
| 3     | `sent_tnx`                        | float  | Sender nonce (RPC)                  |
| 4     | `received_tnx`                    | float  | Recipient nonce (RPC)               |
| 5     | `number_of_created_contracts`     | float  | Etherscan API or 0                  |
| 6     | `max_value_received`              | float  | Recipient balance (RPC)             |
| 7     | `avg_val_received`                | float  | Recipient balance/nonce             |
| 8     | `avg_val_sent`                    | float  | Sender balance/nonce                |
| 9     | `total_ether_sent`                | float  | Transaction value                   |
| 10    | `total_ether_balance`             | float  | Sender balance (RPC)                |
| 11    | `erc20_total_ether_received`      | float  | Etherscan API or 0                  |
| 12    | `erc20_total_ether_sent`          | float  | Etherscan API or 0                  |
| 13    | `erc20_total_ether_sent_contract` | float  | Etherscan API or 0                  |
| 14    | `erc20_uniq_sent_addr`            | float  | Etherscan API or 0                  |
| 15    | `erc20_uniq_rec_token_name`       | float  | Etherscan API or 0                  |
| 16    | `erc20_most_sent_token_type`      | string | Etherscan API or ""                 |
| 17    | `erc20_most_rec_token_type`       | string | Etherscan API or ""                 |

### False-Positive Mitigation

When the ML model says "Fraud" but the recipient is a **new empty wallet** (0 balance, 0 nonce, is EOA) with **no DAO evidence** (no scam reports, no proposals), the risk score is automatically capped at 45 (Medium) instead of 85 (High). This prevents flagging new legitimate wallets as scams.

**Logic**: `Unverified ≠ Confirmed fraud`

### Files

| File | Purpose |
| ---- | ------- |
| `src/components/TransactionInterceptor.tsx` | Orchestrates ML call, scoring, UI modal |
| `src/services/walletFeatures.ts` | Builds 18-feature vector from Etherscan/RPC |
| `api/predict.py` | Python Flask endpoint (proxy to external model) |
| `api/index.py` | Alternative ML API entry point |
| `vite.config.ts` | Vite proxy: `/ml-api` → Render ML API |

### External ML Endpoint

```
https://ml-fraud-transaction-detection.onrender.com/predict
```

Vite proxies this via `/ml-api/predict` to avoid CORS issues.

---

## 5. Feature 2: DAO Quadratic Voting (Layer 2)

### What It Does

Community members vote on scam reports using SHIELD tokens. Voting power follows a **quadratic formula** — `votePower = floor(sqrt(tokens))` — so a whale staking 10,000 tokens gets only 100 votes, while someone staking 100 tokens gets 10 votes. This prevents plutocracy and gives every user a meaningful voice.

### Quadratic Voting Formula

$$\text{votePower} = \lfloor\sqrt{\text{tokensStaked}}\rfloor$$

**Reputation Bonus**: If `voterAccuracy > 80` AND `voterParticipation >= 5` → **+20% vote power** additional boost.

### Scam Confirmation Rules

- **Threshold**: `SCAM_THRESHOLD = 60` — proposal passes if `(votesFor × 100) / totalVotes ≥ 60`
- When a proposal passes: address is marked `isScammer = true`, and `scamScore += 25` (capped at 100)
- Tokens are returned to voters after proposal execution

### Voter Accuracy Tracking

| Event | Effect |
| ----- | ------ |
| Correct vote (aligned with outcome) | `+5` accuracy (starting at 75 for first correct) |
| Incorrect vote | `-10` accuracy (floor at 0) |

### Smart Contract Functions

| Function | Description | Access |
| -------- | ----------- | ------ |
| `submitProposal(address, description, evidence)` | Create scam report proposal | Anyone |
| `castVote(proposalId, support, tokens)` | Vote with quadratic weighting | Anyone with tokens |
| `executeProposal(proposalId)` | Finalize, mark scammer, update accuracy | Anyone (after voting period) |
| `isScammer(address)` | Check if address is DAO-confirmed scam | View (used by interceptor) |
| `scamScore(address)` | Get scam score 0-100 | View (used by interceptor) |
| `getProposal(id)` | Get proposal details | View |
| `getVote(id, voter)` | Get specific vote | View |
| `getVoterStats(voter)` | Get accuracy & participation | View |
| `proposalCount()` | Total proposals created | View |

### Files

| File | Purpose |
| ---- | ------- |
| `hardhat/contracts/QuadraticVoting.sol` | Solidity contract (394 lines) |
| `src/web3/contract.ts` | `ContractService` class — all DAO interactions |
| `src/components/dao/DAOPanel.tsx` | DAO governance UI panel |
| `src/components/QuadraticVoteInput.tsx` | Token input with √ preview |
| `src/pages/Index.tsx` | DAO tab integration |

---

## 6. Feature 3: Dual-Layer Scoring Flywheel

### What It Does

This is the **core innovation** — ML (Layer 1) and DAO (Layer 2) combine into a self-improving flywheel:

```
You report a scam → Community votes (quadratic) → Confirmed scams boost ML score
→ ML catches next scam faster → More reports → Flywheel accelerates
→ Everyone gets safer over time
```

### Scoring Rules (Combined ML + DAO)

| Rule | Condition | Result |
| ---- | --------- | ------ |
| **ML Base** | `risk_score > 0.6` → 85; `> 0.3` → 50; else → 10 | Sets `mlScore` |
| **False-positive override** | ML=85 BUT new empty wallet AND no DAO evidence | `mlScore` capped to **45** |
| **RULE 1: DAO Override** | `daoData.isScammer === true` | `combinedScore = 95` (DAO always wins) |
| **RULE 2: Both Agree** | `mlScore > 60 && scamScore > 30` | `combinedScore = min(100, ml×0.5 + dao×0.5 + 15)` |
| **RULE 3: DAO Only** | `scamScore > 0 && mlScore < 30` | `combinedScore = max(40, scamScore)` |
| **RULE 4: Under Review** | `activeProposals > 0 && score < 30` | Floor at **30** (pending community review) |

### Risk Bands

| Score | Level | UI Color |
| ----- | ----- | -------- |
| > 75  | High  | Red — "DANGER: Likely Scam" |
| > 50  | Medium | Yellow — "CAUTION: Suspicious" |
| ≤ 50  | Low   | Green — "SAFE: Low Risk" |

### Whitelist Override

If the user has added the address to their **Trust List** (localStorage), the effective risk score is capped at **10** and level forced to **Low**, regardless of ML or DAO results.

### Files

| File | Purpose |
| ---- | ------- |
| `src/components/TransactionInterceptor.tsx` (lines ~618-680) | Flywheel scoring engine |
| `src/web3/contract.ts` | `isScamAddress()`, `getScamScore()` — reads on-chain DAO data |

---

## 7. Feature 4: Soulbound Token (SBT) On-Chain Reputation

### What It Does

Your reputation is permanently encoded on-chain as a **non-transferable ERC-721 token**. It can never be bought, sold, or transferred. The trust score is computed entirely on-chain from verifiable sources.

### Trust Score Breakdown (max 100)

| Component | Max Points | How It's Computed |
| --------- | ---------- | ----------------- |
| **Wallet History** (balance-based) | **40** | `_getWalletScore()` — tiers based on MON balance |
| **DAO Voting Accuracy** | **30** | `QuadraticVoting.voterAccuracy(addr)` scaled ×30/100 |
| **DAO Participation** | **30** | `QuadraticVoting.voterParticipation(addr)` × 6, capped at 30 |

### Wallet Score Tiers

| Balance | Points |
| ------- | ------ |
| > 5 MON | 40 |
| > 1 MON | 30 |
| > 0.1 MON | 20 |
| > 0.01 MON | 10 |
| > 0 MON | 5 |
| = 0 | 0 |

### Verification Levels

| Score | Level | Name |
| ----- | ----- | ---- |
| ≥ 70 | 3 | Premium |
| ≥ 40 | 2 | Advanced |
| > 0 | 1 | Basic |
| = 0 | 0 | Unverified |

### Key Properties

- **Non-transferable**: `_transfer`, `transferFrom`, `safeTransferFrom` all revert with `"SBTs cannot be transferred"`
- **On-chain metadata**: Base64-encoded JSON stored directly in the token URI — no IPFS, no server dependency
- **Attributes include**: `issuedAt`, `verificationLevel`, `trustScore`, `votingAccuracy`, `daoParticipation`
- **Anyone can mint**: `mintSBT()` is public — trust score auto-computed on-chain
- **Refreshable**: `refreshSBT()` updates your score with latest DAO stats

### Files

| File | Purpose |
| ---- | ------- |
| `hardhat/contracts/civic/CivicSBT.sol` | Soulbound Token contract (ERC-721, non-transferable) |
| `hardhat/contracts/civic/WalletVerifier.sol` | On-chain trust score computation |
| `hardhat/contracts/civic/CivicGatedWallet.sol` | Gates high-value txs based on trust score |
| `src/components/SoulboundToken.tsx` | SBT profile card UI |
| `src/web3/civic/sbt.ts` | Frontend SBT service (mint, refresh, read) |
| `src/pages/Index.tsx` | SBT tab integration |

---

## 8. Feature 5: Social Recovery Wallet

### What It Does

Lost your private keys? Designate trusted people as **guardians**. If you lose access, guardians collectively vote to transfer ownership to your new wallet. Requires multiple approvals + a **3-day security delay**.

### How It Works

1. **Owner** deploys the wallet with a guardian threshold (e.g., 3 of 5)
2. **Owner** adds guardians: `addGuardian(address)` — owner-only
3. If owner loses keys, a **guardian** calls `initiateRecovery(proposedNewOwner)` — starts 3-day timelock
4. Other **guardians** call `approveRecovery(requestId)` to support
5. When `approvals >= threshold` AND `3 days have passed`, recovery auto-executes
6. **Current owner** can cancel any pending recovery: `cancelRecovery(requestId)`

### Security Properties

- `RECOVERY_DELAY = 3 days` — immutable, cannot be changed after deployment
- `GUARDIAN_THRESHOLD` — set at deploy time, immutable
- No single guardian can execute recovery alone
- Owner can always cancel a pending recovery (protection against rogue guardians)

### Files

| File | Purpose |
| ---- | ------- |
| `hardhat/contracts/SocialRecoveryWallet.sol` | On-chain contract |
| `src/components/GuardianManager.tsx` | Guardian management UI |
| `src/web3/socialRecovery.ts` | Frontend service for recovery operations |
| `hardhat/scripts/deploy-social-recovery-monad.js` | Deployment script |

---

## 9. Feature 6: Civic Biometric Identity

### What It Does

Prevents **Sybil attacks** (one person creating multiple accounts to game the DAO). Users verify their identity through Civic's face biometric authentication. Verification status is linked to the SBT.

### Integration Points

| Component | How Civic Is Used |
| --------- | ----------------- |
| **SBT Minting** | Civic verification status can gate premium SBT features |
| **DAO Voting** | Verified humans get reputation bonus in quadratic voting |
| **High-Value Tx** | `CivicGatedWallet` can require trust score threshold for large transfers |

### Backend Endpoints

| Endpoint | Purpose |
| -------- | ------- |
| `POST /api/auth/civic/initiate` | Start Civic verification session |
| `POST /api/auth/civic/verify` | Verify gatepass token |
| `GET /api/auth/civic/status` | Check verification status |

### Files

| File | Purpose |
| ---- | ------- |
| `src/components/civic/SimpleCivicAuth.tsx` | Civic auth UI component |
| `backend/handlers/civic_auth.go` | Civic auth API handlers |
| `backend/services/civic_auth.go` | Civic auth service logic |
| `backend/models/civic_auth.go` | DB models for Civic sessions |
| `backend/migrations/civic_auth.go` | DB migration for Civic tables |
| `hardhat/contracts/civic/CivicGatedWallet.sol` | On-chain Civic-gated wallet |

---

## 10. Feature 7: Transaction Interceptor & On-Chain Evidence

### What It Does

A modal that appears before every transaction, showing a complete risk assessment with real-time on-chain data. This is the **central orchestrator** that ties ML + DAO + whitelist + on-chain evidence together.

### Flow

1. User clicks "Send" → `SendTransaction.tsx` validates inputs → opens `TransactionInterceptor`
2. Interceptor runs **in parallel**:
   - Fetches sender + recipient on-chain data (balance, nonce, contract status) via `Promise.allSettled`
   - Calls ML API with 18-feature vector (15s timeout with AbortController)
   - Calls DAO contract: `isScamAddress()`, `getScamScore()`, `getScamReports()`
3. Computes combined score using flywheel rules
4. Shows **On-Chain Evidence Panel**: recipient balance, tx count, wallet type (EOA vs Contract)
5. Shows **ML Analysis**: risk score, prediction, raw JSON output
6. Shows **DAO Analysis**: scam score, active proposals, community verdict
7. User can: **Proceed**, **Block**, **Trust (whitelist)**, or **Dismiss**

### On-Chain Evidence Panel

Displays real data fetched directly from the blockchain:
- **Recipient Balance**: `provider.getBalance(toAddress)`
- **Recipient Tx Count**: `provider.getTransactionCount(toAddress)`
- **Wallet Type**: `provider.getCode(toAddress)` — EOA vs Contract
- **Warning banner** if new empty wallet + no DAO evidence (explains why score was adjusted)
- **Red banner** if DAO-confirmed scammer

### Address Validation (SendTransaction.tsx)

Separates format validation from RPC data fetching:
1. `ethers.isAddress(address)` — offline format check (always works)
2. Then tries `getBalance`, `getCode`, `getTransactionCount` — if RPC fails (rate limit, network), address is still marked valid
3. Prevents false "Invalid Ethereum Address" errors on Monad when RPC is slow

### Files

| File | Purpose |
| ---- | ------- |
| `src/components/TransactionInterceptor.tsx` | Central risk assessment modal (~1000 lines) |
| `src/components/SendTransaction.tsx` | Send form + interceptor integration (~405 lines) |

---

## 11. Feature 8: MEV Protection

### What It Does

Protects transactions from **front-running** and **sandwich attacks**. Before sending a DEX trade, the system checks for MEV vulnerability and can route through **private mempools** (Flashbots-style).

### Files

| File | Purpose |
| ---- | ------- |
| `src/web3/mev-protection.ts` | MEV detection and protection logic |
| `src/web3/wallet.ts` | `createMEVProtection()` factory |

---

## 12. Feature 9: Wallet Analytics Dashboard

### What It Does

Visualize your on-chain footprint — the same 18 features the ML model uses are displayed as charts so you can understand exactly what the AI sees about any wallet.

### Files

| File | Purpose |
| ---- | ------- |
| `src/components/WalletAnalytics.tsx` | Analytics dashboard UI |
| `src/services/walletFeatures.ts` | Feature extraction for both ML and display |
| `backend/handlers/analytics.go` | Backend analytics API endpoints |
| `backend/services/wallet_analytics.go` | Backend analytics service |

### Backend Endpoints

| Endpoint | Purpose |
| -------- | ------- |
| `GET /api/analytics/wallet/:address` | Full wallet analytics |
| `GET /api/analytics/risk/:address` | Risk score for address |
| `POST /api/analytics/bulk` | Bulk wallet analytics |
| `POST /api/analytics/export` | Export ML dataset |

---

## 13. Feature 10: Transaction Logs & Audit Trail

### What It Does

Every transaction scanned by the interceptor is logged to `localStorage` with full ML and DAO analysis data. Users can review their transaction history with expandable raw ML/DAO output.

### Storage

- **Key**: `localStorage["transaction-logs"]`
- **Max entries**: 100 (LIFO — oldest removed first)
- **Cross-tab sync**: Via `StorageEvent` listener
- **Refresh**: Custom `"transaction-logged"` event

### Each Log Entry Contains

```typescript
{
  to: string;
  from: string;
  value: string;
  gasPrice: string;
  timestamp: number;
  hash?: string;
  riskScore: number;
  riskLevel: "High" | "Medium" | "Low";
  blocked: boolean;
  whitelisted: boolean;
  ml: {
    raw: object;      // Full ML API JSON response
    durationMs: number;
  };
  dao: {
    data: object;      // DAO check result
    durationMs: number;
  };
}
```

### Files

| File | Purpose |
| ---- | ------- |
| `src/components/TransactionLogsViewer.tsx` | Log viewer with expandable ML/DAO details |
| `src/components/TransactionInterceptor.tsx` | Writes logs after analysis |

---

## 14. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                    │
│  src/components/TransactionInterceptor.tsx  ← Central orchestrator│
│  src/components/SendTransaction.tsx         ← Send flow           │
│  src/components/dao/DAOPanel.tsx            ← DAO governance UI   │
│  src/components/SoulboundToken.tsx          ← SBT profile         │
│  src/components/GuardianManager.tsx         ← Social recovery     │
│  src/components/WalletAnalytics.tsx         ← Analytics dashboard │
│  src/web3/contract.ts                      ← All contract calls   │
│  src/web3/wallet.ts                        ← Wallet + Monad config│
│  src/web3/civic/sbt.ts                     ← SBT frontend service │
│  src/web3/socialRecovery.ts                ← Recovery frontend    │
│  src/pages/Index.tsx                       ← Main page + tabs     │
├──────────────────────────────────────────────────────────────────┤
│                    VITE PROXY (vite.config.ts)                    │
│  /ml-api/*  → https://ml-fraud-transaction-detection.onrender.com │
│  /api/*     → http://localhost:8080                               │
├──────────────────────────────────────────────────────────────────┤
│                    ML API (Python Flask)                           │
│  api/predict.py    ← Prediction endpoint                          │
│  api/index.py      ← Flask server                                 │
│  Model: scikit-learn, 18-feature fraud classifier                 │
│  Hosted: Render (https://ml-fraud-transaction-detection.onrender.com) │
├──────────────────────────────────────────────────────────────────┤
│                    GO BACKEND (Gin + GORM)                        │
│  backend/main.go              ← Entry point                       │
│  backend/routes/routes.go     ← All API routes                    │
│  backend/handlers/            ← Firewall, Report, DAO, Auth, Civic│
│  backend/services/            ← AI, Blockchain, Civic, Analytics  │
│  backend/models/              ← GORM models                       │
│  backend/config/              ← DB + config                       │
│  Database: PostgreSQL (Neon serverless)                            │
├──────────────────────────────────────────────────────────────────┤
│                 SMART CONTRACTS (Solidity 0.8.28)                  │
│  hardhat/contracts/QuadraticVoting.sol       ← DAO + scam voting  │
│  hardhat/contracts/SocialRecoveryWallet.sol  ← Guardian recovery  │
│  hardhat/contracts/civic/CivicSBT.sol       ← Soulbound Token    │
│  hardhat/contracts/civic/WalletVerifier.sol  ← Trust score engine │
│  hardhat/contracts/civic/CivicGatedWallet.sol ← Trust-gated txs  │
│  Network: Monad Testnet (Chain 10143)                             │
└──────────────────────────────────────────────────────────────────┘
```

### Main Page Tab Structure (`src/pages/Index.tsx`)

| Tab | Components |
| --- | ---------- |
| `overview` | `SecurityScore`, `WalletConnect`, `TransactionHistory`, AI Demo button |
| `analytics` | `WalletAnalytics` |
| `dao` | `DAOPanel` (quadratic voting governance) |
| `reports` | Scam report form → `reportScam()` on-chain |
| `sbt` | `SoulboundToken`, `SimpleCivicAuth` |
| `settings` | `GuardianManager`, `TransactionLogsViewer` |

---

## 15. Deployed Contract Addresses

**Network**: Monad Testnet · Chain ID: `10143` · RPC: `https://testnet-rpc.monad.xyz`

| Contract | Address | File |
| -------- | ------- | ---- |
| **QuadraticVoting** | `0xC9755c1Be2c467c17679CeB5d379eF853641D846` | `hardhat/contracts/QuadraticVoting.sol` |
| **ShieldToken** | `0xD1a5dD85366D8957E3f1917c4bFe7BDBA113FE0d` | (deployed alongside QuadraticVoting) |
| **CivicSBT** | `0xc5A1E1E6324Dff8dE996510C8CBc4AdE0D47ADcB` | `hardhat/contracts/civic/CivicSBT.sol` |
| **CivicGatedWallet** | `0xC33c15c33fA18CA7Bc03F4FF5630E9d00727cC34` | `hardhat/contracts/civic/CivicGatedWallet.sol` |
| **SocialRecoveryWallet** | `0x6d51b690b3b10196A07D3Bdc042296825006EfBA` | `hardhat/contracts/SocialRecoveryWallet.sol` |
| **WalletVerifier** | `0x78d8Ff95a4C4dc864AAD94932A39CcB4AcBDdD30` | `hardhat/contracts/civic/WalletVerifier.sol` |

**Source of truth**: `src/web3/addresses.json`

---

## 16. Project History & Key Decisions

### Timeline

1. **Initial Build**: React + Vite frontend, Go backend with Gin, PostgreSQL on Neon serverless
2. **Smart Contracts**: Deployed QuadraticVoting + SocialRecoveryWallet on Monad Testnet
3. **ML Integration**: 18-feature fraud detection model trained on Ethereum transaction data, hosted on Render
4. **Civic Integration**: CivicSBT + WalletVerifier deployed for on-chain identity and reputation
5. **Flywheel Implementation**: ML + DAO dual-layer scoring with 4 rules for combined risk assessment
6. **Monad Adaptation**: Legacy (type 0) transactions (no EIP-1559), `eth_getLogs` chunking (100-block limit), rate limiting (25 req/sec), patched provider to null EIP-1559 fields
7. **False-Positive Fix**: Added recipient on-chain context fetching + scoring override for new empty wallets
8. **Send Flow Rewrite**: Eliminated duplicate ML calls (was 935 lines → 405 lines), single interceptor modal
9. **Address Validation Fix**: Separated format check from RPC data fetch to prevent false "Invalid Address" on Monad

### Key Technical Decisions

| Decision | Reason |
| -------- | ------ |
| **Monad Testnet** over Sepolia | High TPS, EVM-compatible, hackathon sponsor track |
| **Type 0 (legacy) transactions** | Monad doesn't support EIP-1559 |
| **Quadratic voting** over simple voting | Prevents whale domination, mathematically fair |
| **Soulbound (non-transferable) tokens** | Reputation must be earned, not bought |
| **On-chain metadata (Base64 JSON)** | No IPFS dependency — SBT survives even if all servers die |
| **Vite proxy for ML API** | Avoids CORS issues without requiring ML API changes |
| **localStorage for transaction logs** | Works offline, no backend dependency for audit trail |
| **Promise.allSettled for on-chain fetches** | Partial failures don't break the entire analysis |

### Monad-Specific Constraints & Workarounds

| Constraint | Workaround | File |
| ---------- | ---------- | ---- |
| No EIP-1559 | Force `type: 0`, null maxFeePerGas fields | `src/web3/wallet.ts` |
| `eth_getLogs` max 100 blocks | Chunked scanning with backoff | `src/web3/contract.ts` |
| 25 req/sec rate limit | Request throttling, reduced scan windows | `src/web3/contract.ts` |
| `accountsChanged` event | Must use `window.ethereum` (EIP-1193) | `src/components/dao/DAOPanel.tsx` |

---

## 17. DNS / Network Troubleshooting

### Problem: Backend Can't Connect to Neon Database

**Error**: `hostname resolving error: lookup ep-....neon.tech: no such host`

**Root Cause**: Your local DNS server (e.g., `10.x.x.x` on college/corporate WiFi) is **refusing queries** for Neon's subdomain. The hostname resolves fine via Google DNS.

**Diagnosis**:
```powershell
# This will fail on restricted DNS:
nslookup ep-wispy-block-ahqfu1kf-pooler.c-3.us-east-1.aws.neon.tech

# This should work:
nslookup ep-wispy-block-ahqfu1kf-pooler.c-3.us-east-1.aws.neon.tech 8.8.8.8
```

### Fix Options

**Option 1: Add Google DNS to your WiFi adapter** (Admin required)
```powershell
# Run PowerShell as Administrator:
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses ("10.118.78.117","8.8.8.8","8.8.4.4")
```

**Option 2: Switch to mobile hotspot**
Use your phone's hotspot which won't have corporate DNS restrictions.

**Option 3: Use Cloudflare DNS**
Change DNS in Windows Settings → Network → Wi-Fi → DNS → Manual:
- Primary: `1.1.1.1`
- Secondary: `8.8.8.8`

**Option 4: VPN**
Any VPN will bypass local DNS restrictions.

### What Works Without the Backend

| Feature | Works? | Why |
| ------- | ------ | --- |
| ML fraud detection | ✅ | Calls Render ML API via Vite proxy |
| DAO on-chain reads | ✅ | Direct ethers.js → Monad RPC |
| Send transactions | ✅ | MetaMask → Monad RPC |
| Address validation | ✅ | Direct RPC calls |
| Whitelist (trust list) | ✅ | localStorage |
| Transaction logs | ✅ | localStorage |
| Wallet connect | ✅ | MetaMask EIP-1193 |
| Civic Auth | ❌ | Needs backend API |
| Server-side reports | ❌ | Needs backend + DB |
| Wallet analytics (backend) | ❌ | Needs backend + DB |
| SBT profiles (backend) | ❌ | Needs backend + DB |
| Recovery flow (backend) | ❌ | Needs backend + DB |

---

## Winning Features Summary

### Why NeuroShield Wins

1. **Self-Improving AI Flywheel**: ML + DAO form a feedback loop. Every confirmed scam makes the AI smarter. No other project does this.

2. **Quadratic Voting**: Mathematically fair governance. `votePower = √tokens`. Whales can't dominate. Small holders matter.

3. **Soulbound Reputation**: Non-transferable ERC-721 with on-chain metadata. Trust scores computed entirely on-chain. Survives server death.

4. **On-Chain Evidence Analysis**: Real-time recipient profiling (balance, nonce, contract status) prevents false positives. The system knows the difference between "new wallet" and "scam wallet".

5. **Social Recovery**: Lost keys? Guardians + 3-day timelock = safe recovery without seed phrases.

6. **Civic Biometrics**: Sybil-resistant identity. One person = one vote. Face verification linked to SBT.

7. **MEV Protection**: Sandwich attack and front-running prevention via private mempool routing.

8. **Full Stack On-Chain**: Smart contracts (Monad) + ML model (Render) + Go backend + React frontend. Every layer is production-ready.

9. **Monad-Native**: Built specifically for Monad testnet with all its constraints handled (legacy tx, rate limits, log chunking).

10. **Dual-Layer Security**: Neither AI alone nor community alone is enough. Together they create an unstoppable security system.
