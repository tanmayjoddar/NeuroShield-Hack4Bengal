import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Zap,
  FileWarning,
  Clock,
  Eye,
  RefreshCw,
  ShieldCheck,
  Activity,
} from "lucide-react";
import walletConnector from "@/web3/wallet";
import contractService from "@/web3/contract";

// ─── Types ───────────────────────────────────────────────────────────

interface SecurityScoreProps {
  defaultScore?: number;
  onLevelUp?: () => void;
}

interface CheckResult {
  isScam: boolean;
  score: number;
  address: string;
}

interface ActivityLog {
  type?: string;
  address?: string;
  to?: string;
  blocked?: boolean;
  isScam?: boolean;
  timestamp?: number;
  amount?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Derive threat level from activity logs */
const deriveThreatLevel = (logs: ActivityLog[]) => {
  const recent = logs.filter(
    (l) => l.timestamp && Date.now() - l.timestamp < 24 * 60 * 60 * 1000,
  );
  const threats = recent.filter((l) => l.blocked || l.isScam);
  if (threats.length >= 3) return "critical";
  if (threats.length >= 1) return "elevated";
  return "secure";
};

const threatConfig = {
  critical: {
    color: "#ef4444",
    bg: "from-red-500/20 to-orange-500/20",
    border: "border-red-500/30",
    label: "Critical",
    icon: "🔴",
  },
  elevated: {
    color: "#f59e0b",
    bg: "from-amber-500/20 to-yellow-500/20",
    border: "border-amber-500/30",
    label: "Elevated",
    icon: "🟡",
  },
  secure: {
    color: "#22c55e",
    bg: "from-emerald-500/20 to-green-500/20",
    border: "border-emerald-500/30",
    label: "Secure",
    icon: "🟢",
  },
};

const shortenAddr = (addr: string) =>
  addr ? addr.slice(0, 6) + "\u2026" + addr.slice(-4) : "";

// ─── Component ───────────────────────────────────────────────────────

export const SecurityScore: React.FC<SecurityScoreProps> = () => {
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"overview" | "check" | "activity">(
    "overview",
  );

  // Address check
  const [checkAddress, setCheckAddress] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  // Activity logs
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Operations metrics
  const [shieldBalance, setShieldBalance] = useState("0");
  const [reportsCount, setReportsCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  // ── Derived metrics from activity logs ──
  const totalScans = activityLogs.filter(
    (l) => l.type === "address_check",
  ).length;
  const threatsDetected = activityLogs.filter(
    (l) => l.blocked || l.isScam,
  ).length;
  const txProtected = activityLogs.filter(
    (l) => l.type !== "address_check" && !l.blocked,
  ).length;
  const threatLevel = deriveThreatLevel(activityLogs);
  const threat = threatConfig[threatLevel];

  // ── Fetch operational data ──
  const fetchOpsData = useCallback(async () => {
    if (!walletConnector.address) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [balance, reports] = await Promise.all([
        contractService
          .getShieldBalance(walletConnector.address)
          .catch(() => "0"),
        contractService.getUserReports().catch(() => []),
      ]);
      setShieldBalance(parseFloat(balance).toFixed(2));
      setReportsCount(reports.length);
      setLastScanTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to fetch ops data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpsData();
    try {
      const raw = localStorage.getItem("transaction-logs");
      if (raw) setActivityLogs(JSON.parse(raw).slice(-50).reverse());
    } catch {
      /* empty */
    }
    const handler = () => fetchOpsData();
    window.addEventListener("wallet_accountChanged", handler);
    return () => window.removeEventListener("wallet_accountChanged", handler);
  }, [fetchOpsData]);

  // ── Check address against on-chain scam registry ──
  const handleCheckAddress = async () => {
    if (!checkAddress || checkAddress.length < 42) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const [isScam, scamScore] = await Promise.all([
        contractService.isScamAddress(checkAddress),
        contractService.getScamScore(checkAddress).catch(() => 0),
      ]);
      setCheckResult({ isScam, score: scamScore, address: checkAddress });
      // Log this scan
      const scanLog = {
        type: "address_check",
        address: checkAddress,
        isScam,
        timestamp: Date.now(),
      };
      const existing = JSON.parse(
        localStorage.getItem("transaction-logs") || "[]",
      );
      existing.push(scanLog);
      localStorage.setItem("transaction-logs", JSON.stringify(existing));
      setActivityLogs((prev) => [scanLog, ...prev].slice(0, 50));
    } catch (err) {
      console.error("Address check failed:", err);
      setCheckResult({ isScam: false, score: 0, address: checkAddress });
    } finally {
      setChecking(false);
    }
  };

  // ── Stat cards for Overview ──
  const stats = [
    {
      label: "Addresses Scanned",
      value: totalScans.toString(),
      icon: Eye,
      color: "text-cyan-400",
    },
    {
      label: "Threats Detected",
      value: threatsDetected.toString(),
      icon: FileWarning,
      color: "text-red-400",
    },
    {
      label: "Txns Protected",
      value: txProtected.toString(),
      icon: ShieldCheck,
      color: "text-emerald-400",
    },
    {
      label: "SHIELD Balance",
      value: shieldBalance,
      icon: Zap,
      color: "text-amber-400",
    },
  ];

  // ── Action tips ──
  const tips = [
    {
      text: "Check a suspicious address using the Check Address tab",
      done: totalScans >= 1,
    },
    {
      text: "Report a scam address to the DAO from the Reports tab",
      done: reportsCount >= 1,
    },
    {
      text: "Send a secure transaction with ML fraud detection",
      done: txProtected >= 1,
    },
  ];

  // ── Tab definitions ──
  const tabList: {
    id: "overview" | "check" | "activity";
    label: string;
    icon: React.FC<React.SVGProps<SVGSVGElement> & { className?: string }>;
  }[] = [
    { id: "overview", label: "Overview", icon: Shield },
    { id: "check", label: "Check Address", icon: Search },
    { id: "activity", label: "Activity", icon: Clock },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* ── Left: Security Operations Shield ── */}
      <div className="lg:col-span-4">
        <Card className="bg-black/40 backdrop-blur-xl border-white/[0.08] overflow-hidden h-full">
          <CardContent className="p-6 flex flex-col items-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
                <span className="text-sm text-white/40">
                  Loading security data…
                </span>
              </div>
            ) : !walletConnector.address ? (
              <div className="py-16 text-center text-white/40 text-sm">
                Connect wallet to view security status
              </div>
            ) : (
              <>
                {/* Threat Status Shield */}
                <div className="relative w-40 h-40 mb-4 flex items-center justify-center">
                  <svg
                    className="w-full h-full"
                    viewBox="0 0 128 128"
                    fill="none"
                  >
                    {/* Shield shape */}
                    <path
                      d="M64 8 L112 28 L112 60 C112 90 90 112 64 120 C38 112 16 90 16 60 L16 28 Z"
                      fill="rgba(255,255,255,0.03)"
                      stroke={threat.color}
                      strokeWidth="2"
                      strokeLinejoin="round"
                      className="transition-all duration-700"
                    />
                    <path
                      d="M64 18 L104 35 L104 60 C104 85 85 105 64 112 C43 105 24 85 24 60 L24 35 Z"
                      fill={`${threat.color}15`}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Activity
                      className="w-8 h-8 mb-1"
                      style={{ color: threat.color }}
                    />
                    <span
                      className="text-sm font-bold uppercase tracking-wider"
                      style={{ color: threat.color }}
                    >
                      {threat.label}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <Badge
                  className={`${threat.border} bg-gradient-to-r ${threat.bg} px-3 py-1 text-sm font-medium mb-6`}
                  style={{ color: threat.color }}
                >
                  {threat.icon} Threat Level: {threat.label}
                </Badge>

                {/* Quick stats summary */}
                <div className="w-full space-y-3">
                  <div className="flex justify-between items-center text-base">
                    <span className="text-white/50 flex items-center gap-2 font-medium">
                      <Eye className="w-4 h-4" /> Scans
                    </span>
                    <span className="text-white/80 font-mono font-semibold">
                      {totalScans}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-base">
                    <span className="text-white/50 flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-4 h-4" /> Threats
                    </span>
                    <span
                      className={`font-mono font-semibold ${threatsDetected > 0 ? "text-red-400" : "text-emerald-400"}`}
                    >
                      {threatsDetected}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-base">
                    <span className="text-white/50 flex items-center gap-2 font-medium">
                      <ShieldCheck className="w-4 h-4" /> Protected Txns
                    </span>
                    <span className="text-white/80 font-mono font-semibold">
                      {txProtected}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-base">
                    <span className="text-white/50 flex items-center gap-2 font-medium">
                      <Zap className="w-4 h-4" /> SHIELD
                    </span>
                    <span className="text-amber-400 font-mono font-semibold">
                      {shieldBalance}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-base">
                    <span className="text-white/50 flex items-center gap-2 font-medium">
                      <FileWarning className="w-4 h-4" /> Reports Filed
                    </span>
                    <span className="text-white/80 font-mono font-semibold">
                      {reportsCount}
                    </span>
                  </div>
                </div>

                {/* Refresh */}
                <button
                  onClick={fetchOpsData}
                  disabled={loading}
                  className="mt-5 text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                  {lastScanTime && (
                    <span className="text-white/20">
                      {" \u00b7 "}
                      {lastScanTime}
                    </span>
                  )}
                </button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Right: Action Panel ── */}
      <div className="lg:col-span-8">
        <Card className="bg-black/40 backdrop-blur-xl border-white/[0.08] overflow-hidden h-full">
          {/* Tab Bar */}
          <div className="flex border-b border-white/[0.06]">
            {tabList.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-base font-semibold transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-white/60 text-white"
                    : "border-transparent text-white/40 hover:text-white/60"
                }`}
              >
                <tab.icon className="w-5 h-5" /> {tab.label}
              </button>
            ))}
          </div>

          <CardContent className="p-6">
            {/* ── Overview Tab ── */}
            {activeTab === "overview" && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                        <span className="text-sm text-white/50 font-medium">
                          {stat.label}
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-white font-mono">
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                  <h4 className="text-base font-semibold text-white/80 mb-3">
                    Security Actions
                  </h4>
                  <div className="space-y-2.5">
                    {tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        {tip.done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        ) : (
                          <ArrowRight className="w-4 h-4 text-white/20 mt-0.5 shrink-0" />
                        )}
                        <span
                          className={`text-base ${tip.done ? "text-white/50 line-through" : "text-white/70"}`}
                        >
                          {tip.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-white/30 text-center">
                  Metrics from on-chain reads + local security logs — SHIELD
                  balance via{" "}
                  <code className="text-white/40">ShieldToken.balanceOf()</code>
                </p>
              </div>
            )}

            {/* ── Check Address Tab ── */}
            {activeTab === "check" && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-sm font-medium text-white/70 mb-1">
                    On-Chain Scam Registry Lookup
                  </h4>
                  <p className="text-xs text-white/30">
                    Checks the DAO-confirmed scam registry on Monad Testnet
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="0x… address to check"
                    value={checkAddress}
                    onChange={(e) => setCheckAddress(e.target.value)}
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20 transition-colors font-mono"
                  />
                  <button
                    onClick={handleCheckAddress}
                    disabled={checking || checkAddress.length < 42}
                    className="px-5 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm font-medium text-white/80 hover:bg-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {checking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Check
                  </button>
                </div>

                {checkResult && (
                  <div
                    className={`rounded-xl border p-5 ${
                      checkResult.isScam
                        ? "bg-red-500/[0.06] border-red-500/20"
                        : "bg-emerald-500/[0.06] border-emerald-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {checkResult.isScam ? (
                        <XCircle className="w-6 h-6 text-red-400" />
                      ) : (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      )}
                      <div>
                        <div
                          className={`font-semibold ${
                            checkResult.isScam
                              ? "text-red-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {checkResult.isScam
                            ? "\u26a0 DAO-Confirmed Scammer"
                            : "\u2713 Address Clean"}
                        </div>
                        <div className="text-xs text-white/30 font-mono">
                          {checkResult.address}
                        </div>
                      </div>
                    </div>
                    {checkResult.isScam && checkResult.score > 0 && (
                      <div className="text-sm text-white/50">
                        Scam score:{" "}
                        <span className="text-red-400 font-mono">
                          {checkResult.score}
                        </span>{" "}
                        reports confirmed by DAO voting
                      </div>
                    )}
                    <p className="text-xs text-white/20 mt-2">
                      Source: QuadraticVoting contract <code>isScammer()</code>{" "}
                      on-chain read
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Activity Tab ── */}
            {activeTab === "activity" && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-white/70">
                  Recent Security Activity
                </h4>
                {activityLogs.length === 0 ? (
                  <div className="py-12 text-center text-white/30 text-sm">
                    No activity yet. Check an address or send a transaction.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {activityLogs.map((log, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors"
                      >
                        {log.blocked || log.isScam ? (
                          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white/70 truncate font-mono">
                            {shortenAddr(log.address || log.to || "")}
                          </div>
                          <div className="text-xs text-white/30">
                            {log.type === "address_check"
                              ? "Address check"
                              : log.type || "Transaction"}
                            {log.timestamp &&
                              ` \u00b7 ${new Date(log.timestamp).toLocaleString()}`}
                          </div>
                        </div>
                        <Badge
                          className={`shrink-0 text-xs ${
                            log.blocked || log.isScam
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          {log.blocked || log.isScam ? "Flagged" : "Clean"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SecurityScore;
