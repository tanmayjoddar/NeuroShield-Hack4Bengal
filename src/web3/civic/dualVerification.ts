/**
 * Dual-Layer AI + Community Defense System
 * ═══════════════════════════════════════════
 *
 * Layer 1 (Instant): ML model analyzes transaction features in real-time
 * Layer 2 (Long-term): DAO community curates scam database via quadratic voting
 *
 * THE FLYWHEEL:
 *   1. ML flags suspicious transaction → user warned immediately
 *   2. If user proceeds, transaction is logged for community review
 *   3. Community votes on flagged addresses via QuadraticVoting DAO
 *   4. DAO-confirmed scams are added to on-chain scam database
 *   5. On-chain scam data feeds BACK into ML scoring (dual-layer boost)
 *   6. ML becomes more accurate over time → better warnings → cycle repeats
 *
 * This creates a self-improving defense system that gets stronger with use.
 */

import { verifyCivicIdentity, calculateTrustScore } from "./auth";
import { ethers } from "ethers";
import walletConnector from "../wallet";
import contractService from "../contract";
import { buildWalletFeatures } from "@/services/walletFeatures";

// ════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════

interface TransactionData {
  from: string;
  to: string;
  value: string; // ETH value
  data?: string; // Calldata
  gasPrice?: string;
  isContractInteraction?: boolean;
}

interface MLResult {
  isSafe: boolean;
  riskScore: number; // 0-100
  prediction: string; // "Fraud" | "Suspicious" | "Safe"
  warnings: string[];
  details: Record<string, any>;
}

interface DAOResult {
  isKnownScam: boolean;
  scamScore: number; // 0-100 from on-chain
  activeProposals: number;
  communityVerdict: "confirmed_scam" | "under_review" | "cleared" | "unknown";
}

interface DualLayerResult {
  // Individual layer results
  mlResult: MLResult;
  daoResult: DAOResult;
  civicVerified: boolean;
  trustScore: number;

  // Combined assessment
  combinedRiskScore: number; // 0-100 (weighted combination)
  combinedSafe: boolean;
  riskLevel: "critical" | "high" | "medium" | "low" | "safe";

  // User-facing
  recommendation: string;
  warnings: string[];

  // Flywheel metadata
  shouldFlagForDAO: boolean; // Whether this tx should be submitted for DAO review
  confidenceBoost: number; // Extra confidence from dual-layer agreement
}

// ════════════════════════════════════════════
// ML API INTEGRATION (Layer 1 - Instant)
// ════════════════════════════════════════════

const ML_API_URL = "/ml-api/predict";
const ML_API_TIMEOUT = 10000; // 10 second timeout

/**
 * Run ML-based scam detection on a transaction.
 * Calls the deployed Render ML API — we own zero ML code.
 * Uses buildWalletFeatures() to populate real on-chain data from Etherscan / RPC.
 */
const runMlScamDetection = async (
  transaction: TransactionData,
): Promise<MLResult> => {
  try {
    const txValue = parseFloat(transaction.value) || 0;
    const gasPrice = parseFloat(transaction.gasPrice || "20");

    // Build 18-feature array from REAL blockchain data (Etherscan + RPC)
    const provider = window.ethereum
      ? new ethers.BrowserProvider(window.ethereum)
      : null;

    let senderBalance = 0;
    let senderNonce = 0;
    if (provider && transaction.from) {
      try {
        const [bal, nonce] = await Promise.all([
          provider.getBalance(transaction.from),
          provider.getTransactionCount(transaction.from),
        ]);
        senderBalance = parseFloat(ethers.formatEther(bal));
        senderNonce = nonce;
      } catch {
        // non-critical
      }
    }

    const { features, source } = await buildWalletFeatures(
      transaction.to, // Evaluate the RECIPIENT address
      provider,
      {
        senderBalance,
        senderNonce,
        txValue,
      },
    );
    console.log(`[dualVerification] Features from ${source}:`, features);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ML_API_TIMEOUT);

    const response = await fetch(ML_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_address: transaction.from,
        to_address: transaction.to,
        transaction_value: txValue,
        gas_price: gasPrice,
        is_contract_interaction: transaction.isContractInteraction || false,
        acc_holder: transaction.to, // Evaluate the RECIPIENT
        features,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`ML API returned ${response.status}`);
    }

    const result = await response.json();

    // Parse ML API response
    const prediction = result.prediction || result.Prediction || "Unknown";
    let riskScore: number;
    const warnings: string[] = [];

    if (prediction === "Fraud") {
      riskScore = 85;
      warnings.push("ML model detected fraudulent transaction pattern");
    } else if (prediction === "Suspicious") {
      riskScore = 50;
      warnings.push("ML model flagged suspicious activity");
    } else {
      riskScore = 10;
    }

    // Adjust for high-value transactions
    const value = parseFloat(transaction.value);
    if (value > 10) {
      riskScore = Math.min(100, riskScore + 15);
      warnings.push(`High-value transaction: ${value} ETH`);
    }

    return {
      isSafe: riskScore < 30,
      riskScore,
      prediction,
      warnings,
      details: result,
    };
  } catch (error: any) {
    console.error("ML scam detection failed:", error);

    // On timeout or error, return cautious result
    return {
      isSafe: false,
      riskScore: 50,
      prediction: "Unknown",
      warnings: ["ML verification unavailable — exercise caution"],
      details: { error: error.message },
    };
  }
};

