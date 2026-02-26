/**
 * SoulboundToken.tsx — The SBT Profile Card
 *
 * Displays the user's on-chain Soulbound Token with:
 * - Trust score breakdown (+40/+20/+20/+20)
 * - Verification level badge
 * - On-chain metadata viewer (raw Base64 JSON)
 * - Mint/Update SBT actions
 * - Real-time event subscription
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  getSBTProfile,
  computeLiveTrustScore,
  mintSBT,
  updateSBT,
  levelToString,
  levelToColor,
  onSBTMinted,
  onMetadataUpdated,
  type SBTProfile,
  type TrustBreakdown,
} from "@/web3/civic/sbt";
import walletConnector from "@/web3/wallet";

// ════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════

const TrustScoreBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
}> = ({ label, value, max, color }) => (
  <div className="mb-3">
    <div className="flex justify-between text-sm mb-1">
      <span className="text-gray-300">{label}</span>
      <span className="font-mono text-white">
        +{value}/{max}
      </span>
    </div>
    <div className="w-full bg-gray-700 rounded-full h-2.5">
      <div
        className="h-2.5 rounded-full transition-all duration-700 ease-out"
        style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

const VerificationBadge: React.FC<{ level: number }> = ({ level }) => {
  const name = levelToString(level);
  const color = levelToColor(level);
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border"
      style={{ borderColor: color, color }}
    >
      <span
        className="w-2 h-2 rounded-full mr-1.5"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  );
};

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════

const SoulboundToken: React.FC = () => {
  const [profile, setProfile] = useState<SBTProfile | null>(null);
  const [liveBreakdown, setLiveBreakdown] = useState<TrustBreakdown | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRawURI, setShowRawURI] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Load SBT data
  const loadSBTData = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    try {
      const [sbtProfile, breakdown] = await Promise.all([
        getSBTProfile(address),
        computeLiveTrustScore(address),
      ]);
      setProfile(sbtProfile);
      setLiveBreakdown(breakdown);
    } catch (err) {
      console.error("[SBT UI] Failed to load:", err);
      setError("Failed to load SBT data. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Watch wallet connection
  useEffect(() => {
    const addr = walletConnector.address;
    if (addr) {
      setWalletAddress(addr);
      loadSBTData(addr);
    } else {
      setLoading(false);
    }
  }, [loadSBTData]);

  // Subscribe to on-chain SBT events
  useEffect(() => {
    const cleanupMint = onSBTMinted((to, _tokenId) => {
      if (walletAddress && to.toLowerCase() === walletAddress.toLowerCase()) {
        loadSBTData(walletAddress);
      }
    });
    const cleanupUpdate = onMetadataUpdated((_tokenId, _newUri) => {
      if (walletAddress) loadSBTData(walletAddress);
    });
    return () => {
      cleanupMint();
      cleanupUpdate();
    };
  }, [walletAddress, loadSBTData]);

  // Mint SBT
  const handleMint = async () => {
    if (!walletAddress) return;
    setMinting(true);
    setError(null);
    setSuccess(null);

    try {
      // WalletVerifier computes score entirely on-chain — no params needed
      const result = await mintSBT();

      if (result.success) {
        setSuccess(`SBT minted! TX: ${result.txHash?.slice(0, 10)}...`);
        await loadSBTData(walletAddress);
      } else {
        setError(result.error || "Minting failed");
      }
    } catch (err: any) {
      setError(err?.message || "Minting failed");
    } finally {
      setMinting(false);
    }
  };

  // Update SBT metadata
  const handleUpdate = async () => {
    if (!walletAddress) return;
    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      // WalletVerifier refreshes score entirely on-chain
      const result = await updateSBT();

      if (result.success) {
        setSuccess(`SBT updated! TX: ${result.txHash?.slice(0, 10)}...`);
        await loadSBTData(walletAddress);
      } else {
        setError(result.error || "Update failed");
      }
    } catch (err: any) {
      setError(err?.message || "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  // ── Render ──

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-48 mb-4" />
        <div className="h-4 bg-gray-700 rounded w-64 mb-3" />
        <div className="h-4 bg-gray-700 rounded w-56" />
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">🔗</div>
        <p className="text-gray-400">
          Connect your wallet to view your Soulbound Token
        </p>
      </div>
    );
  }

  const breakdown = profile?.hasSBT ? profile.trustBreakdown : liveBreakdown;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 px-6 py-5 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🛡️</span>
              Soulbound Token
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Permanent on-chain reputation — impossible to transfer, impossible
              to fake
            </p>
          </div>
          {profile?.hasSBT && profile.metadata && (
            <VerificationBadge level={profile.metadata.verificationLevel} />
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Status alerts */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-300 text-sm">
            {success}
          </div>
        )}

        {profile?.hasSBT && profile.metadata ? (
          /* ── SBT EXISTS: Show full profile ── */
          <>
            {/* Trust Score Circle */}
            <div className="flex items-center gap-6 mb-6">
              <div className="relative w-24 h-24 flex-shrink-0">
                <svg
                  className="w-24 h-24 transform -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#374151"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke={levelToColor(profile.metadata.verificationLevel)}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(profile.metadata.trustScore / 100) * 264} 264`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {profile.metadata.trustScore}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-white font-semibold text-lg">Trust Score</p>
                <p className="text-gray-400 text-sm">
                  Minted{" "}
                  {new Date(
                    profile.metadata.issuedAt * 1000,
                  ).toLocaleDateString()}
                </p>
                <p className="text-gray-500 text-xs mt-1 font-mono">
                  Level {profile.metadata.verificationLevel} —{" "}
                  {levelToString(profile.metadata.verificationLevel)}
                </p>
              </div>
            </div>

            {/* Trust Breakdown */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Trust Score Breakdown
                <span className="ml-2 text-xs font-normal text-gray-600 normal-case">
                  (derived from on-chain contract data)
                </span>
              </h3>
              {breakdown && (
                <>
                  <TrustScoreBar
                    label="💰 Wallet History"
                    value={breakdown.walletHistory}
                    max={40}
                    color="#8b5cf6"
                  />
                  <TrustScoreBar
                    label="🎯 DAO Voting Accuracy"
                    value={breakdown.votingAccuracy}
                    max={30}
                    color="#10b981"
                  />
                  <TrustScoreBar
                    label="🗳️ DAO Participation"
                    value={breakdown.daoParticipation}
                    max={30}
                    color="#f59e0b"
                  />
                </>
              )}
              <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between">
                <span className="text-gray-300 font-medium">Total</span>
                <span className="text-white font-bold font-mono">
                  {breakdown?.total || 0} / 100
                </span>
              </div>
            </div>

            {/* On-Chain Metadata */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                On-Chain Contract Data
                <span className="ml-2 text-xs font-normal text-green-500/70 normal-case">
                  via eth_call → getTokenMetadata()
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {profile.tokenId !== undefined && (
                  <div className="bg-gray-800 rounded-lg p-3 col-span-2">
                    <span className="text-gray-500 block text-xs">
                      Token ID
                    </span>
                    <span className="text-white font-mono">
                      #{profile.tokenId}
                    </span>
                  </div>
                )}
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-gray-500 block text-xs">
                    Trust Score (raw)
                  </span>
                  <span className="text-white font-mono">
                    {profile.metadata.trustScore}
                  </span>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-gray-500 block text-xs">
                    Verification Level
                  </span>
                  <span className="text-white font-mono">
                    {profile.metadata.verificationLevel} (
                    {levelToString(profile.metadata.verificationLevel)})
                  </span>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-gray-500 block text-xs">
                    Voting Accuracy
                  </span>
                  <span className="text-white font-mono">
                    {profile.metadata.votingAccuracy}%
                  </span>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-gray-500 block text-xs">
                    DAO Votes Cast
                  </span>
                  <span className="text-white font-mono">
                    {profile.metadata.doiParticipation}
                  </span>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-gray-500 block text-xs">Issued At</span>
                  <span className="text-white font-mono text-xs">
                    {new Date(profile.metadata.issuedAt * 1000).toISOString()}
                  </span>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-gray-500 block text-xs">Contract</span>
                  <span className="text-green-400 font-mono text-xs">
                    {import.meta.env.VITE_CIVIC_SBT_ADDRESS?.slice(0, 10)}...
                  </span>
                </div>
              </div>
            </div>

            {/* Raw Token URI (collapsible) */}
            <div className="mb-6">
              <button
                onClick={() => setShowRawURI(!showRawURI)}
                className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                {showRawURI ? "▾" : "▸"} View Raw On-Chain Token URI
                <span className="ml-1 text-xs text-gray-600">
                  (eth_call → tokenURI)
                </span>
              </button>
              {showRawURI && profile.tokenURI && (
                <div className="mt-2 bg-gray-800 rounded-lg p-3 overflow-x-auto">
                  <p className="text-xs text-gray-500 mb-1">
                    Read directly from contract via tokenURI(
                    {profile.tokenId ?? "?"}) — fully on-chain Base64 JSON, no
                    IPFS, no server
                  </p>
                  <code className="text-xs text-green-400 break-all font-mono leading-relaxed">
                    {profile.tokenURI}
                  </code>
                </div>
              )}
            </div>

            {/* Soulbound Explanation */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-300 italic leading-relaxed">
                "In Web2, your reputation lives on a server someone else owns.
                They can delete it. They can sell it. In NeuroShield, your
                reputation is permanently encoded on-chain, bound to your wallet
                forever, impossible to transfer, impossible to fake, impossible
                to take down."
              </p>
            </div>

            {/* Update Button */}
            <button
              onClick={handleUpdate}
              disabled={updating}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-medium transition-colors"
            >
              {updating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⟳</span> Refreshing On-Chain
                  Score...
                </span>
              ) : (
                "🔄 Refresh Trust Score On-Chain"
              )}
            </button>
          </>
        ) : (
          /* ── NO SBT: Show mint prompt ── */
          <>
            {/* Live preview of what the SBT would contain */}
            {liveBreakdown && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Your Current Trust Score (Preview)
                </h3>
                <p className="text-gray-500 text-xs mb-3">
                  This will be permanently encoded on-chain when you mint
                </p>
                <TrustScoreBar
                  label="💰 Wallet History"
                  value={liveBreakdown.walletHistory}
                  max={40}
                  color="#8b5cf6"
                />
                <TrustScoreBar
                  label="🎯 DAO Voting Accuracy"
                  value={liveBreakdown.votingAccuracy}
                  max={30}
                  color="#10b981"
                />
                <TrustScoreBar
                  label="🗳️ DAO Participation"
                  value={liveBreakdown.daoParticipation}
                  max={30}
                  color="#f59e0b"
                />
                <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between">
                  <span className="text-gray-300 font-medium">
                    Projected Score
                  </span>
                  <span className="text-white font-bold font-mono">
                    {liveBreakdown.total} / 100
                  </span>
                </div>
              </div>
            )}

            {/* Soulbound Explanation */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
              <h3 className="text-white font-semibold mb-2">
                What is a Soulbound Token?
              </h3>
              <ul className="text-sm text-gray-400 space-y-1.5">
                <li>
                  ✓ <strong className="text-gray-300">Non-transferable</strong>{" "}
                  — permanently bound to your wallet
                </li>
                <li>
                  ✓ <strong className="text-gray-300">Fully on-chain</strong> —
                  Base64 JSON, no IPFS, no server dependencies
                </li>
                <li>
                  ✓ <strong className="text-gray-300">Trust score</strong> —
                  computed from wallet history + DAO activity
                </li>
                <li>
                  ✓ <strong className="text-gray-300">Updatable</strong> — your
                  score evolves as you participate
                </li>
                <li>✗ Cannot be bought, sold, or faked</li>
              </ul>
            </div>

            {/* Mint Button */}
            <button
              onClick={handleMint}
              disabled={minting}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-900/30"
            >
              {minting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⟳</span> Minting SBT
                  On-Chain...
                </span>
              ) : (
                "🛡️ Mint Your Soulbound Token"
              )}
            </button>
            <p className="text-center text-gray-500 text-xs mt-2">
              Requires MON for gas — score computed entirely on-chain
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default SoulboundToken;
