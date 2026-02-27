<p align="center">
  <img src="https://img.shields.io/badge/Monad-Testnet-purple?style=for-the-badge" />
  <img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/Go-Gin-00ADD8?style=for-the-badge&logo=go" />
  <img src="https://img.shields.io/badge/Solidity-0.8-363636?style=for-the-badge&logo=solidity" />
  <img src="https://img.shields.io/badge/ML-Fraud_Detection-red?style=for-the-badge" />
</p>

# 🛡️ NeuroShield — Next-Gen Web3 Security

**The world's first AI-powered smart wallet that learns from its community.**

NeuroShield isn't just another wallet — it's a self-improving security system. Every scam you report makes the AI smarter. Every vote you cast in the DAO trains the model. Your on-chain reputation is permanent, soulbound, and impossible to fake. This is Web3 security that gets better every single day.

---

## The Problem

Crypto users lose **billions** every year to scams, phishing, rug pulls, and fraudulent transactions. Current solutions are reactive — they warn you _after_ someone else got scammed. There's no system that learns, adapts, and prevents the _next_ attack before it happens.

## The Solution

NeuroShield combines **AI fraud detection**, **community-driven DAO governance**, and **permanent on-chain reputation** into a single, self-improving flywheel:

```
You report a scam → Community votes on it → Confirmed scams train the AI
→ AI gets smarter → Catches the next scam faster → Community reports more
→ Flywheel spins faster → Everyone gets safer
```

---

## Features

### AI Transaction Scanner

Every transaction is scanned in real-time by a machine learning model that analyzes **18 dimensions** of wallet behavior — transaction patterns, gas anomalies, contract interactions, token flows, and more. If something looks wrong, you get a clear warning with a risk score before the transaction goes through. You decide: block it or proceed with caution.

### DAO Quadratic Voting

Community members use SHIELD tokens to vote on scam reports. But here's the twist — **voting power = √(tokens staked)**. A user staking 100 tokens gets 10 votes, not 100. This prevents whales from dominating decisions and gives every community member a real voice. Proposals need 60% vote power to confirm a scam.

### The Self-Improving Flywheel

This is what makes NeuroShield different from everything else. When the DAO confirms a scam address, that data feeds directly back into the ML model. The function `getDAOScamBoost()` adds up to **+50% risk score boost** to addresses flagged by the community. The AI doesn't just learn from historical data — it learns from your community in real-time.

### Soulbound Token (SBT) — On-Chain Reputation

Your reputation is permanently encoded on-chain as a non-transferable ERC-721 token. The trust score is computed from four verifiable sources:

| Component           | Max Points | What It Measures                       |
| ------------------- | ---------- | -------------------------------------- |
| Civic Verification  | +40        | Are you a verified human?              |
| Transaction History | +20        | Do you have real on-chain activity?    |
| DAO Voting Accuracy | +20        | Do you vote correctly on scam reports? |
| DAO Participation   | +20        | Do you actually show up and vote?      |

The metadata is stored as **Base64-encoded JSON directly inside the smart contract** — no IPFS, no server. If every server on earth goes offline, your reputation still exists on the blockchain. And because it's soulbound, it can never be transferred, bought, sold, or faked.

### Civic Face Biometrics & Identity Verification

Before you get full access to NeuroShield, you verify your identity through **Civic's biometric authentication**. This prevents Sybil attacks (one person creating multiple accounts to game the system) and ensures every participant in the DAO is a real, unique human. Your verification status is linked to your SBT.

### Social Recovery Wallet

Lost your private keys? Don't panic. Designate trusted friends or family as **guardians**. If you lose access, your guardians collectively vote to transfer ownership to your new wallet. It requires multiple approvals plus a **3-day security delay** — so no single guardian can steal your funds, and you have time to cancel if something seems off.

### MEV Protection

NeuroShield protects your transactions from front-running and sandwich attacks. Before you trade on a DEX, the system checks for MEV vulnerability and can route your transaction through **private mempools** (like Flashbots) so bots can't see it coming.

### Wallet Analytics Dashboard

Visualize your on-chain footprint — transaction patterns, token flows, spending behavior, and risk indicators. The same 18 features the ML model uses to score transactions are displayed as charts so you can understand exactly what the AI sees.

---