// ════════════════════════════════════════════
// DAO SCAM DATABASE (Layer 2 - Community)
// ════════════════════════════════════════════

/**
 * Query on-chain DAO scam database for address reputation.
 * This is the community-curated layer of defense.
 */
const queryDAOScamDatabase = async (address: string): Promise<DAOResult> => {
  try {
    // Query on-chain scam status from QuadraticVoting contract
    const isKnownScam = await contractService.isScamAddress(address);
    const scamScore = await contractService.getScamScore(address);

    let communityVerdict: DAOResult["communityVerdict"] = "unknown";

    if (isKnownScam) {
      communityVerdict = "confirmed_scam";
    } else if (scamScore > 0) {
      communityVerdict = "under_review";
    }

    // Check for active proposals about this address
    let activeProposals = 0;
    try {
      const reports = await contractService.getScamReports();
      activeProposals = reports.filter(
        (r: any) =>
          r.suspiciousAddress?.toLowerCase() === address.toLowerCase() &&
          r.status === "active",
      ).length;

      if (activeProposals > 0) {
        communityVerdict = "under_review";
      }
    } catch {
      // Reports unavailable
    }

    return {
      isKnownScam,
      scamScore,
      activeProposals,
      communityVerdict,
    };
  } catch (error) {
    console.error("DAO database query failed:", error);
    return {
      isKnownScam: false,
      scamScore: 0,
      activeProposals: 0,
      communityVerdict: "unknown",
    };
  }
};

// ════════════════════════════════════════════
// DUAL-LAYER COMBINATION (The Flywheel)
// ════════════════════════════════════════════

/**
 * Main dual-layer verification function.
 * Combines ML instant detection + DAO community curation + Civic identity.
 *
 * The flywheel logic:
 *   - If BOTH ML and DAO agree → high confidence
 *   - If they disagree → flag for community review
 *   - DAO-confirmed scams ALWAYS override ML "safe" verdict
 *   - Wallet-verified senders get slight trust boost
 *
 * @param address Sender's wallet address
 * @param transaction Transaction details to analyze
 * @returns Combined dual-layer assessment
 */
