import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield,
  AlertTriangle,
  Zap,
  Users,
  FileText,
  Settings,
  PieChart,
  Key,
  Fingerprint,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import WalletConnect from "@/components/WalletConnect";
import TransactionHistory from "@/components/TransactionHistory";
import DAOPanel from "@/components/dao/DAOPanel";
import TransactionInterceptor from "@/components/TransactionInterceptor";
import SecurityScore from "@/components/SecurityScore";
import AILearningFeedback from "@/components/AILearningFeedback";
import WalletAnalytics from "@/components/WalletAnalytics";
import GuardianManager from "@/components/GuardianManager";
import { useCivicStore } from "@/stores/civicStore";
import SimpleCivicAuth from "@/components/civic/SimpleCivicAuth";
import SoulboundToken from "@/components/SoulboundToken";
import NeuroShieldLogo from "@/components/NeuroShieldLogo";
import { reportScam } from "@/web3/contract";

const Index = () => {
  const navigate = useNavigate();
  const [walletConnected, setWalletConnected] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("");
  const [threatLevel, setThreatLevel] = useState<"safe" | "warning" | "danger">(
    "safe",
  );
  const [showInterceptor, setShowInterceptor] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState({
    fromAddress: "",
    toAddress: "",
    value: 0,
    gasPrice: 0,
  });
  const [suspiciousAddress, setSuspiciousAddress] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [aiScansToday, setAiScansToday] = useState(0);
  const [blockedThreats, setBlockedThreats] = useState(0);

  // Report form state
  const [reportAddress, setReportAddress] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportEvidence, setReportEvidence] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // New gamification states
  const [securityScore, setSecurityScore] = useState(0);
  const [shieldLevel, setShieldLevel] = useState("Rookie");
  const [showAIFeedback, setShowAIFeedback] = useState(false);
  const [lastAction, setLastAction] = useState<
    "vote" | "report" | "block" | "scan"
  >("scan");
  const [isProcessing, setIsProcessing] = useState(false);
  const [civicClientId] = useState(
    import.meta.env.VITE_CIVIC_CLIENT_ID || "demo_client_id",
  );

  const { toast } = useToast();

  // Derive dashboard stats from real localStorage transaction logs
  useEffect(() => {
    const loadRealStats = () => {
      try {
        const raw = localStorage.getItem("transaction-logs");
        const logs: Array<{
          timestamp: string;
          to: string;
          value: number;
          riskScore: number;
          riskLevel: string;
          blocked: boolean;
        }> = raw ? JSON.parse(raw) : [];

        // Total ML scans = total log entries
        setAiScansToday(logs.length);

        // Blocked threats
        const blocked = logs.filter((l) => l.blocked);
        setBlockedThreats(blocked.length);

        // Saved amount = sum of values from blocked txs (displayed as USD estimate)
        const totalSaved = blocked.reduce((sum, l) => sum + (l.value || 0), 0);

        // Security score from log quality
        const baseScore = Math.min(30, logs.length * 2);
        const blockBonus = Math.min(40, blocked.length * 5);
        const activityBonus = Math.min(30, logs.length);
        setSecurityScore(Math.min(100, baseScore + blockBonus + activityBonus));

        // Shield level
        const s = baseScore + blockBonus + activityBonus;
        if (s >= 90) setShieldLevel("Guardian Elite");
        else if (s >= 75) setShieldLevel("Shield Master");
        else if (s >= 60) setShieldLevel("Defender");
        else if (s >= 40) setShieldLevel("Guardian");
        else setShieldLevel("Rookie");

        // Last suspicious address from blocked txs
        if (blocked.length > 0) {
          setSuspiciousAddress(blocked[0].to || "");
        }
      } catch {
        // Safe defaults if localStorage fails
      }
    };

    loadRealStats();
    // Refresh when new transactions are logged
    window.addEventListener("transaction-logged", loadRealStats);
    return () =>
      window.removeEventListener("transaction-logged", loadRealStats);
  }, []);

  // Reset threat level after some time for demo purposes
  useEffect(() => {
    if (threatLevel === "danger" && !showInterceptor && !isProcessing) {
      const timer = setTimeout(() => {
        setThreatLevel("safe");
        toast({
          title: "System Secured",
          description:
            "Threat level returned to safe after blocking malicious transaction.",
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [threatLevel, showInterceptor, isProcessing, toast]);

  const simulateScamTransaction = () => {
    if (isProcessing) return;

    console.log("Simulating scam transaction...");
    setIsProcessing(true);

    // Set transaction details for the interceptor
    setTransactionDetails({
      fromAddress:
        currentAddress || "0x742d35Cc6634C0532925a3b8D4C9db96c4b4d8b",
      toAddress: "0xa12066091c6F636505Bd64F2160EA1884142B38c",
      value: 0.00000000000001,
      gasPrice: 20,
    });

    setAiScansToday((prev) => prev + 1);
    setThreatLevel("danger");
    setLastAction("scan");
    setShowAIFeedback(true);

    toast({
      title: "⚠️ Analyzing Transaction",
      description: "ML model is analyzing the transaction...",
      variant: "default",
    });

    setTimeout(() => {
      setShowInterceptor(true);
      setIsProcessing(false);
    }, 800);
  };

  const handleBlockTransaction = () => {
    console.log("Transaction blocked by user");

    setBlockedThreats((prev) => prev + 1);

    setSecurityScore((prev) => Math.min(100, prev + 3));
    setLastAction("block");
    setShowAIFeedback(true);

    setShowInterceptor(false);
    setIsProcessing(false);

    toast({
      title: "🛡️ Transaction Blocked",
      description:
        "Malicious transaction successfully blocked. Your funds are safe!",
    });

    setTimeout(() => {
      setThreatLevel("safe");
    }, 2000);
  };

  const handleCloseInterceptor = () => {
    console.log("Interceptor closed");
    setShowInterceptor(false);
    setIsProcessing(false);

    toast({
      title: "⚠️ Transaction Signed",
      description: "You chose to proceed with the risky transaction.",
      variant: "destructive",
    });

    setTimeout(() => {
      setThreatLevel("warning");
    }, 1000);
  };

  const handleDAOVote = (proposalId: number, vote: "approve" | "reject") => {
    console.log(`Voting ${vote} on proposal ${proposalId}`);
    setSecurityScore((prev) => Math.min(100, prev + 2));
    setLastAction("vote");
    setShowAIFeedback(true);

    toast({
      title: "🗳️ Vote Recorded",
      description: `Your ${vote} vote has been submitted to the DAO.`,
    });
  };

  const handleThreatReport = async () => {
    if (!reportAddress.trim()) {
      toast({
        title: " Address Required",
        description: "Enter the suspicious wallet address to report.",
        variant: "destructive",
      });
      return;
    }
    if (!reportDescription.trim()) {
      toast({
        title: " Description Required",
        description: "Describe why this address is suspicious.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingReport(true);
    try {
      const txHash = await reportScam(
        reportAddress.trim(),
        reportDescription.trim(),
        reportEvidence.trim(),
      );

      setSecurityScore((prev) => Math.min(100, prev + 5));
      setLastAction("report");
      setShowAIFeedback(true);

      // Clear form
      setReportAddress("");
      setReportDescription("");
      setReportEvidence("");

      toast({
        title: "✅ Report Submitted On-Chain",
        description: `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)} — DAO voting is now open.`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Report Failed",
        description:
          error.message || "Could not submit report. Check wallet connection.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleCivicSuccess = (gatewayToken: string) => {
    if (currentAddress) {
      const store = useCivicStore.getState();
      store.setGatewayToken(currentAddress, gatewayToken);

      toast({
        title: "Identity Verified",
        description: "Your wallet is now verified with Civic",
      });
    }
  };

  const handleCivicError = (error: Error) => {
    toast({
      title: "Verification Failed",
      description: error.message,
      variant: "destructive",
    });
  };

  const handleNavigation = (item: { id: string; label: string }) => {
    if (item.id === "register") {
      navigate("/register");
    } else {
      setActiveTab(item.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="w-full border-b border-white/10 bg-black/20 backdrop-blur-lg animate-fade-in-down">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between w-full">
            {/* Logo and Title */}
            <div
              className="flex items-center space-x-3 group cursor-pointer"
              onClick={() => setActiveTab("overview")}
            >
              <NeuroShieldLogo
                size={46}
                className="transition-transform duration-300 group-hover:scale-110"
              />
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white"
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    letterSpacing: "-0.04em",
                  }}
                >
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500">
                    Neuro
                  </span>
                  <span className="text-white">Shield</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-[0.18em] font-medium">
                  Web3 Security Protocol
                </p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center justify-center flex-1 space-x-6 whitespace-nowrap">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-2 px-3 py-2 transition-all duration-300 hover:scale-105 ${
                  activeTab === "overview"
                    ? "text-cyan-400 font-medium scale-105"
                    : "text-gray-400 hover:text-white hover:underline decoration-cyan-400/50 underline-offset-4"
                }`}
              >
                <Shield className="h-5 w-5" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`flex items-center gap-2 px-3 py-2 transition-all duration-300 hover:scale-105 ${
                  activeTab === "analytics"
                    ? "text-cyan-400 font-medium scale-105"
                    : "text-gray-400 hover:text-white hover:underline decoration-cyan-400/50 underline-offset-4"
                }`}
              >
                <PieChart className="h-5 w-5" />
                Analytics
              </button>
              <button
                onClick={() => setActiveTab("dao")}
                className={`flex items-center gap-2 px-3 py-2 transition-all duration-300 hover:scale-105 ${
                  activeTab === "dao"
                    ? "text-cyan-400 font-medium scale-105"
                    : "text-gray-400 hover:text-white hover:underline decoration-cyan-400/50 underline-offset-4"
                }`}
              >
                <Users className="h-5 w-5" />
                DAO
              </button>
              <button
                onClick={() => setActiveTab("reports")}
                className={`flex items-center gap-2 px-3 py-2 transition-all duration-300 hover:scale-105 ${
                  activeTab === "reports"
                    ? "text-cyan-400 font-medium scale-105"
                    : "text-gray-400 hover:text-white hover:underline decoration-cyan-400/50 underline-offset-4"
                }`}
              >
                <FileText className="h-5 w-5" />
                Reports
              </button>
              <button
                onClick={() => setActiveTab("sbt")}
                className={`flex items-center gap-2 px-3 py-2 transition-all duration-300 hover:scale-105 ${
                  activeTab === "sbt"
                    ? "text-cyan-400 font-medium scale-105"
                    : "text-gray-400 hover:text-white hover:underline decoration-cyan-400/50 underline-offset-4"
                }`}
              >
                <Fingerprint className="h-5 w-5" />
                SBT
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-2 px-3 py-2 transition-all duration-300 hover:scale-105 ${
                  activeTab === "settings"
                    ? "text-cyan-400 font-medium scale-105"
                    : "text-gray-400 hover:text-white hover:underline decoration-cyan-400/50 underline-offset-4"
                }`}
              >
                <Settings className="h-5 w-5" />
                Settings
              </button>
            </nav>

            {/* Connect Wallet with enhanced styling */}
            <div className="transition-transform hover:scale-105 duration-300">
              <WalletConnect
                onConnect={(address) => {
                  setWalletConnected(true);
                  setCurrentAddress(address);
                  toast({
                    title: "Wallet Connected",
                    description: `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`,
                  });
                }}
                isConnected={walletConnected}
                address={currentAddress}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Landing Section */}
      <div className="relative overflow-hidden border-b border-white/[0.06]">
        {/* Animated background elements */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/6 w-64 h-64 bg-purple-500/15 rounded-full filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-cyan-500/15 rounded-full filter blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="container mx-auto px-6 py-14 lg:py-20 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">
            {/* Left side content */}
            <div className="flex-1 space-y-6 text-center lg:text-left">
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight"
                style={{
                  fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                  letterSpacing: "-0.03em",
                }}
              >
                Secure Your{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500">
                  Digital Assets
                </span>
                <br />
                <span className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white/80">
                  with AI
                </span>
              </h1>
              <p
                className="text-base sm:text-lg text-gray-400 max-w-lg leading-relaxed"
                style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
              >
                AI-powered smart wallet with real-time threat detection,
                DAO-driven scam reporting, and on-chain Soulbound identity.
              </p>
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start pt-2">
                <button
                  className="group relative inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-bold text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] active:scale-[0.98]"
                  onClick={() => navigate("/send")}
                  style={{
                    background:
                      "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)",
                  }}
                >
                  <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center gap-2">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    Send Tokens
                  </span>
                </button>
                <button
                  className="group relative inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-bold text-white/90 border border-white/[0.12] bg-white/[0.04] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:scale-105 hover:border-purple-400/40 hover:text-white hover:shadow-[0_0_25px_rgba(168,85,247,0.2)] active:scale-[0.98]"
                  onClick={simulateScamTransaction}
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
                    Try AI Demo
                  </span>
                </button>
              </div>
            </div>

            {/* Right side — 3D Y-axis spinning wallet card (front + back) */}
            <div className="flex-1 flex justify-center card-scene">
              <div
                className="relative w-72 lg:w-80 card-spinner"
                style={{ aspectRatio: "4/5" }}
              >
                {/* ===== FRONT FACE ===== */}
                <div className="card-face bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl p-6">
                  <div className="flex justify-between items-center mb-5">
                    <Shield className="h-7 w-7 text-cyan-400" />
                    <div className="flex space-x-1.5">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"
                        ></div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">
                        Wallet
                      </div>
                      <div className="text-sm text-white font-mono">
                        {currentAddress
                          ? `${currentAddress.slice(0, 6)}...${currentAddress.slice(-4)}`
                          : "Not Connected"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">
                        Shield Level
                      </div>
                      <div className="text-sm text-cyan-400 font-semibold">
                        {shieldLevel}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="p-2 bg-white/[0.04] rounded-lg text-center border border-white/[0.06]">
                      <div className="text-sm font-bold text-white">
                        {aiScansToday}
                      </div>
                      <div className="text-[9px] text-gray-500">Scans</div>
                    </div>
                    <div className="p-2 bg-white/[0.04] rounded-lg text-center border border-white/[0.06]">
                      <div className="text-sm font-bold text-white">
                        {blockedThreats}
                      </div>
                      <div className="text-[9px] text-gray-500">Blocked</div>
                    </div>
                    <div className="p-2 bg-white/[0.04] rounded-lg text-center border border-white/[0.06]">
                      <div className="text-sm font-bold text-white">
                        {securityScore}
                      </div>
                      <div className="text-[9px] text-gray-500">Score</div>
                    </div>
                  </div>
                </div>

                {/* ===== BACK FACE ===== */}
                <div className="card-face-back bg-gradient-to-br from-purple-900/90 to-slate-900/90 rounded-2xl border border-purple-400/20 shadow-2xl backdrop-blur-xl p-6">
                  <div className="flex justify-between items-center mb-5">
                    <Zap className="h-7 w-7 text-purple-400" />
                    <span className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold">
                      NeuroShield
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">
                        Network
                      </div>
                      <div className="text-sm text-white font-mono">
                        Monad Testnet
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">
                        Protection
                      </div>
                      <div className="text-sm text-purple-300 font-semibold">
                        AI + DAO + SBT
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">
                        Status
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                        <span className="text-sm text-green-400 font-semibold">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 p-3 bg-white/[0.04] rounded-lg border border-white/[0.06] text-center">
                    <div className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                      NeuroShield
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      Diversion 5.0
                    </div>
                    <div className="text-[9px] text-gray-500 mt-0.5">
                      Secured by Smart Contracts
                    </div>
                  </div>
                </div>

                {/* Glow follows the card */}
                <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/15 to-purple-500/15 rounded-3xl blur-2xl -z-10"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex">
        {/* Main Content */}
        <main className="container mx-auto px-6 py-8">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Security Operations Dashboard */}
              <SecurityScore />

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Send Tokens */}
                <Card className="bg-black/20 backdrop-blur-lg border-white/10 hover:border-emerald-500/30 transition-all duration-300">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="text-base font-semibold text-white">
                            Send Tokens
                          </h3>
                          <p className="text-xs text-gray-400 mt-1">
                            Every outgoing transaction is scanned by our ML
                            fraud detection model before your wallet signs.
                          </p>
                        </div>
                        <Button
                          asChild
                          className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 w-full rounded-lg h-9 text-sm"
                        >
                          <Link
                            to="/send"
                            className="flex items-center justify-center gap-2"
                          >
                            Send Securely
                            <Zap className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Demo */}
                <Card className="bg-black/20 backdrop-blur-lg border-white/10 hover:border-amber-500/30 transition-all duration-300">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="text-base font-semibold text-white">
                            AI Threat Demo
                          </h3>
                          <p className="text-xs text-gray-400 mt-1">
                            Simulate a scam transaction to see the ML model
                            intercept and analyze it in real time.
                          </p>
                        </div>
                        <Button
                          onClick={simulateScamTransaction}
                          disabled={showInterceptor || isProcessing}
                          className="bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 w-full rounded-lg h-9 text-sm disabled:opacity-40"
                        >
                          {isProcessing
                            ? "Analyzing..."
                            : showInterceptor
                              ? "Threat Active"
                              : "Run Simulation"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Transaction History */}
              <TransactionHistory />
            </div>
          )}
          {activeTab === "analytics" && (
            <WalletAnalytics walletAddress={currentAddress} />
          )}
          {activeTab === "dao" && (
            <div className="space-y-6">
              <DAOPanel onNavigateToReports={() => setActiveTab("reports")} />
            </div>
          )}
          {activeTab === "reports" && (
            <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <span className="transform group-hover:scale-110 transition-transform">
                    Community Threat Reports
                  </span>
                  <div className="relative h-6 w-6">
                    <div className="absolute inset-0 bg-purple-500 rounded-full opacity-20 group-hover:animate-ping"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      🛡️
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
                    Help protect the Web3 community by reporting suspicious
                    contracts and activities.
                    <span className="text-purple-400 font-medium group-hover:animate-pulse">
                      {" "}
                      Earn +5 Shield Points per verified report!
                    </span>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Recent reports from real transaction logs */}
                    <div className="group/card p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all duration-300 hover:scale-[1.02]">
                      <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                        <span>Recent Blocked Transactions</span>
                        <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                      </h4>
                      <div className="text-sm text-gray-400 space-y-3">
                        {(() => {
                          try {
                            const rawLogs =
                              localStorage.getItem("transaction-logs");
                            const logs = rawLogs ? JSON.parse(rawLogs) : [];
                            const blocked = logs
                              .filter((l: any) => l.blocked)
                              .slice(0, 3);
                            if (blocked.length === 0) {
                              return (
                                <div className="text-center py-4 text-gray-500">
                                  No blocked transactions yet. Use the AI Demo
                                  or send a transaction to see real reports
                                  here.
                                </div>
                              );
                            }
                            return blocked.map((log: any, i: number) => (
                              <div
                                key={i}
                                className="flex justify-between items-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                              >
                                <span className="group-hover/card:text-white transition-colors font-mono text-xs">
                                  {log.to
                                    ? `${log.to.slice(0, 6)}...${log.to.slice(-4)}`
                                    : "Unknown"}
                                </span>
                                <Badge
                                  className={`${log.riskLevel === "High" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}
                                >
                                  {log.riskLevel || "Medium"} Risk —{" "}
                                  {(log.riskScore || 0).toFixed(0)}%
                                </Badge>
                              </div>
                            ));
                          } catch {
                            return (
                              <div className="text-gray-500">
                                No reports available
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                    {/* Enhanced submit form */}
                    <div className="group/card p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all duration-300 hover:scale-[1.02]">
                      <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                        <span>Submit New Report</span>
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                      </h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Suspicious wallet address (0x...)"
                          value={reportAddress}
                          onChange={(e) => setReportAddress(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Description — why is this address suspicious?"
                          value={reportDescription}
                          onChange={(e) => setReportDescription(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        />
                        <input
                          type="text"
                          placeholder="Evidence URL or IPFS hash (optional)"
                          value={reportEvidence}
                          onChange={(e) => setReportEvidence(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        />
                        <Button
                          className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white transform transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/20 rounded-xl py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={handleThreatReport}
                          disabled={
                            isSubmittingReport ||
                            !reportAddress.trim() ||
                            !reportDescription.trim()
                          }
                        >
                          <span className="flex items-center justify-center gap-2">
                            {isSubmittingReport ? (
                              <>
                                <span className="animate-spin">⏳</span>
                                <span className="text-lg">
                                  Submitting to Blockchain...
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-lg">
                                  Report Suspicious Activity
                                </span>
                                <span className="text-sm bg-white/20 px-2 py-1 rounded-full group-hover/card:animate-pulse">
                                  +5 Points
                                </span>
                              </>
                            )}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}{" "}
          {activeTab === "recovery" && (
            <Card className="bg-black/20 backdrop-blur-lg border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Key className="h-5 w-5 text-cyan-400" />
                  <span>Social Recovery Settings</span>
                </CardTitle>
                <p className="text-gray-400 mt-2">
                  Set up trusted guardians who can help you recover your wallet
                  if you lose access. A minimum of {2} guardians must approve
                  the recovery process.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {" "}
                <SimpleCivicAuth
                  clientId={civicClientId}
                  walletAddress={currentAddress}
                  onSuccess={handleCivicSuccess}
                  onError={handleCivicError}
                />
                <GuardianManager walletAddress={currentAddress} />
              </CardContent>
            </Card>
          )}
          {activeTab === "sbt" && (
            <div className="space-y-6">
              <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Fingerprint className="h-5 w-5 text-purple-400" />
                    <span>Soulbound Token</span>
                    <Badge className="bg-purple-500/20 text-purple-400 ml-2">
                      On-Chain Identity
                    </Badge>
                  </CardTitle>
                  <p className="text-gray-400 mt-2">
                    Your permanent on-chain reputation. Cannot be transferred,
                    cannot be faked, cannot be taken down.
                  </p>
                </CardHeader>
                <CardContent>
                  <SoulboundToken />
                </CardContent>
              </Card>

              {/* Trust Score Formula */}
              <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <span className="text-lg">How Your Trust Score Works</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-sm bg-white/5 rounded-lg p-4 mb-4 border border-white/10">
                    <div className="text-purple-400">
                      +40 Are you a verified human?
                    </div>
                    <div className="text-blue-400">
                      +20 Do you have transaction history?
                    </div>
                    <div className="text-green-400">
                      +20 Do you vote correctly in the DAO?
                    </div>
                    <div className="text-amber-400">
                      +20 Do you actually participate?
                    </div>
                    <div className="text-gray-500 mt-1">────</div>
                    <div className="text-white font-bold">
                      100 Your permanent on-chain reputation
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Every component is independently verifiable from on-chain
                    data. The trust score lives forever as Base64-encoded JSON
                    directly inside the smart contract — no IPFS, no server, no
                    dependency.
                  </p>
                </CardContent>
              </Card>

              {/* Technical Details */}
              <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-white">
                    Technical Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Token Standard</span>
                      <span className="text-white font-mono">
                        ERC-721 (Soulbound)
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Transfer Behavior</span>
                      <span className="text-red-400 font-mono">
                        revert("SBTs cannot be transferred")
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Metadata Storage</span>
                      <span className="text-green-400 font-mono">
                        On-chain Base64 JSON
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Network</span>
                      <span className="text-white font-mono">
                        Monad Testnet (10143)
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Updatable By</span>
                      <span className="text-white font-mono">
                        WalletVerifier (authorized only)
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <Card className="bg-black/20 backdrop-blur-lg border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">
                    Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <h4 className="text-white font-medium">
                          Real-time Protection
                        </h4>
                        <p className="text-sm text-gray-400">
                          Enable AI-powered transaction scanning
                        </p>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <h4 className="text-white font-medium">
                          Auto-block High Risk
                        </h4>
                        <p className="text-sm text-gray-400">
                          Automatically block transactions with 90%+ risk score
                        </p>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <h4 className="text-white font-medium">
                          Community Reports
                        </h4>
                        <p className="text-sm text-gray-400">
                          Show warnings from community-reported contracts
                        </p>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        Active
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Enhanced Modals and Notifications */}
      {showInterceptor && (
        <TransactionInterceptor
          onClose={handleCloseInterceptor}
          onBlock={handleBlockTransaction}
          onDismiss={handleCloseInterceptor}
          fromAddress={transactionDetails.fromAddress}
          toAddress={transactionDetails.toAddress}
          value={transactionDetails.value}
          gasPrice={transactionDetails.gasPrice}
        />
      )}

      {/* AI Learning Feedback */}
      <AILearningFeedback
        trigger={showAIFeedback}
        actionType={lastAction}
        onComplete={() => setShowAIFeedback(false)}
      />
    </div>
  );
};

export default Index;
