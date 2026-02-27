# NeuroShield — Chain Migration Guide

> **How to switch NeuroShield from Monad Testnet to Ethereum or Solana**
>
> Written like a baby-steps checklist. Follow in order. Don't skip.

---

## Current State

NeuroShield runs on **Monad Testnet** (Chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`). All contracts are Solidity EVM contracts. The frontend uses `ethers.js`. MetaMask is the wallet.

---

## OPTION A: Migrate to Ethereum (Mainnet / Sepolia / Goerli)

This is the **easy path** — Monad is EVM-compatible, so your Solidity contracts compile and deploy on Ethereum with zero changes. Same ABI. Same ethers.js. Same MetaMask.

### Step 1: Hardhat Config

**File:** `hardhat/hardhat.config.ts`

Replace the `monad_testnet` network with your target Ethereum network:

```ts
// For Sepolia testnet:
networks: {
  sepolia: {
    url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    accounts: [process.env.PRIVATE_KEY],
    chainId: 11155111,
    timeout: 60000,
  },
  // For mainnet:
  mainnet: {
    url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    accounts: [process.env.PRIVATE_KEY],
    chainId: 1,
    timeout: 60000,
  },
},
defaultNetwork: "sepolia",  // or "mainnet"
```

Update `etherscan` section:

```ts
etherscan: {
  apiKey: { sepolia: process.env.ETHERSCAN_API_KEY || "" },
},
```

### Step 2: Deploy All Contracts

```bash
cd hardhat

# Set your env
export PRIVATE_KEY="your_deployer_private_key"
export ALCHEMY_API_KEY="your_alchemy_key"

# Deploy each contract — note the --network flag
npx hardhat run scripts/deploy-shield-token.js --network sepolia
npx hardhat run scripts/deploy-quadratic-voting.js --network sepolia
npx hardhat run scripts/deploy-civic.js --network sepolia
npx hardhat run scripts/deploy-wallet-verifier.js --network sepolia
npx hardhat run scripts/deploy-social-recovery-monad.js --network sepolia
```

**Write down every deployed address.** You'll need them all.

### Step 3: Update `hardhat/addresses.json`

After deploying, update with new addresses:

```json
{
  "shieldToken": "0xNEW_SHIELD_TOKEN_ADDRESS",
  "quadraticVoting": "0xNEW_QUADRATIC_VOTING_ADDRESS",
  "civicSBT": "0xNEW_CIVIC_SBT_ADDRESS",
  "civicGatedWallet": "0xNEW_CIVIC_GATED_WALLET_ADDRESS",
  "socialRecoveryWallet": "0xNEW_SOCIAL_RECOVERY_ADDRESS",
  "walletVerifier": "0xNEW_WALLET_VERIFIER_ADDRESS"
}
```

### Step 4: Update Frontend `.env`

**File:** `.env` (project root)

```env
# ── Chain Config ──
VITE_CONTRACT_ADDRESS_SEPOLIA=0xNEW_QUADRATIC_VOTING_ADDRESS
VITE_SHIELD_TOKEN_ADDRESS=0xNEW_SHIELD_TOKEN_ADDRESS
VITE_CIVIC_SBT_ADDRESS=0xNEW_CIVIC_SBT_ADDRESS
VITE_WALLET_VERIFIER_ADDRESS=0xNEW_WALLET_VERIFIER_ADDRESS
```

### Step 5: Update RPC URL in Source Files (6 files)

Replace `https://testnet-rpc.monad.xyz` with your Ethereum RPC URL in these files:

| #   | File                                 | Line | What to change                                                      |
| --- | ------------------------------------ | ---- | ------------------------------------------------------------------- |
| 1   | `src/web3/civic/sbt.ts`              | ~74  | `const MONAD_RPC = "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"` |
| 2   | `src/web3/civic/auth.ts`             | ~81  | `const MONAD_RPC = "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"` |
| 3   | `src/components/WalletAnalytics.tsx` | ~21  | `const MONAD_RPC = "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"` |
| 4   | `src/web3/wallet.ts`                 | ~54  | `rpcUrls: ["https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"]`        |
| 5   | `src/web3/utils.ts`                  | ~46  | Update `rpcUrl` in NETWORK_INFO                                     |
| 6   | `hardhat/hardhat.config.ts`          | ~25  | Already done in Step 1                                              |

> **Tip:** Do a global search for `testnet-rpc.monad.xyz` and replace all.

### Step 6: Update Chain ID in Source Files (3 files)

Replace chain ID `10143` with your target chain ID:

| #   | File                                                | What to change                                                          |
| --- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | `src/web3/wallet.ts` line ~30                       | `const chainId = "0xAA36A7"` (Sepolia=11155111=0xAA36A7, Mainnet=1=0x1) |
| 2   | `src/web3/contract.ts` line ~66                     | Add entry `"11155111": { ... }` in CONTRACT_ADDRESSES                   |
| 3   | `src/web3/contract.ts` lines ~731, ~1054, ~1097     | Change `10143` checks to `11155111`                                     |
| 4   | `src/web3/utils.ts` lines ~37, ~71, ~82, ~238, ~290 | Update all `10143` references                                           |

### Step 7: Update Wallet Connection Chain Details

**File:** `src/web3/wallet.ts` — the MetaMask `wallet_addEthereumChain` params:

```ts
// Sepolia — MetaMask already knows it, but just in case:
chainId: "0xAA36A7",
chainName: "Sepolia Testnet",
nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
rpcUrls: ["https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"],
blockExplorerUrls: ["https://sepolia.etherscan.io"],
```

### Step 8: Update Backend

**Files:**

- `backend/services/event_listener.go` lines ~111, ~116, ~122
- `backend/services/sbt.go` line ~52

Replace:

```go
// OLD
rpcURL = "https://testnet-rpc.monad.xyz"
wsURL = "wss://testnet-rpc.monad.xyz"
contractAddr = "0xC9755c1Be2c467c17679CeB5d379eF853641D846"

// NEW
rpcURL = "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
wsURL = "wss://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
contractAddr = "0xNEW_QUADRATIC_VOTING_ADDRESS"
```

Or better — set these env vars:

```bash
MONAD_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
MONAD_WS_URL=wss://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
QUADRATIC_VOTING_ADDRESS=0xNEW_QUADRATIC_VOTING_ADDRESS
CIVIC_SBT_ADDRESS=0xNEW_CIVIC_SBT_ADDRESS
```

### Step 9: Update Explorer URLs

**File:** `src/web3/utils.ts` — the explorer URL mappings at lines ~238 and ~290:

```ts
// OLD
10143: "https://testnet.monadexplorer.com"
// NEW
11155111: "https://sepolia.etherscan.io"
```

### Step 10: Test

```bash
# Frontend
npm run dev
# Connect MetaMask to Sepolia
# Check: Balance shows ETH, nonce is correct, SBT mints work
```

### Ethereum Migration Checklist

- [ ] Hardhat config updated with Ethereum network
- [ ] All 6 contracts deployed on target chain
- [ ] `addresses.json` updated with new addresses
- [ ] `.env` updated with new contract addresses
- [ ] RPC URL replaced in all 6 source files
- [ ] Chain ID replaced in all locations
- [ ] MetaMask chain params updated in wallet.ts
- [ ] Backend RPC/WS/contract addresses updated
- [ ] Explorer URLs updated
- [ ] End-to-end test passed

---

## OPTION B: Migrate to Solana

This is the **hard path**. Solana is NOT EVM-compatible. Nothing carries over except the frontend UI and backend ML model. Every smart contract must be rewritten from scratch.

### What Does NOT Change (Keep As-Is)

| Component                                      | Why                                               |
| ---------------------------------------------- | ------------------------------------------------- |
| React frontend UI (components, pages, styles)  | Framework-agnostic                                |
| ML fraud detection model (`api/predict.py`)    | Chain-agnostic — it analyzes transaction patterns |
| Backend Go server (API routes, auth, handlers) | Business logic, not chain-specific                |
| UI design, Tailwind CSS                        | Visual layer                                      |

### What MUST Be Completely Rewritten

#### 1. Smart Contracts → Solana Programs (Rust/Anchor)

Every Solidity contract becomes a Solana program written in **Rust** using the **Anchor** framework:

| Solidity Contract                          | Solana Equivalent                                                            | Effort    |
| ------------------------------------------ | ---------------------------------------------------------------------------- | --------- |
| `QuadraticVoting.sol`                      | New Anchor program with PDAs for proposals, vote accounts                    | ~3-5 days |
| `ShieldToken.sol` (ERC-20)                 | SPL Token (use `@solana/spl-token`) — almost free, use existing SPL standard | ~1 day    |
| `CivicSBT.sol` (ERC-721, non-transferable) | Metaplex NFT with frozen transfer — OR a custom PDA-based soulbound token    | ~2-3 days |
| `WalletVerifier.sol`                       | Anchor program reading SOL balance + DAO PDAs                                | ~2 days   |
| `SocialRecoveryWallet.sol`                 | Multi-sig PDA program                                                        | ~3 days   |
| `CivicGatedWallet.sol`                     | Anchor program with CPI to WalletVerifier                                    | ~1 day    |

**Total rewrite: ~12-15 days of Solana/Rust development.**

#### 2. Frontend Web3 Layer → Complete Replacement

| Current (EVM)                     | Solana Replacement                      |
| --------------------------------- | --------------------------------------- |
| `ethers.js`                       | `@solana/web3.js` + `@coral-xyz/anchor` |
| MetaMask                          | **Phantom** wallet (or Solflare)        |
| `window.ethereum`                 | `window.solana` (Phantom provider)      |
| `new JsonRpcProvider(rpc)`        | `new Connection(rpc)`                   |
| `contract.functionName()`         | `program.methods.functionName().rpc()`  |
| ERC-20 balance                    | SPL Token `getTokenAccountBalance()`    |
| Chain ID `10143`                  | Cluster: `devnet` / `mainnet-beta`      |
| Addresses: `0x...` (20 bytes hex) | Base58 public keys (e.g., `5yNh...3Kj`) |

**Files to rewrite entirely:**
| File | Why |
|------|-----|
| `src/web3/wallet.ts` | MetaMask → Phantom adapter |
| `src/web3/contract.ts` (~1100 lines) | ethers Contract → Anchor Program calls |
| `src/web3/civic/sbt.ts` (~700 lines) | ERC-721 reads → Metaplex/PDA reads |
| `src/web3/civic/auth.ts` (~500 lines) | ethers provider → Solana Connection |
| `src/web3/utils.ts` | Address format, explorer URLs |
| `src/components/WalletAnalytics.tsx` | Provider calls → Solana RPC |
| `src/components/TransactionInterceptor.tsx` | tx signing flow completely different |

#### 3. Wallet Connection

```bash
# Install
npm install @solana/web3.js @coral-xyz/anchor @solana/spl-token @solana/wallet-adapter-react @solana/wallet-adapter-phantom
```

Replace MetaMask connection with Phantom:

```ts
// OLD (EVM)
const accounts = await window.ethereum.request({
  method: "eth_requestAccounts",
});

// NEW (Solana)
const resp = await window.solana.connect();
const publicKey = resp.publicKey.toString(); // Base58 address
```

#### 4. RPC & Config

```env
# OLD (Monad)
VITE_RPC_URL=https://testnet-rpc.monad.xyz

# NEW (Solana)
VITE_RPC_URL=https://api.devnet.solana.com        # devnet
# or
VITE_RPC_URL=https://api.mainnet-beta.solana.com   # mainnet
```

No chain ID needed — Solana uses cluster names (`devnet`, `testnet`, `mainnet-beta`).

#### 5. Backend Changes

Replace Go Ethereum client calls with Solana RPC:

```go
// OLD (Go-Ethereum)
client, _ := ethclient.Dial("https://testnet-rpc.monad.xyz")

// NEW (Solana — use HTTP JSON-RPC directly or a Go Solana client)
// Option: github.com/gagliardetto/solana-go
client := rpc.New("https://api.devnet.solana.com")
```

#### 6. Transaction Signing

```ts
// OLD (EVM)
const tx = await signer.sendTransaction({ to, value, gasPrice });

// NEW (Solana)
const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: new PublicKey(recipientAddress),
    lamports: amount * LAMPORTS_PER_SOL,
  }),
);
const signature = await wallet.sendTransaction(transaction, connection);
```

#### 7. Program Deployment

```bash
# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor anchor-cli

# Create new Anchor project
anchor init neuroshield-solana
cd neuroshield-solana

# Write programs in programs/*/src/lib.rs
# Build
anchor build

# Deploy to devnet
solana config set --url devnet
anchor deploy

# The program IDs (addresses) are printed — save them
```

### Solana Migration Checklist

- [ ] Install Rust, Solana CLI, Anchor CLI
- [ ] Rewrite all 6 contracts as Anchor programs (~12-15 days)
- [ ] Deploy programs to devnet
- [ ] Replace `ethers.js` with `@solana/web3.js` + `@coral-xyz/anchor`
- [ ] Replace MetaMask with Phantom wallet adapter
- [ ] Rewrite `wallet.ts` for Phantom connection
- [ ] Rewrite `contract.ts` (~1100 lines) for Anchor program calls
- [ ] Rewrite `sbt.ts` (~700 lines) for Metaplex/PDA reads
- [ ] Rewrite `auth.ts` (~500 lines) for Solana Connection
- [ ] Update `utils.ts` for Base58 addresses + Solana explorer URLs
- [ ] Update `WalletAnalytics.tsx` for Solana RPC
- [ ] Update `TransactionInterceptor.tsx` for Solana tx signing
- [ ] Update backend Go services for Solana RPC
- [ ] Update all `.env` variables
- [ ] End-to-end test on devnet

---

## Quick Comparison

|                      | Ethereum Migration                     | Solana Migration             |
| -------------------- | -------------------------------------- | ---------------------------- |
| **Effort**           | ~1-2 hours                             | ~2-3 weeks                   |
| **Contract changes** | Zero (same Solidity)                   | Complete rewrite in Rust     |
| **Frontend changes** | Config only (RPC, chain ID, addresses) | Full web3 layer rewrite      |
| **Wallet**           | Still MetaMask                         | Switch to Phantom            |
| **Library**          | Still ethers.js                        | @solana/web3.js + Anchor     |
| **Address format**   | Same 0x... hex                         | Base58 public keys           |
| **ABI files**        | Same JSON ABIs                         | IDL files (Anchor-generated) |
| **Gas model**        | Gas price × gas used                   | Compute units + priority fee |
| **Token standard**   | ERC-20 / ERC-721                       | SPL Token / Metaplex NFT     |

---

## The One-Liner Summary

- **Ethereum:** Change 6 config values (RPC, chain ID, addresses), redeploy same contracts. Done in an afternoon.
- **Solana:** Rewrite everything below the UI layer in a different programming language. Budget 2-3 weeks.