## How It Works — The Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│         React + TypeScript + Vite                │
│     Tailwind CSS + shadcn/ui + ethers.js v6      │
├─────────────────────────────────────────────────┤
│                   Backend                        │
│            Go (Gin) + GORM + PostgreSQL           │
│       On-chain event listener + REST API          │
├─────────────────────────────────────────────────┤
│                ML Fraud Detection                │
│        Python + scikit-learn + Flask              │
│     18-feature model hosted on Render             │
├─────────────────────────────────────────────────┤
│              Smart Contracts (Monad)              │
│  QuadraticVoting · CivicSBT · CivicVerifier      │
│  SocialRecoveryWallet · CivicGatedWallet          │
│         Solidity 0.8 + OpenZeppelin               │
└─────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- **Node.js** v18+ and **npm**
- **Go** 1.21+
- **MetaMask** browser extension
- **PostgreSQL** database (or use [Neon](https://neon.tech) for serverless)

### 1. Clone the Repository

```bash
git clone https://github.com/tanmayjoddar/NeuroShield-Hack4Bengal.git
cd NeuroShield-Hack4Bengal
```

### 2. Start the Frontend

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start the dev server
npm run dev
```

Open **http://localhost:5173** in your browser. Connect MetaMask to **Monad Testnet** (Chain ID: 10143).

### 3. Start the Backend

```bash
cd backend

# Set environment variables (create a .env file or export them)
# Required:
#   DATABASE_URL=postgresql://user:pass@host/dbname
#   CIVIC_SBT_ADDRESS=0x...        (after deploying contracts)
#   CIVIC_VERIFIER_ADDRESS=0x...   (after deploying contracts)

# Build and run
go build -o server .
./server
```

The API starts on **http://localhost:8080**. It auto-migrates all database tables on first run.

### 4. Deploy Smart Contracts

```bash
cd hardhat

# Install Hardhat dependencies
npm install

# Create .env with your deployer private key
# PRIVATE_KEY=0x...

# Deploy all contracts to Monad Testnet
npx hardhat run scripts/deploy-civic.js --network monad_testnet

# Deploy QuadraticVoting + SocialRecovery
npx hardhat run scripts/deploy.ts --network monad_testnet
```

After deployment, the script automatically saves contract addresses to `src/web3/addresses.json` and prints the environment variables you need.

### 5. Start the ML API (Optional — already hosted)

The ML fraud detection model is already hosted at `ml-fraud-transaction-detection.onrender.com`. To run locally:

```bash
cd api
pip install -r requirements.txt
python index.py
```

---

## 📁 Project Structure

```
NeuroShield-Hack4Bengal/
├── src/                    # React frontend
│   ├── components/         # UI components (SBT, DAO, Wallet, etc.)
│   ├── pages/              # Route pages (Index, SBT, CivicAuth)
│   ├── web3/               # Contract services, wallet, ABIs
│   └── stores/             # State management
├── backend/                # Go backend
│   ├── handlers/           # REST API endpoints
│   ├── services/           # Business logic (SBT, AI, blockchain)
│   ├── models/             # GORM database models
│   └── routes/             # Route definitions
├── hardhat/                # Smart contracts
│   ├── contracts/          # Solidity (QuadraticVoting, CivicSBT, etc.)
│   ├── scripts/            # Deployment scripts
│   └── test/               # Contract tests
├── api/                    # ML fraud detection API (Python)
└── docs/                   # Feature documentation
```

---

## 🔗 Deployed Contracts (Monad Testnet)

| Contract             | Address                                      |
| -------------------- | -------------------------------------------- |
| QuadraticVoting      | `0x7A791FE5A35131B7D98F854A64e7F94180F27C7B` |
| SocialRecoveryWallet | `0xcdc4284A037f8b7C5a6c03b3f190A1B83d0258e2` |
| CivicSBT             | _Set after deployment_                       |
| CivicVerifier        | _Set after deployment_                       |

**Network:** Monad Testnet · Chain ID: 10143 · RPC: `https://testnet-rpc.monad.xyz`

---

## 🛠️ Tech Stack

| Layer           | Technology                                                        |
| --------------- | ----------------------------------------------------------------- |
| Frontend        | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, ethers.js v6 |
| Backend         | Go (Gin), GORM, PostgreSQL (Neon), go-ethereum                    |
| Smart Contracts | Solidity 0.8, OpenZeppelin 4.9.6, Hardhat                         |
| ML Model        | Python, scikit-learn, Flask, 18-feature fraud classifier          |
| Identity        | Civic Auth (face biometrics), Soulbound Tokens                    |
| Blockchain      | Monad Testnet (EVM-compatible, 10k+ TPS)                          |


---

## 📄 Documentation

- [SBT Implementation](SBT_IMPLEMENTATION.md) — Full-stack Soulbound Token breakdown
- [SBT Technical Wiring](SBT_TECHNICAL_WIRING.md) — How SBT connects across all layers
- [Feature Overview](NEUROSHIELD_FEATURES.md) — Complete feature documentation
- [API Documentation](backend/API_DOCUMENTATION.md) — Backend REST API reference
- [Monad Deployment Guide](hardhat/MONAD_DEPLOYMENT.md) — Step-by-step contract deployment

---

## What Makes NeuroShield Different

1. **Self-improving** — The AI gets smarter every time the community confirms a scam
2. **Fair governance** — Quadratic voting ensures no whale can dominate
3. **Permanent reputation** — Soulbound Tokens that can't be bought, transferred, or faked
4. **Real identity** — Civic face biometrics prevent Sybil attacks
5. **Full-stack on-chain** — Every critical piece lives on the blockchain, not a server
6. **Human + AI** — Neither the model nor the community works alone; together they create an unstoppable flywheel

---

---

## 📜 License

This project is open source under the [MIT License](LICENSE).
