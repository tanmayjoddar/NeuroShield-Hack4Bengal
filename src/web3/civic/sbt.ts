/**
 * Soulbound Token (SBT) Service — Production Implementation
 *
 * Reads/writes CivicSBT contract on Monad testnet.
 * The SBT permanently encodes on-chain reputation:
 *   +40  Wallet history (do you have real funds on-chain?)
 *   +30  DAO voting accuracy (do you vote correctly?)
 *   +30  DAO participation (do you actually show up?)
 *   ────
 *   100  Permanent on-chain reputation score
 *
 * Key properties:
 *   - Non-transferable (soulbound) — your reputation can't be bought or sold
 *   - Fully on-chain Base64 JSON metadata — works if every server goes offline
 *   - Authorized updaters only (WalletVerifier, admin) — no one else can modify
 *   - No external dependencies — every number from a real eth_call
 */

import { ethers, Contract, BrowserProvider, JsonRpcProvider } from "ethers";
import CivicSBTABI from "../abi/CivicSBT.json";
import WalletVerifierABI from "../abi/WalletVerifier.json";
import walletConnector from "../wallet";
import addresses from "../addresses.json";

// ════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════

export interface SBTMetadata {
  issuedAt: number; // Unix timestamp of mint
  verificationLevel: number; // 1 = Basic, 2 = Advanced, 3 = Premium
  trustScore: number; // 0-100
  votingAccuracy: number; // 0-100
  doiParticipation: number; // Total DAO votes cast
}

export interface SBTProfile {
  hasSBT: boolean;
  tokenId?: number;
  metadata?: SBTMetadata;
  tokenURI?: string; // data:application/json;base64,... (fully on-chain)
  decodedURI?: SBTTokenURIData;
  trustBreakdown?: TrustBreakdown;
}

