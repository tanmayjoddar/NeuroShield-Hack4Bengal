/**
 * ══════════════════════════════════════════════════════════
 * DEMO EXECUTE — Run this 1 hour after demo-setup.js
 * ══════════════════════════════════════════════════════════
 *
 * Executes the proposal, confirming the demo address as a scam.
 * After this, the dual-layer risk score will jump when you
 * send to that address during the live demo.
 *
 * Usage:
 *   npx hardhat run scripts/demo-execute.js --network monadTestnet
 */

const { ethers } = require("hardhat");

const QUADRATIC_VOTING_ADDRESS = "0xC9755c1Be2c467c17679CeB5d379eF853641D846";
const DEMO_SCAM_ADDRESS = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n⚡ DEMO EXECUTE — Finalizing scam confirmation");
  console.log("═══════════════════════════════════════════════════");

  const votingContract = await ethers.getContractAt(
    "QuadraticVoting",
    QUADRATIC_VOTING_ADDRESS,
  );

  const proposalCount = await votingContract.proposalCount();
  console.log("📋 Total proposals:", proposalCount.toString());

  // Find the proposal for our demo address
  let targetProposalId = null;

  for (let i = Number(proposalCount); i >= 1; i--) {
    const proposal = await votingContract.proposals(i);
    if (
      proposal.suspiciousAddress.toLowerCase() ===
      DEMO_SCAM_ADDRESS.toLowerCase()
    ) {
      targetProposalId = i;
      console.log(`\n📋 Found proposal #${i} for demo address`);
      console.log("   Reporter:", proposal.reporter);
      console.log("   Votes For:", proposal.votesFor.toString());
      console.log("   Votes Against:", proposal.votesAgainst.toString());
      console.log("   Active:", proposal.isActive);
      console.log("   Executed:", proposal.executed);

      const endTime = new Date(Number(proposal.endTime) * 1000);
      const now = new Date();
      console.log("   End Time:", endTime.toLocaleString());
      console.log("   Now:", now.toLocaleString());

      if (now < endTime) {
        const remaining = Math.ceil((endTime - now) / 60000);
        console.log(
          `\n   ⏰ Voting period not ended yet! ${remaining} minutes remaining.`,
        );
        console.log("   Come back after:", endTime.toLocaleString());
        return;
      }

      if (proposal.executed) {
        console.log("\n   ✅ Already executed!");
        // Check if address is confirmed as scammer
        const isScammer = await votingContract.isScammer(DEMO_SCAM_ADDRESS);
        const scamScore = await votingContract.scamScore(DEMO_SCAM_ADDRESS);
        console.log("   🔍 isScammer:", isScammer);
        console.log("   🔍 scamScore:", scamScore.toString());
        return;
      }

      break;
    }
  }

  if (!targetProposalId) {
    console.log(
      "❌ No proposal found for demo address. Run demo-setup.js first.",
    );
    return;
  }

  // Execute the proposal
  console.log(`\n🔨 Executing proposal #${targetProposalId}...`);
  try {
    const tx = await votingContract.executeProposal(targetProposalId);
    const receipt = await tx.wait();
    console.log("   ✅ Proposal executed! Tx:", receipt.hash);

    // Verify result
    const isScammer = await votingContract.isScammer(DEMO_SCAM_ADDRESS);
    const scamScore = await votingContract.scamScore(DEMO_SCAM_ADDRESS);

    console.log("\n═══════════════════════════════════════════════════");
    console.log("🎉 DEMO READY");
    console.log("═══════════════════════════════════════════════════");
    console.log("🎯 Address:", DEMO_SCAM_ADDRESS);
    console.log("🔍 isScammer:", isScammer);
    console.log("📊 scamScore:", scamScore.toString());

    if (isScammer) {
      console.log("\n✅ Address is CONFIRMED as scam on-chain!");
      console.log("   During the demo, when you send to this address,");
      console.log("   the risk score will show:");
      console.log("   • Layer 1 (ML):  85%");
      console.log("   • Layer 2 (DAO): +10% (DAO CONFIRMED)");
      console.log("   • Combined:      95% — CRITICAL RISK");
      console.log(
        "\n   Compare to a random address which shows only 85% (ML only).",
      );
    } else {
      console.log(
        "\n⚠️  Address was NOT confirmed (votes may have been against).",
      );
      console.log("   You may need more votes or a new proposal.");
    }
    console.log("═══════════════════════════════════════════════════");
  } catch (err) {
    console.error("❌ Execution failed:", err.message);
  }
}

main().catch(console.error);
