import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import QuadraticVoteInput from "../QuadraticVoteInput";
import { useToast } from "@/hooks/use-toast";
import { type ToastActionElement } from "@/components/ui/toast";
import contractService from "@/web3/contract";
import walletConnector from "@/web3/wallet";
import { shortenAddress } from "@/web3/utils";

interface ScamReport {
  id: number;
  reporter: string;
  suspiciousAddress: string;
  description: string;
  evidence: string;
  timestamp: Date;
  votesFor: string; // Wei string from contract
  votesAgainst: string; // Wei string from contract
  status: "active" | "approved" | "rejected";
  category?: string;
}

type ToastProps = {
  title: string;
  description: string;
  variant?: "default" | "destructive";
  action?: ToastActionElement;
};

const EmptyState = ({
  onNavigateToReports,
}: {
  onNavigateToReports?: () => void;
}) => (
  <div className="flex flex-col items-center justify-center p-8 text-center bg-black/20 rounded-lg border border-white/10">
    <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
    <h3 className="text-xl font-semibold text-white mb-2">
      No Active Proposals
    </h3>
    <p className="text-gray-400 mb-4">
      Help secure the community by being the first to report suspicious
      activity. Your report will be voted on by SHIELD token holders using
      quadratic voting.
    </p>
    <Button
      className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
      onClick={() => onNavigateToReports?.()}
    >
      Submit First Report
    </Button>
  </div>
);

interface DAOPanelProps {
  onNavigateToReports?: () => void;
}

