import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Shield } from "lucide-react";

interface CivicAuthProps {
  onAuthSuccess: (token: string) => void;
  onAuthError: (error: Error) => void;
  clientId?: string;
  walletAddress?: string;
}

const CivicAuth: React.FC<CivicAuthProps> = ({
  onAuthSuccess,
  onAuthError,
  clientId = import.meta.env.VITE_CIVIC_CLIENT_ID,
  walletAddress,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Reset auth state when wallet changes
    setIsAuthenticated(false);
  }, [walletAddress]);

  const handleAuth = async () => {
    if (!clientId) {
      toast({
        title: "Configuration Error",
        description: "Civic client ID is not configured",
        variant: "destructive",
      });
      return;
    }

    if (!walletAddress) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      // Here we'll add the actual Civic auth flow once you provide the client ID
      // For now, we're just simulating success
      const mockToken = "civic_" + Math.random().toString(36).substring(7);

      setIsAuthenticated(true);
      onAuthSuccess(mockToken);

      toast({
        title: "Authentication Success",
        description: "Successfully verified with Civic",
      });
    } catch (error) {
      console.error("Civic auth error:", error);
      onAuthError(error as Error);

      toast({
        title: "Authentication Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to authenticate with Civic",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handleAuth}
        disabled={isLoading || isAuthenticated || !walletAddress}
        className="w-full flex items-center justify-center space-x-2"
      >
        <Shield className="h-4 w-4" />
        <span>
          {isAuthenticated
            ? "✓ Verified with Civic"
            : isLoading
              ? "Verifying..."
              : "Verify with Civic"}
        </span>
      </Button>

      {!walletAddress && (
        <p className="text-sm text-gray-400">
          Connect your wallet to verify with Civic
        </p>
      )}
    </div>
  );
};

export default CivicAuth;
