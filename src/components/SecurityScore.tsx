import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  TrendingUp,
  Award,
  Zap,
  Loader2,
  Lock,
  Unlock,
  Send,
  History,
  AlertTriangle,
  CheckCircle2,
  Network,
  Activity,
  Share2,
  XCircle,
  AlertOctagon,
  Brain,
} from "lucide-react";
import walletConnector from "@/web3/wallet";
import contractService from "@/web3/contract";
import "../styles/security-score.css";

interface SecurityScoreProps {
  defaultScore?: number;
  onLevelUp?: () => void;
}

interface Transaction {
  id: string;
  type: "send" | "receive";
  amount: string;
  address: string;
  status: "pending" | "completed" | "blocked";
  timestamp: number;
  risk: "low" | "medium" | "high";
}

const ShieldIcon: React.FC<{ score?: number; className?: string }> = ({
  score,
  className,
}) => (
  <div className={className}>
    <Shield
      className={`w-full h-full ${
        score && score >= 80
          ? "text-emerald-500"
          : score && score >= 60
            ? "text-yellow-400"
            : "text-red-500"
      }`}
    />
  </div>
);

export const SecurityScore: React.FC<SecurityScoreProps> = ({
  defaultScore = 65,
  onLevelUp,
}) => {
  const [score, setScore] = useState<number>(defaultScore);
  const [level, setLevel] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [pulseEffect, setPulseEffect] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [securityBreakdown, setSecurityBreakdown] = useState({
    threatsBlocked: 0,
    daoVotes: 0,
    reports: 0,
    walletAge: 0,
  });

  // New state for transaction simulation
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<
    "safe" | "scam" | null
  >(null);
  const [simulationAddress, setSimulationAddress] = useState("");

  // New states for sending tokens
  const [activeTab, setActiveTab] = useState<"send" | "simulate" | "monitor">(
    "send",
  );
  const [sendAmount, setSendAmount] = useState("");
  const [sendAddress, setSendAddress] = useState("");
  const [transactionHistory] = useState([
    {
      type: "blocked",
      address: "0x71C...9E3B",
      amount: "1.5 ETH",
      threat: "Malicious Contract",
    },
    { type: "safe", address: "0x8F2...1D4A", amount: "0.8 ETH", threat: null },
    {
      type: "blocked",
      address: "0x3A9...7C2D",
      amount: "500 USDT",
      threat: "Phishing Attempt",
    },
  ]);

  // Load security score data from the smart contract or API
  useEffect(() => {
    const fetchSecurityData = async () => {
      if (!walletConnector.address) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Get the user's reports count
        let reports = 0;
        try {
          const userReports = await contractService.getUserReports();
          reports = userReports.length;
        } catch (err) {
          console.error("Failed to get user reports:", err);
        }

        // Get the user's DAO votes from contract (real call already in DAOPanel)
        let daoVotes = 0;
        try {
          // Read from localStorage where DAO votes are tracked
          const voteLogs = localStorage.getItem("dao-votes");
          if (voteLogs) {
            const parsed = JSON.parse(voteLogs);
            daoVotes = Array.isArray(parsed) ? parsed.length : 0;
          }
        } catch {
          /* fallback to 0 */
        }

        // Calculate wallet age from transaction count as a proxy
        let walletAge = 0;
        try {
          if (walletConnector.provider) {
            const txCount = await walletConnector.provider.getTransactionCount(
              walletConnector.address,
            );
            // Estimate: ~1 tx per day on average
            walletAge = Math.min(365, Math.max(1, txCount));
          }
        } catch {
          /* fallback to 0 */
        }

        // Get real blocked threats from transaction logs
        let threatsBlocked = 0;
        try {
          const rawLogs = localStorage.getItem("transaction-logs");
          if (rawLogs) {
            const logs = JSON.parse(rawLogs);
            threatsBlocked = logs.filter((l: any) => l.blocked).length;
          }
        } catch {
          /* fallback to 0 */
        }

        const breakdown = {
          threatsBlocked,
          daoVotes,
          reports,
          walletAge,
        };

        setSecurityBreakdown(breakdown);

        // Calculate score based on the breakdown
        const calculatedScore =
          Math.min(25, threatsBlocked) +
          Math.min(30, daoVotes * 2) +
          Math.min(20, reports * 5) +
          Math.min(25, walletAge * 3);

        setScore(calculatedScore);
      } catch (err: any) {
        console.error("Error fetching security data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSecurityData();

    // Re-fetch when wallet changes
    const handleAccountChange = () => fetchSecurityData();
    window.addEventListener("wallet_accountChanged", handleAccountChange);

    return () => {
      window.removeEventListener("wallet_accountChanged", handleAccountChange);
    };
  }, []);

  // Update level when score changes
  useEffect(() => {
    const shieldLevel = getShieldLevel(score);
    setLevel(shieldLevel.level);
  }, [score]);

  const getShieldLevel = (score: number) => {
    if (score >= 90)
      return {
        level: "Guardian Elite",
        color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
        icon: "🛡️⭐",
        gradient: "from-indigo-600 to-violet-500",
      };
    if (score >= 75)
      return {
        level: "Shield Master",
        color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
        icon: "🛡️💎",
        gradient: "from-cyan-500 to-blue-500",
      };
    if (score >= 60)
      return {
        level: "Defender",
        color: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
        icon: "🛡️⚡",
        gradient: "from-fuchsia-500 to-pink-500",
      };
    if (score >= 40)
      return {
        level: "Guardian",
        color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
        icon: "🛡️",
        gradient: "from-violet-500 to-purple-500",
      };
    return {
      level: "Rookie",
      color: "text-slate-400 bg-slate-500/10 border-slate-500/20",
      icon: "🛡️🌱",
      gradient: "from-slate-500 to-gray-500",
    };
  };

  const handleShieldClick = () => {
    setIsExpanded(!isExpanded);
    setIsRotating(true);
    setTimeout(() => setIsRotating(false), 1000);
  };

  const simulateTransaction = () => {
    setIsSimulating(true);
    // Simulate checking transaction
    setTimeout(() => {
      const result = Math.random() > 0.5 ? "safe" : "scam";
      setSimulationResult(result);
      setIsSimulating(false);
      // Update security score if scam detected
      if (result === "scam") {
        setScore((prev) => Math.min(100, prev + 5));
      }
    }, 2000);
  };

  const handleSendToken = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const isScam = Math.random() > 0.7;
      setSimulationResult(isScam ? "scam" : "safe");
      setIsSimulating(false);
      if (isScam) {
        setScore((prev) => Math.min(100, prev + 3));
      }
    }, 2000);
  };

  const handleScan = async () => {
    setIsSimulating(true);
    // Simulate scanning delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setScore((prev) => Math.min(prev + 10, 100));
    setIsSimulating(false);
    onLevelUp?.();
  };

  const handleSimulation = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    // Simulate AI analysis delay
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setIsSimulating(false);
    setSimulationResult(Math.random() > 0.5 ? "safe" : "scam");
  };

  const shieldData = getShieldLevel(score);
  const nextLevelScore =
    score >= 90
      ? 100
      : score >= 75
        ? 90
        : score >= 60
          ? 75
          : score >= 40
            ? 60
            : 40;
  const progressToNext = ((score - (nextLevelScore - 15)) / 15) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-indigo-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-12 gap-6">
          {/* Security Score Card */}
          <div className="col-span-12 lg:col-span-4">
            <Card
              className="bg-black/30 backdrop-blur-2xl border-white/10 relative overflow-hidden hover:bg-black/40 transition-all duration-500"
              onClick={handleShieldClick}
            >
              {/* Enhanced background effects */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 via-cyan-600/5 to-violet-500/10 group-hover:from-emerald-600/20 group-hover:via-cyan-600/15 group-hover:to-violet-500/20 transition-all duration-700"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.12),rgba(0,0,0,0)_50%)]"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.12),rgba(0,0,0,0)_50%)]"></div>

              {/* Enhanced animated rings */}
              <div className="absolute inset-0 flex items-center justify-center -mt-12">
                <div className="w-80 h-80 rounded-full border border-indigo-500/20 animate-[spin_8s_linear_infinite] glow-ring-outer"></div>
                <div className="absolute w-72 h-72 rounded-full border border-cyan-500/20 animate-[spin_6s_linear_infinite_reverse]"></div>
                <div className="absolute w-64 h-64 rounded-full border border-fuchsia-500/20 animate-[spin_10s_linear_infinite]"></div>
              </div>

              {/* Main content area with adjusted spacing */}
              <div className="relative z-10 p-8 -mt-8">
                <div
                  className={`flex flex-col items-center transition-all duration-700 transform ${isExpanded ? "scale-95" : "scale-100"}`}
                >
                  {/* Enhanced shield icon with glow effects */}
                  <div
                    className={`relative transition-transform duration-700 ${isExpanded ? "scale-90 -translate-y-4" : ""}`}
                  >
                    <div className="absolute inset-0 animate-pulse-slow bg-gradient-to-r from-indigo-500/20 via-cyan-500/20 to-fuchsia-500/20 rounded-full blur-2xl"></div>
                    <div className="relative transform hover:scale-110 transition-all duration-500">
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/30 to-fuchsia-500/30 rounded-full blur-xl animate-pulse-slow"></div>
                      <ShieldIcon
                        score={score}
                        className="w-40 h-40 transform hover:scale-105 transition-all duration-500"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-center mt-6 space-y-3">
                    <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-indigo-400 animate-gradient-x">
                      {score}
                    </div>
                    <Badge
                      className={`${shieldData.color} transform transition-transform hover:scale-105 cursor-pointer backdrop-blur-sm px-4 py-2 text-lg`}
                    >
                      {shieldData.icon} {shieldData.level}
                    </Badge>
                  </div>
                </div>
              </div>

              <CardHeader className="relative mt-4">
                <CardTitle className="flex items-center justify-between text-white px-4">
                  <div className="flex items-center space-x-3">
                    <div className="relative transform transition-transform group-hover:scale-110">
                      <Shield
                        className={`h-8 w-8 text-cyan-400 transform transition-transform ${isRotating ? "rotate-180" : ""}`}
                      />
                      <div className="absolute -top-1 -right-1 text-sm bg-gradient-to-r from-indigo-400 to-fuchsia-400 rounded-full p-1">
                        {shieldData.icon.slice(-1)}
                      </div>
                    </div>
                    <span className="transform transition-transform group-hover:scale-105 text-lg font-medium bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-400 text-transparent bg-clip-text">
                      Neural Shield Protocol
                    </span>
                  </div>
                  {!loading &&
                    walletConnector.address &&
                    (score >= 90 ? (
                      <Lock className="h-6 w-6 text-emerald-400 animate-pulse" />
                    ) : (
                      <Unlock className="h-6 w-6 text-fuchsia-400 animate-pulse" />
                    ))}
                </CardTitle>
              </CardHeader>

              <CardContent className="relative space-y-6 px-8">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 text-cyan-400 animate-spin mr-3" />
                    <p className="text-lg text-gradient-primary">
                      Initializing neural shield...
                    </p>
                  </div>
                ) : !walletConnector.address ? (
                  <div className="py-8 text-center">
                    <p className="text-lg text-gradient-primary">
                      Connect wallet to activate neural shield
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Enhanced Score Display with consistent theme */}
                    <div className="flex items-center justify-between bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-white/10">
                      <div className="space-y-2">
                        <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-indigo-400 animate-gradient-x">
                          {score}
                        </div>
                        <Badge
                          className={`${shieldData.color} transform transition-transform hover:scale-105 cursor-pointer backdrop-blur-sm`}
                        >
                          {shieldData.icon} {shieldData.level}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gradient-primary">
                          Next Level
                        </div>
                        <div className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-indigo-400 animate-gradient-x">
                          {nextLevelScore}
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Progress Bar with glow effect */}
                    <div
                      className={`space-y-3 transform transition-all duration-500 ${showDetails ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
                    >
                      <div className="flex justify-between text-sm">
                        <span className="text-gradient-primary font-medium">
                          Neural Shield Capacity
                        </span>
                        <span className="text-cyan-400 font-bold">
                          {Math.round(progressToNext)}%
                        </span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden p-[2px] shadow-inner border border-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-indigo-500 rounded-full transition-all duration-500 animate-gradient-x shadow-lg relative"
                          style={{ width: `${progressToNext}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse-slow"></div>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Score Breakdown with hover effects */}
                    <div
                      className={`grid grid-cols-2 gap-4 transform transition-all duration-500 ${showDetails ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
                    >
                      <div className="flex items-center space-x-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 border border-white/10 backdrop-blur-sm group">
                        <div className="p-2 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                          <TrendingUp className="h-5 w-5 text-green-400" />
                        </div>
                        <div>
                          <span className="text-gray-400 text-sm">
                            Threats Blocked
                          </span>
                          <div className="text-white font-medium text-lg">
                            +{securityBreakdown.threatsBlocked}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 border border-white/10 backdrop-blur-sm group">
                        <div className="p-2 rounded-lg bg-yellow-500/10 group-hover:bg-yellow-500/20 transition-colors">
                          <Award className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div>
                          <span className="text-gray-400 text-sm">
                            DAO Votes
                          </span>
                          <div className="text-white font-medium text-lg">
                            +{securityBreakdown.daoVotes}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 border border-white/10 backdrop-blur-sm group">
                        <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                          <Zap className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <span className="text-gray-400 text-sm">
                            Reports Filed
                          </span>
                          <div className="text-white font-medium text-lg">
                            +{securityBreakdown.reports}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 border border-white/10 backdrop-blur-sm group">
                        <div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                          <Shield className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                          <span className="text-gray-400 text-sm">
                            Wallet Age
                          </span>
                          <div className="text-white font-medium text-lg">
                            +{securityBreakdown.walletAge}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Security Analysis section */}
                    <div
                      className={`absolute inset-0 transition-all duration-700 ${
                        isExpanded
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-8 pointer-events-none"
                      }`}
                    >
                      <div className="h-full flex flex-col justify-center items-center p-8 backdrop-blur-md bg-black/40">
                        <h4 className="text-2xl font-semibold bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent mb-6">
                          Security Analysis
                        </h4>

                        <div className="w-full space-y-5">
                          {[
                            {
                              label: "Smart Contract Safety",
                              value: 90,
                              color: "from-indigo-500 to-violet-500",
                            },
                            {
                              label: "Transaction Security",
                              value: 85,
                              color: "from-fuchsia-500 to-pink-500",
                            },
                            {
                              label: "Wallet Protection",
                              value: 88,
                              color: "from-cyan-500 to-blue-500",
                            },
                          ].map((metric) => (
                            <div key={metric.label} className="group">
                              <div className="flex justify-between text-sm mb-2">
                                <span className="text-white/80 group-hover:text-white transition-colors">
                                  {metric.label}
                                </span>
                                <span className="text-white font-medium">
                                  {metric.value}%
                                </span>
                              </div>
                              <div className="h-3 bg-white/5 rounded-full overflow-hidden p-[2px] border border-white/10">
                                <div
                                  className={`h-full rounded-full bg-gradient-to-r ${metric.color} transition-all duration-1000 relative`}
                                  style={{ width: `${metric.value}%` }}
                                >
                                  <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse-slow"></div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          className="mt-8 w-full py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-500/20 via-cyan-500/20 to-fuchsia-500/20 hover:from-indigo-500/30 hover:via-cyan-500/30 hover:to-fuchsia-500/30 border border-white/10 text-white/90 transition-all duration-300 font-medium text-lg group relative overflow-hidden"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Add security scan action here
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-fuchsia-500/10 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
                          <span className="relative">Run Security Scan</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Vertical Security Panel - Takes 4 columns */}
          <div className="col-span-4 mt-24 space-y-6">
            {/* Main Action Card */}
            <Card className="bg-black/30 backdrop-blur-2xl border-white/10 relative overflow-hidden hover:bg-black/40 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/20 via-fuchsia-900/10 to-cyan-900/20"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.1),rgba(0,0,0,0)_50%)]"></div>

              <CardHeader className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setActiveTab("send")}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                        activeTab === "send"
                          ? "bg-gradient-to-r from-indigo-500/20 to-fuchsia-500/20 border border-white/10"
                          : "text-white/60 hover:text-white/80"
                      }`}
                    >
                      <Send className="w-5 h-5 mb-1 mx-auto" />
                      <span className="text-sm">Send</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("simulate")}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                        activeTab === "simulate"
                          ? "bg-gradient-to-r from-indigo-500/20 to-fuchsia-500/20 border border-white/10"
                          : "text-white/60 hover:text-white/80"
                      }`}
                    >
                      <Shield className="w-5 h-5 mb-1 mx-auto" />
                      <span className="text-sm">Simulate</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("monitor")}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                        activeTab === "monitor"
                          ? "bg-gradient-to-r from-indigo-500/20 to-fuchsia-500/20 border border-white/10"
                          : "text-white/60 hover:text-white/80"
                      }`}
                    >
                      <Activity className="w-5 h-5 mb-1 mx-auto" />
                      <span className="text-sm">Monitor</span>
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="relative z-10 space-y-6">
                {activeTab === "send" && (
                  <div className="space-y-4 animate-fade-in-up">
                    <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                      Secure Token Transfer
                    </h3>
                    <div className="space-y-4">
                      <div className="relative group">
                        <input
                          type="text"
                          placeholder="Enter recipient address"
                          value={sendAddress}
                          onChange={(e) => setSendAddress(e.target.value)}
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 group-hover:border-white/20"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-fuchsia-500/5 rounded-lg pointer-events-none"></div>
                      </div>
                      <div className="relative group">
                        <input
                          type="text"
                          placeholder="Amount"
                          value={sendAmount}
                          onChange={(e) => setSendAmount(e.target.value)}
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 group-hover:border-white/20"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-fuchsia-500/5 rounded-lg pointer-events-none"></div>
                      </div>
                      <button
                        onClick={handleSendToken}
                        disabled={isSimulating || !sendAddress || !sendAmount}
                        className="w-full relative group overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-fuchsia-500/20 to-cyan-500/20 group-hover:from-indigo-500/30 group-hover:via-fuchsia-500/30 group-hover:to-cyan-500/30 border border-white/10 rounded-lg transition-all duration-500"></div>
                        <div className="relative px-4 py-3 flex items-center justify-center space-x-2">
                          {isSimulating ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Analyzing Transaction...</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-5 h-5" />
                              <span>Send Securely</span>
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === "simulate" && (
                  <div className="space-y-6 animate-fade-in-up">
                    <div className="relative group">
                      <input
                        type="text"
                        placeholder="Enter contract address to verify"
                        value={simulationAddress}
                        onChange={(e) => setSimulationAddress(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-fuchsia-500/5 rounded-lg pointer-events-none"></div>
                    </div>

                    <button
                      onClick={simulateTransaction}
                      disabled={isSimulating || !simulationAddress}
                      className="w-full h-[300px] relative group overflow-hidden rounded-xl"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-fuchsia-500/10 to-cyan-500/10 group-hover:from-indigo-500/20 group-hover:via-fuchsia-500/20 group-hover:to-cyan-500/20 border border-white/10 transition-all duration-500"></div>
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                        {isSimulating ? (
                          <div className="space-y-4">
                            <div className="relative mx-auto">
                              <div className="w-24 h-24 rounded-full border-4 border-indigo-500/20 animate-[spin_3s_linear_infinite]"></div>
                              <div className="absolute inset-0 w-24 h-24 rounded-full border-t-4 border-fuchsia-500 animate-[spin_1.5s_linear_infinite]"></div>
                              <Shield className="absolute inset-0 m-auto w-12 h-12 text-white/70" />
                            </div>
                            <div className="space-y-2 text-center">
                              <p className="text-lg font-medium text-white/90">
                                Neural Shield Analysis
                              </p>
                              <p className="text-white/60 text-sm">
                                Scanning for threats...
                              </p>
                            </div>
                          </div>
                        ) : simulationResult ? (
                          <div className="text-center space-y-4">
                            {simulationResult === "safe" ? (
                              <>
                                <div className="relative">
                                  <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center animate-shield-pulse">
                                    <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-lg font-medium text-emerald-400">
                                    Transaction Safe
                                  </p>
                                  <p className="text-white/60 text-sm max-w-[80%] mx-auto">
                                    Contract verified. No threats detected.
                                  </p>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="relative">
                                  <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center animate-shield-pulse">
                                    <XCircle className="w-12 h-12 text-red-400" />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-lg font-medium text-red-400">
                                    Threat Detected!
                                  </p>
                                  <p className="text-white/60 text-sm max-w-[80%] mx-auto">
                                    Malicious contract behavior identified.
                                    Transaction blocked.
                                  </p>
                                  <div className="text-emerald-400 text-sm">
                                    +3 Shield Points Earned!
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="text-center space-y-4">
                            <div className="relative">
                              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-indigo-500/20 to-fuchsia-500/20 flex items-center justify-center">
                                <AlertOctagon className="w-12 h-12 text-white/70" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-medium text-white/90">
                                Simulate Threat
                              </p>
                              <p className="text-white/60 text-sm max-w-[80%] mx-auto">
                                Test our AI-powered threat detection system
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                )}

                {activeTab === "monitor" && (
                  <div className="space-y-6 animate-fade-in-up">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 rounded-lg p-4 border border-white/10">
                        <div className="flex items-center space-x-2 mb-2">
                          <Network className="w-5 h-5 text-indigo-400" />
                          <span className="text-white/60 text-sm">
                            Network Status
                          </span>
                        </div>
                        <p className="text-white/90 font-medium">
                          Neural Shield Active
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 rounded-lg p-4 border border-white/10">
                        <div className="flex items-center space-x-2 mb-2">
                          <Brain className="w-5 h-5 text-fuchsia-400" />
                          <span className="text-white/60 text-sm">
                            AI Status
                          </span>
                        </div>
                        <p className="text-white/90 font-medium">
                          Protection Online
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-medium text-white/90">
                          Recent Activity
                        </h4>
                        <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/20">
                          Live
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        {transactionHistory.map((tx, index) => (
                          <div
                            key={index}
                            className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                {tx.type === "blocked" ? (
                                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <XCircle className="w-5 h-5 text-red-400" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                  </div>
                                )}
                                <div>
                                  <div className="text-sm font-medium text-white/90">
                                    {tx.address}
                                  </div>
                                  <div className="text-sm text-white/60">
                                    {tx.amount}
                                  </div>
                                </div>
                              </div>
                              {tx.threat && (
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/20">
                                  {tx.threat}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Status indicators and stats */}
                <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Neural Shield Status</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400">
                      Active
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Protection Level</span>
                    <span className="text-indigo-400 font-medium">{level}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">ML Model Version</span>
                    <span className="text-fuchsia-400">v2.0.5</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6 text-center text-white/40 text-sm">
          <div className="flex items-center justify-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>NeuroShield Protection</span>
            <span className="text-fuchsia-400">v2.0.5</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityScore;
