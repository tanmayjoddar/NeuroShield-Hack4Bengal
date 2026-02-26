/**
 * Soulbound Token (SBT) Service — Production Implementation
 *
 * Reads/writes CivicSBT contract on Monad testnet.
 * The SBT permanently encodes on-chain reputation:
 *   +40  Civic verification (are you a verified human?)
 *   +20  Transaction history (do you have on-chain activity?)
 *   +20  DAO voting accuracy (do you vote correctly?)
 *   +20  DAO participation (do you actually show up?)
 *   ────
 *   100  Permanent on-chain reputation score
 *
 * Key properties:
 *   - Non-transferable (soulbound) — your reputation can't be bought or sold
 *   - Fully on-chain Base64 JSON metadata — works if every server goes offline
 *   - Authorized updaters only (CivicVerifier, admin) — no one else can modify
 */

import { ethers, Contract, BrowserProvider, JsonRpcProvider } from "ethers";
import CivicSBTABI from "../abi/CivicSBT.json";
import CivicVerifierABI from "../abi/CivicVerifier.json";
import walletConnector from "../wallet";

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
  civicVerification: number; // max 40
  transactionHistory: number; // max 20
  votingAccuracy: number; // max 20
  daoParticipation: number; // max 20
  total: number; // max 100
}

export type VerificationLevel = "Unverified" | "Basic" | "Advanced" | "Premium";

// ════════════════════════════════════════════
// CONTRACT ADDRESSES
// ════════════════════════════════════════════

const CIVIC_SBT_ADDRESS = import.meta.env.VITE_CIVIC_SBT_ADDRESS || "";
const CIVIC_VERIFIER_ADDRESS =
  import.meta.env.VITE_CIVIC_VERIFIER_ADDRESS || "";
const MONAD_RPC = "https://testnet-rpc.monad.xyz";

// QuadraticVoting ABI (voter stats only)
const QV_ABI = [
  "function getVoterStats(address voter) view returns (uint256 accuracy, uint256 participation)",
  "function voterAccuracy(address) view returns (uint256)",
  "function voterParticipation(address) view returns (uint256)",
];
const QV_ADDRESS = "0x7A791fe5A35131B7d98f854a64E7f94180F27C7b";

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

const getReadProvider = (): JsonRpcProvider | BrowserProvider | null => {
  // Prefer the wallet provider for consistency, fall back to direct RPC
  if (walletConnector.provider) return walletConnector.provider;
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

const getVerifierContract = (
  signerOrProvider?: ethers.ContractRunner | null,
): Contract | null => {
  const runner = signerOrProvider || getReadProvider();
  if (!runner || !CIVIC_VERIFIER_ADDRESS) return null;
  try {
    return new Contract(CIVIC_VERIFIER_ADDRESS, CivicVerifierABI.abi, runner);
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
 * Mint a new SBT for the connected wallet by registering verification
 * through the CivicVerifier contract.
 *
 * Flow: User → CivicVerifier.registerVerification() → CivicSBT.mint()
 *
 * The CivicVerifier checks that the user has a valid Civic Pass,
 * then calls CivicSBT.mint() as an authorized updater.
 */
export const mintSBT = async (params: {
  verificationLevel: number;
  trustScore: number;
  votingAccuracy: number;
  doiParticipation: number;
}): Promise<{ success: boolean; txHash?: string; error?: string }> => {
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
        error: "You already have a Soulbound Token. Use updateSBT() instead.",
      };
    }

    const verifier = getVerifierContract(walletConnector.signer);
    if (!verifier) {
      return {
        success: false,
        error:
          "CivicVerifier contract not configured. Set VITE_CIVIC_VERIFIER_ADDRESS.",
      };
    }

    // Call registerVerification — this checks Civic Pass validity then mints SBT
    const tx = await verifier.registerVerification(
      userAddress,
      params.verificationLevel,
      params.trustScore,
      params.votingAccuracy,
      params.doiParticipation,
    );

    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  } catch (err: any) {
    console.error("[SBT] mintSBT failed:", err);

    // Parse common revert reasons
    const reason = err?.reason || err?.message || "Unknown error";
    if (reason.includes("Sender not verified")) {
      return {
        success: false,
        error: "You need a valid Civic Pass before minting an SBT.",
      };
    }
    if (reason.includes("already has an SBT")) {
      return { success: false, error: "You already have a Soulbound Token." };
    }
    return { success: false, error: reason };
  }
};

/**
 * Update the metadata on an existing SBT.
 * Called through CivicVerifier.registerVerification() which delegates to CivicSBT.updateMetadata().
 */
