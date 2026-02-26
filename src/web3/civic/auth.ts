// Wallet Verification Integration for NeuroShield
// Connects to on-chain WalletVerifier + QuadraticVoting contracts for real verification
// Falls back to local heuristics when contracts unavailable

import { ethers } from "ethers";
import walletConnector from "../wallet";
import addresses from "../addresses.json";
import {
  getOnChainMetadata,
  decomposeOnChainTrustScore,
  type SBTMetadata,
} from "./sbt";

// ════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════

interface CivicPassResult {
  isValid: boolean;
  expiry?: number;
  verificationLevel?: number;
}

interface CivicProfile {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  verificationLevel: string;
  verified: boolean;
  joinedDate: Date;
}

interface TrustScoreData {
  score: number; // 0-100
  level: "High" | "Medium" | "Low";
  factors: {
    civicVerified: boolean;
    transactionHistory: {
      totalCount: number;
      successRate: number;
    };
    daoActivity: {
      votingAccuracy: number;
      participation: number;
    };
  };
}

// ════════════════════════════════════════════
// CONTRACT ABIs (minimal for reads)
// ════════════════════════════════════════════

const WALLET_VERIFIER_ABI = [
  "function computeTrustScore(address _wallet) view returns (uint256 trustScore, uint256 walletScore, uint256 daoAccuracy, uint256 daoParticipation, uint256 level)",
  "function getWalletScore(address _wallet) view returns (uint256)",
];

const QUADRATIC_VOTING_ABI = [
  "function voterAccuracy(address) view returns (uint256)",
  "function voterParticipation(address) view returns (uint256)",
  "function isScammer(address) view returns (bool)",
  "function scamScore(address) view returns (uint256)",
  "function getVoterStats(address voter) view returns (uint256 accuracy, uint256 participation)",
];

// Contract addresses (loaded from env or defaults for Monad testnet)
const WALLET_VERIFIER_ADDRESS =
  (addresses as any).walletVerifier ||
  import.meta.env.VITE_WALLET_VERIFIER_ADDRESS ||
  "";
const QUADRATIC_VOTING_ADDRESS =
  (addresses as any).quadraticVoting ||
  import.meta.env.VITE_CONTRACT_ADDRESS_MONAD ||
  "0x0000000000000000000000000000000000000000";

// ════════════════════════════════════════════
// HELPER: Get contract instances
// ════════════════════════════════════════════

const MONAD_RPC = "https://testnet-rpc.monad.xyz";

/**
 * Get a provider for READ-ONLY on-chain calls.
 * Always uses direct Monad RPC — does NOT depend on MetaMask.
 */
const getProvider = () => {
  try {
    return new ethers.JsonRpcProvider(MONAD_RPC);
  } catch {
    return null;
  }
};

const getQuadraticVotingContract = () => {
  const provider = getProvider();
  if (!provider) return null;
  try {
    return new ethers.Contract(
      QUADRATIC_VOTING_ADDRESS,
      QUADRATIC_VOTING_ABI,
      provider,
    );
  } catch {
    return null;
  }
};

const getWalletVerifierContract = () => {
  const provider = getProvider();
  if (!provider || !WALLET_VERIFIER_ADDRESS) return null;
  try {
    return new ethers.Contract(
      WALLET_VERIFIER_ADDRESS,
      WALLET_VERIFIER_ABI,
      provider,
    );
  } catch {
    return null;
  }
};

// ════════════════════════════════════════════
// LOCAL VERIFICATION CACHE
// ════════════════════════════════════════════

const VERIFICATION_CACHE_KEY = "neuroshield_civic_cache";

interface CachedVerification {
  address: string;
  isVerified: boolean;
  verificationLevel: number;
  timestamp: number;
  source: "contract" | "local";
}

const getCachedVerification = (address: string): CachedVerification | null => {
  try {
    const cache = localStorage.getItem(VERIFICATION_CACHE_KEY);
    if (!cache) return null;
    const data: CachedVerification = JSON.parse(cache);
    // Cache expires after 24 hours
    if (data.address.toLowerCase() !== address.toLowerCase()) return null;
    if (Date.now() - data.timestamp > 86400000) return null;
    return data;
  } catch {
    return null;
  }
};

