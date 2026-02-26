import React, { useState, useEffect } from "react";
import {
  verifyCivicIdentity,
  getCivicProfile,
  calculateTrustScore,
  createCivicWallet,
} from "../../web3/civic/auth";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Progress } from "../ui/progress";

interface CivicAuthProps {
  address: string;
  onVerified?: (isVerified: boolean) => void;
}

const CivicAuth: React.FC<CivicAuthProps> = ({ address, onVerified }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [profile, setProfile] = useState<any>(null);
  const [trustScore, setTrustScore] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const checkVerification = async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const verificationResult = await verifyCivicIdentity(address);
      setIsVerified(verificationResult.isVerified);

      if (verificationResult.isVerified) {
        // Fetch profile if verified
        const profileData = await getCivicProfile(address);
        setProfile(profileData);

        // Calculate trust score
        const trustData = await calculateTrustScore(address);
        setTrustScore(trustData);

        // Trigger callback if provided
        if (onVerified) {
          onVerified(true);
        }
      }
    } catch (err) {
      console.error("Verification error:", err);
      setError("Failed to verify with Civic. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWallet = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await createCivicWallet();
      if (result.success) {
        // Handle successful wallet creation
        console.log("Created wallet:", result.wallet);
        // You'd typically update the app state with the new wallet here
      } else {
        setError(result.error || "Failed to create wallet");
      }
    } catch (err) {
      console.error("Wallet creation error:", err);
      setError("Failed to create wallet with Civic. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (address) {
      checkVerification();
    }
  }, [address]);

  const getTrustLevelColor = () => {
    if (!trustScore) return "bg-gray-300";

    switch (trustScore.level) {
      case "High":
        return "bg-green-500";
      case "Medium":
        return "bg-yellow-500";
      case "Low":
        return "bg-red-500";
      default:
        return "bg-gray-300";
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Civic Identity
          {isVerified && (
            <Badge
              variant="outline"
              className="ml-2 bg-green-50 text-green-700 border-green-200"
            >
              Verified
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Verify your identity with Civic to unlock full wallet features
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="bg-red-50 text-red-700 p-2 rounded mb-4">{error}</div>
        )}

        {!address ? (
          <div className="text-center">
            <p className="mb-4">
              Create a new wallet with Civic to get started
            </p>
            <Button onClick={handleCreateWallet} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Wallet with Civic"}
            </Button>
          </div>
        ) : !isVerified ? (
          <div className="text-center">
            <p className="mb-4">
              Verify your wallet with Civic to enhance security
            </p>
            <Button onClick={checkVerification} disabled={isLoading}>
              {isLoading ? "Verifying..." : "Verify with Civic"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {profile && (
              <div className="flex items-center space-x-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={profile.avatar} alt={profile.name} />
                  <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">{profile.name}</h3>
                  <p className="text-sm text-gray-500">
                    Verified since{" "}
                    {new Date(profile.joinedDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            {trustScore && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Trust Score</span>
                  <span className="font-bold">{trustScore.score}/100</span>
                </div>
                <Progress
                  value={trustScore.score}
                  className={getTrustLevelColor()}
                />
                <div className="text-xs text-gray-500 flex justify-between">
                  <span>Low Trust</span>
                  <span>High Trust</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-center border-t pt-4 mt-2">
        <p className="text-xs text-center text-gray-500">
          Powered by Civic - Web3's trusted identity verification protocol
        </p>
      </CardFooter>
    </Card>
  );
};

export default CivicAuth;
