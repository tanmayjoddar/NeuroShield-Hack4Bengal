# NeuroShield — Feature Documentation for New Team Members

> **Who is this for?** You are new to the team and possibly new to Web3. This document explains every major feature of NeuroShield in plain language — **no code**, just concepts, flows, and file references so you know exactly where to look.

---

## Table of Contents

1. [Quick Web3 Crash Course (Read This First)](#1-quick-web3-crash-course)
2. [Feature 1 — Pre-Transaction ML Firewall](#2-feature-1--pre-transaction-ml-firewall)
3. [Feature 2 — Quadratic Voting Scam DAO](#3-feature-2--quadratic-voting-scam-dao)
4. [Feature 3 — ML + DAO Flywheel](#4-feature-3--ml--dao-flywheel)
5. [Feature 4 — Biometric Face Verification (Planned)](#5-feature-4--biometric-face-verification)

---

## 1. Quick Web3 Crash Course

Before diving into features, here are the Web3 terms you'll see everywhere:

| Term                 | What It Means                                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wallet**           | Like a bank account, but on the blockchain. Identified by an address like `0xAbC123...`. Users connect their wallet (e.g. MetaMask) to our app.                                                                        |
| **Transaction (tx)** | Sending crypto from one wallet to another. Every tx has a sender (`from`), receiver (`to`), amount (`value`), and a fee (`gas`).                                                                                       |
| **Smart Contract**   | A program that lives on the blockchain. Once deployed, nobody can change it. It runs automatically when someone calls its functions. Think of it as a vending machine — put the right input in, get guaranteed output. |
| **Gas**              | The fee you pay to the network to process your transaction. Higher gas = faster processing.                                                                                                                            |
| **DAO**              | "Decentralized Autonomous Organization" — a group of people who vote on decisions using the blockchain. No single person controls it.                                                                                  |
| **ERC-20 Token**     | A standard type of cryptocurrency token. Our SHIELD token is an ERC-20 used for voting.                                                                                                                                |
| **On-chain**         | Data stored on the blockchain. Permanent, public, tamper-proof.                                                                                                                                                        |
| **Off-chain**        | Data stored on regular servers (our Go backend, the ML API). Faster, cheaper, but not as trustless.                                                                                                                    |
| **Monad Testnet**    | The blockchain network we deploy to. It's a test version (fake money) so we can experiment safely. Chain ID: `10143`.                                                                                                  |

---

## 2. Feature 1 — Pre-Transaction ML Firewall

### The Problem

Imagine you're about to send 5 ETH to someone. How do you know that address isn't a scammer? By the time you realize you were scammed, the money is gone — blockchain transactions are **irreversible**.

### The Solution

NeuroShield puts an **invisible security guard** between you and the blockchain. **Before** your transaction goes through, we secretly analyze it with a Machine Learning model. If the model says "this looks like fraud", we warn you or block the transaction entirely.

Think of it like your credit card company calling you to confirm a suspicious purchase — except it happens in milliseconds, automatically.

### How It Works (Step by Step)

```
  ┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────┐
  │  User     │────▶│  Our Backend │────▶│  External ML │────▶│  Decision  │
  │  clicks   │     │  (Go server) │     │  API (Render)│     │            │
  │  "Send"   │     │              │     │              │     │  safe /    │
  │           │◀────│  collects    │◀────│  returns     │     │  suspicious│
  │  sees     │     │  18 wallet   │     │  "Fraud" or  │     │  / blocked │
  │  result   │     │  features    │     │  "Safe"      │     │            │
  └──────────┘     └──────────────┘     └──────────────┘     └────────────┘
```

**Step 1 — User clicks Send:**
The frontend collects the transaction details (who you're sending to, how much, gas price).

**Step 2 — Gather wallet features:**
Before calling the ML model, we need to describe the sender's wallet in numbers. We collect **18 data points** (called "features") about the wallet:

- How old is this wallet?
- How many transactions has it sent/received?
- What's the average value of its transactions?
- Does it interact with ERC-20 tokens?
- How much ETH does it hold?
- What's the time gap between transactions?

These 18 numbers are like a "fingerprint" of the wallet's behavior.

**Step 3 — Ask the ML Model:**
We send these 18 numbers to an **external ML API** hosted on Render (`ml-fraud-transaction-detection.onrender.com/predict`). We do NOT own the ML code — it's a deployed model trained on a dataset of known fraud/legit wallets. It returns one of three answers:

- **"Fraud"** → risk score = 0.85
- **"Suspicious"** → risk score = 0.50
- **"Safe"** → risk score = 0.10

**Step 4 — Make a decision:**
Based on the risk score:

- **> 0.7** → Transaction is **BLOCKED**. User sees a red warning.
- **0.3 – 0.7** → Transaction is **SUSPICIOUS**. User sees a yellow warning but can proceed.
- **< 0.3** → Transaction is **SAFE**. Green light.

**Step 5 — Log everything:**
Every analyzed transaction (safe or not) is saved to our database. This creates an audit trail and feeds the dashboard statistics.

### The Two Paths: Regular vs High-Value

Regular transactions go through the standard flow above. But if a transaction is **high-value** (large amount of ETH), it gets **enhanced analysis**:

- Stricter thresholds (blocked at 0.5 instead of 0.7)
- Additional checks: does the recipient have scam history? Is the transaction pattern unusual?
- Admin gets a **Telegram notification** instantly for any blocked high-value transaction

### The Frontend Side

There's also a **dual-layer check** that runs entirely in the browser:

1. The frontend builds its own 18-feature array using data from your MetaMask wallet (balance, transaction count)
2. It calls the same ML API directly
3. It ALSO checks the DAO scam database (more on that in Feature 2)
4. It combines both results with 6 priority rules to give a final risk score

This means even if our backend is down, the frontend can still protect you.

### API Endpoints

| What Happens                                                              | Method | Route                                                         |
| ------------------------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| Analyze a regular transaction                                             | POST   | `/api/firewall/tx`                                            |
| Get overall stats (safe/suspicious/blocked counts)                        | GET    | `/api/firewall/stats`                                         |
| Analyze a high-value transaction (requires Civic auth + wallet signature) | POST   | `/api/secure/transaction/high-value`                          |
| Get your transaction history (requires wallet signature)                  | GET    | `/api/transactions`                                           |
| External ML prediction                                                    | POST   | `https://ml-fraud-transaction-detection.onrender.com/predict` |

### Files to Look At

| File                                                                 | What It Does                                                                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/services/ai.go`                                             | **The brain.** Builds the 18-feature array, calls the external ML API, interprets the response, and adds the DAO flywheel boost. Start here. |
| `backend/services/wallet_analytics.go`                               | Collects the 18 wallet metrics (transaction counts, timing gaps, token data, etc.) from the database and blockchain RPC.                     |
| `backend/handlers/firewall.go`                                       | The HTTP handler. Receives the transaction from the frontend, calls `ai.go`, decides safe/suspicious/blocked, saves to DB, returns response. |
| `backend/models/config.go`                                           | Defines the `Transaction` data model (from address, to address, value, risk score, status, etc.).                                            |
| `backend/routes/routes.go`                                           | Registers all the `/api/firewall/*` endpoints and wires up the handlers.                                                                     |
| `src/web3/civic/dualVerification.ts`                                 | The frontend's own ML check. Builds features from MetaMask, calls the ML API directly, combines with DAO data.                               |
| `src/web3/contract.ts`                                               | Frontend service that talks to the QuadraticVoting smart contract (reads `isScamAddress`, `getScamScore`).                                   |
| `src/pages/Send.tsx`                                                 | The Send page UI. Triggers the firewall check when user clicks Send. Shows warnings/blocks.                                                  |
| `api/predict.py`, `predict_v2.py`, `predict_v3.py`, `predict_new.py` | Python proxy files for Vercel serverless functions — alternative ways to route to the ML API.                                                |

---

## 3. Feature 2 — Quadratic Voting Scam DAO

### The Problem

The ML model is fast but not perfect. It might miss new types of scams or false-flag innocent addresses. We need **human intelligence** to complement the AI — but how do you let thousands of people vote fairly without one rich person controlling everything?

### The Solution

NeuroShield has a **DAO (Decentralized Autonomous Organization)** where any community member can:

1. **Report** a suspicious wallet address
2. **Vote** on whether that address is really a scam
3. Once enough votes confirm it → the address is permanently marked as a scam **on the blockchain**

The voting uses a special system called **Quadratic Voting** to ensure fairness.

### What Is Quadratic Voting? (The Key Innovation)

In normal voting, if you have 100 tokens, you get 100 votes. A whale (someone with lots of tokens) can dominate.

In **quadratic voting**, your vote power equals the **square root** of the tokens you stake:

| Tokens Staked | Vote Power |  Cost Per Vote  |
| :-----------: | :--------: | :-------------: |
|       1       |     1      |  1 token/vote   |
|       4       |     2      |  2 tokens/vote  |
|       9       |     3      |  3 tokens/vote  |
|      100      |     10     | 10 tokens/vote  |
|    10,000     |    100     | 100 tokens/vote |

Notice: each additional unit of vote power costs **more** tokens. This means:

- A regular person with 9 tokens gets 3 votes
- A whale with 10,000 tokens gets only 100 votes (not 10,000!)
- The cost of influencing the outcome goes up dramatically
- **Many small voices > one rich voice**

This makes the DAO fair and resistant to manipulation.

### The Full DAO Flow

```
  ┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────────┐
  │  Someone │────▶│  Submit      │────▶│  Community   │────▶│  Auto-execute  │
  │  spots a │     │  Proposal    │     │  Votes       │     │  if 60% agree  │
  │  scammer │     │  (on-chain)  │     │  (7 days)    │     │  → mark scam   │
  └──────────┘     └──────────────┘     └──────────────┘     └────────────────┘
```

**Step 1 — Report:**
Anyone can submit a "proposal" saying "I think address 0xABC is a scammer." They provide a description and evidence (screenshot link, IPFS hash, etc.). This creates a proposal on the blockchain.

**Step 2 — Voting Period (7 days):**
Community members review the evidence and vote:

- **"For"** = "Yes, this is a scam"
- **"Against"** = "No, this is legit"

To vote, you must **stake SHIELD tokens**. Your tokens are locked until voting ends (prevents vote manipulation). You get them back regardless of outcome.

**Step 3 — Execution:**
After 7 days, anyone can trigger `executeProposal`:

- If **≥60% of vote power** says "For" → the address is marked as a scammer **on-chain**
- If **>40% of vote power** says "Against" → the address is cleared
- The `isScammer` mapping is updated permanently on the blockchain
- A `scamScore` is assigned (increases by 25 per confirmed report, caps at 100)

**Step 4 — Voter Reputation:**
After execution, every voter's **accuracy score** is updated:

- Voted with the majority? → accuracy goes up (+5, max 100)
- Voted against the majority? → accuracy goes down (-10)
- Voters with >80% accuracy AND 5+ votes get a **20% vote power bonus** on future proposals

This creates a meritocratic system: good voters become more influential over time.

### Backend Mirror

The smart contract handles on-chain voting, but we also mirror everything in our PostgreSQL database via the Go backend. This is because:

- Reading from the blockchain is slow and costs gas
- Our backend can serve the same data instantly via REST APIs
- The backend auto-executes: when enough votes come in, it writes to a `ConfirmedScam` table automatically

### API Endpoints

| What Happens                                         | Method | Route                         |
| ---------------------------------------------------- | ------ | ----------------------------- |
| Get all proposals (optional `?status=active` filter) | GET    | `/api/dao/proposals`          |
| Get DAO scam score for an address                    | GET    | `/api/dao/scamscore/:address` |
| Check if address is DAO-confirmed scam               | GET    | `/api/dao/address/:address`   |
| Cast a vote (requires wallet signature)              | POST   | `/api/dao/vote`               |
| Create a new proposal (requires wallet signature)    | POST   | `/api/dao/proposals`          |

### Smart Contract Functions

| Function                                         | What It Does                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `submitProposal(address, description, evidence)` | Creates a new scam report proposal. Anyone can call.                                      |
| `castVote(proposalId, support, tokens)`          | Stake tokens and vote. Power = √tokens. Gets reputation bonus if eligible.                |
| `executeProposal(proposalId)`                    | Finalizes voting. Marks scammer if passed. Updates voter accuracy. Returns staked tokens. |
| `getProposal(proposalId)`                        | Read proposal details (reporter, votes for/against, is active).                           |
| `getVote(proposalId, voter)`                     | Check how a specific person voted.                                                        |
| `getVoterStats(voter)`                           | Get someone's accuracy score and participation count.                                     |
| `proposalCount()`                                | Total number of proposals ever created.                                                   |
| `isScammer(address)`                             | Returns true/false — is this a confirmed scam address?                                    |
| `scamScore(address)`                             | Returns 0–100 — how "scammy" is this address based on confirmed reports?                  |
| `setVotingPeriod(newPeriod)`                     | Admin only. Change the voting duration (min 1 hour, max 30 days).                         |

### Files to Look At

| File                                    | What It Does                                                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hardhat/contracts/QuadraticVoting.sol` | **The smart contract itself.** All on-chain logic: proposals, quadratic voting, execution, reputation. This is the most important file for this feature.                      |
| `backend/handlers/dao.go`               | HTTP handlers for all DAO endpoints. Handles vote validation, duplicate prevention, auto-execution, and the ConfirmedScam table write.                                        |
| `backend/models/dao.go`                 | Database models: `DAOProposal`, `DAOVote`, `ConfirmedScam`. Defines the shape of data in PostgreSQL.                                                                          |
| `backend/routes/routes.go`              | Registers all `/api/dao/*` endpoints.                                                                                                                                         |
| `src/web3/contract.ts`                  | Frontend service that calls the smart contract. Contains the ABI (the "interface" definition), and methods like `castQuadraticVote()`, `getScamReports()`, `isScamAddress()`. |
| `src/components/DAOPanel.tsx`           | The DAO voting UI component. Shows proposals, vote buttons, stats. Uses `contract.ts` to talk to the blockchain.                                                              |
| `src/pages/DAOVoting.tsx`               | The full DAO page that wraps `DAOPanel.tsx`.                                                                                                                                  |

---

## 4. Feature 3 — ML + DAO Flywheel

### The Problem

ML models have a weakness: they only know what they were trained on. New scam patterns will fool the model. Meanwhile, the DAO has a weakness too: community voting takes days. Neither system alone is enough.

### The Solution — A Self-Improving Loop

The **Flywheel** connects the ML model and the DAO into a loop where each one makes the other better over time:

```
         ┌─────────────────────────────────────────┐
         │                                         │
         ▼                                         │
  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐
  │  ML Firewall │───▶│  Flags tx as │───▶│  DAO reviews  │
  │  analyzes tx │    │  suspicious  │    │  & votes      │
  └──────────────┘    └──────────────┘    └───────┬───────┘
         ▲                                        │
         │                                        ▼
  ┌──────────────┐                       ┌───────────────┐
  │  ML queries  │◀──────────────────────│  Confirmed    │
  │  DAO data    │                       │  Scam written │
  │  for boost   │                       │  to database  │
  └──────────────┘                       └───────────────┘
```

Here's the cycle in plain English:

1. **ML flags a suspicious transaction** → User gets an instant warning
2. **If the ML is unsure**, the address is **flagged for DAO review** (the `shouldFlagForDAO` field)
3. **Community members vote** on whether the flagged address is a real scam
4. **If the DAO confirms it's a scam** → the address is written to the `ConfirmedScam` database table AND marked on-chain
5. **Next time the ML analyzes a transaction** to that address, it queries the `ConfirmedScam` table and **boosts** the risk score
6. The ML is now smarter → it flags more accurately → better data for the DAO → even better ML → **the system gets stronger with every cycle**

### The DAO Boost Mechanism

When the ML analyzes a transaction, it doesn't just use the ML prediction. It also asks: "Has the DAO community said anything about this address?"

There are three scenarios:

| DAO Status                                | Risk Boost Added                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **DAO-confirmed scam**                    | +0.5 × (scamScore/100). If the community is 100% confident, this adds +0.50 to the risk. That's huge — it can turn a "safe" ML verdict into "blocked". |
| **Under review** (active proposals exist) | +0.15. Not confirmed yet, but someone reported it, so we're cautious.                                                                                  |
| **Unknown** (no DAO data)                 | +0.00. ML stands alone.                                                                                                                                |

So if the ML says risk = 0.10 (safe) but the DAO has confirmed this address as a scam with score 80, the final risk becomes: `0.10 + (80/100 × 0.50) = 0.10 + 0.40 = 0.50` — now it's "suspicious" instead of "safe". The community override works.

### The Frontend Dual-Layer Rules

The frontend has its own combination logic with **6 priority rules**:

| #   | Condition                           | Result                                                      |
| --- | ----------------------------------- | ----------------------------------------------------------- |
| 1   | DAO says "confirmed scam"           | Risk = 95. **Always wins.** Community overrides everything. |
| 2   | Both ML (>60) AND DAO (>30) flag it | Average + 15 bonus. Very high confidence.                   |
| 3   | ML flags it but DAO hasn't reviewed | Use ML score. Flag for DAO review.                          |
| 4   | DAO has reports but ML says safe    | Risk = at least 40. Community concern trumps ML optimism.   |
| 5   | Both ML AND DAO say it's safe       | Use ML score. Extra confidence boost.                       |
| 6   | Everything else                     | Weighted average: 60% ML + 40% DAO.                         |

**Bonus:** If you have Civic identity verification, you get up to 10 points off your risk score. Verified humans are slightly more trusted.

### Voter Reputation → Better Curation → Better ML

The flywheel extends to voter quality too:

- Voters who consistently vote with the majority earn higher **accuracy scores**
- High-accuracy voters get a **20% vote power bonus** on future proposals
- This means experienced, accurate curators have more influence
- Their votes produce higher-quality confirmed scam data
- Higher-quality data → ML gets better signals → better warnings → the cycle continues

### API Endpoints (The Flywheel Cycle)

| Step                       | Method | Route                         | Role                                                         |
| -------------------------- | ------ | ----------------------------- | ------------------------------------------------------------ |
| ML checks DAO data         | POST   | `/api/firewall/tx`            | `getDAOScamBoost()` reads `ConfirmedScam` table              |
| Vote triggers auto-confirm | POST   | `/api/dao/vote`               | On quorum (≥3 votes, ≥60% agree) → writes to `ConfirmedScam` |
| Query DAO confidence       | GET    | `/api/dao/scamscore/:address` | Returns community scam score                                 |
| Check blacklist            | GET    | `/api/dao/address/:address`   | Simple yes/no: is this address DAO-confirmed?                |
| ML base prediction         | POST   | External `/predict`           | Returns "Fraud"/"Suspicious"/"Safe"; boosted by DAO data     |

### Files to Look At

| File                                    | What It Does                                                                                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/services/ai.go`                | **The flywheel hub.** `AnalyzeTransaction()` calls ML, then `getDAOScamBoost()` queries the ConfirmedScam table and adds the community risk boost. `IsAddressBlacklisted()` checks both ConfirmedScam and Reports tables. |
| `backend/handlers/dao.go`               | The auto-execution logic. Inside `CastVote()`, after recording a vote, it checks if quorum is met. If yes → writes a `ConfirmedScam` record. This is the DAO → ML direction of the flywheel.                              |
| `backend/models/dao.go`                 | The `ConfirmedScam` model: address, scam score, proposal ID, confirmation time, total voters, description.                                                                                                                |
| `backend/services/wallet_analytics.go`  | `GetAddressScamHistory()` checks if a destination address has prior scam reports. Used by enhanced analysis.                                                                                                              |
| `backend/db_init.go`                    | Auto-migrates the `ConfirmedScam` table on startup so the database schema is always up to date.                                                                                                                           |
| `hardhat/contracts/QuadraticVoting.sol` | `_updateVoterAccuracy()` rewards good voters. `executeProposal()` marks `isScammer[address] = true` on-chain. These feed the on-chain half of the flywheel.                                                               |
| `src/web3/civic/dualVerification.ts`    | Frontend flywheel. Reads on-chain `isScamAddress()` and `getScamScore()` and combines with ML results using the 6 priority rules. Sets `shouldFlagForDAO` when ML flags something the DAO hasn't reviewed.                |

---

## 5. Feature 4 — Biometric Face Verification

> **Status: Planned / Idea Stage.** This feature is NOT built yet. Here is the concept for the team member who will implement it.

### The Problem

Wallet addresses are anonymous. Anyone can create hundreds of wallets. This means:

- A scammer can create new wallets faster than the DAO can flag them
- A scammer can create multiple wallets to vote on their own proposals (Sybil attack)
- There's no way to know if the person behind a wallet is who they claim to be

### The Idea — "One Face, One Wallet"

We add a **biometric face verification layer** so that each real human can only be linked to one verified wallet. Think of it like airport face scan — you prove you're a real, unique person, and you get a special badge (a Soulbound Token) on the blockchain.

### How It Would Work

```
  ┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────┐
  │  User     │────▶│  Camera      │────▶│  Face Match  │────▶│  Soulbound │
  │  opens    │     │  captures    │     │  Service     │     │  Token     │
  │  app      │     │  live photo  │     │  (anti-spoof)│     │  minted    │
  └──────────┘     └──────────────┘     └──────────────┘     └────────────┘
```

**Step 1 — Liveness Check:**
The user opens their camera. The system asks them to perform random actions (blink, turn head, smile) to prove they're a real person in front of the camera, not a photo or deepfake.

**Step 2 — Face Template:**
The face is converted into a **mathematical template** (a string of numbers), NOT stored as an image. This protects privacy — you can't recreate a face from the template, but you can compare two templates to check if they're the same person.

**Step 3 — Uniqueness Check:**
The template is compared against all existing verified templates. If there's a match → this person already verified with another wallet → **rejected** (one face = one wallet).

**Step 4 — Soulbound Token (SBT):**
If the person is unique, a **Soulbound Token** is minted to their wallet address. This is a special NFT that:

- **Cannot be transferred** (it's "soulbound" — stuck to your wallet forever)
- Proves you're a verified unique human
- Is publicly readable on-chain by any smart contract

**Step 5 — Integration with existing features:**
Once you have a Soulbound Token:

- **DAO Voting:** Only SBT holders can vote → eliminates Sybil attacks (one person, one vote)
- **ML Firewall:** SBT holders get a trust boost (lower risk scores)
- **Higher limits:** Verified users could send larger transactions without extra friction

### Privacy Considerations

- Face images are NEVER stored — only mathematical templates
- Templates should be stored encrypted, ideally in a zero-knowledge proof system
- The blockchain only stores "this wallet is verified" (boolean), not biometric data
- Users can revoke their verification at any time

### Why This Matters for the Project

| Without Face Verification                    | With Face Verification                 |
| -------------------------------------------- | -------------------------------------- |
| Scammer creates 100 wallets, votes 100 times | Scammer has 1 face = 1 vote, period    |
| Anyone can claim to be "verified"            | Verified status is cryptographic proof |
| ML has to treat all wallets equally          | ML can trust verified wallets more     |
| DAO can be gamed by sockpuppets              | DAO votes are guaranteed human         |

### Existing Foundation to Build On

We already have **Civic Auth integration** and a **CivicSBT (Soulbound Token) contract** deployed. The face verification would plug into this existing system:

| File                                           | What Already Exists                                                                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/web3/civic/auth.ts`                       | Civic identity verification, trust score calculation, on-chain reads from CivicVerifier contract. The biometric layer would extend `verifyCivicIdentity()`. |
| `hardhat/contracts/civic/CivicSBT.sol`         | Soulbound Token contract. Already prevents transfers. Would need a new `mintWithBiometric()` function gated by the face verification oracle.                |
| `hardhat/contracts/civic/CivicVerifier.sol`    | On-chain verification status. Would add a `biometricVerified` field alongside existing verification levels.                                                 |
| `hardhat/contracts/civic/CivicGatedWallet.sol` | Wallet operations gated by Civic verification. Would add biometric checks for high-value operations.                                                        |
| `backend/handlers/civic_auth.go`               | Backend Civic auth endpoints. Would add `/api/auth/biometric/initiate` and `/api/auth/biometric/verify` routes.                                             |
| `backend/services/civic_service.go`            | Civic auth service. Would integrate with a face matching provider (AWS Rekognition, FaceTec, or open-source alternatives).                                  |

### Suggested Implementation Approach

1. **Pick a face verification provider** — FaceTec (liveness + matching) or Civic's own biometric pass
2. **Add a `/api/auth/biometric/initiate` endpoint** — returns a session token and challenge (random pose to perform)
3. **Frontend captures face + liveness** — sends to provider API, gets back a template hash
4. **Backend verifies uniqueness** — compares template against existing ones
5. **Mint SBT on success** — call `CivicSBT.mint(walletAddress)` via backend signer
6. **Gate DAO voting** — modify `castVote()` in `QuadraticVoting.sol` to require `civicSBT.balanceOf(msg.sender) > 0`

---

## Quick Reference — Full File Map

### Backend (Go)

| File                                   | Features              |
| -------------------------------------- | --------------------- |
| `backend/services/ai.go`               | ML Firewall, Flywheel |
| `backend/services/wallet_analytics.go` | ML Firewall, Flywheel |
| `backend/handlers/firewall.go`         | ML Firewall           |
| `backend/handlers/dao.go`              | DAO, Flywheel         |
| `backend/models/dao.go`                | DAO, Flywheel         |
| `backend/models/config.go`             | ML Firewall           |
| `backend/routes/routes.go`             | All features          |
| `backend/db_init.go`                   | Flywheel              |

### Smart Contracts (Solidity)

| File                                           | Features           |
| ---------------------------------------------- | ------------------ |
| `hardhat/contracts/QuadraticVoting.sol`        | DAO, Flywheel      |
| `hardhat/contracts/civic/CivicSBT.sol`         | Biometric (future) |
| `hardhat/contracts/civic/CivicVerifier.sol`    | Biometric (future) |
| `hardhat/contracts/civic/CivicGatedWallet.sol` | Biometric (future) |

### Frontend (React + TypeScript)

| File                                 | Features              |
| ------------------------------------ | --------------------- |
| `src/web3/civic/dualVerification.ts` | ML Firewall, Flywheel |
| `src/web3/civic/auth.ts`             | Biometric (future)    |
| `src/web3/contract.ts`               | DAO, Flywheel         |
| `src/components/DAOPanel.tsx`        | DAO                   |
| `src/pages/DAOVoting.tsx`            | DAO                   |
| `src/pages/Send.tsx`                 | ML Firewall           |

### ML API Proxies (Python)

| File                 | Features    |
| -------------------- | ----------- |
| `api/predict.py`     | ML Firewall |
| `api/predict_v2.py`  | ML Firewall |
| `api/predict_v3.py`  | ML Firewall |
| `api/predict_new.py` | ML Firewall |

---

> **Next steps for new member:** Start by reading `backend/services/ai.go` and `src/web3/civic/dualVerification.ts` — these two files are the heart of the system. Then explore the smart contract `hardhat/contracts/QuadraticVoting.sol` to understand the on-chain side. Everything else connects to these three.
