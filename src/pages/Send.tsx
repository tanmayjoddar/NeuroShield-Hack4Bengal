import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import TransactionInterceptor from '@/components/TransactionInterceptor';
import { ethers } from 'ethers';
import walletConnector from '@/web3/wallet';
import { isValidAddress } from '@/web3/utils';

interface PendingTransaction {
  to: string;
  value: bigint;
  gasLimit: bigint;
  gasPrice: bigint;
  signer: ethers.JsonRpcSigner;
}

interface TransactionResult {
  hash: string;
  success: boolean;
  error?: string;
}

const Send = () => {
  // Form state
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [gasPrice, setGasPrice] = useState(20);
  
  // UI state
  const [showInterceptor, setShowInterceptor] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Transaction state
  const [pendingTx, setPendingTx] = useState<PendingTransaction | null>(null);
  const { toast } = useToast();

  const resetForm = () => {
    setToAddress('');
    setAmount('');
    setPendingTx(null);
    setError(null);
    setIsProcessing(false);
    setShowInterceptor(false);
  };

  const prepareSendTransaction = async () => {
    try {
      if (!window.ethereum) throw new Error("Please install MetaMask");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Basic transaction setup
      const value = ethers.parseEther(amount.toString());
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || (20n * (10n ** 9n)); // Default 20 gwei if null

      // Estimate gas with a buffer
      const gasEstimate = await provider.estimateGas({
        to: toAddress,
        value,
        from: await signer.getAddress()
      });
      const gasLimit = gasEstimate + (gasEstimate * 20n / 100n); // Add 20% buffer

      return {
        to: toAddress,
        value,
        gasLimit,
        gasPrice,
        signer
      };
    } catch (err: any) {
      console.error('Error preparing transaction:', err);
      throw new Error(err.message || 'Failed to prepare transaction');
    }
  };

  const executeTransaction = async () => {
    if (!pendingTx) return;
    
    try {
      const { signer, ...tx } = pendingTx;
      const transaction = await signer.sendTransaction(tx);
      
      toast({
        title: "Transaction Sent",
        description: `Transaction hash: ${transaction.hash}`,
      });

      resetForm();
      return { hash: transaction.hash, success: true };
    } catch (err: any) {
      console.error('Transaction failed:', err);
      toast({
        title: "Transaction Failed",
        description: err.message,
        variant: "destructive"
      });
      return { hash: '', success: false, error: err.message };
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!walletConnector.address) {
        throw new Error("Please connect your wallet first");
      }

      if (!isValidAddress(toAddress)) {
        throw new Error("Please enter a valid recipient address");
      }

      if (!amount || parseFloat(amount) <= 0) {
        throw new Error("Please enter a valid amount");
      }

      setIsProcessing(true);
      setError(null);

      // Check balance
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(walletConnector.address);
      const amountInWei = ethers.parseEther(amount);
      
      if (balance < amountInWei) {
        throw new Error("Insufficient balance for this transaction");
      }

      // Prepare transaction but don't send
      const tx = await prepareSendTransaction();
      setPendingTx(tx);
      try {
        setGasPrice(Number(ethers.formatUnits(tx.gasPrice, "gwei")));
      } catch {
        // non-fatal
      }
      setShowInterceptor(true);

    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBlockTransaction = () => {
    toast({
      title: "Transaction Blocked",
      description: "The transaction was blocked due to security concerns",
      variant: "default"
    });
    resetForm();
  };

  const handleDismissInterceptor = () => {
    // User dismissed the interceptor (Esc/backdrop/X). Do not send.
    setShowInterceptor(false);
    setPendingTx(null);
    setIsProcessing(false);
  };

  const handleProceedAnyway = async () => {
    setShowInterceptor(false);
    
    try {
      await executeTransaction();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-xl mx-auto bg-black/20 backdrop-blur-lg border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Send Tokens Securely</CardTitle>
          {error && (
            <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="to">Recipient Address</Label>
              <Input
                id="to"
                placeholder="0x..."
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (ETH)</Label>
              <Input
                id="amount"
                type="number"
                step="0.000000000000000001"
                min="0"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
                required
              />
            </div>

            <Button 
              type="submit"
              className="w-full bg-cyan-600 hover:bg-cyan-700"
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Send Tokens'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Transaction Interceptor Modal */}
      {showInterceptor && (
        <TransactionInterceptor
          onClose={handleProceedAnyway}
          onBlock={handleBlockTransaction}
          onDismiss={handleDismissInterceptor}
          fromAddress={walletConnector.address || ''}
          toAddress={toAddress}
          value={parseFloat(amount)}
          gasPrice={gasPrice}
        />
      )}
    </div>
  );
};

export default Send;
