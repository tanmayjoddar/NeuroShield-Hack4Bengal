import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import { Loader2, AlertCircle, Activity, Shield, Network } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import walletConnector from "@/web3/wallet";
import contractService from "@/web3/contract";
import { JsonRpcProvider, formatUnits } from "ethers";

const MONAD_RPC = "https://testnet-rpc.monad.xyz";

/** Always returns a working read-only provider (never depends on MetaMask). */
const getReadProvider = () => new JsonRpcProvider(MONAD_RPC);

// ------- Types -------

interface TransactionLog {
  timestamp: string;
  from: string;
  to: string;
  value: number;
  gasPrice: number;
  riskScore: number;
  riskLevel: string;
  blocked: boolean;
  whitelisted: boolean;
}

interface TimelinePoint {
  time: string;
  fullTime: string;
  score: number;
  address: string;
  blocked: boolean;
  isScammer: boolean;
}

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  status: "scam" | "safe" | "unknown";
  isCenter: boolean;
  txCount: number;
}

interface GraphEdge {
  source: string;
  target: string;
  riskScore: number;
}

interface WalletAnalyticsData {
  sent_tx_count: number;
  received_tx_count: number;
  total_ether_balance: string;
  wallet_age_days: number;
}

interface WalletAnalyticsProps {
  walletAddress?: string;
}

// ------- Network Graph (Canvas) -------

const NetworkGraph: React.FC<{
  nodes: GraphNode[];
  edges: GraphEdge[];
}> = ({ nodes: initialNodes, edges }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const animRef = useRef<number>(0);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Deep-clone so we can mutate positions
    nodesRef.current = initialNodes.map((n) => ({ ...n }));
  }, [initialNodes]);

  // Simple force-directed simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const CX = W / 2;
    const CY = H / 2;

    // Place center node and arrange others in a circle initially
    const others = nodesRef.current.filter((n) => !n.isCenter);
    const center = nodesRef.current.find((n) => n.isCenter);
    if (center) {
      center.x = CX;
      center.y = CY;
    }
    others.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(others.length, 1);
      const radius = Math.min(W, H) * 0.32;
      n.x = CX + Math.cos(angle) * radius;
      n.y = CY + Math.sin(angle) * radius;
      n.vx = 0;
      n.vy = 0;
    });

    let tick = 0;
    const maxTicks = 200;

    const simulate = () => {
      const nodes = nodesRef.current;
      if (tick < maxTicks) {
        const alpha = 1 - tick / maxTicks;
        // Repulsion between all nodes
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = (800 * alpha) / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (!nodes[i].isCenter) {
              nodes[i].vx -= fx;
              nodes[i].vy -= fy;
            }
            if (!nodes[j].isCenter) {
              nodes[j].vx += fx;
              nodes[j].vy += fy;
            }
          }
        }
        // Attraction along edges
        for (const edge of edges) {
          const src = nodes.find((n) => n.id === edge.source);
          const tgt = nodes.find((n) => n.id === edge.target);
          if (!src || !tgt) continue;
          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const idealDist = Math.min(W, H) * 0.25;
          const force = (dist - idealDist) * 0.01 * alpha;
          if (!src.isCenter) {
            src.vx += (dx / dist) * force;
            src.vy += (dy / dist) * force;
          }
          if (!tgt.isCenter) {
            tgt.vx -= (dx / dist) * force;
            tgt.vy -= (dy / dist) * force;
          }
        }
        // Apply velocity + damping
        for (const n of nodes) {
          if (n.isCenter) continue;
          n.vx *= 0.6;
          n.vy *= 0.6;
          n.x += n.vx;
          n.y += n.vy;
          // Boundary
          n.x = Math.max(40, Math.min(W - 40, n.x));
          n.y = Math.max(40, Math.min(H - 40, n.y));
        }
        tick++;
      }

      // ---- Draw ----
      ctx.clearRect(0, 0, W, H);

      // Edges
      for (const edge of edges) {
        const src = nodes.find((n) => n.id === edge.source);
        const tgt = nodes.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;

        const riskColor =
          edge.riskScore > 70
            ? "rgba(248, 113, 113, 0.6)"
            : edge.riskScore > 40
              ? "rgba(250, 204, 21, 0.4)"
              : "rgba(74, 222, 128, 0.3)";

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = riskColor;
        ctx.lineWidth = Math.min(3, 1 + (tgt.txCount || 1) * 0.5);
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        const radius = n.isCenter ? 18 : 8 + Math.min(n.txCount, 5) * 2;
        const color = n.isCenter
          ? "#818cf8"
          : n.status === "scam"
            ? "#f87171"
            : n.status === "safe"
              ? "#4ade80"
              : "#9ca3af";

        // Glow
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = n.isCenter
          ? "rgba(129,140,248,0.15)"
          : n.status === "scam"
            ? "rgba(248,113,113,0.2)"
            : "rgba(255,255,255,0.05)";
        ctx.fill();

        // Circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        ctx.fillStyle = "#fff";
        ctx.font = n.isCenter ? "bold 10px sans-serif" : "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y + radius + 14);

        // Status badge for scam nodes
        if (n.status === "scam" && !n.isCenter) {
          ctx.fillStyle = "#fca5a5";
          ctx.font = "bold 7px sans-serif";
          ctx.fillText("SCAM", n.x, n.y + radius + 24);
        }
      }

      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animRef.current);
  }, [initialNodes, edges]);

  // Mouse hover
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x =
        (e.clientX - rect.left) * (canvasRef.current!.width / rect.width);
      const y =
        (e.clientY - rect.top) * (canvasRef.current!.height / rect.height);
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

      const hit = nodesRef.current.find((n) => {
        const r = n.isCenter ? 18 : 10;
        return Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2) < r + 5;
      });
      setHoveredNode(hit || null);
    },
    [],
  );

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        className="w-full h-[400px] rounded-lg bg-black/30"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredNode(null)}
      />
      {hoveredNode && (
        <div
          className="absolute pointer-events-none bg-black/90 border border-white/20 rounded-lg px-3 py-2 text-xs z-10"
          style={{ left: mousePos.x + 12, top: mousePos.y - 10 }}
        >
          <div className="text-white font-mono">{hoveredNode.id}</div>
          <div className="text-gray-400">
            {hoveredNode.txCount} transaction
            {hoveredNode.txCount !== 1 ? "s" : ""}
          </div>
          <div
            className={
              hoveredNode.status === "scam"
                ? "text-red-400 font-bold"
                : hoveredNode.status === "safe"
                  ? "text-green-400"
                  : "text-gray-500"
            }
          >
            {hoveredNode.status === "scam"
              ? "⚠ DAO Confirmed Scam"
              : hoveredNode.status === "safe"
                ? "✓ Whitelisted"
                : "Unknown"}
          </div>
        </div>
      )}
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> DAO
          Confirmed Scam
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-400 inline-block" />{" "}
          Whitelisted / Safe
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" />{" "}
          Unknown
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-indigo-400 inline-block" />{" "}
          Your Wallet
        </span>
      </div>
    </div>
  );
};