export const updateSBT = async (params: {
  verificationLevel: number;
  trustScore: number;
  votingAccuracy: number;
  doiParticipation: number;
}): Promise<{ success: boolean; txHash?: string; error?: string }> => {
  try {
    if (!walletConnector.signer) {
      return { success: false, error: "Wallet not connected." };
    }

    const userAddress = await walletConnector.signer.getAddress();

    const existing = await hasSBT(userAddress);
    if (!existing) {
      return { success: false, error: "No SBT found. Mint one first." };
    }

    const verifier = getVerifierContract(walletConnector.signer);
    if (!verifier) {
      return {
        success: false,
        error: "CivicVerifier contract not configured.",
      };
    }

    const tx = await verifier.registerVerification(
      userAddress,
      params.verificationLevel,
      params.trustScore,
      params.votingAccuracy,
      params.doiParticipation,
    );

    const receipt = await tx.wait();
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
 * Decompose an on-chain SBT trust score into its 4 bar values.
 *
 * All inputs come from on-chain contract storage (via getTokenMetadata eth_call):
 *   - metadata.verificationLevel  → stored on-chain, determines civic bar (0 or 40)
 *   - metadata.votingAccuracy      → stored on-chain (0-100%), scaled to bar (0-20)
 *   - metadata.doiParticipation    → stored on-chain (vote count), scaled to bar (0-20)
 *   - metadata.trustScore          → stored on-chain (the total), tx bar = remainder
 *
 * This is a deterministic, pure function: identical on-chain inputs always produce
 * identical bar values. Anyone can verify by reading getTokenMetadata() and applying
 * the same formula. The contract uses the same weights during mint/update.
 */
export const decomposeOnChainTrustScore = (
  metadata: SBTMetadata,
): TrustBreakdown => {
  // Each component is derived from a specific on-chain field:
  const civic = metadata.verificationLevel > 0 ? 40 : 0; // on-chain: verificationLevel
  const accuracy = Math.min(20, Math.floor(metadata.votingAccuracy * 0.2)); // on-chain: votingAccuracy (0-100%)
  const participation = Math.min(20, metadata.doiParticipation * 2); // on-chain: doiParticipation (count)
  // Transaction history is not stored separately — derive from the on-chain total:
  const txHistory = Math.min(
    20,
    Math.max(0, metadata.trustScore - civic - accuracy - participation),
  );

  return {
    civicVerification: civic,
    transactionHistory: txHistory,
    votingAccuracy: accuracy,
    daoParticipation: participation,
    total: metadata.trustScore,
  };
};

/**
 * Compute a fresh trust score from LIVE on-chain data.
 * This is the real-time version that reads CivicVerifier + QuadraticVoting + provider.
 *
 * Formula:
 *   +40  Are you a verified human? (Civic Pass valid)
 *   +20  Do you have transaction history? (min(20, floor(txCount/5)))
 *   +20  Do you vote correctly in the DAO? (floor(accuracy * 0.2))
 *   +20  Do you actually participate? (min(20, participation * 2))
 *   ────
 *   100  Maximum possible trust score
 */
export const computeLiveTrustScore = async (
  address: string,
): Promise<TrustBreakdown> => {
  // Run all reads in parallel
  const [civicData, daoData, txCount] = await Promise.allSettled([
    // 1. Check civic verification
    (async () => {
      const verifier = getVerifierContract();
      if (!verifier) return { isVerified: false, level: 0 };
      try {
        const verified = await verifier.isVerified(address);
        const level = await verifier.getVerificationLevel(address);
        console.log(
          `[SBT] eth_call isVerified(${address}) → ${verified}  |  contract: ${CIVIC_VERIFIER_ADDRESS}`,
        );
        return { isVerified: Boolean(verified), level: Number(level) };
      } catch {
        return { isVerified: false, level: 0 };
      }
    })(),

    // 2. Check DAO stats
    (async () => {
      const qv = getQVContract();
      if (!qv) return { accuracy: 0, participation: 0 };
      try {
        const stats = await qv.getVoterStats(address);
        console.log(
          `[SBT] eth_call getVoterStats(${address}) → accuracy=${stats[0]}, participation=${stats[1]}  |  contract: ${QV_ADDRESS}`,
        );
        return {
          accuracy: Number(stats.accuracy || stats[0] || 0),
          participation: Number(stats.participation || stats[1] || 0),
        };
      } catch {
        return { accuracy: 0, participation: 0 };
      }
    })(),

    // 3. Get transaction count
    (async () => {
      const provider = getReadProvider();
      if (!provider) return 0;
      try {
        return await provider.getTransactionCount(address);
      } catch {
        return 0;
      }
    })(),
  ]);

  // Extract values (Promise.allSettled always returns)
  const civic =
    civicData.status === "fulfilled"
      ? civicData.value
      : { isVerified: false, level: 0 };
  const dao =
    daoData.status === "fulfilled"
      ? daoData.value
      : { accuracy: 0, participation: 0 };
  const txn = txCount.status === "fulfilled" ? txCount.value : 0;

  // Compute each component
  const civicScore = civic.isVerified ? 40 : 0;
  const txScore = Math.min(20, Math.floor(txn / 5));
  const accuracyScore = Math.min(20, Math.floor(dao.accuracy * 0.2));
  const participationScore = Math.min(20, dao.participation * 2);
  const total = Math.min(
    100,
    civicScore + txScore + accuracyScore + participationScore,
  );

  return {
    civicVerification: civicScore,
    transactionHistory: txScore,
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
 * Used when computing the parameters for mintSBT / updateSBT.
 */
export const determineVerificationLevel = async (
  address: string,
  hasCivicPass: boolean,
): Promise<{
  level: number;
  trustScore: number;
  accuracy: number;
  participation: number;
}> => {
  const breakdown = await computeLiveTrustScore(address);

  let level = 0;
  if (hasCivicPass) {
    // Base level from Civic Pass
    level = 1;
    // Promote based on DAO activity
    if (breakdown.daoParticipation >= 10 && breakdown.votingAccuracy >= 16) {
      level = 3; // Premium: 5+ votes AND >80% accuracy
    } else if (breakdown.daoParticipation >= 4) {
      level = 2; // Advanced: 2+ DAO votes
    }
  }

  return {
    level,
    trustScore: breakdown.total,
    accuracy: Math.min(100, Math.floor(breakdown.votingAccuracy / 0.2)),
    participation: Math.floor(breakdown.daoParticipation / 2),
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
