import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SendTransaction from "@/components/SendTransaction";
import { connectWallet } from "@/web3/wallet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Wallet, Shield } from "lucide-react";

const SendPage: React.FC = () => {
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [lastTransaction, setLastTransaction] = useState<string | null>(null);
  const [fraudDetectionEnabled, setFraudDetectionEnabled] =
    useState<boolean>(true);
  const navigate = useNavigate();

  // Connect wallet on initial load
  useEffect(() => {
    const connectOnLoad = async () => {
      const address = await connectWallet();
      setConnectedAddress(address);
    };

    connectOnLoad();
  }, []);

  // Handle wallet connect button click
  const handleConnectWallet = async () => {
    const address = await connectWallet();
    setConnectedAddress(address);
  };

  // Handle successful transaction
  const handleTransactionSuccess = (txHash: string) => {
    setLastTransaction(txHash);
  };

  // Handle fraud detected
  const handleFraudDetected = (fraudData: any) => {
    console.log("Fraud detected:", fraudData);
    // Additional logic can be added here if needed
  };

  // Toggle fraud detection
  const toggleFraudDetection = () => {
    setFraudDetectionEnabled(!fraudDetectionEnabled);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto py-8 max-w-2xl px-6">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/")}
            className="border-white/20 text-gray-300 hover:bg-white/10"
          >
            <Wallet className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold text-white">Send Tokens</h1>
        </div>

        {/* Wallet Connection Status */}
        <Card className="mb-6 bg-black/20 backdrop-blur-lg border-white/10">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-white">Wallet Status</CardTitle>
              {connectedAddress ? (
                <Badge
                  variant="outline"
                  className="bg-green-500/20 text-green-400 border-green-500/30"
                >
                  Connected
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                >
                  Not Connected
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {connectedAddress ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Connected Address:</p>
                  <p className="font-mono text-sm text-white">
                    {connectedAddress}
                  </p>
                </div>
                <Wallet className="h-5 w-5 text-gray-400" />
              </div>
            ) : (
              <div className="text-center">
                <p className="mb-2 text-sm text-gray-400">
                  Please connect your wallet to continue
                </p>
                <Button
                  onClick={handleConnectWallet}
                  className="bg-cyan-500 hover:bg-cyan-600"
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fraud Detection Status */}
        <Card className="mb-6 bg-black/20 backdrop-blur-lg border-white/10">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-white">
                Transaction Protection
              </CardTitle>
              <Button
                variant={fraudDetectionEnabled ? "default" : "outline"}
                size="sm"
                onClick={toggleFraudDetection}
                className={
                  fraudDetectionEnabled
                    ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                    : "border-white/20 text-gray-400"
                }
              >
                <Shield className="mr-2 h-4 w-4" />
                {fraudDetectionEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
            <CardDescription className="text-gray-400">
              AI-powered fraud detection using external ML API
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex items-start space-x-2 text-sm">
              <AlertCircle
                className={`h-5 w-5 ${fraudDetectionEnabled ? "text-green-400" : "text-yellow-400"}`}
              />
              <p className="text-gray-300">
                {fraudDetectionEnabled
                  ? "Fraud detection is active. Suspicious transactions will be flagged before processing."
                  : "Warning: Fraud detection is disabled. Enable it to protect your assets."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Send Transaction Form */}
        {connectedAddress ? (
          <SendTransaction
            onSuccess={handleTransactionSuccess}
            onFraudDetected={handleFraudDetected}
          />
        ) : (
          <Card className="bg-black/20 backdrop-blur-lg border-white/10">
            <CardContent className="py-8">
              <div className="text-center text-gray-400">
                <Wallet className="mx-auto h-8 w-8 mb-2" />
                <p>Connect your wallet to send tokens</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Last Transaction Info */}
        {lastTransaction && (
          <div className="mt-6">
            <Card className="bg-black/20 backdrop-blur-lg border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Transaction Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400">Transaction Hash:</p>
                <p className="font-mono text-sm break-all text-white">
                  {lastTransaction}
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full border-white/20 text-gray-300 hover:bg-white/10"
                  onClick={() =>
                    window.open(
                      `https://explorer.testnet.monad.xyz/tx/${lastTransaction}`,
                      "_blank",
                    )
                  }
                >
                  View on Explorer
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default SendPage;
