/**
 * SBTPage.tsx — Soulbound Token Management Page
 *
 * Full-page view for managing the user's on-chain Soulbound Token.
 * Includes the SBT profile card, trust score explanation, and technical details.
 */

import React from "react";
import SoulboundToken from "@/components/SoulboundToken";

const SBTPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Soulbound Token</h1>
          <p className="text-gray-400">
            Your permanent on-chain reputation. Cannot be transferred, cannot be
            faked, cannot be taken down.
          </p>
        </div>

        {/* SBT Profile Card */}
        <SoulboundToken />

        {/* Trust Score Formula */}
        <div className="mt-8 bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            How Your Trust Score Works
          </h2>
          <div className="font-mono text-sm bg-gray-800 rounded-lg p-4 mb-4">
            <div className="text-purple-400">+40 Are you a verified human?</div>
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
            Every component is independently verifiable from on-chain data. The
            trust score lives forever as Base64-encoded JSON directly inside the
            smart contract — no IPFS, no server, no dependency. If every server
            on earth goes offline, your reputation still exists on the
            blockchain.
          </p>
        </div>

        {/* Technical Details */}
        <div className="mt-6 bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Technical Details
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Token Standard</span>
              <span className="text-white font-mono">ERC-721 (Soulbound)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Transfer Behavior</span>
              <span className="text-red-400 font-mono">
                revert("SBTs cannot be transferred")
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Metadata Storage</span>
              <span className="text-green-400 font-mono">
                On-chain Base64 JSON
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Network</span>
              <span className="text-white font-mono">
                Monad Testnet (10143)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Updatable By</span>
              <span className="text-white font-mono">
                WalletVerifier (authorized only)
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SBTPage;
