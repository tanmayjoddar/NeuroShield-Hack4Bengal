import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, AlertTriangle, CheckCircle, Zap, Users, FileText, Settings, PieChart, Key, Fingerprint } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import WalletConnect from '@/components/WalletConnect';
import ThreatMonitor from '@/components/ThreatMonitor';
import TransactionHistory from '@/components/TransactionHistory';
import DAOPanel from '@/components/dao/DAOPanel';
import TransactionInterceptor from '@/components/TransactionInterceptor';
import SecurityScore from '@/components/SecurityScore';
import AILearningFeedback from '@/components/AILearningFeedback';
import TelegramCompanion from '@/components/TelegramCompanion';
import TelegramSettings from '@/components/TelegramSettings';
import WalletAnalytics from '@/components/WalletAnalytics';
import GuardianManager from '@/components/GuardianManager';
import { useCivicStore } from '@/stores/civicStore';
import SimpleCivicAuth from '@/components/civic/SimpleCivicAuth';
import MEVProtectionTester from '@/components/MEVProtectionTester';
import SoulboundToken from '@/components/SoulboundToken';

const Index = () => {
  const navigate = useNavigate();
  const [walletConnected, setWalletConnected] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('');
  const [threatLevel, setThreatLevel] = useState<'safe' | 'warning' | 'danger'>('safe');
  const [showInterceptor, setShowInterceptor] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState({
    fromAddress: '',
    toAddress: '',
    value: 0,
    gasPrice: 0
  });
  const [suspiciousAddress, setSuspiciousAddress] = useState('0xa12066091c6F636505Bd64F2160EA1884142B38c');  // Add this line
  const [activeTab, setActiveTab] = useState('overview');
  const [aiScansToday, setAiScansToday] = useState(247);
  const [blockedThreats, setBlockedThreats] = useState(15);
  const [savedAmount, setSavedAmount] = useState(12450);
  
  // New gamification states
  const [securityScore, setSecurityScore] = useState(67);
  const [shieldLevel, setShieldLevel] = useState('Defender');
  const [showAIFeedback, setShowAIFeedback] = useState(false);
  const [lastAction, setLastAction] = useState<'vote' | 'report' | 'block' | 'scan'>('scan');
  const [isProcessing, setIsProcessing] = useState(false);
  const [civicClientId] = useState(import.meta.env.VITE_CIVIC_CLIENT_ID || "demo_client_id");
  
  const { toast } = useToast();

  // Reset threat level after some time for demo purposes
  useEffect(() => {
    if (threatLevel === 'danger' && !showInterceptor && !isProcessing) {
      const timer = setTimeout(() => {
        setThreatLevel('safe');
        toast({
          title: "System Secured",
          description: "Threat level returned to safe after blocking malicious transaction.",
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [threatLevel, showInterceptor, isProcessing, toast]);

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'safe': return 'text-green-500 bg-green-100';
      case 'warning': return 'text-yellow-500 bg-yellow-100';
      case 'danger': return 'text-red-500 bg-red-100';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  const simulateScamTransaction = () => {
    if (isProcessing) return;
    
    console.log('Simulating scam transaction...');
    setIsProcessing(true);
    
    // Set transaction details for the interceptor
    setTransactionDetails({
      fromAddress: currentAddress || '0x742d35Cc6634C0532925a3b8D4C9db96c4b4d8b',
      toAddress: '0xa12066091c6F636505Bd64F2160EA1884142B38c',
      value: 0.00000000000001,
      gasPrice: 20
    });

    setAiScansToday(prev => prev + 1);
    setThreatLevel('danger');
    setLastAction('scan');
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
    console.log('Transaction blocked by user');
    
    setBlockedThreats(prev => prev + 1);
    setSavedAmount(prev => prev + Math.floor(Math.random() * 5000) + 1000);
    setSecurityScore(prev => Math.min(100, prev + 3));
    setLastAction('block');
    setShowAIFeedback(true);
    
    setShowInterceptor(false);
    setIsProcessing(false);
    
    toast({
      title: "🛡️ Transaction Blocked",
      description: "Malicious transaction successfully blocked. Your funds are safe!",
    });

    setTimeout(() => {
      setThreatLevel('safe');
    }, 2000);
  };

  const handleCloseInterceptor = () => {
    console.log('Interceptor closed');
    setShowInterceptor(false);
    setIsProcessing(false);
    
    toast({
      title: "⚠️ Transaction Signed",
      description: "You chose to proceed with the risky transaction.",
      variant: "destructive",
    });
    
    setTimeout(() => {
      setThreatLevel('warning');
    }, 1000);
  };

  const handleDAOVote = (proposalId: number, vote: 'approve' | 'reject') => {
    console.log(`Voting ${vote} on proposal ${proposalId}`);
    setSecurityScore(prev => Math.min(100, prev + 2));
    setLastAction('vote');
    setShowAIFeedback(true);
    
    toast({
      title: "🗳️ Vote Recorded",
      description: `Your ${vote} vote has been submitted to the DAO.`,
    });
  };

  const handleThreatReport = () => {
    setSecurityScore(prev => Math.min(100, prev + 5));
    setLastAction('report');
    setShowAIFeedback(true);
    
    toast({
      title: "📊 Report Submitted",
      description: "Thank you for helping secure the Web3 community!",
    });
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
      variant: "destructive"
    });
  };
  
  const handleNavigation = (item: { id: string; label: string }) => {
    if (item.id === 'register') {
      navigate('/register');
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
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Shield className="h-8 w-8 text-cyan-400" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              </div>              <div>
                <h1 className="text-2xl font-bold text-white">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Neuro</span>Shield
                </h1>
                <p className="text-sm text-gray-400">Next-Gen Web3 Security</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center justify-center flex-1 space-x-6 whitespace-nowrap">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 px-3 py-2 transition-all duration-300 hover:scale-105 ${
                  activeTab === 'overview'
                    ? 'text-cyan-400 font-medium scale-105'
                    : 'text-gray-400 hover:text-white hover:underline decoration-cyan-400/50 underline-offset-4'
                }`}
              >
                <Shield className="h-5 w-5" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-2 px-3 py-2 transition-all duration-300 hover:scale-105 ${
                  activeTab === 'analytics'
                    ? 'text-cyan-400 font-medium scale-105'
                    : 'text-gray-400 hover:text-white hover:underline decoration-cyan-400/50 underline-offset-4'
                }`}
              >
                <PieChart className="h-5 w-5" />
                Analytics
              </button>
              <button
                onClick={() => setActiveTab('dao')}
                className={`flex items-center gap-2 px-3 py-2 transition-all duration-300 hover:scale-105 ${
                  activeTab === 'dao'
                    ? 'text-cyan-400 font-medium scale-105'
                    : 'text-gray-400 hover:text-white hover:underline decoration-cyan-400/50 underline-offset-4'
                }`}
              >
                <Users className="h-5 w-5" />
                DAO
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`flex items-center gap-2 px-3 py-2 transition-all duration-300 hover:scale-105 ${
                  activeTab === 'reports'
                    ? 'text-cyan-400 font-medium scale-105'
                    : 'text-gray-400 hover:text-white hover:underline decoration-cyan-400/50 underline-offset-4'
                }`}
              >
                <FileText className="h-5 w-5" />
                Reports
              </button>
              <button
                onClick={() => setActiveTab('recovery')}
                className={`flex items-center gap-2 px-3 py-2 transition-all duration-300 hover:scale-105 ${
                  activeTab === 'recovery'
                    ? 'text-cyan-400 font-medium scale-105'
                    : 'text-gray-400 hover:text-white hover:underline decoration-cyan-400/50 underline-offset-4'
                }`}
              >
                <Key className="h-5 w-5" />
                Recovery
              </button>
              <button
                onClick={() => setActiveTab('sbt')}
                className={`flex items-center gap-2 px-3 py-2 transition-all duration-300 hover:scale-105 ${
                  activeTab === 'sbt'
                    ? 'text-cyan-400 font-medium scale-105'
                    : 'text-gray-400 hover:text-white hover:underline decoration-cyan-400/50 underline-offset-4'
                }`}
              >
                <Fingerprint className="h-5 w-5" />
                SBT
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-3 py-2 transition-all duration-300 hover:scale-105 ${
                  activeTab === 'settings'
                    ? 'text-cyan-400 font-medium scale-105'
                    : 'text-gray-400 hover:text-white hover:underline decoration-cyan-400/50 underline-offset-4'
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
      <div className="relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/30 rounded-full filter blur-3xl animate-pulse"></div>
          <div className="absolute top-1/3 right-1/3 w-96 h-96 bg-cyan-500/30 rounded-full filter blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="container mx-auto px-6 py-16 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            {/* Left side content */}
            <div className="flex-1 space-y-8 text-center lg:text-left">
              <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight animate-fade-in-up">
                Secure Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Digital Assets</span> with AI
              </h1>
              <p className="text-xl text-gray-300 animate-fade-in-up animation-delay-200">
                The world's first AI-powered smart wallet with real-time threat detection and autonomous security features.
              </p>
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start animate-fade-in-up animation-delay-300">
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 text-lg rounded-xl transition-all hover:scale-105">
                  Get Started
                </Button>
                <Button variant="outline" className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 px-8 py-6 text-lg rounded-xl transition-all hover:scale-105">
                  Watch Demo
                </Button>
              </div>
              <div className="flex items-center gap-8 justify-center lg:justify-start animate-fade-in-up animation-delay-400">
                <div className="flex -space-x-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-12 h-12 rounded-full border-2 border-white bg-gradient-to-r from-purple-400 to-cyan-400"></div>
                  ))}
                </div>
                <div className="text-left">
                  <div className="text-2xl font-bold text-white">10k+</div>
                  <div className="text-gray-400">Protected Wallets</div>
                </div>
              </div>
            </div>            {/* Right side animated wallet visualization */}
            <div className="flex-1 relative animate-float">
              <div className="relative w-full aspect-square max-w-[400px] mx-auto">
                {/* Spinning Crypto Icons */}
                <div className="absolute inset-0 -m-20">
                  {/* Bitcoin */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-64 h-64 animate-spin-slow">
                      <div className="absolute top-0 transform -translate-x-1/2">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 shadow-lg flex items-center justify-center text-2xl">₿</div>
                      </div>
                      <div className="absolute top-1/2 right-0 transform translate-y-1/2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 shadow-lg flex items-center justify-center text-xl">Ξ</div>
                      </div>
                      <div className="absolute bottom-0 transform -translate-x-1/2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-400 to-green-600 shadow-lg flex items-center justify-center">₳</div>
                      </div>
                      <div className="absolute top-1/2 left-0 transform -translate-y-1/2">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-400 to-purple-600 shadow-lg flex items-center justify-center">◎</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main wallet card */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl p-6 transform rotate-6 hover:rotate-0 transition-transform duration-500 scale-75">
                  {/* Wallet content */}
                  <div className="h-full flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                      <Shield className="h-10 w-10 text-cyan-400" />
                      <div className="flex space-x-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse delay-100"></div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse"></div>
                      <div className="h-4 w-1/2 bg-white/5 rounded animate-pulse"></div>
                    </div>
                    <div className="mt-auto">
                      <div className="grid grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse"></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Floating security elements */}
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-cyan-500/20 rounded-full animate-float-slow"></div>
                <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-purple-500/20 rounded-full animate-float-delayed"></div>
              </div>
              {/* AI scanning effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 via-transparent to-transparent animate-scan"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex">        
        {/* Main Content */}
        <main className="container mx-auto px-6 py-8">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Security Score Card */}
              <SecurityScore />              {/* Threat Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">Threat Level</CardTitle>
                    <AlertTriangle className={`h-4 w-4 transform group-hover:scale-110 transition-all ${threatLevel === 'danger' ? 'text-red-500' : threatLevel === 'warning' ? 'text-yellow-500' : 'text-green-500'}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white capitalize group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-cyan-400 group-hover:to-purple-400 transition-all">{threatLevel}</div>
                    <Badge className={`mt-2 transition-all transform hover:scale-105 ${getThreatColor(threatLevel)}`}>
                      {threatLevel === 'safe' ? 'All Systems Secure' : 
                       threatLevel === 'warning' ? 'Suspicious Activity' : 
                       'Threat Detected'}
                    </Badge>
                  </CardContent>
                </Card>                <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">AI Scans Today</CardTitle>
                    <div className="relative">
                      <Zap className="h-4 w-4 text-yellow-500 group-hover:animate-ping absolute" />
                      <Zap className="h-4 w-4 text-yellow-500 relative" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-yellow-400 group-hover:to-orange-400 transition-all">{aiScansToday}</div>
                    <p className="text-xs text-gray-400 mt-2 group-hover:text-gray-300 transition-colors">
                      <span className="text-green-400 group-hover:animate-pulse">+{Math.floor(Math.random() * 20) + 5}%</span> from yesterday
                    </p>
                  </CardContent>
                </Card>

                <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-green-500/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">Blocked Threats</CardTitle>
                    <div className="relative">
                      <CheckCircle className="h-4 w-4 text-green-500 transform group-hover:scale-125 transition-transform" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-green-400 group-hover:to-emerald-400 transition-all">{blockedThreats}</div>
                    <p className="text-xs text-gray-400 mt-2 group-hover:text-gray-300 transition-colors">
                      Saved <span className="text-green-400 group-hover:animate-pulse">${savedAmount.toLocaleString()}</span> in potential losses
                    </p>
                  </CardContent>
                </Card>
              </div>              {/* Send Transaction Section */}              <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-green-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <span className="transform group-hover:scale-110 transition-transform">Send Tokens</span>
                    <div className="relative h-6 w-6">
                      <div className="absolute inset-0 bg-green-500 rounded-full opacity-20 group-hover:animate-ping"></div>
                      <div className="absolute inset-0 flex items-center justify-center">💸</div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button 
                      asChild
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white w-full transform transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-green-500/20 rounded-xl"
                    >
                      <Link to="/send" className="flex items-center justify-center gap-2 py-3">
                        <span className="text-lg">Send Tokens Securely</span>
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                      </Link>
                    </Button>
                    <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
                      Send tokens to any address with ML-powered fraud detection.
                      Our AI will analyze the transaction and warn you about potential risks.
                      <span className="text-cyan-400 font-medium group-hover:animate-pulse"> Protected by external ML fraud detection!</span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Demo Section */}
              <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-red-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <span className="transform group-hover:scale-110 transition-transform">AI Security Demo</span>
                    <div className="relative h-6 w-6">
                      <div className="absolute inset-0 bg-red-500 rounded-full opacity-20 group-hover:animate-ping"></div>
                      <div className="absolute inset-0 flex items-center justify-center">🚨</div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button 
                      onClick={simulateScamTransaction}
                      disabled={showInterceptor || isProcessing}
                      className="relative bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white w-full transform transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-red-500/20 disabled:opacity-50 disabled:hover:scale-100 rounded-xl py-3"
                    >
                      <div className="absolute inset-0 bg-white/10 rounded-xl animate-pulse"></div>
                      <span className="relative text-lg">
                        {isProcessing ? 'Processing...' : showInterceptor ? 'Threat Active...' : '🚨 Simulate Scam Transaction'}
                      </span>
                    </Button>
                    <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
                      Test the AI threat detection system with a simulated malicious transaction. 
                      Our AI will analyze the transaction and warn you about potential risks.
                      <span className="text-cyan-400 font-medium group-hover:animate-pulse"> Earn +3 Shield Points when you block threats!</span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Threat Monitor */}
              <ThreatMonitor threatLevel={threatLevel} />

              {/* Transaction History */}
              <TransactionHistory />
              {/* MEV Protection Tester */}
              <MEVProtectionTester />
            </div>
          )}

          {activeTab === 'analytics' && <WalletAnalytics walletAddress={currentAddress} />}
          
          {activeTab === 'dao' && (
            <div className="space-y-6">
              <DAOPanel />
            </div>
          )}

          {activeTab === 'reports' && (            <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <span className="transform group-hover:scale-110 transition-transform">Community Threat Reports</span>
                  <div className="relative h-6 w-6">
                    <div className="absolute inset-0 bg-purple-500 rounded-full opacity-20 group-hover:animate-ping"></div>
                    <div className="absolute inset-0 flex items-center justify-center">🛡️</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
                    Help protect the Web3 community by reporting suspicious contracts and activities.
                    <span className="text-purple-400 font-medium group-hover:animate-pulse"> Earn +5 Shield Points per verified report!</span>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Recent reports with enhanced styling */}
                    <div className="group/card p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all duration-300 hover:scale-[1.02]">
                      <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                        <span>Recent Reports</span>
                        <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                      </h4>
                      <div className="text-sm text-gray-400 space-y-3">
                        <div className="flex justify-between items-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                          <span className="group-hover/card:text-white transition-colors">Token Drainer</span>
                          <Badge className="bg-red-500/20 text-red-400 group-hover/card:animate-pulse">High Risk</Badge>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                          <span className="group-hover/card:text-white transition-colors">Fake Airdrop</span>
                          <Badge className="bg-yellow-500/20 text-yellow-400 group-hover/card:animate-pulse">Medium Risk</Badge>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                          <span className="group-hover/card:text-white transition-colors">Rug Pull Contract</span>
                          <Badge className="bg-green-500/20 text-green-400 group-hover/card:animate-pulse">Resolved</Badge>
                        </div>
                      </div>
                    </div>
                    {/* Enhanced submit button */}
                    <div className="group/card p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all duration-300 hover:scale-[1.02]">
                      <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                        <span>Submit New Report</span>
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                      </h4>
                      <Button 
                        className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white transform transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/20 rounded-xl py-3"
                        onClick={handleThreatReport}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className="text-lg">Report Suspicious Activity</span>
                          <span className="text-sm bg-white/20 px-2 py-1 rounded-full group-hover/card:animate-pulse">+5 Points</span>
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}          {activeTab === 'recovery' && (
            <Card className="bg-black/20 backdrop-blur-lg border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Key className="h-5 w-5 text-cyan-400" />
                  <span>Social Recovery Settings</span>
                </CardTitle>
                <p className="text-gray-400 mt-2">
                  Set up trusted guardians who can help you recover your wallet if you lose access.
                  A minimum of {2} guardians must approve the recovery process.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">                <SimpleCivicAuth
                  clientId={civicClientId}
                  walletAddress={currentAddress}
                  onSuccess={handleCivicSuccess}
                  onError={handleCivicError}
                />
                <GuardianManager walletAddress={currentAddress} />
              </CardContent>
            </Card>
          )}

          {activeTab === 'sbt' && (
            <div className="space-y-6">
              <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Fingerprint className="h-5 w-5 text-purple-400" />
                    <span>Soulbound Token</span>
                    <Badge className="bg-purple-500/20 text-purple-400 ml-2">On-Chain Identity</Badge>
                  </CardTitle>
                  <p className="text-gray-400 mt-2">
                    Your permanent on-chain reputation. Cannot be transferred, cannot be faked, cannot be taken down.
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
                    <div className="text-purple-400">+40 Are you a verified human?</div>
                    <div className="text-blue-400">+20 Do you have transaction history?</div>
                    <div className="text-green-400">+20 Do you vote correctly in the DAO?</div>
                    <div className="text-amber-400">+20 Do you actually participate?</div>
                    <div className="text-gray-500 mt-1">────</div>
                    <div className="text-white font-bold">100 Your permanent on-chain reputation</div>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Every component is independently verifiable from on-chain data. The trust score lives forever as Base64-encoded JSON directly inside the smart contract — no IPFS, no server, no dependency.
                  </p>
                </CardContent>
              </Card>

              {/* Technical Details */}
              <Card className="group bg-black/20 backdrop-blur-lg border-white/10 hover:bg-black/30 transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-white">Technical Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Token Standard</span>
                      <span className="text-white font-mono">ERC-721 (Soulbound)</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Transfer Behavior</span>
                      <span className="text-red-400 font-mono">revert("SBTs cannot be transferred")</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Metadata Storage</span>
                      <span className="text-green-400 font-mono">On-chain Base64 JSON</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Network</span>
                      <span className="text-white font-mono">Monad Testnet (10143)</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Updatable By</span>
                      <span className="text-white font-mono">CivicVerifier (authorized only)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <Card className="bg-black/20 backdrop-blur-lg border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Security Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <h4 className="text-white font-medium">Real-time Protection</h4>
                        <p className="text-sm text-gray-400">Enable AI-powered transaction scanning</p>
                      </div>
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <h4 className="text-white font-medium">Auto-block High Risk</h4>
                        <p className="text-sm text-gray-400">Automatically block transactions with 90%+ risk score</p>
                      </div>
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <h4 className="text-white font-medium">Community Reports</h4>
                        <p className="text-sm text-gray-400">Show warnings from community-reported contracts</p>
                      </div>
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Telegram Settings Integration */}
              <TelegramSettings walletAddress={currentAddress} />
            </div>
          )}

          {activeTab === 'recovery' && (
            <Card className="bg-black/20 backdrop-blur-lg border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Guardian Recovery Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">
                    Manage your Guardian recovery settings. Enable recovery options to enhance wallet security.
                  </p>
                  
                  <GuardianManager walletAddress={currentAddress} />
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* Enhanced Modals and Notifications */}
      {showInterceptor && (
        <TransactionInterceptor 
          onClose={handleCloseInterceptor}
          onBlock={handleBlockTransaction}
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

      {/* Telegram Companion */}
      <TelegramCompanion />
    </div>
  );
};

export default Index;