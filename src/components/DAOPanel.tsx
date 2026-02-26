
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Vote, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import contractService from '@/web3/contract';
import walletConnector from '@/web3/wallet';
import { voteOnProposal } from '@/web3/contract';
import { shortenAddress } from '@/web3/utils';

interface ScamReport {
  id: number;
  reporter: string;
  suspiciousAddress: string;
  description: string;
  evidence: string;
  timestamp: Date;
  votesFor: number;
  votesAgainst: number;
  confirmed: boolean;
}

const DAOPanel = () => {
  const [userVotes, setUserVotes] = useState<{[key: number]: 'approve' | 'reject' | null}>({});
  const [proposals, setProposals] = useState<ScamReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userShield, setUserShield] = useState<number>(0);
  const [votesCast, setVotesCast] = useState<number>(0);
  const [accuracyRate, setAccuracyRate] = useState<number>(0);
  const [isVoting, setIsVoting] = useState<boolean>(false);
  // Load proposals from the contract
  useEffect(() => {
    const fetchScamReports = async () => {
      try {
        setLoading(true);
        setError(null);
        if (walletConnector.address) {
          // Get all scam reports from the contract
          const reports = await contractService.getScamReports();
          
          // Sort by timestamp descending (newest first)
          const sortedReports = [...reports].sort((a, b) => 
            b.timestamp.getTime() - a.timestamp.getTime()
          );
          
          setProposals(sortedReports);
          
          // Fetch real on-chain stats for the connected wallet
          try {
            const balance = await contractService.getShieldBalance(walletConnector.address!);
            const balNum = parseFloat(balance || '0') / 1e18;
            setUserShield(Math.round(balNum));
          } catch {
            setUserShield(0);
          }

          try {
            const stats = await contractService.getUserVotingStats(walletConnector.address!);
            setVotesCast(stats.totalVotes);
            setAccuracyRate(stats.accuracy);
          } catch {
            setVotesCast(0);
            setAccuracyRate(0);
          }
        }
      } catch (err: any) {
        console.error("Error fetching scam reports:", err);
        setError(err.message || "Failed to load DAO proposals");
      } finally {
        setLoading(false);
      }
    };
    
    // Fetch immediately on mount
    fetchScamReports();
    
    // Set up event listener for wallet connection changes
    const handleAccountChange = () => fetchScamReports();
    window.addEventListener('wallet_accountChanged', handleAccountChange);
    
    // Cleanup
    return () => {
      window.removeEventListener('wallet_accountChanged', handleAccountChange);
    };
  }, []);
  
  // Handle vote submission
  const handleVote = async (proposalId: number, vote: 'approve' | 'reject') => {
    if (!walletConnector.address) {
      setError("Please connect your wallet to vote");
      return;
    }
    
    try {
      setIsVoting(true);
      setError(null);
      
      // Update local state for immediate UI feedback
      setUserVotes(prev => ({ ...prev, [proposalId]: vote }));
      
      // Submit vote to the blockchain
      const hash = await voteOnProposal(proposalId.toString(), vote === 'approve');
      
      // Refresh the proposals list after voting
      const reports = await contractService.getScamReports();
      const sortedReports = [...reports].sort((a, b) => 
        b.timestamp.getTime() - a.timestamp.getTime()
      );
      setProposals(sortedReports);
      
    } catch (err: any) {
      console.error("Voting error:", err);
      setError(err.message || "Failed to submit vote");
      
      // Revert the optimistic update
      setUserVotes(prev => ({ ...prev, [proposalId]: null }));
    } finally {
      setIsVoting(false);
    }
  };

  const getStatusColor = (confirmed: boolean | undefined) => {
    // If we have confirmed status from the blockchain
    if (confirmed !== undefined) {
      return confirmed 
        ? 'text-green-400 bg-green-500/20 border-green-500/30'  // Approved/confirmed
        : 'text-red-400 bg-red-500/20 border-red-500/30';       // Rejected
    }
    
    // If we don't have status info, it's active/pending
    return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
  };

  // Helper to get a category based on the description
  const getCategory = (description: string): string => {
    const desc = description.toLowerCase();
    if (desc.includes('nft') || desc.includes('mint')) return 'NFT Mint Scam';
    if (desc.includes('token') || desc.includes('honeypot')) return 'Honeypot';
    if (desc.includes('approval') || desc.includes('drain')) return 'Approval Drainer';
    if (desc.includes('phishing')) return 'Phishing';
    return 'Other Scam';
  };
  
  const getCategoryColor = (description: string) => {
    const category = getCategory(description);
    switch (category) {
      case 'NFT Mint Scam': return 'bg-purple-500/20 text-purple-400';
      case 'Honeypot': return 'bg-yellow-500/20 text-yellow-400';
      case 'Approval Drainer': return 'bg-red-500/20 text-red-400';
      case 'Phishing': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };
  return (
    <div className="space-y-6">
      <Card className="bg-black/20 backdrop-blur-lg border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <Users className="h-5 w-5 text-cyan-400" />
            <span>DAO Governance Panel</span>
          </CardTitle>
          <p className="text-gray-400">Vote on community-reported threats using your SHIELD tokens</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="text-2xl font-bold text-white">{userShield.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Your SHIELD Balance</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="text-2xl font-bold text-white">{votesCast}</div>
              <div className="text-sm text-gray-400">Votes Cast</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="text-2xl font-bold text-white">{accuracyRate}%</div>
              <div className="text-sm text-gray-400">Accuracy Rate</div>
            </div>
          </div>
          
          {error && (
            <div className="p-4 mb-4 bg-red-500/20 border border-red-500/30 rounded-md flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <p className="text-red-400">{error}</p>
            </div>
          )}
          
          {loading && (
            <div className="text-center p-4">
              <p className="text-gray-400">Loading proposals...</p>
            </div>
          )}
          
          {!walletConnector.address && !loading && (
            <div className="text-center p-4 bg-blue-500/20 border border-blue-500/30 rounded-md">
              <p className="text-blue-400">Connect your wallet to view and vote on DAO proposals</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proposals */}
      <div className="space-y-4">
        {proposals.length === 0 && !loading && walletConnector.address && (
          <Card className="bg-black/20 backdrop-blur-lg border-white/10">
            <CardContent className="p-6 text-center">
              <p className="text-gray-400">No scam reports found. Be the first to report a scam!</p>
            </CardContent>
          </Card>
        )}
        
        {proposals.map((report) => {
          // Create a title from the address
          const title = `Report: Suspicious Address ${shortenAddress(report.suspiciousAddress)}`;
          
          // Determine status
          const status = report.confirmed ? 'approved' : (!report.confirmed && (report.votesAgainst > report.votesFor)) ? 'rejected' : 'active';
          
          // Calculate timeLeft (in a real app, this would come from the contract)
          const now = new Date();
          const daysSinceCreation = Math.floor((now.getTime() - report.timestamp.getTime()) / (1000 * 60 * 60 * 24));
          const timeLeft = daysSinceCreation > 2 ? 'Completed' : `${2 - daysSinceCreation} days`;
          
          // Get category from description
          const category = getCategory(report.description);
          
          // Calculate total staked (mock value - would come from contract)
          const totalStaked = `${(report.votesFor + report.votesAgainst) * 100} SHIELD`;
          
          return (
            <Card key={report.id} className="bg-black/20 backdrop-blur-lg border-white/10">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-white">{title}</h3>
                      <Badge className={getStatusColor(report.confirmed)}>
                        {status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getCategoryColor(report.description)}>
                        {category}
                      </Badge>
                      <span className="text-sm text-gray-400">
                        Reported by {shortenAddress(report.reporter)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-1 text-gray-400 text-sm">
                      <Clock className="h-4 w-4" />
                      <span>{timeLeft}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Contract Address:</div>
                    <div className="font-mono text-sm text-white bg-white/5 p-2 rounded border border-white/10">
                      {report.suspiciousAddress}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Description:</div>
                    <p className="text-white">{report.description}</p>
                  </div>
                  
                  {report.evidence && (
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Evidence:</div>
                      <p className="text-white break-all">{report.evidence}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-white">{report.votesFor} Approve</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-white">{report.votesAgainst} Reject</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        Total Staked: {totalStaked}
                      </div>
                    </div>

                    {status === 'active' && (
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleVote(report.id, 'approve')}
                          disabled={isVoting || userVotes[report.id] === 'approve'}
                          className={`${
                            userVotes[report.id] === 'approve'
                              ? 'bg-green-600 hover:bg-green-700'
                              : 'bg-green-600/20 hover:bg-green-600/30 border border-green-500/30'
                          }`}
                        >
                          <Vote className="h-4 w-4 mr-1" />
                          {isVoting && userVotes[report.id] === 'approve' ? 'Voting...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleVote(report.id, 'reject')}
                          disabled={isVoting || userVotes[report.id] === 'reject'}
                          className={`${
                            userVotes[report.id] === 'reject'
                              ? 'bg-red-600 hover:bg-red-700'
                              : 'bg-red-600/20 hover:bg-red-600/30 border border-red-500/30'
                          }`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {isVoting && userVotes[report.id] === 'reject' ? 'Voting...' : 'Reject'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DAOPanel;