export interface SBTTokenURIData {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

export interface TrustBreakdown {
  walletHistory: number; // max 40
  votingAccuracy: number; // max 30
  daoParticipation: number; // max 30
  total: number; // max 100
}

export type VerificationLevel = "Unverified" | "Basic" | "Advanced" | "Premium";

// ════════════════════════════════════════════
// CONTRACT ADDRESSES
// ════════════════════════════════════════════

const CIVIC_SBT_ADDRESS = import.meta.env.VITE_CIVIC_SBT_ADDRESS || "";
const WALLET_VERIFIER_ADDRESS =
  (addresses as any).walletVerifier ||
  import.meta.env.VITE_WALLET_VERIFIER_ADDRESS ||
  "";
const MONAD_RPC = "https://testnet-rpc.monad.xyz";

// QuadraticVoting ABI (voter stats only)
const QV_ABI = [
  "function getVoterStats(address voter) view returns (uint256 accuracy, uint256 participation)",
  "function voterAccuracy(address) view returns (uint256)",
  "function voterParticipation(address) view returns (uint256)",
];
const QV_ADDRESS =
  (addresses as any).quadraticVoting ||
  import.meta.env.VITE_CONTRACT_ADDRESS_MONAD ||
  "0x0000000000000000000000000000000000000000"; // loaded from addresses.json after deploy

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

/**
 * Get a provider for READ-ONLY on-chain calls.
 * Always uses the direct Monad RPC — does NOT depend on MetaMask being connected
 * or being on the right chain. This ensures trust score reads always work.
 */
const getReadProvider = (): JsonRpcProvider | null => {
  try {
    return new JsonRpcProvider(MONAD_RPC);
  } catch {
    return null;
  }
};

const getSBTContract = (
  provider?: ethers.ContractRunner | null,
): Contract | null => {
  const runner = provider || getReadProvider();
  if (!runner || !CIVIC_SBT_ADDRESS) return null;
  try {
    return new Contract(CIVIC_SBT_ADDRESS, CivicSBTABI.abi, runner);
  } catch {
    return null;
  }
};

const getWalletVerifierContract = (
  signerOrProvider?: ethers.ContractRunner | null,
): Contract | null => {
  const runner = signerOrProvider || getReadProvider();
  if (!runner || !WALLET_VERIFIER_ADDRESS) return null;
  try {
    return new Contract(WALLET_VERIFIER_ADDRESS, WalletVerifierABI, runner);
  } catch {
    return null;
  }
};

const getQVContract = (): Contract | null => {
  const provider = getReadProvider();
  if (!provider) return null;
  try {
    return new Contract(QV_ADDRESS, QV_ABI, provider);
  } catch {
    return null;
  }
};

// ════════════════════════════════════════════
// READ: On-Chain SBT Data
// ════════════════════════════════════════════

/**
 * Check if an address has a Soulbound Token minted.
 */
export const hasSBT = async (address: string): Promise<boolean> => {
  const sbt = getSBTContract();
  if (!sbt) return false;
  try {
    const result = Boolean(await sbt.hasSBT(address));
    console.log(
      `[SBT] eth_call hasSBT(${address}) → ${result}  |  contract: ${CIVIC_SBT_ADDRESS}`,
    );
    return result;
  } catch (err) {
    console.warn("[SBT] hasSBT call failed:", err);
    return false;
  }
};

/**
 * Read the full on-chain SBT metadata for an address.
 * Returns null if the address has no SBT.
 */
export const getOnChainMetadata = async (
  address: string,
): Promise<SBTMetadata | null> => {
  const sbt = getSBTContract();
  if (!sbt) return null;

  try {
    const has = await sbt.hasSBT(address);
    if (!has) return null;

    const raw = await sbt.getTokenMetadata(address);
    const metadata = {
      issuedAt: Number(raw.issuedAt),
      verificationLevel: Number(raw.verificationLevel),
      trustScore: Number(raw.trustScore),
      votingAccuracy: Number(raw.votingAccuracy),
      doiParticipation: Number(raw.doiParticipation),
    };
    console.log(
      `[SBT] eth_call getTokenMetadata(${address}) →`,
      metadata,
      ` |  contract: ${CIVIC_SBT_ADDRESS}`,
    );
    return metadata;
  } catch (err) {
    console.warn("[SBT] getTokenMetadata failed:", err);
    return null;
  }
};

/**
 * Read the on-chain token URI (Base64-encoded JSON stored directly in the contract).
 *
 * This calls the REAL tokenURI(tokenId) via eth_call — not a local reconstruction.
 * The contract's generateTokenURI() encodes metadata as Base64 JSON and stores it
 * via _setTokenURI(), so tokenURI() returns the actual on-chain value.
 *
 * Visible in browser DevTools Network tab as an eth_call to the SBT contract.
 */
export const getOnChainTokenURI = async (
  address: string,
): Promise<{
  raw: string;
  decoded: SBTTokenURIData;
  tokenId: number;
} | null> => {
  const sbt = getSBTContract();
  if (!sbt) return null;

  try {
    const has = await sbt.hasSBT(address);
    if (!has) return null;

    // ── Resolve tokenId ──
    // Try getTokenIdForAddress(address) first (new contract with public getter).
    // Fallback: query SBTMinted event logs (works with any deployment).
    let tokenId: number | null = null;

    try {
      const id = await sbt.getTokenIdForAddress(address);
      tokenId = Number(id);
    } catch {
      // Fallback: scan SBTMinted events for this address (chunked for Monad's 1000-block limit)
      try {
        const filter = sbt.filters.SBTMinted(address);
        const provider = getReadProvider();
        if (provider) {
          const latestBlock = await provider.getBlockNumber();
          const CHUNK = 999;
          const startBlock = Math.max(0, latestBlock - 5000);
          for (let from = startBlock; from <= latestBlock; from += CHUNK + 1) {
            const to = Math.min(from + CHUNK, latestBlock);
            try {
              const events = await sbt.queryFilter(filter, from, to);
              if (events.length > 0) {
                const event = events[events.length - 1];
                const args = (event as any).args;
                tokenId = Number(args?.tokenId ?? args?.[1]);
                break;
              }
            } catch {
              // chunk failed, continue
            }
          }
        }
      } catch (evtErr) {
        console.warn("[SBT] Event log fallback failed:", evtErr);
      }
    }

    if (tokenId === null) {
      console.warn("[SBT] Could not resolve tokenId for:", address);
      return null;
    }

    // ── Call the REAL on-chain tokenURI(uint256) — this is a genuine eth_call ──
    const onChainURI: string = await sbt.tokenURI(tokenId);
    console.log(
      `[SBT] eth_call tokenURI(${tokenId}) → ${onChainURI.slice(0, 60)}...  |  contract: ${CIVIC_SBT_ADDRESS}`,
    );

    // ── Decode the Base64 JSON returned by the contract ──
    let decoded: SBTTokenURIData;
    try {
      const BASE64_PREFIX = "data:application/json;base64,";
      const base64Data = onChainURI.startsWith(BASE64_PREFIX)
        ? onChainURI.slice(BASE64_PREFIX.length)
        : onChainURI;
      const jsonStr = atob(base64Data);
      decoded = JSON.parse(jsonStr);
    } catch {
      decoded = {
        name: `Civic Soulbound Token #${tokenId}`,
        description: "Non-transferable on-chain reputation token",
        image: "",
        attributes: [],
      };
    }

    return { raw: onChainURI, decoded, tokenId };
  } catch (err) {
    console.warn("[SBT] getOnChainTokenURI failed:", err);
    return null;
  }
};

// ════════════════════════════════════════════
// READ: Full SBT Profile
// ════════════════════════════════════════════

/**
 * Get the complete SBT profile for an address.
 * Includes on-chain metadata, trust breakdown, and decoded token URI.
 */
export const getSBTProfile = async (address: string): Promise<SBTProfile> => {
  try {
    const [hasToken, metadata, tokenURI] = await Promise.all([
      hasSBT(address),
      getOnChainMetadata(address),
      getOnChainTokenURI(address),
    ]);

    if (!hasToken || !metadata) {
      return { hasSBT: false };
    }

    return {
      hasSBT: true,
      tokenId: tokenURI?.tokenId,
      metadata,
      tokenURI: tokenURI?.raw,
      decodedURI: tokenURI?.decoded,
      trustBreakdown: decomposeOnChainTrustScore(metadata),
    };
  } catch (err) {
    console.error("[SBT] getSBTProfile failed:", err);
    return { hasSBT: false };
  }
};

// ════════════════════════════════════════════
// WRITE: Mint / Update SBT
// ════════════════════════════════════════════

/**
 * Mint a new SBT for the connected wallet via WalletVerifier.
 *
 * Flow: User → WalletVerifier.mintSBT() → CivicSBT.mint()
 *
 * The WalletVerifier computes trust score entirely on-chain:
 *   - Wallet balance (proxy for activity) → 0-40 pts
 *   - QuadraticVoting.voterAccuracy() → 0-30 pts
 *   - QuadraticVoting.voterParticipation() → 0-30 pts
 *
 * No external services, no mock contracts. Every number traceable.
 */
export const mintSBT = async (): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> => {
  try {
    if (!walletConnector.signer) {
      return {
        success: false,
        error: "Wallet not connected. Please connect your wallet first.",
      };
    }

    const userAddress = await walletConnector.signer.getAddress();

    // Check if user already has an SBT
    const existing = await hasSBT(userAddress);
    if (existing) {
      return {
        success: false,
        error: "You already have a Soulbound Token. Use refreshSBT() instead.",
      };
    }

    const verifier = getWalletVerifierContract(walletConnector.signer);
    if (!verifier) {
      return {
        success: false,
        error:
          "WalletVerifier contract not configured. Set VITE_WALLET_VERIFIER_ADDRESS.",
      };
    }

    // Call mintSBT() — score is computed entirely on-chain
    console.log(
      `[SBT] Calling WalletVerifier.mintSBT()  |  contract: ${WALLET_VERIFIER_ADDRESS}`,
    );
    const tx = await verifier.mintSBT();

    const receipt = await tx.wait();
    console.log(`[SBT] ✅ SBT minted on-chain  |  tx: ${receipt.hash}`);
    return { success: true, txHash: receipt.hash };
  } catch (err: any) {
    console.error("[SBT] mintSBT failed:", err);

    // Parse common revert reasons
    const reason = err?.reason || err?.message || "Unknown error";
    if (reason.includes("Already has SBT")) {
      return { success: false, error: "You already have a Soulbound Token." };
    }
    return { success: false, error: reason };
  }
};

/**
 * Refresh an existing SBT with latest on-chain data via WalletVerifier.
 *
 * Flow: User → WalletVerifier.refreshSBT() → CivicSBT.updateMetadata()
 *
 * Re-reads wallet balance and DAO stats, recomputes score on-chain.
 */
export const updateSBT = async (): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> => {
  try {
    if (!walletConnector.signer) {
      return { success: false, error: "Wallet not connected." };
    }

    const userAddress = await walletConnector.signer.getAddress();

    const existing = await hasSBT(userAddress);
    if (!existing) {
      return { success: false, error: "No SBT found. Mint one first." };
    }

    const verifier = getWalletVerifierContract(walletConnector.signer);
    if (!verifier) {
      return {
        success: false,
        error: "WalletVerifier contract not configured.",
      };
    }

    console.log(
      `[SBT] Calling WalletVerifier.refreshSBT()  |  contract: ${WALLET_VERIFIER_ADDRESS}`,
    );
    const tx = await verifier.refreshSBT();

    const receipt = await tx.wait();
    console.log(`[SBT] ✅ SBT refreshed on-chain  |  tx: ${receipt.hash}`);
    return { success: true, txHash: receipt.hash };
  } catch (err: any) {
    console.error("[SBT] updateSBT failed:", err);
    return {
      success: false,
      error: err?.reason || err?.message || "Update failed",
    };
  }
};

// ════════════════════════════════════════════
// TRUST SCORE: Compute from Live On-Chain Data
// ════════════════════════════════════════════

/**
 * Decompose an on-chain SBT trust score into its bar values.
 *
 * New formula (WalletVerifier):
 *   +40  Wallet history (balance-based) → walletHistory bar
 *   +30  DAO voting accuracy → votingAccuracy bar
 *   +30  DAO participation → daoParticipation bar
 *
 * All inputs come from on-chain contract storage (via getTokenMetadata eth_call).
 */
export const decomposeOnChainTrustScore = (
  metadata: SBTMetadata,
): TrustBreakdown => {
  // DAO accuracy: stored on-chain as raw 0-100, contract scales to 0-30
  const accuracy = Math.min(
    30,
    Math.floor((metadata.votingAccuracy * 30) / 100),
  );
  // DAO participation: stored on-chain as vote count, contract scales 1 vote = 6 pts (max 30)
  const participation = Math.min(30, metadata.doiParticipation * 6);
  // Wallet history: derive from total minus DAO components
  const walletHistory = Math.min(
    40,
    Math.max(0, metadata.trustScore - accuracy - participation),
  );

  return {
    walletHistory,
    votingAccuracy: accuracy,
    daoParticipation: participation,
    total: metadata.trustScore,
  };
};

/**
 * Compute a fresh trust score from LIVE on-chain data.
 * Reads WalletVerifier.computeTrustScore() which returns all components.
 *
 * Formula (all on-chain, same as the contract):
 *   +40  Wallet history (balance-based, proves real user)
 *   +30  DAO voting accuracy (from QuadraticVoting.voterAccuracy)
 *   +30  DAO participation (from QuadraticVoting.voterParticipation)
 *   ────
 *   100  Maximum possible trust score
 */
export const computeLiveTrustScore = async (
  address: string,
): Promise<TrustBreakdown> => {
  // Try reading directly from WalletVerifier.computeTrustScore() — single eth_call
  try {
    const verifier = getWalletVerifierContract();
    if (verifier) {
      const result = await verifier.computeTrustScore(address);
      const trustScore = Number(result[0]);
      const walletScore = Number(result[1]);
      const daoAccuracy = Number(result[2]);
      const daoParticipation = Number(result[3]);

      console.log(
        `[SBT] eth_call computeTrustScore(${address}) → total=${trustScore}, wallet=${walletScore}, acc=${daoAccuracy}, part=${daoParticipation}  |  contract: ${WALLET_VERIFIER_ADDRESS}`,
      );

      return {
        walletHistory: walletScore,
        votingAccuracy: daoAccuracy,
        daoParticipation: daoParticipation,
        total: trustScore,
      };
    }
  } catch (err) {
    console.warn(
      "[SBT] WalletVerifier.computeTrustScore failed, falling back:",
      err,
    );
  }

  // Fallback: read individual components
  const [daoData, balance] = await Promise.allSettled([
    // DAO stats from QuadraticVoting
    (async () => {
      const qv = getQVContract();
      if (!qv) return { accuracy: 0, participation: 0 };
      try {
        const [acc, part] = await Promise.all([
          qv.voterAccuracy(address),
          qv.voterParticipation(address),
        ]);
        console.log(
          `[SBT] eth_call voterAccuracy(${address}) → ${acc}, voterParticipation → ${part}  |  contract: ${QV_ADDRESS}`,
        );
        return { accuracy: Number(acc), participation: Number(part) };
      } catch {
        return { accuracy: 0, participation: 0 };
      }
    })(),

    // Wallet balance
    (async () => {
      const provider = getReadProvider();
      if (!provider) return 0n;
      try {
        return await provider.getBalance(address);
      } catch {
        return 0n;
      }
    })(),
  ]);

  const dao =
    daoData.status === "fulfilled"
      ? daoData.value
      : { accuracy: 0, participation: 0 };
  const bal = balance.status === "fulfilled" ? balance.value : 0n;

  // Compute wallet score (same thresholds as contract)
  let walletScore = 0;
  const balBigInt = typeof bal === "bigint" ? bal : BigInt(0);
  if (balBigInt > ethers.parseEther("5")) walletScore = 40;
  else if (balBigInt > ethers.parseEther("1")) walletScore = 30;
  else if (balBigInt > ethers.parseEther("0.1")) walletScore = 20;
  else if (balBigInt > ethers.parseEther("0.01")) walletScore = 10;
  else if (balBigInt > 0n) walletScore = 5;

  // DAO accuracy: raw 0-100 → scaled to 0-30
  const accuracyScore = Math.min(30, Math.floor((dao.accuracy * 30) / 100));
  // DAO participation: 1 vote = 6 pts, max 30
  const participationScore = Math.min(30, dao.participation * 6);

  const total = Math.min(100, walletScore + accuracyScore + participationScore);

  return {
    walletHistory: walletScore,
    votingAccuracy: accuracyScore,
    daoParticipation: participationScore,
    total,
  };
};

// ════════════════════════════════════════════
// VERIFICATION LEVEL HELPERS
// ════════════════════════════════════════════

export const levelToString = (level: number): VerificationLevel => {
  switch (level) {
    case 1:
      return "Basic";
    case 2:
      return "Advanced";
    case 3:
      return "Premium";
    default:
      return "Unverified";
  }
};

export const levelToColor = (level: number): string => {
  switch (level) {
    case 1:
      return "#3b82f6"; // blue
    case 2:
      return "#8b5cf6"; // purple
    case 3:
      return "#f59e0b"; // gold
    default:
      return "#6b7280"; // gray
  }
};

/**
 * Determine what verification level a user should get based on their on-chain activity.
 * Score is computed on-chain by WalletVerifier — this is just a preview read.
 */
export const determineVerificationLevel = async (
  address: string,
): Promise<{
  level: number;
  trustScore: number;
  accuracy: number;
  participation: number;
}> => {
  // Try reading directly from WalletVerifier (most accurate)
  const verifier = getWalletVerifierContract();
  if (verifier) {
    try {
      const result = await verifier.computeTrustScore(address);
      return {
        level: Number(result[4]), // level
        trustScore: Number(result[0]), // trustScore
        accuracy: Number(result[2]), // daoAccuracy (already scaled 0-30)
        participation: Number(result[3]), // daoParticipation (already scaled 0-30)
      };
    } catch {
      // fallback below
    }
  }

  // Fallback: compute from live data
  const breakdown = await computeLiveTrustScore(address);

  let level = 0;
  if (breakdown.total >= 70)
    level = 3; // Premium
  else if (breakdown.total >= 40)
    level = 2; // Advanced
  else if (breakdown.total > 0) level = 1; // Basic

  return {
    level,
    trustScore: breakdown.total,
    accuracy: breakdown.votingAccuracy,
    participation: breakdown.daoParticipation,
  };
};

// ════════════════════════════════════════════
// EVENT LISTENERS
// ════════════════════════════════════════════

/**
 * Listen for SBTMinted events on-chain.
 * Returns a cleanup function to stop listening.
 */
export const onSBTMinted = (
  callback: (to: string, tokenId: number) => void,
): (() => void) => {
  const sbt = getSBTContract();
  if (!sbt) return () => {};

  const handler = (to: string, tokenId: bigint) => {
    callback(to, Number(tokenId));
  };

  sbt.on("SBTMinted", handler);
  return () => {
    sbt.off("SBTMinted", handler);
  };
};

/**
 * Listen for MetadataUpdated events on-chain.
 */
export const onMetadataUpdated = (
  callback: (tokenId: number, newUri: string) => void,
): (() => void) => {
  const sbt = getSBTContract();
  if (!sbt) return () => {};

  const handler = (tokenId: bigint, newUri: string) => {
    callback(Number(tokenId), newUri);
  };

  sbt.on("MetadataUpdated", handler);
  return () => {
    sbt.off("MetadataUpdated", handler);
  };
};
