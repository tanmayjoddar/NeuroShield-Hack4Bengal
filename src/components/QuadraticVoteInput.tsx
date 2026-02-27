import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Vote, Calculator } from "lucide-react";

interface QuadraticVoteInputProps {
  proposalId: number;
  maxTokens: string; // Wei string
  onVote: (
    proposalId: number,
    tokens: string,
    isApprove: boolean,
  ) => Promise<void>;
  isVoting?: boolean;
  className?: string;
}

const QuadraticVoteInput: React.FC<QuadraticVoteInputProps> = ({
  proposalId,
  maxTokens,
  onVote,
  isVoting = false,
  className = "",
}) => {
  const [tokens, setTokens] = useState("");
  const [votePower, setVotePower] = useState("0");

  // Calculate quadratic vote power when tokens change
  useEffect(() => {
    if (!tokens || isNaN(Number(tokens))) {
      setVotePower("0");
      return;
    }

    // Square root of tokens for quadratic voting
    const power = Math.sqrt(Number(tokens));
    setVotePower(power.toFixed(2));
  }, [tokens]);

  // Format helper to display readable numbers
  // maxTokens arrives as a formatted ETH string (e.g. "999800.0"), NOT wei
  const formatNumber = (num: string) => {
    try {
      const n = parseFloat(num);
      return isNaN(n) ? "0" : n.toLocaleString();
    } catch {
      return "0";
    }
  };

  return (
    <Card
      className={`bg-black/20 backdrop-blur-lg border-white/10 ${className}`}
    >
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <Label>SHIELD Tokens</Label>
            <p className="text-sm text-gray-400">
              Available: {formatNumber(maxTokens)}
            </p>
          </div>
          <div className="text-right">
            <Label>Vote Power</Label>
            <div className="flex items-center space-x-1">
              <Calculator className="h-4 w-4 text-cyan-400" />
              <span className="text-cyan-400">{votePower}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Input
            type="number"
            placeholder="Enter amount of tokens..."
            value={tokens}
            onChange={(e) => setTokens(e.target.value)}
            min="0"
            max={formatNumber(maxTokens)}
            disabled={isVoting}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTokens(formatNumber(maxTokens))}
            disabled={isVoting}
          >
            MAX
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button
            onClick={() => onVote(proposalId, tokens, true)}
            disabled={isVoting || !tokens || Number(tokens) <= 0}
            className="bg-green-600/20 hover:bg-green-600/30 border border-green-500/30"
          >
            <Vote className="h-4 w-4 mr-1" />
            {isVoting ? "Voting..." : "Approve"}
          </Button>
          <Button
            onClick={() => onVote(proposalId, tokens, false)}
            disabled={isVoting || !tokens || Number(tokens) <= 0}
            className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/30"
          >
            <Vote className="h-4 w-4 mr-1" />
            {isVoting ? "Voting..." : "Reject"}
          </Button>
        </div>

        {Number(tokens) > 0 && (
          <div className="text-center">
            <Badge className="bg-cyan-500/20 text-cyan-400">
              Your vote power will be {votePower}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuadraticVoteInput;
