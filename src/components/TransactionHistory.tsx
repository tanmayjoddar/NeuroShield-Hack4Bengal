import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Shield,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import walletConnector from "@/web3/wallet";
import { shortenAddress } from "@/web3/utils";
import { formatUnits } from "ethers";

interface Transaction {
  id: number;
  type: "send" | "receive" | "approve" | "contract";
  amount: string;
  to?: string;
  from?: string;
  status: "safe" | "blocked" | "pending";
  hash: string | null;
  timestamp: string;
  gasUsed: string;
  reason?: string;
}

// Helper function to calculate time since a block
const getTimeSince = async (blockNumber: number): Promise<string> => {
  try {
    // Get current block
    const provider = walletConnector.provider;
    if (!provider) return "Unknown";

    const currentBlock = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);

    if (!block || !block.timestamp) return "Unknown";

    const blockTime = new Date(Number(block.timestamp) * 1000);
    const now = new Date();

    const seconds = Math.floor((now.getTime() - blockTime.getTime()) / 1000);

    if (seconds < 60) return `${seconds} sec ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  } catch (err) {
    console.error("Error calculating time since:", err);
    return "Unknown";
  }
};

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!walletConnector.address || !walletConnector.provider) {
          setLoading(false);
          return;
        }

        // Get the last 10 transactions for the connected address
        const userAddress = walletConnector.address;

        try {
          // Get real transactions from localStorage (logged by TransactionInterceptor)
          const rawLogs = localStorage.getItem("transaction-logs");
          const logs: Array<{
            timestamp: string;
            from: string;
            to: string;
            value: number;
            gasPrice: number;
            riskScore: number;
            riskLevel: string;
            blocked: boolean;
            whitelisted: boolean;
          }> = rawLogs ? JSON.parse(rawLogs) : [];

          // Also try to get the real transaction count from provider for context
          const provider = walletConnector.provider;
          let txCount = 0;
          if (provider) {
            try {
              txCount = await provider.getTransactionCount(userAddress);
            } catch {
              /* ignore */
            }
          }

          // Convert localStorage logs into our Transaction format
          const realTransactions: Transaction[] = logs
            .filter((log) => log.from === userAddress || log.to === userAddress)
            .slice(0, 20)
            .map((log, index) => ({
              id: index + 1,
              type: log.blocked
                ? ("approve" as const)
                : log.from === userAddress
                  ? ("send" as const)
                  : ("receive" as const),
              amount: `${log.value || 0} ETH`,
              to: log.to,
              from: log.from,
              status: log.blocked ? ("blocked" as const) : ("safe" as const),
              hash: null,
              timestamp: new Date(log.timestamp).toLocaleString(),
              gasUsed: `${log.gasPrice || 0} Gwei`,
              reason: log.blocked
                ? `Blocked — Risk Score: ${(log.riskScore || 0).toFixed(1)}% (${log.riskLevel || "Unknown"})`
                : undefined,
            }));

          if (realTransactions.length > 0) {
            setTransactions(realTransactions);
            console.log(
              `Loaded ${realTransactions.length} real transaction logs for ${shortenAddress(userAddress)}`,
            );
          } else if (txCount > 0) {
            // User has on-chain transactions but no ML-scanned logs yet
            setTransactions([
              {
                id: 1,
                type: "send",
                amount: `${txCount} historical txs`,
                from: userAddress,
                status: "safe",
                hash: null,
                timestamp: "On-chain history",
                gasUsed: "N/A",
                reason:
                  "Send a transaction through NeuroShield to see ML-scanned logs here",
              },
            ]);
          } else {
            setTransactions([]);
          }
        } catch (err: any) {
          console.error("Failed to fetch transaction history:", err);
          setError("Could not load transaction history");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();

    // Setup event listeners for wallet connection changes and new transaction logs
    const handleAccountChange = () => fetchTransactions();
    const handleNewLog = () => fetchTransactions();
    window.addEventListener("wallet_accountChanged", handleAccountChange);
    window.addEventListener("transaction-logged", handleNewLog);

    return () => {
      window.removeEventListener("wallet_accountChanged", handleAccountChange);
      window.removeEventListener("transaction-logged", handleNewLog);
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "safe":
        return <Shield className="h-4 w-4 text-green-500" />;
      case "blocked":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <History className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "send":
        return <ArrowUpRight className="h-4 w-4 text-orange-400" />;
      case "receive":
        return <ArrowDownLeft className="h-4 w-4 text-green-400" />;
      case "approve":
        return <Shield className="h-4 w-4 text-blue-400" />;
      default:
        return <History className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "safe":
        return "text-green-400 bg-green-500/20 border-green-500/30";
      case "blocked":
        return "text-red-400 bg-red-500/20 border-red-500/30";
      default:
        return "text-gray-400 bg-gray-500/20 border-gray-500/30";
    }
  };
  return (
    <Card className="bg-black/20 backdrop-blur-lg border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <History className="h-5 w-5 text-cyan-400" />
          <span>Transaction History</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-6 w-6 text-cyan-400 animate-spin mr-2" />
            <p className="text-gray-400">Loading transactions...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-md">
            <p className="text-red-400">{error}</p>
          </div>
        ) : !walletConnector.address ? (
          <div className="text-center p-6">
            <p className="text-gray-400">
              Connect your wallet to view transaction history
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center p-6">
            <p className="text-gray-400">No transactions found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getTypeIcon(tx.type)}
                    {getStatusIcon(tx.status)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium capitalize">
                        {tx.type}
                      </span>
                      <span className="text-cyan-400 font-mono">
                        {tx.amount}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">
                      {tx.type === "send" || tx.type === "approve"
                        ? `To: ${shortenAddress(tx.to || "")}`
                        : `From: ${shortenAddress(tx.from || "")}`}
                    </div>
                    {tx.hash && (
                      <div className="text-xs text-gray-500 mt-1 font-mono">
                        Tx: {shortenAddress(tx.hash, 8)}
                      </div>
                    )}
                    {tx.reason && (
                      <div className="text-xs text-red-400 mt-1">
                        {tx.reason}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-sm text-gray-400">{tx.timestamp}</div>
                    <div className="text-xs text-gray-500">
                      Gas: {tx.gasUsed}
                    </div>
                  </div>
                  <Badge className={getStatusColor(tx.status)}>
                    {tx.status === "safe"
                      ? "🟢"
                      : tx.status === "blocked"
                        ? "🔴"
                        : "🟠"}{" "}
                    {tx.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionHistory;
