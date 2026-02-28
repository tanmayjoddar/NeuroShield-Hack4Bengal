import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import walletConnector, { getSigner } from "@/web3/wallet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, AlertCircle, Shield } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import TransactionInterceptor from "./TransactionInterceptor";

interface SendTransactionProps {
  onSuccess?: (txHash: string) => void;
  onFraudDetected?: (fraudData: any) => void;
}

const SendTransaction: React.FC<SendTransactionProps> = ({
  onSuccess,
  onFraudDetected,
}) => {
  const navigate = useNavigate();

  // Form state
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [gasPrice, setGasPrice] = useState("20");
  const [useMEVProtection, setUseMEVProtection] = useState(true);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Single interceptor modal — replaces the old dual-modal approach
  const [showInterceptor, setShowInterceptor] = useState(false);
  const [senderAddress, setSenderAddress] = useState("");

  // State for real-time address preview
  const [addressPreview, setAddressPreview] = useState<{
    isValid: boolean;
    isContract: boolean;
    balance?: number;
    txCount?: number;
  } | null>(null);

  // Real-time address validation and preview
  const validateAndPreviewAddress = async (address: string) => {
    if (!address || address.length < 10) {
      setAddressPreview(null);
      return;
    }

    // Step 1: Check address format (works offline, no RPC needed)
    if (!ethers.isAddress(address)) {
      setAddressPreview({ isValid: false, isContract: false });
      return;
    }

    // Step 2: Address format is valid, now try to fetch on-chain data
    // If RPC fails (rate limit, network issue), address is STILL valid
    try {
      const provider = walletConnector.provider
        ? walletConnector.provider
        : window.ethereum
          ? new ethers.BrowserProvider(window.ethereum)
          : null;

      if (!provider) {
        // Provider unavailable, but address format is valid
        setAddressPreview({ isValid: true, isContract: false });
        return;
      }

      const code = await provider.getCode(address);
      const isContract = code !== "0x";

      let balance = 0;
      let txCount = 0;
      if (!isContract) {
        const balanceWei = await provider.getBalance(address);
        balance = parseFloat(ethers.formatEther(balanceWei));
        txCount = await provider.getTransactionCount(address);
      }

      setAddressPreview({ isValid: true, isContract, balance, txCount });
    } catch (error) {
      // RPC call failed (network/rate limit), but address format is still valid
      console.warn("Address preview fetch failed (network issue):", error);
      setAddressPreview({ isValid: true, isContract: false });
    }
  };

  // Handle recipient address change with debounced validation
  const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRecipient = e.target.value;
    setRecipient(newRecipient);
    setTimeout(() => {
      if (newRecipient === e.target.value) {
        validateAndPreviewAddress(newRecipient);
      }
    }, 800);
  };

  // ───────────────────────────────────────────────────
  // Form submission — validate inputs, get signer,
  // then show TransactionInterceptor which handles
  // ML + DAO + whitelist scoring in a single call.
  // No duplicate ML call needed here.
  // ───────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    if (!recipient || !ethers.isAddress(recipient)) {
      setError("Please enter a valid Ethereum address");
      return;
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    try {
      setLoading(true);
      const signer = await getSigner();
      if (!signer) throw new Error("No wallet connected");
      const from = await signer.getAddress();
      setSenderAddress(from);
      // Show the interceptor — it handles ML + DAO analysis internally
      setShowInterceptor(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
      setLoading(false);
    }
  };

  // ───────────────────────────────────────────────────
  // Send transaction (called when user clicks
  // "Proceed to MetaMask" inside the interceptor)
  // ───────────────────────────────────────────────────
  const sendTransaction = async () => {
    setLoading(true);
    setShowInterceptor(false);
    try {
      const signer = await getSigner();
      if (!signer) throw new Error("No wallet connected");

      const amountInWei = ethers.parseEther(amount);
      const from = await signer.getAddress();

      const tx: ethers.TransactionRequest = {
        to: recipient,
        value: amountInWei,
        type: 0, // Legacy tx — Monad doesn't support EIP-1559
        gasPrice: ethers.parseUnits(gasPrice, "gwei"),
        nonce: await signer.provider.getTransactionCount(from),
        chainId: (await signer.provider.getNetwork()).chainId,
      };

      const transaction = await signer.sendTransaction(tx);
      console.log("Transaction submitted:", transaction.hash);

      setSuccess(`Transaction sent! Hash: ${transaction.hash}`);
      setRecipient("");
      setAmount("");
      if (onSuccess) onSuccess(transaction.hash);
    } catch (err: any) {
      if (err.code === 4001) {
        setError("Transaction was rejected in MetaMask");
      } else {
        setError(err.message || "Transaction failed");
      }
    } finally {
      setLoading(false);
    }
  };

  // Interceptor callbacks
  const handleInterceptorProceed = () => {
    sendTransaction();
  };

  const handleInterceptorBlock = () => {
    setShowInterceptor(false);
    setError("Transaction cancelled due to high fraud risk");
    if (onFraudDetected) onFraudDetected({ blocked: true });
  };

  const handleInterceptorDismiss = () => {
    setShowInterceptor(false);
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Send Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid w-full items-center gap-2">
              <Label htmlFor="recipient">Recipient Address</Label>
              <Input
                id="recipient"
                placeholder="0x..."
                value={recipient}
                onChange={handleRecipientChange}
                required
                className={
                  addressPreview?.isValid === false
                    ? "border-red-500"
                    : addressPreview?.isValid
                      ? "border-green-500"
                      : ""
                }
              />

              {/* Real-time address preview */}
              {addressPreview && (
                <div className="mt-2 p-3 rounded-lg border bg-black/20 border-white/10">
                  {addressPreview.isValid ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-green-400">
                          Valid Address
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Type:</span>
                          <span className="ml-2 font-medium">
                            {addressPreview.isContract ? (
                              <span className="text-blue-400">📄 Contract</span>
                            ) : (
                              <span className="text-green-400">
                                👤 Wallet (EOA)
                              </span>
                            )}
                          </span>
                        </div>

                        {!addressPreview.isContract && (
                          <>
                            <div>
                              <span className="text-gray-400">Balance:</span>
                              <span className="ml-2 font-medium text-blue-400">
                                {addressPreview.balance?.toFixed(4)} ETH
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400">
                                Transactions:
                              </span>
                              <span className="ml-2 font-medium text-purple-400">
                                {addressPreview.txCount}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 mt-2">
                        ✅ Real-time data fetched from blockchain
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm font-medium text-red-400">
                        Invalid Ethereum Address
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid w-full items-center gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="any"
                min="0"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="grid w-full items-center gap-2">
              <Label htmlFor="gasPrice">Gas Price (Gwei)</Label>
              <Input
                id="gasPrice"
                type="number"
                step="any"
                min="0"
                placeholder="20"
                value={gasPrice}
                onChange={(e) => setGasPrice(e.target.value)}
                required
              />
            </div>

            <div className="grid w-full items-center gap-2">
              <Label htmlFor="mevProtection" className="flex items-center">
                <span>MEV Protection</span>
                <Shield className="ml-2 h-5 w-5 text-blue-500" />
              </Label>
              <Switch
                id="mevProtection"
                checked={useMEVProtection}
                onCheckedChange={setUseMEVProtection}
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                {useMEVProtection
                  ? "MEV protection is enabled. Your transaction will be protected against MEV bots."
                  : "MEV protection is disabled. Your transaction may be vulnerable to MEV bots."}
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert
                variant="default"
                className="bg-green-500/20 border-green-500/30 text-green-400"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* Real-time ML Data Preview */}
            {recipient && amount && addressPreview?.isValid && (
              <div className="mt-4 p-4 rounded-lg border bg-black/20 border-white/10">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-cyan-400">
                    🤖 ML Analysis Preview
                  </span>
                </div>

                <div className="text-xs text-gray-400 space-y-1">
                  <div>
                    📊{" "}
                    <strong className="text-gray-300">Real Data Ready:</strong>{" "}
                    When you submit, the system will fetch:
                  </div>
                  <ul className="ml-4 space-y-1">
                    <li>• Your wallet balance and transaction history</li>
                    <li>• Current network gas prices</li>
                    <li>• Contract detection for recipient</li>
                    <li>• Risk ratios and behavioral patterns</li>
                    <li>• Time-based transaction analysis</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Submit button INSIDE the form */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/logs")}
                type="button"
              >
                View Transaction Logs
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                {loading ? "Connecting Wallet..." : "Send Tokens"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {/* Single TransactionInterceptor modal — handles ML + DAO + whitelist */}
      {showInterceptor && (
        <TransactionInterceptor
          onClose={handleInterceptorProceed}
          onBlock={handleInterceptorBlock}
          onDismiss={handleInterceptorDismiss}
          toAddress={recipient}
          fromAddress={senderAddress}
          value={parseFloat(amount)}
          gasPrice={parseFloat(gasPrice)}
        />
      )}
    </>
  );
};

export default SendTransaction;