// ------- Custom Tooltip for Timeline -------

const TimelineTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as TimelinePoint;
  return (
    <div className="bg-black/90 border border-white/20 rounded-lg px-3 py-2 text-xs">
      <div className="text-gray-400">{d.fullTime}</div>
      <div className="text-white font-bold text-sm">
        Risk: {(d.score * 100).toFixed(0)}%
      </div>
      <div className="text-gray-400 font-mono text-[10px]">
        → {d.address.slice(0, 10)}…{d.address.slice(-6)}
      </div>
      {d.isScammer && (
        <div className="text-red-400 font-bold mt-1">⚠ DAO Confirmed Scam</div>
      )}
      {d.blocked && <div className="text-yellow-400">Blocked by user</div>}
    </div>
  );
};

// ------- Main Component -------

const WalletAnalytics: React.FC<WalletAnalyticsProps> = ({ walletAddress }) => {
  const [analytics, setAnalytics] = useState<WalletAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chart data
  const [timelineData, setTimelineData] = useState<TimelinePoint[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  // Fetch basic analytics
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const address = walletAddress || walletConnector.address;

        if (!address) {
          setError("Connect your wallet to view analytics");
          setLoading(false);
          return;
        }

        // Use dedicated read-only provider — never MetaMask
        const provider = getReadProvider();
        console.log("[Analytics] Reading balance & nonce for", address);

        const [balance, txCount] = await Promise.all([
          provider.getBalance(address),
          provider.getTransactionCount(address),
        ]);

        console.log(
          "[Analytics] Balance:",
          balance.toString(),
          "Nonce:",
          txCount,
        );

        setAnalytics({
          sent_tx_count: txCount,
          received_tx_count: 0,
          total_ether_balance: balance.toString(),
          wallet_age_days: Math.max(1, txCount),
        });
      } catch (err) {
        console.error("Error fetching analytics:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch analytics data",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [walletAddress]);

  // Build chart data from transaction logs + on-chain scam status
  useEffect(() => {
    const buildChartData = async () => {
      setChartsLoading(true);
      const address = walletAddress || walletConnector.address;
      if (!address) {
        setChartsLoading(false);
        return;
      }

      try {
        const rawLogs = localStorage.getItem("transaction-logs");
        const logs: TransactionLog[] = rawLogs ? JSON.parse(rawLogs) : [];

        // Use ALL logs — this is a single-user app, all scans belong to this user
        const myLogs = logs.filter((l) => l.to || l.from);
        console.log(
          `[Analytics] Found ${myLogs.length} transaction logs for charts`,
        );

        // --- Threat Score Timeline ---
        // Unique target addresses to batch-check scam status
        const uniqueAddresses = [
          ...new Set(myLogs.map((l) => l.to?.toLowerCase()).filter(Boolean)),
        ];

        // Check on-chain isScammer for each unique address
        const scamStatusMap: Record<string, boolean> = {};
        await Promise.all(
          uniqueAddresses.map(async (addr) => {
            if (!addr) return;
            try {
              scamStatusMap[addr] = await contractService.isScammer(addr);
            } catch {
              scamStatusMap[addr] = false;
            }
          }),
        );

        // Build timeline (chronological order — oldest first)
        const sorted = [...myLogs].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );

        const timeline: TimelinePoint[] = sorted.map((log) => {
          const d = new Date(log.timestamp);
          return {
            time: `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`,
            fullTime: d.toLocaleString(),
            score: log.riskScore ?? 0,
            address: log.to || "",
            blocked: log.blocked,
            isScammer: scamStatusMap[log.to?.toLowerCase()] || false,
          };
        });
        setTimelineData(timeline);

        // --- Network Graph ---
        // Count transactions per unique counterparty
        const counterpartyMap: Record<
          string,
          { count: number; maxRisk: number; whitelisted: boolean }
        > = {};
        for (const log of myLogs) {
          const counterparty =
            log.from?.toLowerCase() === address.toLowerCase()
              ? log.to?.toLowerCase()
              : log.from?.toLowerCase();
          if (!counterparty) continue;
          if (!counterpartyMap[counterparty]) {
            counterpartyMap[counterparty] = {
              count: 0,
              maxRisk: 0,
              whitelisted: false,
            };
          }
          counterpartyMap[counterparty].count++;
          counterpartyMap[counterparty].maxRisk = Math.max(
            counterpartyMap[counterparty].maxRisk,
            (log.riskScore ?? 0) * 100,
          );
          if (log.whitelisted) {
            counterpartyMap[counterparty].whitelisted = true;
          }
        }

        const nodes: GraphNode[] = [
          {
            id: address,
            label: "You",
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            status: "safe",
            isCenter: true,
            txCount: myLogs.length,
          },
        ];

        const edgesArr: GraphEdge[] = [];

        for (const [addr, data] of Object.entries(counterpartyMap)) {
          const isScam = scamStatusMap[addr] || false;
          nodes.push({
            id: addr,
            label: `${addr.slice(0, 6)}…${addr.slice(-4)}`,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            status: isScam ? "scam" : data.whitelisted ? "safe" : "unknown",
            isCenter: false,
            txCount: data.count,
          });
          edgesArr.push({
            source: address,
            target: addr,
            riskScore: data.maxRisk,
          });
        }

        setGraphNodes(nodes);
        setGraphEdges(edgesArr);
      } catch (err) {
        console.error("Error building chart data:", err);
      } finally {
        setChartsLoading(false);
      }
    };

    buildChartData();

    // Re-build when a new transaction is logged
    const handler = () => buildChartData();
    window.addEventListener("transaction-logged", handler);
    return () => window.removeEventListener("transaction-logged", handler);
  }, [walletAddress]);

  const formatEther = (value: string): string => {
    if (!value) return "0";
    try {
      return (parseFloat(value) / 1e18).toFixed(4);
    } catch {
      return "0";
    }
  };

  if (loading) {
    return (
      <Card className="bg-black/20 backdrop-blur-lg border-white/10">
        <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-4" />
          <p className="text-gray-400">Analyzing wallet data...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !analytics) {
    return (
      <Card className="bg-black/20 backdrop-blur-lg border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-400 mb-4">
            <AlertCircle className="w-5 h-5" />
            <span>Analytics Error</span>
          </div>
          <p className="text-gray-400">
            {error || "No analytics data available"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasData = timelineData.length > 0;

  return (
    <Card className="bg-black/20 backdrop-blur-lg border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Wallet Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-emerald-400">
                {analytics.sent_tx_count}
              </div>
              <p className="text-gray-400">Nonce (Sent Tx Count)</p>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-indigo-400">
                {formatEther(analytics.total_ether_balance)} MON
              </div>
              <p className="text-gray-400">Current Balance</p>
            </div>
            <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-fuchsia-400">
                {timelineData.length}
              </div>
              <p className="text-gray-400">Scans Performed</p>
            </div>
          </div>

          {/* Charts */}
          <Tabs defaultValue="timeline" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 bg-black/40">
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Threat Score Timeline
              </TabsTrigger>
              <TabsTrigger value="network" className="flex items-center gap-2">
                <Network className="w-4 h-4" />
                Transaction Network
              </TabsTrigger>
            </TabsList>

            {/* ── Threat Score Timeline ── */}
            <TabsContent value="timeline">
              <div className="bg-black/20 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-3">
                  Each point is a real ML scan result. Red zone (&gt;70%) = high
                  risk. The DAO confirmation line shows when community consensus
                  boosts the score.
                </p>
                {chartsLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  </div>
                ) : !hasData ? (
                  <div className="h-[300px] flex flex-col items-center justify-center text-gray-500">
                    <Shield className="w-10 h-10 mb-3 opacity-40" />
                    <p>
                      No scans yet. Send a transaction to see threat scores.
                    </p>
                    <p className="text-xs mt-1 text-gray-600">
                      Try sending to the Ronin address in the demo to populate
                      this chart.
                    </p>
                  </div>
                ) : (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer>
                      <AreaChart
                        data={timelineData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient
                            id="riskGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#f87171"
                              stopOpacity={0.4}
                            />
                            <stop
                              offset="95%"
                              stopColor="#f87171"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#333"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          stroke="#666"
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          stroke="#666"
                          domain={[0, 1]}
                          tickFormatter={(v: number) =>
                            `${(v * 100).toFixed(0)}%`
                          }
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip content={<TimelineTooltip />} />
                        <ReferenceLine
                          y={0.7}
                          stroke="#f87171"
                          strokeDasharray="6 3"
                          label={{
                            value: "High Risk",
                            fill: "#f87171",
                            fontSize: 10,
                            position: "insideTopRight",
                          }}
                        />
                        <ReferenceLine
                          y={0.4}
                          stroke="#facc15"
                          strokeDasharray="4 4"
                          label={{
                            value: "Medium",
                            fill: "#facc15",
                            fontSize: 10,
                            position: "insideTopRight",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#f87171"
                          strokeWidth={2}
                          fill="url(#riskGradient)"
                          dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            const isScam = payload.isScammer;
                            return (
                              <circle
                                cx={cx}
                                cy={cy}
                                r={isScam ? 6 : 4}
                                fill={
                                  isScam
                                    ? "#f87171"
                                    : payload.score > 0.7
                                      ? "#fb923c"
                                      : "#4ade80"
                                }
                                stroke={isScam ? "#fff" : "none"}
                                strokeWidth={isScam ? 2 : 0}
                              />
                            );
                          }}
                          activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Transaction Network Graph ── */}
            <TabsContent value="network">
              <div className="bg-black/20 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-3">
                  Your wallet in the center. Each node is an address you
                  interacted with. Red = DAO confirmed scam (on-chain{" "}
                  <code className="text-gray-400">isScammer()</code> check).
                  Green = whitelisted. Hover for details.
                </p>
                {chartsLoading ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  </div>
                ) : graphNodes.length <= 1 ? (
                  <div className="h-[400px] flex flex-col items-center justify-center text-gray-500">
                    <Network className="w-10 h-10 mb-3 opacity-40" />
                    <p>No transaction network yet.</p>
                    <p className="text-xs mt-1 text-gray-600">
                      Send or scan transactions to build the network graph.
                    </p>
                  </div>
                ) : (
                  <NetworkGraph nodes={graphNodes} edges={graphEdges} />
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletAnalytics;