export const dualVerification = async (
  address: string,
  transaction: TransactionData,
): Promise<DualLayerResult> => {
  try {
    // Run all three checks in parallel for speed
    const [mlResult, daoResult, civicVerification, trustData] =
      await Promise.all([
        runMlScamDetection(transaction),
        queryDAOScamDatabase(transaction.to),
        verifyCivicIdentity(address),
        calculateTrustScore(address),
      ]);

    const civicVerified = civicVerification.isVerified;
    const trustScore = trustData.score;
    const warnings: string[] = [...mlResult.warnings];

    // ════════════════════════════════════════════
    // DUAL-LAYER RISK COMBINATION
    // ════════════════════════════════════════════

    let combinedRiskScore: number;
    let confidenceBoost = 0;

    // RULE 1: DAO-confirmed scam ALWAYS takes priority (community > ML)
    if (daoResult.isKnownScam) {
      combinedRiskScore = 95;
      warnings.push(
        "⚠️ DAO CONFIRMED SCAM: This address was flagged by community vote",
      );
      confidenceBoost = 30; // Very high confidence when DAO confirms
    }
    // RULE 2: Both layers agree it's dangerous → very high risk
    else if (mlResult.riskScore > 60 && daoResult.scamScore > 30) {
      combinedRiskScore = Math.min(
        100,
        mlResult.riskScore * 0.5 + daoResult.scamScore * 0.5 + 15,
      );
      warnings.push("Both AI and community flagged this address");
      confidenceBoost = 20; // Dual agreement = high confidence
    }
    // RULE 3: ML flags but DAO hasn't reviewed → moderate risk, flag for review
    else if (
      mlResult.riskScore > 60 &&
      daoResult.communityVerdict === "unknown"
    ) {
      combinedRiskScore = mlResult.riskScore;
      warnings.push("AI flagged — pending community review");
      confidenceBoost = 0; // Single layer = normal confidence
    }
    // RULE 4: DAO has reports but ML says safe → still cautious
    else if (daoResult.scamScore > 0 && mlResult.riskScore < 30) {
      combinedRiskScore = Math.max(40, daoResult.scamScore);
      warnings.push("Community reports exist for this address");
      confidenceBoost = 5;
    }
    // RULE 5: Both layers agree it's safe → low risk
    else if (mlResult.riskScore < 30 && daoResult.scamScore === 0) {
      combinedRiskScore = mlResult.riskScore;
      confidenceBoost = 15; // Both agree = extra safe
    }
    // RULE 6: Default weighted average
    else {
      combinedRiskScore = mlResult.riskScore * 0.6 + daoResult.scamScore * 0.4;
    }

    // Wallet-verified senders get a small trust discount (max -10 points)
    if (civicVerified && combinedRiskScore > 10) {
      const civicDiscount = Math.min(10, trustScore / 10);
      combinedRiskScore = Math.max(5, combinedRiskScore - civicDiscount);
    }

    // Under review addresses get a minimum risk floor
    if (daoResult.activeProposals > 0 && combinedRiskScore < 30) {
      combinedRiskScore = 30;
      warnings.push(
        `${daoResult.activeProposals} active DAO proposal(s) about this address`,
      );
    }

    combinedRiskScore = Math.round(
      Math.min(100, Math.max(0, combinedRiskScore)),
    );

    // ════════════════════════════════════════════
    // RISK LEVEL CLASSIFICATION
    // ════════════════════════════════════════════

    let riskLevel: DualLayerResult["riskLevel"];
    if (combinedRiskScore >= 80) riskLevel = "critical";
    else if (combinedRiskScore >= 60) riskLevel = "high";
    else if (combinedRiskScore >= 40) riskLevel = "medium";
    else if (combinedRiskScore >= 20) riskLevel = "low";
    else riskLevel = "safe";

    const combinedSafe = combinedRiskScore < 30;

    // ════════════════════════════════════════════
    // FLYWHEEL: Should this be flagged for DAO?
    // ════════════════════════════════════════════

    // Flag for DAO review if ML flagged it but community hasn't reviewed yet
    const shouldFlagForDAO =
      mlResult.riskScore > 50 &&
      daoResult.communityVerdict === "unknown" &&
      daoResult.activeProposals === 0;

    // ════════════════════════════════════════════
    // RECOMMENDATION
    // ════════════════════════════════════════════

    const recommendation = getRecommendation(
      riskLevel,
      civicVerified,
      daoResult,
      mlResult,
    );

    return {
      mlResult,
      daoResult,
      civicVerified,
      trustScore,
      combinedRiskScore,
      combinedSafe,
      riskLevel,
      recommendation,
      warnings,
      shouldFlagForDAO,
      confidenceBoost,
    };
  } catch (error) {
    console.error("Dual verification failed:", error);
    return {
      mlResult: {
        isSafe: false,
        riskScore: 75,
        prediction: "Error",
        warnings: ["Verification failed"],
        details: {},
      },
      daoResult: {
        isKnownScam: false,
        scamScore: 0,
        activeProposals: 0,
        communityVerdict: "unknown",
      },
      civicVerified: false,
      trustScore: 0,
      combinedRiskScore: 75,
      combinedSafe: false,
      riskLevel: "high",
      recommendation:
        "Verification failed. Do NOT proceed with this transaction.",
      warnings: ["Dual-layer verification system encountered an error"],
      shouldFlagForDAO: false,
      confidenceBoost: 0,
    };
  }
};

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

function getRecommendation(
  riskLevel: DualLayerResult["riskLevel"],
  civicVerified: boolean,
  daoResult: DAOResult,
  mlResult: MLResult,
): string {
  if (daoResult.isKnownScam) {
    return "🚫 BLOCKED: This address is a DAO-confirmed scam. Transaction strongly discouraged.";
  }

  switch (riskLevel) {
    case "critical":
      return `🔴 CRITICAL RISK (${mlResult.riskScore}% ML + ${daoResult.scamScore}% DAO): Do NOT proceed. Both AI and community have flagged this address.`;
    case "high":
      return `🟠 HIGH RISK: Our AI detected suspicious patterns. ${daoResult.activeProposals > 0 ? "Community is also reviewing this address." : "Consider reporting to DAO."}`;
    case "medium":
      return `🟡 MODERATE RISK: Some concerns detected. ${civicVerified ? "Your wallet verification adds trust." : "Build on-chain reputation to enhance security."}`;
    case "low":
      return `🟢 LOW RISK: Minor flags detected. ${civicVerified ? "Your verified status provides additional security." : ""}`;
    case "safe":
      return "✅ SAFE: Both AI and community database show no concerns. Transaction appears safe.";
    default:
      return "Unable to determine risk level. Proceed with caution.";
  }
}

/**
 * Quick check: is this address known to be dangerous?
 * Fast path for the TransactionInterceptor.
 */
export const quickScamCheck = async (
  address: string,
): Promise<{
  isDangerous: boolean;
  reason?: string;
}> => {
  try {
    // Check DAO database first (fastest, most authoritative)
    const isScam = await contractService.isScamAddress(address);
    if (isScam) {
      return { isDangerous: true, reason: "DAO-confirmed scam address" };
    }

    const scamScore = await contractService.getScamScore(address);
    if (scamScore > 50) {
      return {
        isDangerous: true,
        reason: `High community scam score: ${scamScore}/100`,
      };
    }

    return { isDangerous: false };
  } catch {
    return { isDangerous: false };
  }
};
