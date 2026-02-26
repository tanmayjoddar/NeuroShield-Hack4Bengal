# NeuroShield — Complete Web3 Documentation

> **Written in plain English.** Think of this as "explaining the entire blockchain side of NeuroShield to someone who has never touched Web3 before, while still being technically complete."

---

## Table of Contents

1. [The Big Picture — What Does NeuroShield Do on the Blockchain?](#1-the-big-picture)
2. [Which Blockchain Does It Run On? (Monad Explained)](#2-monad-explained)
3. [All the Smart Contracts — What Each One Does](#3-smart-contracts)
4. [How Monad Is Connected & Working](#4-how-monad-is-connected)
5. [How This Could Be Transferred to Ethereum (or Any EVM Chain)](#5-transferring-to-ethereum)
6. [Cross-Platform Compatibility — Where Else Can This Run?](#6-cross-platform-compatibility)
7. [The Dual-Layer Defense System (ML + DAO)](#7-dual-layer-defense)
8. [MEV Protection & Flashbots](#8-mev-protection)
9. [Civic Identity Integration](#9-civic-identity)
10. [All Addresses — Which Are REAL and Which Are MOCK/Placeholder](#10-address-audit)
11. [Frontend ↔ Blockchain Communication Flow](#11-frontend-blockchain-flow)
12. [Backend ↔ Blockchain Communication Flow](#12-backend-blockchain-flow)
13. [Deployment Pipeline — How Contracts Get Deployed](#13-deployment-pipeline)
14. [Known Limitations & Incomplete Parts](#14-known-limitations)
15. [File Map — Where Everything Lives](#15-file-map)

---

## 1. The Big Picture

NeuroShield is a **scam-detection and wallet-protection platform**. It has two brains:

- **Brain 1 (Instant — AI/ML):** A machine learning model that instantly analyzes a transaction BEFORE you send it and tells you "this looks safe" or "this looks like a scam."
- **Brain 2 (Long-term — Community/DAO):** A community voting system where real people vote on whether a reported address is a scam or not. Their votes are on-chain (on the blockchain), permanent, and transparent.

**Why does it need a blockchain at all?**

Because the scam database, votes, and recovery mechanisms must be:
- **Tamper-proof** — nobody can delete a report once it's submitted
- **Transparent** — anyone can verify who reported what and how votes went
- **Decentralized** — no single company controls the scam database
- **Programmable** — smart contracts automatically enforce rules (like "you need 2 out of 3 guardians to recover your wallet")

---

## 2. Monad Explained

### What Is Monad?

Monad is a **Layer-1 blockchain** — meaning it is its own independent blockchain, just like Ethereum is. But Monad is designed to be much faster.

| Feature | Ethereum Mainnet | Monad Testnet (used here) |
|---------|-----------------|---------------------------|
| Transactions per second | ~15-30 | Up to 10,000 |
| Block time | ~12-15 seconds | ~1-2 seconds |
| Gas fees | Expensive ($1-$100+) | Very cheap (fractions of a cent) |
| EVM Compatible? | It IS the EVM | Yes, 100% compatible |
| Native currency | ETH | MON (testnet tokens, free) |
| Chain ID | 1 (mainnet) | **10143** (testnet) |

### Why Monad Instead of Ethereum?

- **Speed:** Scam detection needs to be FAST. Waiting 15 seconds for a block confirmation is too slow when someone is about to lose their money.
- **Cost:** Reporting scams, voting, and recovering wallets all cost gas. On Ethereum mainnet, each transaction might cost $5-$50. On Monad, it's essentially free.
- **Same code works on both.** Because Monad is EVM-compatible, every Solidity smart contract written for Ethereum runs on Monad with ZERO changes.

### How Is Monad Connected in This Project?

The project talks to Monad through these touch-points:

1. **Hardhat Configuration** (`hardhat/hardhat.config.ts`):
   - Default network is set to `monad_testnet`
   - RPC URL: `https://testnet-rpc.monad.xyz`
   - Chain ID: `10143`
   - Gas price: 1 gwei (1,000,000,000 wei)

2. **Frontend Wallet Connection** (`src/web3/wallet.ts`):
   - When a user connects MetaMask, the app **automatically tries to switch them to Monad testnet**
   - If Monad isn't in their MetaMask yet, it **automatically adds it** using `wallet_addEthereumChain`
   - Monad network details sent to MetaMask:
     - Chain ID: `0x2797` (10143 in hex)
     - Name: "Monad Testnet"
     - Currency: MON (18 decimals)
     - RPC: `https://testnet-rpc.monad.xyz`
     - Explorer: `https://testnet.monadexplorer.com`

3. **Network Utilities** (`src/web3/utils.ts`):
   - Has a `NETWORK_INFO` object with Monad listed as the **recommended** network
   - `isMonadNetwork()` function checks if user is on chain 10143 (decimal) or 0x2797 (hex)
   - Monad gets **faster polling** (500ms vs 3000ms) and **fewer confirmation blocks** (1 vs 3)

4. **Contract Service** (`src/web3/contract.ts`):
   - Contract addresses are mapped by chain ID
   - Chain `10143` and `2023` both point to the same Monad contract address
   - When reporting scams, the code checks `chainId !== 10143 && chainId !== 2023` and rejects non-Monad networks

---

## 3. Smart Contracts

There are **8 smart contracts** in this project. Here's what each one does, explained simply:

### 3.1 UnhackableWallet.sol — The Main Scam-Reporting Contract

**Location:** `hardhat/contracts/UnhackableWallet.sol`
**Solidity Version:** ^0.8.20
**What it does:**

Think of this as a **public bulletin board** for scam reports, combined with a **safe transfer system**.

- **Report a scam:** Anyone can call `reportScam(scammerAddress, reason, evidence)` to report a suspicious address. Each report adds 10 points to that address's scam score.
- **DAO voting:** Community members vote on reports using `voteOnReport(proposalId, inSupport)`. Each person gets one vote per proposal.
- **Secure transfers:** The `secureTransfer(to)` function lets you send money, but it checks if the recipient is a confirmed scammer first. The transfer still goes through (it doesn't block it), but it emits an event saying whether the transfer was safe or not.
- **Scam score:** Every address has a score from 0-100. Higher = more likely to be a scam.

### 3.2 QuadraticVoting.sol — The Advanced DAO Governance

**Location:** `hardhat/contracts/QuadraticVoting.sol`
**Solidity Version:** ^0.8.20
**What it does:**

This is the **upgraded version** of the voting system. Instead of "one person = one vote," it uses **quadratic voting**.

**What is quadratic voting?** Imagine you have tokens:
- If you stake **1 token**, you get **1 vote power** (√1 = 1)
- If you stake **100 tokens**, you get **10 vote power** (√100 = 10)
- If you stake **10,000 tokens**, you get **100 vote power** (√10000 = 100)

This means a whale with 10,000x more tokens only gets 100x more voting power, not 10,000x. It prevents rich people from dominating the governance.

**Key features:**
- **Proposals:** Anyone submits a scam report as a proposal. The community votes for 3 days.
- **SHIELD tokens:** Voters stake SHIELD tokens (an ERC-20 token) to vote. Tokens are returned after the vote ends.
- **Reputation system:** Voters who vote with the majority get accuracy points. Voters with >80% accuracy AND 5+ votes get a 20% voting power boost.
- **Scam threshold:** A proposal passes if 60% or more of the vote power says "yes, this is a scam."
- **Flywheel:** Confirmed scams feed BACK into the ML model's training data, making the AI smarter over time.

### 3.3 SocialRecoveryWallet.sol — The "I Lost My Keys" Safety Net

**Location:** `hardhat/contracts/SocialRecoveryWallet.sol`
**Solidity Version:** ^0.8.19
**What it does:**

Imagine you lose your private key (the password to your wallet). Normally, your money is gone forever. This contract lets you set up **trusted friends (guardians)** who can help you recover your wallet.

**How it works:**
1. **Setup:** The wallet owner adds guardians (trusted friends) using `addGuardian(address)`.
2. **Something goes wrong:** You lose access to your wallet.
3. **Recovery starts:** One of your guardians calls `initiateRecovery(newOwnerAddress)` to propose a new owner.
4. **Others approve:** Other guardians call `approveRecovery(requestId)` to say "yes, I agree."
5. **Time delay:** There's a mandatory **3-day waiting period** (RECOVERY_DELAY). This gives the real owner time to cancel if someone is trying to steal their wallet.
6. **Threshold met:** Once enough guardians approve (GUARDIAN_THRESHOLD) AND the 3 days pass, ownership transfers.

### 3.4 Lock.sol — Hardhat Sample Contract (Not Used)

**Location:** `hardhat/contracts/Lock.sol`
**What it is:** This is just the default sample contract that comes with every Hardhat project. It locks ETH until a specific time, then lets the owner withdraw. **It is NOT part of NeuroShield's actual functionality.**

### 3.5 CivicVerifier.sol — Identity Verification Bridge

**Location:** `hardhat/contracts/civic/CivicVerifier.sol`
**Solidity Version:** ^0.8.20
**What it does:**

This is the bridge between **Civic Pass** (an off-chain identity verification service) and the on-chain system.

- Checks if a user has a valid Civic Pass
- Stores verification levels (1 = low, 2 = medium, 3 = high)
- Mints or updates Soulbound Tokens (SBTs) when users get verified
- Tracks trust scores, voting accuracy, and DAO participation per user

### 3.6 CivicSBT.sol — Soulbound Token for Identity

**Location:** `hardhat/contracts/civic/CivicSBT.sol`
**Solidity Version:** ^0.8.20
**What it does:**

A **Soulbound Token (SBT)** is like an NFT, but you **cannot transfer it**. It is permanently bound to your wallet address. Think of it like a diploma — it proves something about YOU and can't be given to someone else.

**Each SBT stores:**
- When it was issued
- Verification level (1-3)
- Trust score (0-100)
- Voting accuracy (0-100)
- DAO participation count

**Important:** The `_transfer`, `transferFrom`, and `safeTransferFrom` functions all `revert("SBTs cannot be transferred")`. This is what makes them "soulbound."

### 3.7 CivicGatedWallet.sol — Identity-Protected Wallet

**Location:** `hardhat/contracts/civic/CivicGatedWallet.sol`
**Solidity Version:** ^0.8.20
**What it does:**

A wallet that requires Civic identity verification for **big transactions**. Small transactions go through normally. Big transactions (above a configurable threshold) require the sender to be Civic-verified.

- Default threshold: 1 ETH (set during deployment)
- Owner can update the threshold with `updateThreshold()`
- Requires the CivicVerifier contract address during deployment

### 3.8 MockCivicPass.sol — Fake Identity Checker for Testing

**Location:** `hardhat/contracts/civic/MockCivicPass.sol`
**Solidity Version:** ^0.8.17
**What it does:**

A **mock (fake) contract** used for testing. Instead of connecting to the real Civic Pass service, this lets developers manually set which addresses are "verified" using `setValidity(address, true/false)`.

- The deployer is automatically marked as valid
- Anyone can call `setValidity()` to mark addresses as valid/invalid
- **This should NEVER be used in production** — it's only for testing

---

## 4. How Monad Is Connected & Working

### The Connection Chain

```
User's Browser (MetaMask)
    ↓ (JSON-RPC calls)
Monad Testnet RPC: https://testnet-rpc.monad.xyz
    ↓ (processes transactions)
Monad Blockchain (Chain ID: 10143)
    ↓ (stores state)
Smart Contracts (deployed at specific addresses)
```

### What Happens When a User Connects

1. User clicks "Connect Wallet" in the app
2. `wallet.ts` calls `window.ethereum.request({ method: 'eth_requestAccounts' })`
3. MetaMask pops up asking the user to approve
4. After approval, the app checks the current chain: `eth_chainId`
5. If NOT on Monad (10143), it calls `wallet_switchEthereumChain` with `chainId: '0x2797'`
6. If Monad isn't added to MetaMask, it catches error 4902 and calls `wallet_addEthereumChain` with the full Monad config
7. A `BrowserProvider` and `Signer` are created from ethers.js
8. The app is now connected and can read/write to Monad

### What Happens When a User Reports a Scam

1. User fills in the scam report form (suspicious address, description, evidence)
2. Frontend calls `contractService.reportScam(address, description, evidence)`
3. The code checks: Are we on Monad? (`chainId === 10143 || chainId === 2023`)
4. Estimates gas for the transaction
5. Calls `votingContract.submitProposal(suspiciousAddress, description, evidence)` — this is the QuadraticVoting contract
6. MetaMask pops up asking the user to confirm the transaction and pay gas (in MON)
7. Transaction is sent to Monad testnet
8. After 1 confirmation (~1-2 seconds), the receipt comes back
9. The scam report is now permanently on-chain

### Monad-Specific Optimizations in the Code

| What | Where | Optimization |
|------|-------|-------------|
| Block confirmations needed | `src/web3/utils.ts` | Monad: 1, Others: 3 |
| Transaction polling interval | `src/web3/utils.ts` | Monad: 500ms, Others: 3000ms |
| Gas price | `hardhat/hardhat.config.ts` | Fixed at 1 gwei |
| Network auto-switch | `src/web3/wallet.ts` | Always tries to switch to Monad |
| Timeout for deployment | `hardhat/hardhat.config.ts` | 60 seconds |

---

## 5. Transferring to Ethereum (or Any EVM Chain)

### The Good News: It's Almost Trivial

Because Monad is **100% EVM-compatible**, every single smart contract in this project can be deployed to Ethereum mainnet, Sepolia, Goerli, Polygon, Arbitrum, Optimism, BSC, or any other EVM chain with **ZERO code changes** to the Solidity contracts.

### What You Would Need to Change

#### Step 1: Hardhat Config — Add the New Network

In `hardhat/hardhat.config.ts`, add a new network entry:

```typescript
// Example: Adding Ethereum Sepolia testnet
sepolia: {
  url: "https://rpc.sepolia.org",
  accounts: [PRIVATE_KEY],
  chainId: 11155111,
}

// Example: Adding Ethereum mainnet
mainnet: {
  url: "https://eth.llamarpc.com",
  accounts: [PRIVATE_KEY],
  chainId: 1,
}
```

#### Step 2: Deploy to the New Network

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

#### Step 3: Update Frontend Addresses

The contract addresses are mapped by chain ID in `src/web3/contract.ts`:

```typescript
const CONTRACT_ADDRESSES: { [chainId: string]: string } = {
  '1': '0xYOUR_MAINNET_ADDRESS',          // Ethereum Mainnet
  '11155111': '0xYOUR_SEPOLIA_ADDRESS',    // Sepolia
  '10143': '0x7A791FE5...F27C7B',         // Monad (already there)
};
```

#### Step 4: Update Network Switching Logic

Currently the app auto-switches to Monad. Remove or modify the auto-switch in `wallet.ts` if you want to support multiple chains:

```typescript
// In wallet.ts connect() method, remove or make conditional:
if (!isMonadNetwork(this.chainId.toString())) {
  await switchToMonadNetwork();  // <-- Remove this for multi-chain
}
```

#### Step 5: Gas & Timing Adjustments

- Ethereum blocks are ~12s, not ~1-2s. The polling interval and confirmation counts in `utils.ts` already handle this via the `isMonadNetwork()` check.
- Gas prices are much higher on mainnet. You might want to remove the fixed `gasPrice: 1000000000` from the hardhat config.

### What Works Automatically on Ethereum

- All Solidity contracts (no changes needed)
- All ABI interactions (same ABI works on all EVM chains)
- MetaMask wallet connection (works the same everywhere)
- Event listening and filtering
- ENS name resolution (the code already supports this for chains 1, 5, and 11155111!)

### What Does NOT Work on Ethereum

- **Flashbots MEV Protection:** Already coded to only work on chains 1 (mainnet) and 5 (Goerli). This is correct — Flashbots is Ethereum-specific.
- **SHIELD Token:** The token address is set to `0x0000...0000` (null address), meaning there is no deployed SHIELD token yet on any chain.
- **Gas economics:** Transactions that cost fractions of a cent on Monad would cost real money on Ethereum mainnet.

---

## 6. Cross-Platform Compatibility

### EVM Chains Where This Would Work (No Contract Changes)

| Chain | Chain ID | Native Currency | Would Work? | Notes |
|-------|----------|----------------|-------------|-------|
| Ethereum Mainnet | 1 | ETH | Yes | Expensive gas |
| Ethereum Sepolia | 11155111 | SepoliaETH | Yes | Free testnet |
| Ethereum Goerli | 5 | GoerliETH | Yes | Deprecated testnet |
| Polygon | 137 | MATIC | Yes | Low gas |
| Polygon Mumbai | 80001 | MATIC | Yes | Free testnet |
| BNB Smart Chain | 56 | BNB | Yes | Low gas |
| BNB Testnet | 97 | tBNB | Yes | Free testnet |
| Arbitrum One | 42161 | ETH | Yes | L2, cheap |
| Optimism | 10 | ETH | Yes | L2, cheap |
| Avalanche C-Chain | 43114 | AVAX | Yes | Fast, cheap |
| Monad Testnet | 10143 | MON | Yes (current) | Fastest |

### What Makes It Cross-Platform?

1. **Solidity + EVM:** All contracts use standard Solidity (0.8.x) and standard EVM opcodes. Nothing Monad-specific.
2. **OpenZeppelin libraries:** The contracts import from `@openzeppelin/contracts`, which is the industry standard.
3. **ethers.js v6:** The frontend uses ethers.js which works with any EVM chain.
4. **MetaMask:** The wallet connection code uses the standard `window.ethereum` API that all EVM wallets support.
5. **No chain-specific opcodes:** No Monad-only or Ethereum-only opcodes are used.

### Non-EVM Chains — Would It Work?

| Chain | Would Work? | Why/Why Not |
|-------|------------|-------------|
| Solana | No | Different VM (SVM, uses Rust programs) |
| Bitcoin | No | No smart contracts (in the Solidity sense) |
| Cosmos/IBC chains | No | Different VM (CosmWasm, uses Rust) |
| Near | No | Different VM (uses Rust/AssemblyScript) |
| Aptos/Sui | No | Different VM (Move language) |
| Tron | Partially | Has EVM compatibility but differences exist |

---

## 7. The Dual-Layer Defense System

This is the heart of NeuroShield's innovation. Here's how the two layers work together:

### Layer 1: ML Model (Instant Protection)

- **Where:** `api/predict.py` (backend ML model hosted on Render)
- **How:** When you're about to send a transaction, the frontend sends 18 numeric features (transaction value, gas price, sender balance, nonce, etc.) to the ML API
- **Speed:** Response in < 1 second
- **Output:** "Fraud" / "Suspicious" / "Safe" with a risk score (0-100)

### Layer 2: DAO Community (Long-term Curation)

- **Where:** QuadraticVoting.sol smart contract on Monad
- **How:** Community members stake SHIELD tokens to vote on whether reported addresses are scams
- **Speed:** Voting period is 3 days
- **Output:** Address is marked as `isScammer = true` on-chain if 60%+ vote power agrees

### The Flywheel (How They Feed Each Other)

```
ML flags transaction → User warned → If user proceeds → Logged for DAO review
                                                              ↓
                                                    Community votes (3 days)
                                                              ↓
                                                   If confirmed scam:
                                                     - Address marked on-chain
                                                     - Scam score increased
                                                     - Data feeds back into ML ←──── THE FLYWHEEL
```

### Combined Risk Scoring (from `dualVerification.ts`)

The dual-layer result combines both sources:

- `combinedRiskScore`: Weighted average of ML risk + DAO scam score
- If ML says "scam" AND DAO says "scam" → `confidenceBoost` increases (dual confirmation)
- If ML says "safe" but DAO says "scam" → Warning is shown (community knows something ML doesn't)
- If ML says "scam" but DAO has no data → ML drives the decision (first-time scam, no community data yet)

---

## 8. MEV Protection & Flashbots

### What Is MEV?

MEV stands for **Maximal Extractable Value**. In simple terms: bad actors can see your pending transaction in the mempool (the waiting room for transactions) and place their own transaction BEFORE yours to profit from it. Common attacks:

- **Front-running:** Someone sees you're about to buy a token, buys it first, then sells to you at a higher price.
- **Sandwich attacks:** Someone buys before you AND sells after you, squeezing profit from your trade.

### How NeuroShield Protects Against MEV

**File:** `src/web3/mev-protection.ts`

1. **Flashbots Integration:** On Ethereum mainnet/Goerli (chains 1 and 5), the app can send transactions through Flashbots — a private channel that bypasses the public mempool so front-runners can't see your transaction.

2. **Slippage Protection:** For DEX trades (Uniswap V2, Uniswap V3, SushiSwap), the app automatically:
   - Detects if the transaction is going to a DEX router address
   - Adds a minimum output amount (slippage tolerance)
   - Adds a deadline (5 minutes) so pending transactions expire

3. **Supported DEX Routers:**
   - Uniswap V2: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`
   - Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564`
   - SushiSwap: `0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F`

> **Note:** Flashbots does NOT work on Monad. It's Ethereum-specific. On Monad, the app falls back to regular transactions. Monad's architecture (faster blocks, different mempool) may inherently reduce some MEV opportunities, but dedicated Monad MEV solutions would be different.

---

## 9. Civic Identity Integration

### What Is Civic?

Civic is an **identity verification** service. Think of it like KYC (Know Your Customer) but decentralized. Users prove they are real humans through Civic's app, and then smart contracts can check this on-chain.

### How It's Used in NeuroShield

1. **CivicVerifier contract** talks to a Civic Pass contract (or MockCivicPass for testing)
2. When a user is verified, a **Soulbound Token (SBT)** is minted to their address
3. The SBT contains their trust score, verification level, and DAO participation stats
4. **CivicGatedWallet** requires Civic verification for large transactions (above threshold)
5. The frontend (`src/web3/civic/auth.ts`) reads verification status and trust scores from the contracts

### Trust Score Factors

The trust score (0-100) is calculated from:
- **Civic verification status** (are they a verified human?)
- **Transaction history** (how many successful transactions? what percentage succeeded?)
- **DAO activity** (how often do they vote? how accurate are their votes?)

---

## 10. All Addresses — REAL vs MOCK/PLACEHOLDER

This is the critical section. Here is every blockchain address found in the codebase and whether it's real or fake:

### REAL Deployed Contract Addresses (on Monad Testnet)

| Address | What It Is | Where Used | Status |
|---------|-----------|------------|--------|
| `0x7A791FE5A35131B7D98F854A64e7F94180F27C7B` | QuadraticVoting / Main contract on Monad | `src/web3/contract.ts` (lines 59, 60, 70), `src/web3/civic/auth.ts` | **REAL — Deployed on Monad Testnet (chain 10143)** |
| `0xcdc4284A037f8b7C5a6c03b3f190A1B83d0258e2` | SocialRecoveryWallet on Monad | `src/web3/addresses.json` | **REAL — Deployed on Monad Testnet** |

### PLACEHOLDER / NULL Addresses (Not Deployed)

| Address | What It Is | Where Used | Status |
|---------|-----------|------------|--------|
| `0x0000000000000000000000000000000000000000` | Ethereum Mainnet contract | `src/web3/contract.ts` (chain '1') | **PLACEHOLDER — No mainnet deployment exists** |
| `0x0000000000000000000000000000000000000000` | Goerli contract | `src/web3/contract.ts` (chain '5') | **PLACEHOLDER — No Goerli deployment exists** |
| `0x0000000000000000000000000000000000000000` | Sepolia contract | `src/web3/contract.ts` (chain '11155111') | **PLACEHOLDER — No Sepolia deployment exists** |
| `0x0000000000000000000000000000000000000000` | SHIELD Token address | `src/web3/contract.ts` (SHIELD_TOKEN_ADDRESS) | **PLACEHOLDER — No SHIELD token has been deployed anywhere** |
| `0x0000000000000000000000000000000000000000` | Backend scam report contract | `backend/services/blockchain.go` (SCAM_REPORT_CONTRACT env var default) | **PLACEHOLDER — Backend uses simulated transactions** |

### REAL External Addresses (Not Part of This Project)

| Address | What It Is | Where Used | Status |
|---------|-----------|------------|--------|
| `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D` | Uniswap V2 Router (Ethereum Mainnet) | `src/web3/constants.ts` | **REAL — This is the official Uniswap V2 router on Ethereum** |
| `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 Router (Ethereum Mainnet) | `src/web3/constants.ts` | **REAL — This is the official Uniswap V3 router on Ethereum** |
| `0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F` | SushiSwap Router (Ethereum Mainnet) | `src/web3/constants.ts` | **REAL — This is the official SushiSwap router on Ethereum** |

### Test-Only Addresses

| Address | What It Is | Where Used | Status |
|---------|-----------|------------|--------|
| `0x0000000000000000000000000000000000000001` | Test scam address used in deployment test | `hardhat/scripts/test-monad-deployment.js` | **TEST — Just a dummy address for testing report functionality** |

### Civic Contract Addresses

| Address | What It Is | Where Used | Status |
|---------|-----------|------------|--------|
| `VITE_CIVIC_VERIFIER_ADDRESS` (env var) | CivicVerifier contract | `src/web3/civic/auth.ts` | **NOT SET — Defaults to empty string. Civic contracts are not deployed yet.** |

### Summary

- **Only 2 addresses are actually deployed and live on Monad testnet**
- **All Ethereum mainnet/testnet addresses are `0x000...000` placeholders** — the contracts have never been deployed to Ethereum
- **The 3 DEX router addresses are real Ethereum mainnet addresses** — they're used for MEV protection detection but only relevant if the app runs on Ethereum mainnet
- **Civic contracts have no deployed addresses** — the integration exists in code but nothing is deployed
- **SHIELD token does not exist** — the QuadraticVoting contract expects a SHIELD ERC-20 token, but none has been deployed

---

## 11. Frontend ↔ Blockchain Communication Flow

### The Stack

```
React Components (UI)
    ↓
src/web3/contract.ts (ContractService — singleton)
    ↓
src/web3/wallet.ts (WalletConnector — singleton)
    ↓
ethers.js v6 (BrowserProvider + Contract)
    ↓
window.ethereum (MetaMask browser extension)
    ↓
JSON-RPC calls to Monad RPC
    ↓
Monad Blockchain
```

### Key Singleton Services

1. **`walletConnector`** (from `wallet.ts`): Manages the MetaMask connection, provider, signer, and chain switching. One instance shared everywhere.

2. **`contractService`** (from `contract.ts`): Manages smart contract instances and provides methods like `reportScam()`, `getScamReports()`, `castQuadraticVote()`, etc. Uses `walletConnector` internally.

3. **`socialRecoveryService`** (from `socialRecovery.ts`): Manages the SocialRecoveryWallet contract with methods like `addGuardian()`, `initiateRecovery()`, `approveRecovery()`.

### Reading Data (Free — No Gas)

Reading from the blockchain is free and doesn't require a transaction:

```
contractService.getScamReports()
    → votingContract.queryFilter(ProposalCreated)    // Get all proposal events
    → votingContract.getProposal(id)                  // Get each proposal's details
    → Returns array of { reporter, suspiciousAddress, description, votesFor, votesAgainst, status }
```

### Writing Data (Costs Gas — Requires MetaMask Approval)

Writing to the blockchain creates a transaction that costs MON (gas):

```
contractService.reportScam(address, description, evidence)
    → votingContract.submitProposal.estimateGas(...)  // Estimate gas first
    → votingContract.submitProposal(...)              // MetaMask popup appears
    → User clicks "Confirm" in MetaMask
    → Transaction sent to Monad
    → Wait for 1 confirmation (~1-2 seconds)
    → Return transaction receipt
```

---

## 12. Backend ↔ Blockchain Communication Flow

### Current State: Mostly Simulated

The Go backend (`backend/services/blockchain.go`) has blockchain service code but **most of it is simulated/placeholder**:

- `ReportScamOnChain()` — Generates a **fake transaction hash** using `crypto.Keccak256`. Does NOT actually submit a transaction.
- `TriggerAssetRecovery()` — Same, generates a **fake transaction hash**.
- `GetTransactionStatus()` — Always returns `"confirmed"`. Does NOT check the actual blockchain.
- `GetWalletBalance()` — This one IS real! It actually connects to an Ethereum client and reads the balance.
- `SubmitReport()` — Has real structure but the helper methods (`prepareAuth`, `submitToContract`) return `"not implemented"` errors.

### Backend Contract Binding

The file `backend/contracts/scam_reporting.go` contains a **placeholder ABI** for the scam reporting contract. The comment says "In a real implementation, you would use abigen to generate Go bindings."

**Translation:** The backend's blockchain integration is incomplete. The frontend handles all real blockchain interactions directly through MetaMask.

---

## 13. Deployment Pipeline

### How Contracts Get Deployed to Monad

1. **Write contracts** in `hardhat/contracts/`
2. **Configure network** in `hardhat/hardhat.config.ts` (already done for Monad)
3. **Set up `.env`** with your private key:
   ```
   PRIVATE_KEY=your_64_char_hex_key
   ```
4. **Get testnet tokens** from https://faucet.testnet.monad.xyz/
5. **Deploy:**
   - UnhackableWallet: `npx hardhat run scripts/deploy.ts --network monad_testnet`
   - SocialRecoveryWallet: `npx hardhat run scripts/deploy-social-recovery-monad.js --network monad_testnet`
   - Civic contracts: `npx hardhat run scripts/deploy-civic.js --network monad_testnet`
6. **Contract address saved** to `hardhat/src/web3/addresses.json` and/or `src/web3/addresses.json`
7. **Update frontend** with: `node scripts/update-addresses.js <address> <chainId>`
8. **Verify on explorer** with: `npx hardhat verify --network monad_testnet <address> <constructorArgs>`

### Automated Workflow

The file `hardhat/scripts/monad-deploy-workflow.js` provides an interactive CLI tool that walks you through:
1. Checking if `.env` exists
2. Validating your private key format
3. Compiling contracts
4. Deploying
5. Updating frontend config
6. Verifying on explorer

---

## 14. Known Limitations & Incomplete Parts

| What | Status | Details |
|------|--------|---------|
| SHIELD Token | **Not deployed** | QuadraticVoting contract needs it, but no ERC-20 token exists. Quadratic voting cannot work without it. |
| Backend blockchain integration | **Mostly simulated** | Go backend fakes transaction hashes. Real blockchain ops happen only in the frontend. |
| Civic contract deployment | **Not deployed** | All Civic contracts (CivicVerifier, CivicSBT, CivicGatedWallet, MockCivicPass) exist in code but have no deployed addresses. |
| Ethereum mainnet support | **No contracts deployed** | Address slots exist (chain 1, 5, 11155111) but are all `0x000...000`. |
| Flashbots on Monad | **Not applicable** | Flashbots only works on Ethereum. The code correctly handles this by falling back to regular transactions. |
| ENS on Monad | **Not supported** | The code correctly skips ENS resolution for Monad (chain 10143 and 2023). |
| Chain ID inconsistency | **Minor issue** | Some old docs/code reference chain ID `2023` for Monad, but the actual testnet uses `10143`. The code handles both, but it's confusing. |
| `contract.ts` dual-ABI | **Confusing** | The file imports `UnhackableWalletABI` but actually uses `QUADRATIC_VOTING_ABI` inline. The legacy `initContract()` method tries to call `getReportCount()` which is from UnhackableWallet, not QuadraticVoting. This would fail if called. |
| Test coverage for contracts | **Exists** | Test files exist in `hardhat/test/` for SocialRecoveryWallet and QuadraticVoting. |

---

## 15. File Map — Where Everything Lives

### Smart Contracts (Solidity)

| File | Contract | Purpose |
|------|----------|---------|
| `hardhat/contracts/UnhackableWallet.sol` | UnhackableWallet | Scam reporting + DAO voting + secure transfers |
| `hardhat/contracts/QuadraticVoting.sol` | QuadraticVoting | Advanced DAO with quadratic voting + reputation |
| `hardhat/contracts/SocialRecoveryWallet.sol` | SocialRecoveryWallet | Guardian-based wallet recovery |
| `hardhat/contracts/Lock.sol` | Lock | Hardhat sample (not used) |
| `hardhat/contracts/civic/CivicVerifier.sol` | CivicVerifier | Identity verification bridge |
| `hardhat/contracts/civic/CivicSBT.sol` | CivicSBT | Soulbound token for identity |
| `hardhat/contracts/civic/CivicGatedWallet.sol` | CivicGatedWallet | Identity-gated wallet |
| `hardhat/contracts/civic/MockCivicPass.sol` | MockCivicPass | Fake identity for testing |

### Deploy Scripts

| File | What It Deploys | Target |
|------|----------------|--------|
| `hardhat/scripts/deploy.ts` | UnhackableWallet | Any network |
| `hardhat/scripts/deploy-social-recovery-monad.js` | SocialRecoveryWallet | Monad testnet |
| `hardhat/scripts/deploy-civic.js` | MockCivicPass + CivicVerifier + CivicGatedWallet | Any network |
| `hardhat/scripts/monad-deploy-workflow.js` | Interactive deploy wizard | Monad testnet |
| `hardhat/scripts/test-monad-deployment.js` | Tests deployed contract | Monad testnet |
| `hardhat/scripts/update-addresses.js` | Updates frontend addresses | N/A (file edit) |

### Frontend Web3 Integration

| File | Purpose |
|------|---------|
| `src/web3/wallet.ts` | MetaMask connection, network switching, MEV-protected transactions |
| `src/web3/contract.ts` | All smart contract interactions (report, vote, transfer, etc.) |
| `src/web3/socialRecovery.ts` | Social recovery wallet interactions |
| `src/web3/utils.ts` | Address formatting, network info, explorer URLs |
| `src/web3/constants.ts` | DEX router addresses and function selectors |
| `src/web3/mev-protection.ts` | Flashbots + slippage protection |
| `src/web3/flashbotsProvider.ts` | Flashbots provider setup |
| `src/web3/addresses.json` | Deployed contract addresses |
| `src/web3/civic/auth.ts` | Civic identity verification with on-chain contracts |
| `src/web3/civic/dualVerification.ts` | Dual-layer ML + DAO verification system |
| `src/web3/abi/*.json` | Contract ABIs (UnhackableWallet, QuadraticVoting, CivicSBT, CivicVerifier) |

### Backend Blockchain Code

| File | Purpose |
|------|---------|
| `backend/services/blockchain.go` | Blockchain interaction (mostly simulated) |
| `backend/contracts/scam_reporting.go` | Contract ABI placeholder |

### Configuration

| File | Purpose |
|------|---------|
| `hardhat/hardhat.config.ts` | Hardhat config — networks, Solidity version, paths |
| `hardhat/package.json` | Hardhat dependencies |

---

## Quick Reference Card

| Question | Answer |
|----------|--------|
| What blockchain does this run on? | Monad Testnet (Chain ID: 10143) |
| What's the RPC URL? | `https://testnet-rpc.monad.xyz` |
| What currency is used for gas? | MON (Monad testnet tokens) |
| Where do I get testnet tokens? | https://faucet.testnet.monad.xyz/ |
| What's the main contract address? | `0x7A791FE5A35131B7D98F854A64e7F94180F27C7B` |
| What's the recovery wallet address? | `0xcdc4284A037f8b7C5a6c03b3f190A1B83d0258e2` |
| Can I deploy to Ethereum? | Yes, change hardhat config + deploy |
| Is the SHIELD token deployed? | No |
| Are Civic contracts deployed? | No |
| Does the backend talk to blockchain? | Mostly simulated, frontend does real blockchain ops |
| What Solidity version? | 0.8.19 - 0.8.28 (varies by contract) |
| What's the explorer? | https://testnet.monadexplorer.com |

---

*Document generated from codebase analysis. Last reviewed against source code on February 26, 2026.*