const setCachedVerification = (data: CachedVerification) => {
  try {
    localStorage.setItem(VERIFICATION_CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable
  }
};

// ════════════════════════════════════════════
// CORE FUNCTIONS
// ════════════════════════════════════════════

/**
 * Verify user identity using on-chain WalletVerifier contract.
 * Reads wallet balance + DAO stats to determine verification level.
 * Falls back to local cache if contract not available.
 * @param address User's wallet address
 * @returns Verification result
 */
export const verifyCivicIdentity = async (
  address: string,
): Promise<{
  isVerified: boolean;
  verificationLevel?: number;
  expiry?: number;
  source: "contract" | "local";
}> => {
  try {
    // Try on-chain verification via WalletVerifier.computeTrustScore()
    const walletVerifier = getWalletVerifierContract();
    if (walletVerifier) {
      try {
        const result = await walletVerifier.computeTrustScore(address);
        const trustScore = Number(result[0]);
        const level = Number(result[4]);

        const isVerified = trustScore > 0;

        const verificationResult = {
          isVerified,
          verificationLevel: level,
          expiry: isVerified ? Date.now() + 86400000 : undefined,
          source: "contract" as const,
        };

        // Cache the result
        setCachedVerification({
          address,
          isVerified,
          verificationLevel: level,
          timestamp: Date.now(),
          source: "contract",
        });

        return verificationResult;
      } catch {
        // WalletVerifier call failed — try fallbacks
      }
    }

    // Fallback: check local cache
    const cached = getCachedVerification(address);
    if (cached) {
      return {
        isVerified: cached.isVerified,
        verificationLevel: cached.verificationLevel,
        expiry: cached.timestamp + 86400000,
        source: "local",
      };
    }

    // Fallback: check if user has DAO participation (proves they're active)
    const qvContract = getQuadraticVotingContract();
    if (qvContract) {
      try {
        const stats = await qvContract.getVoterStats(address);
        const participation = Number(stats.participation || 0);

        if (participation > 0) {
          const result = {
            isVerified: true,
            verificationLevel: participation >= 5 ? 2 : 1,
            expiry: Date.now() + 86400000,
            source: "local" as const,
          };
          setCachedVerification({
            address,
            isVerified: true,
            verificationLevel: result.verificationLevel,
            timestamp: Date.now(),
            source: "local",
          });
          return result;
        }
      } catch {
        // Contract call failed
      }
    }

    // Default: not verified
    return {
      isVerified: false,
      source: "local",
    };
  } catch (error) {
    console.error("Wallet verification failed:", error);
    return {
      isVerified: false,
      source: "local",
    };
  }
};

/**
 * Initialize Civic Auth client
 * Used by components that need sign-in flow
 */
export const initializeCivicAuth = async () => {
  try {
    return {
      signIn: async () => {
        if (!walletConnector.address) {
          throw new Error("Wallet not connected");
        }
        const verification = await verifyCivicIdentity(walletConnector.address);
        return {
          status: verification.isVerified ? "success" : "failed",
          data: {
            wallet: {
              address: walletConnector.address,
              publicKey: walletConnector.address,
            },
            user: {
              id: `civic-${walletConnector.address.slice(2, 10)}`,
              verified: verification.isVerified,
            },
          },
        };
      },
    };
  } catch (error) {
    console.error("Failed to initialize Civic Auth client:", error);
    throw error;
  }
};

/**
 * Create wallet through Civic embedded wallet
 */
export const createCivicWallet = async () => {
  try {
    const authClient = await initializeCivicAuth();
    const response = await authClient.signIn();

    if (response.status === "success") {
      return {
        success: true,
        wallet: response.data.wallet,
        user: response.data.user,
      };
    }
    return { success: false, error: "Verification failed" };
  } catch (error) {
    console.error("Failed to create Civic wallet:", error);
    return {
      success: false,
      error: "An error occurred during wallet creation",
    };
  }
};

/**
 * Get Civic profile for a user.
 * Pulls real data from on-chain contracts when available.
 * @param address User wallet address
 * @returns Civic profile data
 */
export const getCivicProfile = async (
  address: string,
): Promise<CivicProfile> => {
  const verification = await verifyCivicIdentity(address);
  const shortAddr = address.slice(0, 6) + "..." + address.slice(-4);

  // Try to get on-chain data
  let daoStats = { accuracy: 0, participation: 0 };
  const qvContract = getQuadraticVotingContract();
  if (qvContract) {
    try {
      const stats = await qvContract.getVoterStats(address);
      daoStats = {
        accuracy: Number(stats.accuracy || 0),
        participation: Number(stats.participation || 0),
      };
    } catch {
      // Contract call failed
    }
  }

  const levelMap: Record<number, string> = {
    0: "Unverified",
    1: "Basic",
    2: "Advanced",
    3: "Premium",
  };

  return {
    id: `civic-${address.slice(2, 10)}`,
    name: `NeuroShield User ${shortAddr}`,
    avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
    verificationLevel: levelMap[verification.verificationLevel || 0] || "Basic",
    verified: verification.isVerified,
    joinedDate: new Date(),
  };
};

/**
 * Calculate trust score based on on-chain SBT data (preferred) or live contract reads (fallback).
 *
 * Priority:
 *   1. Read from CivicSBT.getTokenMetadata() — already stored on-chain by the SBT
 *   2. If no SBT exists, compute live from WalletVerifier + QuadraticVoting
 *
 * Formula (same in both paths):
 *   +40  Wallet history (balance-based, proves real user)
 *   +30  DAO voting accuracy
 *   +30  DAO participation
 *   ────
 *   100  Permanent on-chain reputation
 *
 * @param address User wallet address
 * @returns Trust score data
 */
export const calculateTrustScore = async (
  address: string,
): Promise<TrustScoreData> => {
  // ── Path 1: Read trust score from on-chain SBT (authoritative, fastest) ──
  try {
    const sbtMetadata: SBTMetadata | null = await getOnChainMetadata(address);
    if (sbtMetadata) {
      const breakdown = decomposeOnChainTrustScore(sbtMetadata);
      const finalScore = Math.min(100, breakdown.total);
      let level: "High" | "Medium" | "Low";
      if (finalScore >= 70) level = "High";
      else if (finalScore >= 40) level = "Medium";
      else level = "Low";

      return {
        score: finalScore,
        level,
        factors: {
          civicVerified: sbtMetadata.verificationLevel > 0,
          transactionHistory: {
            totalCount: 0,
            successRate: finalScore > 0 ? 0.95 : 0,
          },
          daoActivity: {
            votingAccuracy: sbtMetadata.votingAccuracy,
            participation: sbtMetadata.doiParticipation,
          },
        },
      };
    }
  } catch {
    // SBT not available — fall through to live computation
  }

  // ── Path 2: Compute live from WalletVerifier (no SBT minted yet) ──

  // Try WalletVerifier.computeTrustScore() first (single eth_call)
  const walletVerifier = getWalletVerifierContract();
  if (walletVerifier) {
    try {
      const result = await walletVerifier.computeTrustScore(address);
      const trustScore = Number(result[0]);
      const level_num = Number(result[4]);

      let level: "High" | "Medium" | "Low";
      if (trustScore >= 70) level = "High";
      else if (trustScore >= 40) level = "Medium";
      else level = "Low";

      return {
        score: trustScore,
        level,
        factors: {
          civicVerified: level_num > 0,
          transactionHistory: {
            totalCount: 0,
            successRate: trustScore > 0 ? 0.95 : 0,
          },
          daoActivity: {
            votingAccuracy: Number(result[2]),
            participation: Number(result[3]),
          },
        },
      };
    } catch {
      // Fall through to manual computation
    }
  }

  // Fallback: manual computation from individual contracts
  const verification = await verifyCivicIdentity(address);
  const isVerified = verification.isVerified;

  let daoActivity = { votingAccuracy: 0, participation: 0 };
  const qvContract = getQuadraticVotingContract();
  if (qvContract) {
    try {
      const stats = await qvContract.getVoterStats(address);
      daoActivity = {
        votingAccuracy: Number(stats.accuracy || 0),
        participation: Number(stats.participation || 0),
      };
    } catch {
      // Contract not available
    }
  }

  // Get balance as proxy for wallet history
  let walletScore = 0;
  const provider = getProvider();
  if (provider) {
    try {
      const bal = await provider.getBalance(address);
      if (bal > ethers.parseEther("5")) walletScore = 40;
      else if (bal > ethers.parseEther("1")) walletScore = 30;
      else if (bal > ethers.parseEther("0.1")) walletScore = 20;
      else if (bal > ethers.parseEther("0.01")) walletScore = 10;
      else if (bal > 0n) walletScore = 5;
    } catch {
      // Provider error
    }
  }

  // Calculate trust score
  let baseScore = walletScore;

  // +30 for DAO voting accuracy (scale 0-100 → 0-30)
  baseScore += Math.min(
    30,
    Math.floor((daoActivity.votingAccuracy * 30) / 100),
  );

  // +30 for DAO participation (1 vote = 6 pts, max 30)
  baseScore += Math.min(30, daoActivity.participation * 6);

  const finalScore = Math.min(100, baseScore);

  let level: "High" | "Medium" | "Low";
  if (finalScore >= 70) level = "High";
  else if (finalScore >= 40) level = "Medium";
  else level = "Low";

  return {
    score: finalScore,
    level,
    factors: {
      civicVerified: isVerified,
      transactionHistory: {
        totalCount: 0,
        successRate: walletScore > 0 ? 0.95 : 0,
      },
      daoActivity,
    },
  };
};
