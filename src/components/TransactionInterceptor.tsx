import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Shield,
  X,
  ExternalLink,
  Zap,
  Brain,
  Heart,
} from "lucide-react";
import { ethers } from "ethers";
import walletConnector from "@/web3/wallet";
import contractService from "@/web3/contract";
import { buildWalletFeatures } from "@/services/walletFeatures";

interface TransactionInterceptorProps {
  onClose: () => void;
  onBlock: () => void;
  onDismiss?: () => void;
  toAddress: string;
  fromAddress: string;
  value: number;
  gasPrice: number;
  isSuccess?: boolean; // Optional prop to show success modal instead of warning
  transaction?: ethers.TransactionRequest;
}

interface MLResponse {
  prediction: any;
  risk_score: number;
  features: (number | string)[];
}

const isContractAddress = async (address: string): Promise<boolean> => {
  try {
    if (!window.ethereum) {
      console.warn("No ethereum provider available");
      return false;
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const code = await provider.getCode(address);
    // If address has code, it's a contract
    return code !== "0x";
  } catch (error) {
    // If there's an error, assume it's not a contract
    console.warn("Error checking contract address:", error);
    return false;
  }
};

// Function to retrieve transaction logs from localStorage
const getTransactionLogs = () => {
  try {
    const logs = localStorage.getItem("transaction-logs");
    return logs ? JSON.parse(logs) : [];
  } catch (error) {
    console.error("Error retrieving transaction logs:", error);
    return [];
  }
};

const TransactionInterceptor: React.FC<TransactionInterceptorProps> = ({
  onClose,
  onBlock,
  onDismiss,
  toAddress,
  fromAddress,
  value,
  gasPrice,
  isSuccess: isSuccessProp = false,
  transaction,
}) => {
  const dismiss = onDismiss ?? onBlock;

  const [whitelistedAddresses, setWhitelistedAddresses] = useState<string[]>(
    () => {
      const saved = localStorage.getItem("whitelisted-addresses");
      if (!saved) return [];
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed)
          ? parsed
              .filter((v) => typeof v === "string")
              .map((v) => v.toLowerCase())
          : [];
      } catch {
        return [];
      }
    },
  );

  const [mlResponse, setMlResponse] = useState<MLResponse | null>(null);
  const [mlRawResponse, setMlRawResponse] = useState<any>(null);
  const [mlDurationMs, setMlDurationMs] = useState<number | null>(null);
  const [daoDurationMs, setDaoDurationMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMEVProtected, setIsMEVProtected] = useState<boolean | null>(null);
  const [daoData, setDaoData] = useState<{
    isScammer: boolean;
    scamScore: number;
    activeProposals: number;
    verdict: string;
  } | null>(null);

  // On-chain context for the recipient address
  const [recipientContext, setRecipientContext] = useState<{
    balance: number;
    nonce: number;
    isContract: boolean;
  } | null>(null);

  const normalizedToAddress = (toAddress || "").toLowerCase();
  const isAddressWhitelisted =
    whitelistedAddresses.includes(normalizedToAddress);

  const analysisRunRef = useRef(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const activeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addToWhitelist = () => {
    const normalized = normalizedToAddress;
    const newWhitelist = whitelistedAddresses.includes(normalized)
      ? whitelistedAddresses
      : [...whitelistedAddresses, normalized];
    setWhitelistedAddresses(newWhitelist);
    localStorage.setItem("whitelisted-addresses", JSON.stringify(newWhitelist));
    onClose();
  };

  useEffect(() => {
    const checkTransaction = async () => {
      const runId = ++analysisRunRef.current;
      try {
        setIsLoading(true);
        setError(null);
        setMlResponse(null);
        setMlRawResponse(null);
        setMlDurationMs(null);
        setDaoDurationMs(null);
        setDaoData(null);

        console.log("Starting ML risk assessment for transaction:", {
          fromAddress,
          toAddress,
          value,
          gasPrice,
        });

        // ── Fetch on-chain context for BOTH sender and recipient in parallel ──
        const provider = window.ethereum
          ? new ethers.BrowserProvider(window.ethereum)
          : null;

        let senderBalance = 0;
        let senderNonce = 0;
        let recipientBalance = 0;
        let recipientNonce = 0;
        let isContract = false;

        if (provider) {
          try {
            const results = await Promise.allSettled([
              fromAddress
                ? provider.getBalance(fromAddress)
                : Promise.resolve(0n),
              fromAddress
                ? provider.getTransactionCount(fromAddress)
                : Promise.resolve(0),
              provider.getBalance(toAddress),
              provider.getTransactionCount(toAddress),
              provider.getCode(toAddress),
            ]);

            if (results[0].status === "fulfilled")
              senderBalance = parseFloat(
                ethers.formatEther(results[0].value as bigint),
              );
            if (results[1].status === "fulfilled")
              senderNonce = results[1].value as number;
            if (results[2].status === "fulfilled")
              recipientBalance = parseFloat(
                ethers.formatEther(results[2].value as bigint),
              );
            if (results[3].status === "fulfilled")
              recipientNonce = results[3].value as number;
            if (results[4].status === "fulfilled")
              isContract = (results[4].value as string) !== "0x";
          } catch {
            // non-critical — features stay at defaults
          }
        }

        // Store recipient on-chain context for UI display and scoring
        if (analysisRunRef.current === runId) {
          setRecipientContext({
            balance: recipientBalance,
            nonce: recipientNonce,
            isContract,
          });
        }

        console.log("On-chain context:", {
          sender: { balance: senderBalance, nonce: senderNonce },
          recipient: {
            balance: recipientBalance,
            nonce: recipientNonce,
            isContract,
          },
        });

        // Build 18-feature array from REAL blockchain data (Etherscan + RPC)
        // The external ML API requires all 18 features populated with real data.
        // Sending all zeros causes 99.9% false-positive Fraud classifications.
        const { features, source: featureSource } = await buildWalletFeatures(
          toAddress, // acc_holder = recipient (the address we're evaluating)
          provider,
          {
            senderBalance,
            senderNonce,
            recipientBalance,
            recipientNonce,
            txValue: value,
          },
        );
        console.log(`Features built from ${featureSource}:`, features);

        const transactionData = {
          from_address: fromAddress,
          to_address: toAddress,
          transaction_value: value,
          gas_price: gasPrice,
          is_contract_interaction: isContract,
          acc_holder: toAddress, // Evaluate the RECIPIENT address
          features,
          // Extra on-chain context for downstream processing
          recipient_balance: recipientBalance,
          recipient_nonce: recipientNonce,
          sender_balance: senderBalance,
          sender_nonce: senderNonce,
        };

        console.log("Sending transaction data to ML service:", transactionData);

        try {
          console.log("Starting ML risk assessment using external API only");

          // Use ONLY the external ML API endpoint
          const controller = new AbortController();
          activeAbortControllerRef.current = controller;
          const timeoutId = setTimeout(() => {
            controller.abort();
            console.warn("ML API request timed out after 15 seconds");
          }, 15000); // 15 second timeout
          activeTimeoutRef.current = timeoutId;

          const mlStart = performance.now();

          const response = await fetch("/ml-api/predict", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(transactionData),
            signal: controller.signal,
          });

          activeAbortControllerRef.current = null;

          clearTimeout(timeoutId);
          activeTimeoutRef.current = null;

          if (!response.ok) {
            const errorText = await response.text();
            console.error("ML API error:", response.status, errorText);
            throw new Error(
              `ML API returned status ${response.status}: ${errorText}`,
            );
          }

          const data = await response.json();
          const mlEnd = performance.now();

          // Ignore stale results if a newer run started
          if (analysisRunRef.current !== runId) return;

          setMlRawResponse(data);
          setMlDurationMs(Math.round(mlEnd - mlStart));

          console.log("ML API response received:", data);

          const prediction =
            data?.prediction ??
            data?.Prediction ??
            data?.result ??
            data?.label ??
            null;

          if (!data || prediction == null) {
            console.error("ML response missing required fields:", data);
            throw new Error(
              "Invalid response format from ML service (missing prediction)",
            );
          }

          // Convert the API response to our expected format
          const normalizedData = {
            prediction,
            risk_score: prediction === "Fraud" ? 0.8 : 0.2, // keep stable scoring; raw output shown separately
            risk_level: prediction === "Fraud" ? "HIGH" : "LOW",
            type: data?.Type ?? data?.type ?? "Unknown",
            explanation: `ML Assessment: ${data?.Type ?? data?.type ?? "Unknown"}`,
            features: features, // Include the features array we prepared earlier
          };

          // Success - valid response received
          console.log("Valid ML risk assessment received:", normalizedData);
          setMlResponse(normalizedData);

          // ══════════════════════════════════════════
          // LAYER 2: DAO Community Check (On-Chain)
          // ══════════════════════════════════════════
          try {
            console.log("🏛️ Starting DAO community check for:", toAddress);
            const daoStart = performance.now();
            const [isScammer, scamScore] = await Promise.all([
              contractService.isScamAddress(toAddress),
              contractService.getScamScore(toAddress),
            ]);

            let activeProposals = 0;
            let verdict = "unknown";

            try {
              const reports = await contractService.getScamReports();
              activeProposals = reports.filter(
                (r: any) =>
                  r.suspiciousAddress?.toLowerCase() ===
                    toAddress.toLowerCase() && r.status === "active",
              ).length;
            } catch {
              // Reports fetch is non-critical
            }

            if (isScammer) verdict = "confirmed_scam";
            else if (scamScore > 0 || activeProposals > 0)
              verdict = "under_review";

            const daoEnd = performance.now();
            if (analysisRunRef.current === runId) {
              setDaoDurationMs(Math.round(daoEnd - daoStart));
            }

            console.log("🏛️ DAO check result:", {
              isScammer,
              scamScore,
              activeProposals,
              verdict,
              contract: `QuadraticVoting @ ${contractService.getContractAddress?.() || "unknown"}`, // dynamic address
              calls: [
                "isScammer(address) → eth_call",
                "scamScore(address) → eth_call",
              ],
            });
            setDaoData({ isScammer, scamScore, activeProposals, verdict });
          } catch (daoErr) {
            console.warn("DAO check failed (non-fatal):", daoErr);
            setDaoData({
              isScammer: false,
              scamScore: 0,
              activeProposals: 0,
              verdict: "unavailable",
            });
          }
        } catch (err: any) {
          console.error("Error in ML service communication:", err);

          if (err.name === "AbortError") {
            throw new Error("ML risk assessment timed out");
          }

          throw err; // Re-throw to be caught by outer catch
        }
      } catch (err) {
        console.error("Transaction check error:", err);

        // Provide more informative error message
        if (err instanceof Error) {
          if (err.message.includes("timed out")) {
            setError(
              "ML risk assessment timed out. You may proceed with caution or try again.",
            );
          } else if (err.message.includes("fetch")) {
            setError(
              "Could not connect to ML service. Network issue or service unavailable.",
            );
          } else {
            setError(err.message);
          }
        } else {
          setError(
            "An unexpected error occurred while checking the transaction",
          );
        }

        // Still set ML response to a default "cautious" value so UI can render
        setMlResponse({
          prediction: 0.5, // neutral prediction
          risk_score: 0.5, // medium risk
          features: new Array(18).fill(0), // Default features
        });
      } finally {
        // Always finish loading state to avoid UI getting stuck
        if (analysisRunRef.current === runId) {
          setIsLoading(false);
        }
      }
    };

    checkTransaction();

    return () => {
      // Invalidate this run so late promises don't update state
      analysisRunRef.current++;

      // Abort any in-flight ML request
      try {
        activeAbortControllerRef.current?.abort();
      } catch {
        // ignore
      }
      activeAbortControllerRef.current = null;

      if (activeTimeoutRef.current) {
        clearTimeout(activeTimeoutRef.current);
        activeTimeoutRef.current = null;
      }
    };
  }, [fromAddress, toAddress, value, gasPrice]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      dismiss();
    }
  };

  // Get whitelisted addresses from local storage
  useEffect(() => {
    const loadWhitelist = () => {
      try {
        const whitelist = localStorage.getItem("whitelisted-addresses");
        if (whitelist) {
          const parsed = JSON.parse(whitelist);
          setWhitelistedAddresses(
            Array.isArray(parsed)
              ? parsed
                  .filter((v) => typeof v === "string")
                  .map((v) => v.toLowerCase())
              : [],
          );
        }
      } catch (error) {
        console.error("Error loading whitelist:", error);
      }
    };
    loadWhitelist();
  }, []);
  // Functions for logging transaction attempts
  const logTransactionAttempt = (transaction, risk) => {
    try {
      // Get existing logs from localStorage
      const existingLogs = localStorage.getItem("transaction-logs");
      const logs = existingLogs ? JSON.parse(existingLogs) : [];

      // Create log entry
      const logEntry = {
        timestamp: new Date().toISOString(),
        from: transaction.fromAddress,
        to: transaction.toAddress,
        value: transaction.value,
        gasPrice: transaction.gasPrice,
        riskScore: risk.score,
        riskLevel: risk.level,
        blocked: risk.blocked,
        whitelisted: risk.whitelisted,
        ml: {
          raw: mlRawResponse ?? null,
          durationMs: mlDurationMs,
        },
        dao: {
          data: daoData ?? null,
          durationMs: daoDurationMs,
        },
      };

      // Add to beginning of logs array (most recent first)
      logs.unshift(logEntry);

      // Keep only the most recent 100 logs
      const trimmedLogs = logs.slice(0, 100);

      // Save back to localStorage
      localStorage.setItem("transaction-logs", JSON.stringify(trimmedLogs));

      // Dispatch an event that a transaction was logged
      window.dispatchEvent(
        new CustomEvent("transaction-logged", { detail: logEntry }),
      );

      // Log for debugging
      console.log("Transaction logged:", logEntry);
    } catch (error) {
      console.error("Error logging transaction:", error);
    }
  };

  useEffect(() => {
    const checkMEVProtection = async () => {
      if (transaction && walletConnector.isTransactionProtected) {
        try {
          const isProtected =
            await walletConnector.isTransactionProtected(transaction);
          setIsMEVProtected(isProtected);
        } catch (err) {
          console.warn("Failed to check MEV protection:", err);
          setIsMEVProtected(false);
        }
      }
    };

    checkMEVProtection();
  }, [transaction]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <Card className="w-full max-w-md bg-black/90 backdrop-blur-lg border-yellow-500/30 border-2">
          <CardContent className="p-6 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-white">
              Analyzing with dual-layer AI + DAO defense...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <Card className="w-full max-w-md bg-black/90 backdrop-blur-lg border-red-500/30 border-2">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-white">Failed to analyze transaction: {error}</p>
            <Button onClick={dismiss} className="mt-4">
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ══════════════════════════════════════════
  // DUAL-LAYER SCORE COMPUTATION (THE FLYWHEEL)
  // Uses on-chain evidence to prevent false positives
  // ══════════════════════════════════════════

  // Determine if the recipient is a "new/low-history" wallet.
  // Key signal: nonce === 0 means zero outgoing transactions — the ML model has
  // no behavioral data to work with, so its "Fraud" prediction is unreliable.
  // A small balance from a previous inbound transfer doesn't change this.
  const isNewEmptyWallet =
    recipientContext != null &&
    !recipientContext.isContract &&
    recipientContext.nonce === 0;

  // ML base score (0-100) — derived from ML API prediction
  // If ML says Fraud but the address is just new/empty with ZERO DAO evidence,
  // it's likely a false positive → cap at Medium (50)
  let mlScore = mlResponse
    ? mlResponse.risk_score > 0.6
      ? 85
      : mlResponse.risk_score > 0.3
        ? 50
        : 10
    : 0;

  // On-chain false-positive mitigation:
  // A new empty wallet with 0 DAO reports is *unverified*, not *confirmed fraud*
  const daoHasEvidence =
    daoData &&
    (daoData.isScammer || daoData.scamScore > 0 || daoData.activeProposals > 0);
  if (mlScore >= 85 && isNewEmptyWallet && !daoHasEvidence) {
    mlScore = 45; // Downgrade to Medium — insufficient on-chain evidence for High
    console.log(
      "[Scoring] ML false-positive override: new empty wallet with no DAO reports → capped at 45",
    );
  }

  // Compute combined score incorporating DAO community data
  let combinedScore = mlScore;
  let daoBoostAmount = 0;

  if (daoData) {
    if (daoData.isScammer) {
      // RULE 1: DAO-confirmed scam ALWAYS takes priority
      combinedScore = 95;
      daoBoostAmount = 95 - mlScore;
    } else if (mlScore > 60 && daoData.scamScore > 30) {
      // RULE 2: Both layers agree it's dangerous
      combinedScore = Math.round(
        Math.min(100, mlScore * 0.5 + daoData.scamScore * 0.5 + 15),
      );
      daoBoostAmount = combinedScore - mlScore;
    } else if (daoData.scamScore > 0 && mlScore < 30) {
      // RULE 3: DAO has reports but ML says safe
      combinedScore = Math.max(40, daoData.scamScore);
      daoBoostAmount = combinedScore - mlScore;
    } else if (daoData.activeProposals > 0 && combinedScore < 30) {
      // Under review — minimum risk floor
      combinedScore = 30;
      daoBoostAmount = 30 - mlScore;
    }
  }

  const riskScore = combinedScore;
  const riskLevel = riskScore > 75 ? "High" : riskScore > 50 ? "Medium" : "Low";

  // UI + logging should be consistent and respect whitelist.
  // If recipient is trusted, we still show the raw ML output, but we do not block or label it as high risk.
  const effectiveRiskScore = isAddressWhitelisted
    ? Math.min(riskScore, 10)
    : riskScore;
  const effectiveRiskLevel = isAddressWhitelisted ? "Low" : riskLevel;
  const effectiveIsSuccess = isAddressWhitelisted
    ? true
    : isSuccessProp
      ? true
      : effectiveRiskLevel !== "High";

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <Card
        className={`w-full max-w-2xl bg-black/90 backdrop-blur-lg border-2 animate-scale-in ${
          effectiveIsSuccess ? "border-green-500/30" : "border-red-500/30"
        }`}
      >
        <CardHeader
          className={`border-b ${effectiveIsSuccess ? "border-green-500/30" : "border-red-500/30"}`}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-3 text-white">
              <div className="relative">
                {effectiveIsSuccess ? (
                  <>
                    <Shield className="h-6 w-6 text-green-500" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                  </>
                )}
              </div>
              <span>
                {effectiveIsSuccess
                  ? "✅ SECURITY PASSED"
                  : "🚨 DUAL-LAYER RISK ASSESSMENT"}
              </span>
            </CardTitle>

            {/* MEV Protection Status */}
            {isMEVProtected !== null && (
              <Badge
                className={
                  isMEVProtected
                    ? "bg-green-500/20 text-green-400 flex items-center gap-1"
                    : "bg-yellow-500/20 text-yellow-400 flex items-center gap-1"
                }
              >
                <Shield className="w-3 h-3" />
                {isMEVProtected ? "MEV Protected" : "MEV Protection Available"}
              </Badge>
            )}

            <button
              onClick={dismiss}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p
            className={`text-sm ${effectiveIsSuccess ? "text-green-400" : "text-red-400"}`}
          >
            {effectiveIsSuccess
              ? "Dual-layer security analysis passed. Transaction appears safe to proceed."
              : "ML + DAO community analysis completed. Review the dual-layer assessment below."}
          </p>
        </CardHeader>

        <CardContent className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {isAddressWhitelisted && (
            <div className="flex items-center p-4 rounded-lg bg-green-500/10 border border-green-500/30 mb-4">
              <Heart className="h-6 w-6 text-green-500 mr-3" />
              <div>
                <div className="text-green-400 font-semibold">
                  Whitelisted Address
                </div>
                <div className="text-sm text-gray-400">
                  This address is in your trusted contacts
                </div>
              </div>
            </div>
          )}
          {/* ══════ DUAL-LAYER RISK BREAKDOWN ══════ */}
          <div className="space-y-3">
            {/* Layer 1: ML Assessment */}
            <div
              className={`flex items-center justify-between p-3 rounded-lg border ${
                effectiveIsSuccess
                  ? "bg-green-500/5 border-green-500/20"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Brain
                  className={`h-5 w-5 ${effectiveIsSuccess ? "text-green-400" : "text-cyan-400"}`}
                />
                <div>
                  <div className="text-white text-sm font-medium">
                    Layer 1 — ML Model
                  </div>
                  <div className="text-xs text-gray-500">
                    {mlRawResponse?.prediction
                      ? `External ML: ${mlRawResponse.prediction}${mlRawResponse.Type ? ` (${mlRawResponse.Type})` : ""}${isNewEmptyWallet && !daoHasEvidence && mlRawResponse.prediction === "Fraud" ? " — adjusted (new wallet)" : ""}`
                      : "Real-time fraud detection"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-cyan-400">
                  {mlScore}%
                </div>
                <div className="text-[11px] text-gray-500">
                  {mlDurationMs != null ? `ML ${mlDurationMs}ms` : ""}
                  {mlDurationMs != null && daoDurationMs != null ? " • " : ""}
                  {daoDurationMs != null ? `DAO ${daoDurationMs}ms` : ""}
                </div>
              </div>
            </div>

            {/* Layer 2: DAO Community */}
            <div
              className={`flex items-center justify-between p-3 rounded-lg border ${
                daoData?.isScammer
                  ? "bg-red-500/10 border-red-500/30"
                  : daoData && daoData.scamScore > 0
                    ? "bg-yellow-500/10 border-yellow-500/30"
                    : "bg-white/5 border-white/10"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Shield
                  className={`h-5 w-5 ${
                    daoData?.isScammer
                      ? "text-red-400"
                      : daoData && daoData.scamScore > 0
                        ? "text-yellow-400"
                        : "text-gray-500"
                  }`}
                />
                <div>
                  <div className="text-white text-sm font-medium">
                    Layer 2 — DAO Community
                  </div>
                  <div className="text-xs text-gray-500">
                    {daoData?.isScammer
                      ? "⚠️ CONFIRMED SCAM by community vote"
                      : daoData && daoData.activeProposals > 0
                        ? `${daoData.activeProposals} active review proposal(s)`
                        : daoData && daoData.scamScore > 0
                          ? `Community reports exist (score: ${daoData.scamScore})`
                          : daoData?.verdict === "unavailable"
                            ? "DAO unavailable — ML only"
                            : "No community reports yet"}
                  </div>
                </div>
              </div>
              <div
                className={`text-lg font-bold ${daoBoostAmount > 0 ? "text-red-400" : "text-gray-600"}`}
              >
                {daoBoostAmount > 0 ? `+${daoBoostAmount}%` : "+0%"}
              </div>
            </div>

            {/* Combined Score */}
            <div
              className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                effectiveIsSuccess
                  ? "bg-green-500/10 border-green-500/40"
                  : effectiveRiskLevel === "High"
                    ? "bg-red-500/10 border-red-500/40"
                    : effectiveRiskLevel === "Medium"
                      ? "bg-yellow-500/10 border-yellow-500/40"
                      : "bg-green-500/10 border-green-500/40"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Zap
                  className={`h-6 w-6 ${
                    effectiveIsSuccess
                      ? "text-green-500"
                      : effectiveRiskLevel === "High"
                        ? "text-red-500"
                        : effectiveRiskLevel === "Medium"
                          ? "text-yellow-500"
                          : "text-green-500"
                  }`}
                />
                <div>
                  <div className="text-white font-semibold">
                    {effectiveIsSuccess
                      ? "Security Analysis Result"
                      : "Combined Risk Score"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {daoBoostAmount > 0
                      ? "⚡ ML + DAO Flywheel Active"
                      : effectiveIsSuccess
                        ? "Dual-layer analysis complete"
                        : isNewEmptyWallet && !daoHasEvidence
                          ? "⚠️ Unverified new wallet — on-chain evidence insufficient"
                          : "ML assessment only — report to DAO to strengthen"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-3xl font-bold ${
                    effectiveIsSuccess
                      ? "text-green-500"
                      : effectiveRiskLevel === "High"
                        ? "text-red-500"
                        : effectiveRiskLevel === "Medium"
                          ? "text-yellow-500"
                          : "text-green-500"
                  }`}
                >
                  {effectiveRiskScore.toFixed(1)}%
                </div>
                <Badge
                  className={
                    effectiveIsSuccess
                      ? "bg-green-500/20 text-green-400"
                      : effectiveRiskLevel === "High"
                        ? "bg-red-500/20 text-red-400"
                        : effectiveRiskLevel === "Medium"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-green-500/20 text-green-400"
                  }
                >
                  {effectiveIsSuccess ? "SAFE" : `${effectiveRiskLevel} RISK`}
                </Badge>
              </div>
            </div>
          </div>
          {/* On-chain evidence panel */}
          {recipientContext && (
            <div className="space-y-3">
              <h3 className="text-white font-semibold flex items-center space-x-2">
                <ExternalLink className="h-5 w-5 text-cyan-400" />
                <span>On-Chain Evidence</span>
              </h3>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-gray-400">
                      Recipient Balance
                    </div>
                    <div className="text-white font-medium mt-1">
                      {recipientContext.balance.toFixed(6)} ETH
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Recipient Txns</div>
                    <div className="text-white font-medium mt-1">
                      {recipientContext.nonce}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Type</div>
                    <div className="text-white font-medium mt-1">
                      {recipientContext.isContract ? "📄 Contract" : "👤 EOA"}
                    </div>
                  </div>
                </div>
                {isNewEmptyWallet && !daoHasEvidence && (
                  <div className="mt-3 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
                    ⚠️ This is a new wallet with no transaction history and no
                    DAO reports. ML risk was adjusted downward because there is
                    no on-chain evidence of fraud.
                  </div>
                )}
                {daoData?.isScammer && (
                  <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
                    🚨 This address has been confirmed as a scam by DAO
                    community vote (on-chain).
                  </div>
                )}
              </div>
            </div>
          )}
          {/* External ML raw output (debug) */}
          <details className="bg-white/5 rounded-lg p-4 border border-white/10">
            <summary className="text-sm text-gray-300 cursor-pointer select-none">
              External ML output (raw JSON)
              {mlDurationMs != null ? ` — ${mlDurationMs}ms` : ""}
            </summary>
            <pre className="mt-3 text-xs text-gray-200 overflow-x-auto whitespace-pre-wrap break-words">
              {mlRawResponse
                ? JSON.stringify(mlRawResponse, null, 2)
                : "No ML response captured."}
            </pre>
          </details>
          {/* Transaction Details */}
          <div className="space-y-3">
            <h3 className="text-white font-semibold flex items-center space-x-2">
              <Shield className="h-5 w-5 text-cyan-400" />
              <span>Transaction Details</span>
            </h3>

            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <div className="text-sm text-gray-400">To Address</div>
                  <div className="font-mono text-sm text-white bg-black/30 p-2 rounded break-all">
                    {toAddress}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Value</div>
                  <div className="text-white font-medium">{value} ETH</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Gas Price</div>
                  <div className="text-white font-medium">{gasPrice} Gwei</div>
                </div>
              </div>
            </div>
          </div>
          {/* MEV Protection Status */}
          {transaction && (
            <div className="p-4 rounded-lg border bg-white/5 border-white/10">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  MEV Protection Status
                </div>
                <div className="text-sm">
                  {isMEVProtected === null ? (
                    <div className="animate-pulse h-4 bg-gray-700 rounded-full w-1/2"></div>
                  ) : isMEVProtected ? (
                    <Badge className="bg-green-500/20 text-green-400">
                      Protected
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/20 text-red-400">
                      Not Protected
                    </Badge>
                  )}
                </div>
              </div>
              {isMEVProtected === false && (
                <div className="mt-2 text-sm text-red-400">
                  ⚠️ This transaction is not protected against MEV (Miner
                  Extractable Value) attacks.
                </div>
              )}
            </div>
          )}
          {/* Action Buttons */}{" "}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            {!isAddressWhitelisted && (
              <Button
                variant="outline"
                onClick={() => {
                  logTransactionAttempt(
                    { fromAddress, toAddress, value, gasPrice },
                    {
                      score: effectiveRiskScore,
                      level: effectiveRiskLevel,
                      blocked: false,
                      whitelisted: true,
                    },
                  );
                  addToWhitelist();
                }}
                className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              >
                <Heart className="h-4 w-4 mr-2" />
                Trust this Address
              </Button>
            )}

            <div className="flex items-center space-x-3 ml-auto">
              <Button
                variant="outline"
                onClick={() => {
                  logTransactionAttempt(
                    { fromAddress, toAddress, value, gasPrice },
                    {
                      score: effectiveRiskScore,
                      level: effectiveRiskLevel,
                      blocked: false,
                      whitelisted: isAddressWhitelisted,
                    },
                  );
                  onClose();
                }}
                className={`${
                  effectiveIsSuccess
                    ? "border-green-500/30 text-green-400 hover:bg-green-500/10"
                    : "border-gray-500/30 text-gray-400 hover:bg-gray-500/10"
                }`}
              >
                {effectiveIsSuccess ? "✅ Proceed to MetaMask" : "Sign Anyway"}
              </Button>
              {!effectiveIsSuccess &&
                !isAddressWhitelisted &&
                effectiveRiskLevel === "High" && (
                  <Button
                    onClick={() => {
                      logTransactionAttempt(
                        { fromAddress, toAddress, value, gasPrice },
                        {
                          score: effectiveRiskScore,
                          level: effectiveRiskLevel,
                          blocked: true,
                          whitelisted: false,
                        },
                      );
                      onBlock();
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    🛑 Block Transaction
                  </Button>
                )}
              {effectiveIsSuccess && (
                <Button
                  onClick={() => {
                    logTransactionAttempt(
                      { fromAddress, toAddress, value, gasPrice },
                      {
                        score: effectiveRiskScore,
                        level: effectiveRiskLevel,
                        blocked: true,
                        whitelisted: false,
                      },
                    );
                    onBlock();
                  }}
                  className="border-gray-500/30 text-gray-400 hover:bg-gray-500/10"
                  variant="outline"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionInterceptor;
