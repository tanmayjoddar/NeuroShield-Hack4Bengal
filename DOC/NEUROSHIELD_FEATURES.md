# NeuroShield — Complete Feature Documentation

> **The world's first self-improving scam detection platform.**
> AI + DAO + On-Chain Identity = A firewall that gets smarter every time someone tries to scam you.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Self-Improving Flywheel](#2-the-self-improving-flywheel)
3. [Layer 1 — ML Fraud Detection (Instant)](#3-layer-1--ml-fraud-detection-instant)
4. [Layer 2 — Quadratic Voting DAO (Community)](#4-layer-2--quadratic-voting-dao-community)
5. [On-Chain Event Listener (The Bridge)](#5-on-chain-event-listener-the-bridge)
6. [Dual-Layer Risk Fusion Engine](#6-dual-layer-risk-fusion-engine)
7. [Civic Identity Verification](#7-civic-identity-verification)
8. [Soulbound Token (SBT) — On-Chain Reputation](#8-soulbound-token-sbt--on-chain-reputation)
9. [SHIELD Token — Governance & Staking](#9-shield-token--governance--staking)
10. [Social Recovery Wallet](#10-social-recovery-wallet)
11. [MEV Protection & Private Mempool](#11-mev-protection--private-mempool)
12. [Civic-Gated High-Value Transactions](#12-civic-gated-high-value-transactions)
13. [Wallet Analytics Engine](#13-wallet-analytics-engine)
14. [Telegram Bot Integration](#14-telegram-bot-integration)
15. [Backend API Reference](#15-backend-api-reference)
16. [Frontend Architecture](#16-frontend-architecture)
17. [Smart Contract Registry](#17-smart-contract-registry)
18. [Tech Stack Summary](#18-tech-stack-summary)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         NEUROSHIELD ARCHITECTURE                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────┐    ┌─────────────┐    ┌───────────────────────────────┐   │
│   │ React   │───▶│  Go Backend │───▶│  PostgreSQL                   │   │
│   │ Frontend │    │  (Gin)      │    │  • transactions               │   │
│   │ + Vite   │    │  + REST API │    │  • dao_proposals              │   │
│   │ + ethers │    │  + WebSocket│    │  • confirmed_scams            │   │
│   └────┬─────┘    └─────┬───────┘    │  • civic_auth_sessions        │   │
│        │                │            └───────────────────────────────┘   │
│        │                │                                                │
│        ▼                ▼                                                │
│   ┌──────────────────────────┐    ┌─────────────────────────────────┐   │
│   │   Monad Testnet (EVM)    │    │   External ML API (Render)      │   │
│   │   Chain ID: 10143        │    │   18-feature fraud model        │   │
│   │   • QuadraticVoting      │    │   Real-time risk scoring        │   │
│   │   • ShieldToken          │    └─────────────────────────────────┘   │
│   │   • SocialRecoveryWallet │                                          │
│   │   • CivicVerifier + SBT  │    ┌─────────────────────────────────┐   │
│   │   • CivicGatedWallet     │    │   Telegram Bot                  │   │
│   └──────────────────────────┘    │   Real-time security alerts     │   │
│                                    └─────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

**What makes NeuroShield different:** Most scam detectors are static blacklists. NeuroShield has a **feedback loop** — the community's votes _literally_ retrain the AI's threat model in real-time.

---

## 2. The Self-Improving Flywheel

This is the core innovation. Every component feeds into the next, creating a system that gets smarter over time:

```
   ┌─── ML Model (Layer 1) ◀──────────────────────┐
   │    Flags suspicious transactions               │
   │    Uses 18-feature vector + DAO boost          │
   ▼                                                │
   User gets warned ──▶ Community reviews     getDAOScamBoost()
                              │                reads confirmed_scams
                              ▼                     │
                     QuadraticVoting DAO             │
                     (Layer 2)                       │
                     Voters stake SHIELD tokens      │
                     sqrt(tokens) = vote power       │
                              │                      │
                              ▼                      │
                     ProposalExecuted event           │
                              │                      │
                              ▼                      │
                     Event Listener (Go)              │
                     WebSocket subscriber             │
                              │                      │
                              ▼                      │
                     PostgreSQL confirmed_scams ──────┘
```

**Step by step:**

1. ML model flags a transaction as suspicious (Layer 1)
2. User or community submits a scam proposal to the DAO
3. Token holders stake SHIELD tokens and vote using quadratic power
4. After the 3-day voting period, proposal executes on-chain
5. **Event Listener** catches the `ProposalExecuted` event via WebSocket
6. Listener writes the confirmed address + score to PostgreSQL `confirmed_scams` table
7. Next time the ML model scores a transaction, `getDAOScamBoost()` reads `confirmed_scams` and **adds up to +50% risk boost** for DAO-confirmed scammers
8. Better detection → more trust → more community participation → better data → repeat

> **The flywheel never stops.** Each confirmed scam makes every future detection more accurate.

---

## 3. Layer 1 — ML Fraud Detection (Instant)

**Response time:** < 2 seconds
**Model:** Externally hosted on Render (`ml-fraud-transaction-detection.onrender.com/predict`)

### 18-Feature Vector

Every transaction is analyzed across 18 dimensions:

| #   | Feature                             | What it captures                   |
| --- | ----------------------------------- | ---------------------------------- |
| 0   | Avg minutes between sent txns       | Sending frequency pattern          |
| 1   | Avg minutes between received txns   | Receiving frequency pattern        |
| 2   | Time diff first↔last tx (mins)      | Account age & activity span        |
| 3   | Sent transaction count              | Outgoing activity volume           |
| 4   | Received transaction count          | Incoming activity volume           |
| 5   | Number of created contracts         | Deployer behavior (scam factory?)  |
| 6   | Max value received (ETH)            | Largest single incoming transfer   |
| 7   | Avg value received (ETH)            | Typical incoming size              |
| 8   | Avg value sent (ETH)                | Typical outgoing size              |
| 9   | Total ether sent                    | Lifetime outflow                   |
| 10  | Total ether balance                 | Current holding                    |
| 11  | ERC20 total ether received          | Token activity (in)                |
| 12  | ERC20 total ether sent to contracts | Token activity (out to contracts)  |
| 13  | **Transaction value** (current tx)  | This specific transaction's amount |
| 14  | Gas price                           | Urgency/willingness to pay         |
| 15  | ERC20 unique sent addresses         | Token distribution breadth         |
| 16  | ERC20 unique received token names   | Token diversity                    |
| 17  | Wallet age (days)                   | Account maturity                   |

### DAO Boost (The Flywheel Output)

After ML scoring, the system queries the DAO-confirmed scam database:

```
Final Risk = ML_Risk + DAO_Boost     (capped at 1.0)

Where DAO_Boost =
  • Address in confirmed_scams: scamScore/100 × 0.5  (max +0.50)
  • Address has active proposals: +0.15              (under review)
  • Address not in DAO:          0.0                 (clean)
```

### Enhanced Analysis (High-Value Transactions)

For transactions above threshold:

- **+0.30** if destination has scam history (prior confirmed reports)
- **+0.20** if unusual pattern (value > 3× 24-hour average, or first-time recipient)

---

## 4. Layer 2 — Quadratic Voting DAO (Community)

**Contract:** `QuadraticVoting.sol` (394 lines)
**Deployed:** `0x7A791FE5A35131B7D98F854A64e7F94180F27C7B` on Monad testnet
**Scam threshold:** 60% of quadratic vote power must agree

### How Quadratic Voting Works

Traditional voting (1 person = 1 vote) lets whales dominate. Quadratic voting uses `sqrt(tokens)`:

| SHIELD Tokens Staked | Vote Power | Cost per marginal vote |
| -------------------- | ---------- | ---------------------- |
| 1                    | 1          | 1 token                |
| 4                    | 2          | 3 tokens               |
| 9                    | 3          | 5 tokens               |
| 100                  | 10         | 19 tokens              |
| 10,000               | 100        | 199 tokens             |

**Result:** Small voters have disproportionately more influence. A whale with 10,000 tokens gets 100 votes, but 100 community members with 1 token each get 100 votes total — for 1% of the cost.

### Voter Reputation System

Voters build on-chain reputation that amplifies their future power:

- **Accuracy Score** (0-100):
  - First correct vote starts at 75
  - Each correct vote: +5 (cap 100)
  - Each wrong vote: -10 (floor 0)

- **Participation Count**: Total proposals voted on

- **Reputation Bonus**: If `accuracy > 80` AND `participation >= 5` → **+20% vote power boost**

### Scam Confirmation Flow

```
submitProposal(address, description, evidence)
    │
    ├─── 3-day voting period ───┐
    │    castVote(id, support,  │
    │      tokens)              │
    │    • SHIELD tokens staked │
    │    • sqrt(tokens) = power │
    │    • Reputation bonus     │
    │                           │
    └──── executeProposal(id) ──┘
              │
              ├── passed (≥60%): isScammer[addr]=true, scamScore+=25
              │   emits ScamAddressConfirmed + ProposalExecuted
              │
              └── rejected: no scam marking

         ALL voters get staked tokens returned
```

---

## 5. On-Chain Event Listener (The Bridge)

**File:** `backend/services/event_listener.go`
**The missing link** that connects on-chain DAO votes to the off-chain ML model.

### Architecture

```
Monad WSS ──► SubscribeFilterLogs(ProposalExecuted)
                        │
                   ┌────▼────┐
                   │ passed?  │──── false → skip
                   └────┬────┘
                        │ true
                ┌───────▼───────┐
                │ eth_call:     │
                │ getProposal() │  ← HTTP RPC
                │ scamScore()   │
                │ voterCount()  │
                └───────┬───────┘
                        │
                ┌───────▼───────┐
                │ UPSERT into   │
                │ ConfirmedScam │  ← PostgreSQL
                └───────────────┘
```

### Key Details

| Feature      | Implementation                                                          |
| ------------ | ----------------------------------------------------------------------- |
| Connection   | WebSocket to `wss://testnet-rpc.monad.xyz`                              |
| Event filter | `ProposalExecuted(uint256 indexed, bool)` topic only                    |
| View calls   | `getProposal()`, `scamScore()`, `getProposalVoterCount()` via HTTP RPC  |
| DB write     | UPSERT into `confirmed_scams` — updates score if address already exists |
| Reconnect    | Exponential backoff: 1s → 2s → 4s → ... → 2min cap                      |
| Logging      | Structured JSON: `{timestamp, level, service, message, fields}`         |
| Shutdown     | Channel-based graceful stop with `sync.WaitGroup`                       |

---

## 6. Dual-Layer Risk Fusion Engine

**File:** `src/web3/civic/dualVerification.ts`
**Where all three signals merge:** ML risk, DAO verdict, and Civic trust.

### Parallel Execution

All checks run simultaneously for speed:

```typescript
const [mlResult, daoResult, civicResult, trustResult] =
  await Promise.allSettled([
    runMlScamDetection(transaction),
    queryDAOScamDatabase(address),
    verifyCivicIdentity(address),
    calculateTrustScore(address),
  ]);
```

### Risk Fusion Rules (Priority Order)

| Priority | Condition                  | Combined Risk             | Confidence Boost |
| -------- | -------------------------- | ------------------------- | ---------------- |
| 1        | DAO-confirmed scammer      | **95**                    | +30              |
| 2        | ML > 60 AND DAO score > 30 | `(ML×0.5 + DAO×0.5) + 15` | +20              |
| 3        | ML > 60, DAO unknown       | ML score                  | 0                |
| 4        | DAO score > 0, ML < 30     | `max(40, daoScore)`       | +5               |
| 5        | Both low                   | ML score                  | +15              |
| 6        | Default                    | `ML×0.6 + DAO×0.4`        | 0                |

### Civic Trust Discount

Verified users get the benefit of the doubt:

```
if (civicVerified && risk > 10):
    discount = min(10, trustScore / 10)
    risk -= discount     // floor 5
```

### DAO Review Floor

If an address has active proposals under review and combined risk < 30, force it to 30 (no false safety).

### Risk Levels

| Risk Score | Level    | Action            |
| ---------- | -------- | ----------------- |
| ≥ 80       | Critical | Block transaction |
| ≥ 60       | High     | Strong warning    |
| ≥ 40       | Medium   | Caution advisory  |
| ≥ 20       | Low      | Informational     |
| < 20       | Safe     | Proceed           |

---

## 7. Civic Identity Verification

Three-tier verification with on-chain fallback:

### Verification Cascade

```
1. On-chain CivicVerifier.isVerified() + getVerificationLevel()
       │                                          │
       └── fails? ─────────────────────────────────┘
                             │
2. Local verification cache (localStorage, 24h expiry)
       │
       └── miss? ─────────────────────────────────────
                             │
3. DAO participation check: QuadraticVoting.getVoterStats()
       • participation > 0 → level 1 (Basic)
       • participation ≥ 5 → level 2 (Advanced)
```

### Trust Score Calculation

| Component           | Max Points | Formula                       |
| ------------------- | ---------- | ----------------------------- |
| Civic verification  | 40         | 40 if verified, 0 if not      |
| Transaction history | 20         | `min(20, floor(txCount / 5))` |
| DAO voting accuracy | 20         | `floor(accuracy × 0.2)`       |
| DAO participation   | 20         | `min(20, participation × 2)`  |
| **Total**           | **100**    | Sum, capped at 100            |

### Verification Levels

| Level | Name       | Requirements                             |
| ----- | ---------- | ---------------------------------------- |
| 0     | Unverified | No checks passed                         |
| 1     | Basic      | Civic Pass or DAO participation          |
| 2     | Advanced   | High accuracy + ≥5 DAO votes             |
| 3     | Premium    | Full CivicVerifier on-chain verification |

---

## 8. Soulbound Token (SBT) — On-Chain Reputation

**Contract:** `CivicSBT.sol` — ERC-721 with **non-transferable** enforcement

### What's Stored On-Chain

Each SBT permanently records:

```solidity
struct TokenMetadata {
    uint256 issuedAt;           // Block timestamp
    uint256 verificationLevel;  // 1-3: Basic/Advanced/Premium
    uint256 trustScore;         // 0-100
    uint256 votingAccuracy;     // 0-100 (DAO alignment)
    uint256 doiParticipation;   // Total DAO votes cast
}
```

### Non-Transferability (Soulbound)

Every transfer function is overridden to revert:

```solidity
function _transfer(address, address, uint256) internal pure override {
    revert("SBTs cannot be transferred");
}
function transferFrom(address, address, uint256) public pure override { ... }
function safeTransferFrom(address, address, uint256) public pure override { ... }
```

**Your reputation is permanently bound to your wallet.** You can't buy someone else's good standing.

### Fully On-Chain Token URI

Token metadata is encoded as Base64 JSON directly on-chain — no IPFS, no external dependencies. The SBT works even if every server goes offline.

---

## 9. SHIELD Token — Governance & Staking

**Contract:** `ShieldToken.sol` — ERC-20 (OpenZeppelin)

| Property       | Value                                        |
| -------------- | -------------------------------------------- |
| Name           | SHIELD                                       |
| Symbol         | SHIELD                                       |
| Initial Supply | 1,000,000 SHIELD                             |
| Decimals       | 18                                           |
| Minting        | Owner-only (`mint()`) for airdrops/faucets   |
| Primary Use    | Staked in QuadraticVoting to earn vote power |

**TOKEN FLOW:**

```
User holds SHIELD → stakes in DAO vote → sqrt(tokens) = vote power
→ vote resolves → tokens returned to all voters (win or lose)
```

Tokens are never burned by voting. They're temporarily locked, then returned. This encourages participation without penalizing honest voters.

---

## 10. Social Recovery Wallet

**Contract:** `SocialRecoveryWallet.sol`
**The answer to "I lost my private key"** — without centralized custody.

### Guardian System

- Owner adds trusted **guardians** (friends, family, other wallets)
- Guardians have **no access** to funds during normal operation
- Recovery only triggers if enough guardians agree

### Recovery Process

```
1. Guardian calls initiateRecovery(proposedNewOwner)
   ├── Creates RecoveryRequest
   ├── 1 approval counted (the initiator)
   └── Starts 3-day delay timer

2. Other guardians call approveRecovery(requestId)
   ├── Each guardian can approve once
   └── If threshold met AND 3 days passed → auto-execute

3. _executeRecovery(requestId)
   ├── Requires: approvals ≥ GUARDIAN_THRESHOLD
   ├── Requires: block.timestamp ≥ initiationTime + 3 days
   └── Transfers ownership to proposed new owner

4. Owner can cancelRecovery(requestId) at any time
```

### Security Properties

- **3-day delay**: Owner has time to cancel malicious recovery attempts
- **Threshold**: Not just one guardian, but N-of-M must agree
- **ReentrancyGuard**: Prevents re-entrancy attacks during ownership transfer
- **No fund access**: Guardians can only vote on ownership, never move funds

---

## 11. MEV Protection & Private Mempool

**File:** `src/web3/mev-protection.ts` + `src/web3/flashbotsProvider.ts`

### What is MEV?

Miner Extractable Value (MEV) is when bots front-run your transaction. You swap on Uniswap, a bot sees your pending tx in the mempool, buys before you, drives up the price, then sells after your trade at profit. You get a worse price.

### NeuroShield's Three-Layer Defense

**1. Sandwich Attack Detection**

Checks all DEX transactions against known router addresses:

- Uniswap V2: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`
- Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564`
- SushiSwap: `0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F`

Decodes swap calldata, verifies `amountOutMin > 0` and `deadline > now`.

**2. Automatic Slippage Protection**

If a DEX trade is detected with insufficient slippage protection:

- Recalculates `amountOutMin` with the configured tolerance
- Adds a 5-minute deadline
- Re-encodes the transaction with safe parameters

**3. Flashbots Private Mempool**

Transactions are routed through Flashbots relay instead of the public mempool:

```
Normal:  your tx → public mempool → bots see it → front-run
Private: your tx → Flashbots relay → direct to block builder → no bots
```

Flow: `protectTransaction()` → add slippage protection → Flashbots bundle → simulate → submit → wait for `BundleIncluded` → fallback to regular tx on failure.

---

## 12. Civic-Gated High-Value Transactions

**Contract:** `CivicGatedWallet.sol`

Adds identity verification to large transfers:

```
executeTransaction(to, value):
    if value >= verificationThreshold:
        require(civicVerifier.isVerified(msg.sender))  // Must be identity-verified
    else:
        proceed normally  // Small txs don't need verification
```

**Default threshold:** 1 ETH

This prevents stolen wallets from being drained — even if your key is compromised, the attacker can't make large transfers without passing Civic identity verification.

---

## 13. Wallet Analytics Engine

**File:** `backend/services/wallet_analytics.go`

### Metrics Collected

| Category    | Metrics                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| **Timing**  | Avg min between sent/received txns, time span first↔last tx             |
| **Volume**  | Sent count, received count, created contracts count                     |
| **Value**   | Max/avg received, avg sent, total sent, current balance                 |
| **ERC20**   | Total received/sent, sent to contracts, unique addresses, unique tokens |
| **Derived** | Transaction frequency (txs/hour), wallet age (days)                     |

### Scam History Analysis

`GetAddressScamHistory()` returns:

- Total confirmed scam reports
- Total scam amount involved
- Last scam report timestamp

### Unusual Transaction Detection

A transaction is flagged as unusual if:

- Value > **3× the 24-hour average** for that wallet
- Recipient is a **first-time** address for that sender

### ML Dataset Export

`ExportAnalyticsForML()` exports wallet analytics as CSV for ML model retraining — the data flywheel extends beyond the blockchain.

---

## 14. Telegram Bot Integration

**File:** `backend/services/telegram.go`

### Real-Time Security Alerts

The Telegram bot sends instant notifications for:

| Alert Type     | Trigger               | Content                                  |
| -------------- | --------------------- | ---------------------------------------- |
| Security Alert | ML flags high-risk tx | Type, Severity, Details, `/block` action |
| Scam Report    | New DAO scam proposal | Address, Category, Description           |
| Admin Notice   | System events         | Arbitrary admin messages                 |

### Bot Commands

| Command         | Action                                |
| --------------- | ------------------------------------- |
| `/start`        | Welcome + feature overview            |
| `/link 0x...`   | Link Telegram chat to wallet address  |
| `/status`       | Show linked wallets & security status |
| `/block TX_ID`  | Block suspicious transaction          |
| `/report 0x...` | Report scam address to DAO            |
| `/help`         | List all commands                     |

### Wallet Linking

Users link their Telegram to their wallet via `/link`. All security alerts for that wallet are then pushed in real-time to their Telegram chat.

---

## 15. Backend API Reference

### Public (No Auth)

| Method | Endpoint                         | Purpose                                |
| ------ | -------------------------------- | -------------------------------------- |
| `GET`  | `/health`                        | Service health check                   |
| `POST` | `/api/auth/civic/initiate`       | Start Civic identity verification      |
| `POST` | `/api/auth/civic/verify`         | Verify Civic gatepass token            |
| `GET`  | `/api/auth/civic/status`         | Check verification status              |
| `POST` | `/api/auth/verify`               | Verify wallet signature                |
| `GET`  | `/api/auth/nonce`                | Get signature nonce for signing        |
| `POST` | `/api/firewall/tx`               | **ML fraud analysis** on a transaction |
| `GET`  | `/api/firewall/stats`            | Firewall statistics                    |
| `GET`  | `/api/dao/proposals`             | List all DAO proposals                 |
| `GET`  | `/api/dao/scamscore/:address`    | Get community scam score               |
| `GET`  | `/api/dao/address/:address`      | Get DAO address status                 |
| `GET`  | `/api/analytics/wallet/:address` | Wallet analytics                       |
| `GET`  | `/api/analytics/risk/:address`   | Wallet risk score                      |
| `POST` | `/api/analytics/bulk`            | Bulk wallet analysis                   |
| `POST` | `/api/analytics/export`          | Export ML training dataset             |

### Web3 Authenticated (Wallet Signature Required)

| Method | Endpoint                       | Purpose                 |
| ------ | ------------------------------ | ----------------------- |
| `POST` | `/api/report`                  | Submit scam report      |
| `GET`  | `/api/reports`                 | Get user's reports      |
| `POST` | `/api/dao/vote`                | Cast DAO vote           |
| `POST` | `/api/dao/proposals`           | Create DAO proposal     |
| `POST` | `/api/recovery/initiate`       | Start social recovery   |
| `GET`  | `/api/recovery/status/:txHash` | Check recovery status   |
| `GET`  | `/api/transactions`            | Get transaction history |
| `GET`  | `/api/profile`                 | Get wallet profile      |

### Dual-Auth (Web3 + Civic Required)

| Method | Endpoint                             | Purpose                     |
| ------ | ------------------------------------ | --------------------------- |
| `POST` | `/api/secure/transaction/high-value` | Analyze high-value tx       |
| `POST` | `/api/secure/report/critical`        | Submit critical scam report |
| `POST` | `/api/secure/recovery/initiate`      | Initiate wallet recovery    |

### Admin (JWT)

| Method | Endpoint                        | Purpose          |
| ------ | ------------------------------- | ---------------- |
| `GET`  | `/api/admin/reports`            | View all reports |
| `PUT`  | `/api/admin/reports/:id/verify` | Verify a report  |
| `GET`  | `/api/admin/stats`              | Admin statistics |

---

## 16. Frontend Architecture

### Pages

| Page             | Route        | Purpose                                         |
| ---------------- | ------------ | ----------------------------------------------- |
| Home             | `/`          | Dashboard with threat overview                  |
| Send             | `/send`      | Transaction sending with real-time interception |
| DAO Voting       | `/dao`       | Governance — view/create proposals, cast votes  |
| Civic Auth       | `/civic`     | Identity verification                           |
| Wallet Analytics | `/analytics` | Deep wallet analysis                            |
| Threat Reports   | `/threats`   | Community scam reports                          |
| Transaction Logs | `/logs`      | Detailed transaction history                    |
| Social Recovery  | `/recovery`  | Guardian management + recovery                  |
| Settings         | `/settings`  | User preferences                                |

### Key Components

| Component                         | What It Does                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `TransactionInterceptor`          | **Real-time TX interception** — runs dual-layer analysis before every transaction |
| `DAOPanel` + `QuadraticVoteInput` | Full DAO governance UI with quadratic vote slider                                 |
| `GuardianManager`                 | Add/remove recovery guardians                                                     |
| `ThreatMonitor`                   | Live threat feed                                                                  |
| `SecurityScore`                   | Visual security score gauge                                                       |
| `MEVProtectionTester`             | Test MEV protection features                                                      |
| `MonadNetworkSwitcher`            | One-click Monad network switch                                                    |
| `TelegramCompanion`               | Link Telegram for real-time alerts                                                |
| `AILearningFeedback`              | Report ML false positives/negatives back to model                                 |

---

## 17. Smart Contract Registry

| Contract             | Address                                      | Purpose                    |
| -------------------- | -------------------------------------------- | -------------------------- |
| QuadraticVoting      | `0x7A791FE5A35131B7D98F854A64e7F94180F27C7B` | DAO governance             |
| SocialRecoveryWallet | `0xcdc4284A037f8b7C5a6c03b3f190A1B83d0258e2` | Guardian-based recovery    |
| ShieldToken          | _pending deployment_                         | ERC-20 governance token    |
| CivicVerifier        | _pending deployment_                         | Identity → SBT bridge      |
| CivicSBT             | _pending deployment_                         | Soulbound reputation token |
| CivicGatedWallet     | _pending deployment_                         | Identity-gated transfers   |

**Network:** Monad Testnet (Chain ID 10143)
**RPC:** `https://testnet-rpc.monad.xyz`
**WSS:** `wss://testnet-rpc.monad.xyz`
**Explorer:** `https://testnet.monadexplorer.com`

---

## 18. Tech Stack Summary

| Layer                | Technology                                               |
| -------------------- | -------------------------------------------------------- |
| **Blockchain**       | Monad Testnet (EVM-compatible, 1-2s blocks)              |
| **Smart Contracts**  | Solidity ^0.8.20, OpenZeppelin, Hardhat v3               |
| **Frontend**         | React 18, TypeScript, Vite, Tailwind CSS, ethers.js v6   |
| **Backend**          | Go 1.24, Gin framework, GORM ORM                         |
| **Database**         | PostgreSQL (Neon serverless)                             |
| **ML Model**         | Python, deployed on Render (18-feature fraud classifier) |
| **Identity**         | Civic Pass integration, Soulbound Tokens                 |
| **MEV Protection**   | Flashbots relay, private mempool routing                 |
| **Messaging**        | Telegram Bot API for real-time alerts                    |
| **State Management** | Zustand stores                                           |
| **Deployment**       | Render (backend), Vercel (frontend)                      |

---

## What Makes This Mind-Boggling

1. **The Flywheel** — ML + DAO + Event Listener = a system that literally improves itself. Every community vote makes the AI smarter.

2. **Quadratic Voting** — Not 1-person-1-vote, not plutocracy. The mathematically optimal balance where small voices matter but commitment is rewarded.

3. **Soulbound Reputation** — Your on-chain identity can't be bought, sold, or faked. It's permanently bound to your wallet.

4. **3-Layer Transaction Defense** — Every transaction passes through: ML instant scoring → DAO community verdict → Civic identity trust discount. Three independent signals fused into one risk score.

5. **MEV Protection** — Flashbots private mempool routing means bots literally cannot see your transaction to front-run it.

6. **Social Recovery** — Lost your keys? Your guardians can save your wallet. No centralized custody. No seed phrase nightmare.

7. **Civic-Gated Transfers** — Even if your key is stolen, the attacker can't drain large amounts without passing biometric identity verification.

8. **Dual-Layer API Security** — High-value operations require both wallet signature AND Civic identity verification. Two independent auth factors, one on-chain and one off-chain.

9. **Real-Time Telegram Alerts** — Not an email you'll read tomorrow. Instant Telegram push notification the moment something suspicious happens.

10. **Fully On-Chain Token URIs** — SBT metadata is Base64-encoded JSON stored directly on-chain. Works even if every server in the world goes offline.

---

_Built for Diversion — on Monad testnet._
