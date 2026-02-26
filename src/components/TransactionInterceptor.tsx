import React, { useEffect, useState } from "react";
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

interface TransactionInterceptorProps {
  onClose: () => void;
  onBlock: () => void;
  toAddress: string;
  fromAddress: string;
  value: number;
  gasPrice: number;
  isSuccess?: boolean; // Optional prop to show success modal instead of warning
  transaction?: ethers.TransactionRequest;
}

interface MLResponse {
  prediction: number;
  risk_score: number;
  features: number[];
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
  toAddress,
  fromAddress,
  value,
  gasPrice,
  isSuccess = false,
  transaction,
}) => {
  const [whitelistedAddresses, setWhitelistedAddresses] = useState<string[]>(
    () => {
      const saved = localStorage.getItem("whitelisted-addresses");
      return saved ? JSON.parse(saved) : [];
    },
  );

  const [mlResponse, setMlResponse] = useState<MLResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMEVProtected, setIsMEVProtected] = useState<boolean | null>(null);
  const [daoData, setDaoData] = useState<{
    isScammer: boolean;
    scamScore: number;
    activeProposals: number;
    verdict: string;
  } | null>(null);

  const isAddressWhitelisted = whitelistedAddresses.includes(toAddress);

  const addToWhitelist = () => {
    const newWhitelist = [...whitelistedAddresses, toAddress];
    setWhitelistedAddresses(newWhitelist);
    localStorage.setItem("whitelisted-addresses", JSON.stringify(newWhitelist));
    onClose();
  };

  useEffect(() => {
    const checkTransaction = async () => {
      try {
        console.log("Starting ML risk assessment for transaction:", {
          fromAddress,
          toAddress,
          value,
          gasPrice,
        });

        // Check if address is a contract - do this first to avoid delays later
        const isContract = await isContractAddress(toAddress);
        console.log("Contract address check result:", isContract);

        // Prepare features array with real transaction data
        const features = [
          gasPrice, // gas_price
          value, // transaction_value
          isAddressWhitelisted ? 1 : 0, // trusted address
          isContract ? 1 : 0, // is_contract
          0, // remaining features, could be enhanced with historical data
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ];

        const transactionData = {
          from_address: fromAddress,
          to_address: toAddress,
          transaction_value: value,
          gas_price: gasPrice,
          is_contract_interaction: isContract, // Use the value we already computed
          acc_holder: fromAddress,
          features,
        };

        console.log("Sending transaction data to ML service:", transactionData);

        try {
          console.log("Starting ML risk assessment using external API only");

          // Use ONLY the external ML API endpoint
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
            console.warn("ML API request timed out after 15 seconds");
          }, 15000); // 15 second timeout

          const response = await fetch(
            "https://ml-fraud-transaction-detection.onrender.com/predict",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(transactionData),
              signal: controller.signal,
            },
          );

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            console.error("ML API error:", response.status, errorText);
            throw new Error(
              `ML API returned status ${response.status}: ${errorText}`,
            );
          }

          const data = await response.json();
          console.log("ML API response received:", data);

          if (!data || !data.prediction) {
            console.error("ML response missing required fields:", data);
            throw new Error(
              "Invalid response format from ML service - missing prediction data",
            );
          }

          // Convert the API response to our expected format
          const normalizedData = {
            prediction: data.prediction,
            risk_score: data.prediction === "Fraud" ? 0.8 : 0.2, // Convert string to numeric score
            risk_level: data.prediction === "Fraud" ? "HIGH" : "LOW",
            type: data.Type,
            explanation: `ML Assessment: ${data.Type}`,
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
        setIsLoading(false);
      }
    };

    checkTransaction();
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
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Get whitelisted addresses from local storage
  useEffect(() => {
    const loadWhitelist = () => {
      try {
        const whitelist = localStorage.getItem("whitelisted-addresses");
        if (whitelist) {
          setWhitelistedAddresses(JSON.parse(whitelist));
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
            <Button onClick={onClose} className="mt-4">
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ══════════════════════════════════════════
  // DUAL-LAYER SCORE COMPUTATION (THE FLYWHEEL)
  // ══════════════════════════════════════════

  // ML base score (0-100) — derived from ML API prediction
  const mlScore = mlResponse
    ? mlResponse.risk_score > 0.6
      ? 85
      : mlResponse.risk_score > 0.3
        ? 50
        : 10
    : 0;

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
      // RULE 4: DAO has reports but ML says safe
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

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <Card
        className={`w-full max-w-2xl bg-black/90 backdrop-blur-lg border-2 animate-scale-in ${
          isSuccess ? "border-green-500/30" : "border-red-500/30"
        }`}
      >
        <CardHeader
          className={`border-b ${isSuccess ? "border-green-500/30" : "border-red-500/30"}`}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-3 text-white">
              <div className="relative">
                {isSuccess ? (
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
                {isSuccess
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
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p
            className={`text-sm ${isSuccess ? "text-green-400" : "text-red-400"}`}
          >
            {isSuccess
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
                isSuccess
                  ? "bg-green-500/5 border-green-500/20"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Brain
                  className={`h-5 w-5 ${isSuccess ? "text-green-400" : "text-cyan-400"}`}
                />
                <div>
                  <div className="text-white text-sm font-medium">
                    Layer 1 — ML Model
                  </div>
                  <div className="text-xs text-gray-500">
                    Real-time fraud detection
                  </div>
                </div>
              </div>
              <div className="text-lg font-bold text-cyan-400">{mlScore}%</div>
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
                isSuccess
                  ? "bg-green-500/10 border-green-500/40"
                  : riskLevel === "High"
                    ? "bg-red-500/10 border-red-500/40"
                    : riskLevel === "Medium"
                      ? "bg-yellow-500/10 border-yellow-500/40"
                      : "bg-green-500/10 border-green-500/40"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Zap
                  className={`h-6 w-6 ${
                    isSuccess
                      ? "text-green-500"
                      : riskLevel === "High"
                        ? "text-red-500"
                        : riskLevel === "Medium"
                          ? "text-yellow-500"
                          : "text-green-500"
                  }`}
                />
                <div>
                  <div className="text-white font-semibold">
                    {isSuccess
                      ? "Security Analysis Result"
                      : "Combined Risk Score"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {daoBoostAmount > 0
                      ? "⚡ ML + DAO Flywheel Active"
                      : isSuccess
                        ? "Dual-layer analysis complete"
                        : "ML assessment only — report to DAO to strengthen"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-3xl font-bold ${
                    isSuccess
                      ? "text-green-500"
                      : riskLevel === "High"
                        ? "text-red-500"
                        : riskLevel === "Medium"
                          ? "text-yellow-500"
                          : "text-green-500"
                  }`}
                >
                  {riskScore.toFixed(1)}%
                </div>
                <Badge
                  className={
                    isSuccess
                      ? "bg-green-500/20 text-green-400"
                      : riskLevel === "High"
                        ? "bg-red-500/20 text-red-400"
                        : riskLevel === "Medium"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-green-500/20 text-green-400"
                  }
                >
                  {isSuccess ? "SAFE" : `${riskLevel} RISK`}
                </Badge>
              </div>
            </div>
          </div>
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
                      score: riskScore,
                      level: riskLevel,
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
                      score: riskScore,
                      level: riskLevel,
                      blocked: false,
                      whitelisted: isAddressWhitelisted,
                    },
                  );
                  onClose();
                }}
                className={`${
                  isSuccess
                    ? "border-green-500/30 text-green-400 hover:bg-green-500/10"
                    : "border-gray-500/30 text-gray-400 hover:bg-gray-500/10"
                }`}
              >
                {isSuccess ? "✅ Proceed to MetaMask" : "Sign Anyway"}
              </Button>
              {!isSuccess && !isAddressWhitelisted && riskLevel === "High" && (
                <Button
                  onClick={() => {
                    logTransactionAttempt(
                      { fromAddress, toAddress, value, gasPrice },
                      {
                        score: riskScore,
                        level: riskLevel,
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
              {isSuccess && (
                <Button
                  onClick={() => {
                    logTransactionAttempt(
                      { fromAddress, toAddress, value, gasPrice },
                      {
                        score: riskScore,
                        level: riskLevel,
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