const DAOPanel = ({ onNavigateToReports }: DAOPanelProps) => {
  const { toast } = useToast();

  // State management
  const [userVotes, setUserVotes] = useState<{
    [key: number]: "approve" | "reject" | null;
  }>({});
  const [proposals, setProposals] = useState<ScamReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userShield, setUserShield] = useState<string>("0"); // Wei string
  const [totalVotes, setTotalVotes] = useState(0);
  const [votingAccuracy, setVotingAccuracy] = useState(0);
  const [isVoting, setIsVoting] = useState(false);

  // Fetch data callback
  const fetchData = useCallback(async () => {
    if (!walletConnector.provider) {
      setLoading(false);
      return;
    }

    try {
      // Get user's SHIELD token balance
      const shieldBalance = await contractService.getShieldBalance(
        walletConnector.address,
      );
      setUserShield(shieldBalance);

      // Get user's voting stats
      const stats = await contractService.getUserVotingStats(
        walletConnector.address,
      );
      setTotalVotes(stats.totalVotes);
      setVotingAccuracy(stats.accuracy);

      // Get proposals from contract
      const reports = await contractService.getScamReports();

      // Add category based on description keywords
      const categorizedReports = reports.map((report) => ({
        ...report,
        category: getCategoryFromDescription(report.description),
      }));

      setProposals(categorizedReports);
    } catch (error: any) {
      console.error("Error fetching DAO data:", error);
      setError(error.message || "Failed to load DAO data");
    } finally {
      setLoading(false);
    }
  }, [walletConnector.address]);

  // Load proposals and user data from the contract
  useEffect(() => {
    fetchData();

    // Set up event listeners for updates
    const handleAccountChange = () => {
      setLoading(true); // Show loading while refreshing data
      fetchData();
    };

    const handleNewProposal = () => {
      toast({
        title: "New Proposal",
        description: "A new proposal has been created. Refreshing data...",
      } as ToastProps);
      fetchData();
    };

    const handleNewVote = () => fetchData();

    // Register listeners — accountsChanged is an EIP-1193 event on
    // window.ethereum, NOT an ethers ProviderEvent.
    const eth = (window as any).ethereum;
    eth?.on("accountsChanged", handleAccountChange);
    contractService.on("ProposalCreated", handleNewProposal);
    contractService.on("VoteCast", handleNewVote);

    // Cleanup on unmount
    return () => {
      eth?.removeListener("accountsChanged", handleAccountChange);
      contractService.off("ProposalCreated", handleNewProposal);
      contractService.off("VoteCast", handleNewVote);
    };
  }, [fetchData, toast]);

  // Handle quadratic voting
  const handleVote = async (
    proposalId: number,
    tokens: string,
    isApprove: boolean,
  ) => {
    if (!walletConnector.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to vote on proposals.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsVoting(true);
      setError(null);

      // Update UI immediately for better UX
      setUserVotes((prev) => ({
        ...prev,
        [proposalId]: isApprove ? "approve" : "reject",
      }));

      // Approve tokens if needed
      const needsApproval = await contractService.needsShieldApproval(tokens);
      if (needsApproval) {
        const approveTx = await contractService.approveShield(tokens);
        await approveTx.wait();
      }

      // Cast the vote with quadratic voting power
      const tx = await contractService.castQuadraticVote(
        proposalId.toString(),
        isApprove,
        tokens,
      );

      await tx.wait();

      // Calculate voting power for toast message
      const votingPower = Math.sqrt(Number(tokens));

      toast({
        title: "🗳️ Vote Submitted",
        description: `Your vote has been recorded with ${votingPower.toFixed(2)} voting power`,
      } as ToastProps);

      // Refresh data
      const reports = await contractService.getScamReports();
      setProposals(
        reports.map((report) => ({
          ...report,
          category: getCategoryFromDescription(report.description),
        })),
      );
    } catch (error: any) {
      console.error("Voting error:", error);
      setError(error.message || "Failed to submit vote");
      // Revert the optimistic update
      setUserVotes((prev) => ({ ...prev, [proposalId]: null }));

      toast({
        title: "❌ Vote Failed",
        description: error.message || "Failed to submit vote",
        variant: "destructive",
      } as ToastProps);
    } finally {
      setIsVoting(false);
    }
  };

  // Get CSS class for status badge
  const getStatusColor = (status: ScamReport["status"]) => {
    switch (status) {
      case "approved":
        return "text-green-400 bg-green-500/20 border-green-500/30";
      case "rejected":
        return "text-red-400 bg-red-500/20 border-red-500/30";
      default:
        return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30";
    }
  };

  // Get category from description
  const getCategoryFromDescription = (description: string): string => {
    const lowerDesc = description.toLowerCase();
    if (lowerDesc.includes("nft")) return "NFT Scam";
    if (lowerDesc.includes("defi") || lowerDesc.includes("liquidity"))
      return "DeFi Attack";
    if (lowerDesc.includes("phish")) return "Phishing";
    if (lowerDesc.includes("malware")) return "Malware";
    if (lowerDesc.includes("honeypot")) return "Honeypot";
    if (lowerDesc.includes("airdrop")) return "Airdrop Scam";
    if (lowerDesc.includes("hack")) return "Protocol Hack";
    return "Other";
  };

  // Get CSS class for category badge
  const getCategoryColor = (category: string) => {
    switch (category) {
      case "NFT Scam":
        return "bg-purple-500/20 text-purple-400";
      case "DeFi Attack":
        return "bg-blue-500/20 text-blue-400";
      case "Phishing":
        return "bg-orange-500/20 text-orange-400";
      case "Malware":
        return "bg-red-500/20 text-red-400";
      case "Honeypot":
        return "bg-yellow-500/20 text-yellow-400";
      case "Airdrop Scam":
        return "bg-green-500/20 text-green-400";
      case "Protocol Hack":
        return "bg-pink-500/20 text-pink-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  if (loading) {
    return (
      <Card className="bg-black/20 backdrop-blur-lg border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-400" />
            Quadratic Voting DAO
          </CardTitle>
          <CardDescription className="text-gray-400">
            Loading community proposals...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 bg-white/5" />
            ))}
          </div>
          <Skeleton className="h-[200px] bg-white/5" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-black/20 backdrop-blur-lg border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <Users className="h-5 w-5 text-cyan-400" />
            <span>Quadratic Voting DAO</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Vote on community-reported threats using your SHIELD tokens. Your
            voting power scales with the square root of tokens used.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <TooltipProvider>
              <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                  {parseFloat(userShield || "0").toLocaleString()} SHIELD
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Your SHIELD token balance. More tokens = more voting power
                      (quadratically).
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-sm text-gray-400">Available Balance</div>
              </div>

              <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                  {totalVotes}
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Total number of proposals you've voted on
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-sm text-gray-400">Votes Cast</div>
              </div>

              <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                  {votingAccuracy}%
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Percentage of your votes that aligned with final outcomes
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-sm text-gray-400">Voting Accuracy</div>
              </div>
            </TooltipProvider>
          </div>

          {error && (
            <div className="p-4 mb-4 bg-red-500/20 border border-red-500/30 rounded-md flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {!walletConnector.address && (
            <div className="text-center p-4 bg-blue-500/20 border border-blue-500/30 rounded-md">
              <p className="text-blue-400">
                Connect your wallet to view and vote on DAO proposals
              </p>
            </div>
          )}

          {proposals.length === 0 && walletConnector.address && (
            <EmptyState onNavigateToReports={onNavigateToReports} />
          )}

          {proposals.map((proposal) => (
            <Card
              key={proposal.id}
              className="bg-black/20 backdrop-blur-lg border-white/10 mb-4"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-white">
                        Report #{proposal.id}:{" "}
                        {shortenAddress(proposal.suspiciousAddress)}
                      </h3>
                      <Badge className={getStatusColor(proposal.status)}>
                        {proposal.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Badge
                        className={getCategoryColor(proposal.category || "")}
                      >
                        {proposal.category || "Uncategorized"}
                      </Badge>
                      <span className="text-sm text-gray-400">
                        Reported by {shortenAddress(proposal.reporter)}
                      </span>
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(proposal.timestamp).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>
                </div>

                <p className="mt-2 text-gray-300">{proposal.description}</p>

                {proposal.evidence && (
                  <a
                    href={proposal.evidence}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-cyan-400 hover:underline flex items-center mt-1"
                  >
                    View Evidence
                  </a>
                )}
              </CardHeader>

              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <ThumbsUp className="h-4 w-4 text-green-500" />
                      <span className="text-white">
                        {Number(proposal.votesFor).toLocaleString()} Power
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ThumbsDown className="h-4 w-4 text-red-500" />
                      <span className="text-white">
                        {Number(proposal.votesAgainst).toLocaleString()} Power
                      </span>
                    </div>
                  </div>
                </div>

                {proposal.status === "active" && (
                  <QuadraticVoteInput
                    proposalId={proposal.id}
                    maxTokens={userShield}
                    onVote={handleVote}
                    isVoting={isVoting && userVotes[proposal.id] !== null}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default DAOPanel;
