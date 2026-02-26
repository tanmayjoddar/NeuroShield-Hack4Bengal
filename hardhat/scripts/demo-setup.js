/**
 * ═══════════════════════════════════════════════════════
 * DEMO SETUP SCRIPT — Run 1+ hour BEFORE your live demo
 * ═══════════════════════════════════════════════════════
 *
 * This script:
 *  1. Sets voting period to 1 hour (minimum allowed)
 *  2. Submits a scam report for the demo address
 *  3. Approves SHIELD tokens for voting
 *  4. Casts a vote to confirm the scam
 *
 * After 1 hour, run `demo-execute.js` to finalize.
 *
 * Usage:
 *   npx hardhat run scripts/demo-setup.js --network monadTestnet
 */

const { ethers } = require("hardhat");

// ═══════════════════════════════════════════
// CONFIGURATION — Edit these for your demo
// ═══════════════════════════════════════════

const QUADRATIC_VOTING_ADDRESS = "0x7A791fe5A35131B7d98f854a64E7f94180F27C7b";

// The address you will send TO during the demo.
// Default: Ronin Bridge exploiter (perfect villain for the story)
const DEMO_SCAM_ADDRESS = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96";

// Tokens to stake for voting (need at least 1 for quadratic vote)
const VOTE_TOKENS = ethers.parseEther("100"); // 100 SHIELD

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n🎬 DEMO SETUP — Preparing flywheel demonstration");
  console.log("═══════════════════════════════════════════════════");
  console.log("📍 Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 MON Balance:", ethers.formatEther(balance));

  // Get QuadraticVoting contract
  const votingContract = await ethers.getContractAt(
    "QuadraticVoting",
    QUADRATIC_VOTING_ADDRESS,
  );

  // Get SHIELD token address from contract
  const shieldTokenAddress = await votingContract.shieldToken();
  console.log("🛡️  SHIELD Token:", shieldTokenAddress);

  const shieldToken = await ethers.getContractAt(
    "ShieldToken",
    shieldTokenAddress,
  );

  const shieldBalance = await shieldToken.balanceOf(deployer.address);
  console.log(
    "🛡️  SHIELD Balance:",
    ethers.formatEther(shieldBalance),
    "SHIELD",
  );

  if (shieldBalance === 0n) {
    console.log("❌ No SHIELD tokens! Deploy ShieldToken first.");
    process.exit(1);
  }

  // ─────────────────────────────────────────
  // STEP 1: Set voting period to 1 hour
  // ─────────────────────────────────────────
  console.log("\n📏 Step 1: Setting voting period to 1 hour...");
  try {
    const currentPeriod = await votingContract.votingPeriod();
    console.log(
      "   Current voting period:",
      Number(currentPeriod) / 3600,
      "hours",
    );

    if (Number(currentPeriod) !== 3600) {
      const tx1 = await votingContract.setVotingPeriod(3600); // 1 hour
      await tx1.wait();
      console.log("   ✅ Voting period set to 1 hour");
    } else {
      console.log("   ✅ Already set to 1 hour");
    }
  } catch (err) {
    console.log("   ⚠️  Could not set voting period:", err.message);
    console.log("   (You may not be the contract owner)");
  }

  // ─────────────────────────────────────────
  // STEP 2: Submit scam report
  // ─────────────────────────────────────────
  console.log("\n📝 Step 2: Submitting scam report for demo address...");
  console.log("   Target:", DEMO_SCAM_ADDRESS);

  try {
    const tx2 = await votingContract.submitProposal(
      DEMO_SCAM_ADDRESS,
      "Ronin Bridge Exploiter — $625M stolen from Axie Infinity's Ronin Bridge via compromised validator keys. Linked to Lazarus Group (DPRK). Funds laundered through Tornado Cash.",
      "https://rekt.news/ronin-network-rekt/",
    );
    const receipt2 = await tx2.wait();

    // Extract proposal ID from event
    const event = receipt2.logs.find(
      (log) => log.fragment?.name === "ProposalCreated",
    );
    const proposalId = event
      ? event.args[0]
      : await votingContract.proposalCount();
    console.log("   ✅ Proposal created! ID:", proposalId.toString());

    // ─────────────────────────────────────────
    // STEP 3: Approve SHIELD tokens for voting
    // ─────────────────────────────────────────
    console.log("\n🔓 Step 3: Approving SHIELD tokens for voting...");
    const tx3 = await shieldToken.approve(
      QUADRATIC_VOTING_ADDRESS,
      VOTE_TOKENS,
    );
    await tx3.wait();
    console.log(
      "   ✅ Approved",
      ethers.formatEther(VOTE_TOKENS),
      "SHIELD for voting",
    );

    // ─────────────────────────────────────────
    // STEP 4: Cast vote to confirm scam
    // ─────────────────────────────────────────
    console.log("\n🗳️  Step 4: Casting vote to confirm scam...");
    const tx4 = await votingContract.castVote(
      proposalId,
      true, // support = confirm it's a scam
      VOTE_TOKENS,
    );
    const receipt4 = await tx4.wait();
    console.log("   ✅ Vote cast! Tx:", receipt4.hash);

    // Check vote power
    const proposal = await votingContract.proposals(proposalId);
    console.log(
      "   📊 Votes For:",
      proposal.votesFor.toString(),
      "| Against:",
      proposal.votesAgainst.toString(),
    );

    const endTime = new Date(Number(proposal.endTime) * 1000);
    console.log("   ⏰ Voting ends at:", endTime.toLocaleString());

    // ─────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════");
    console.log("🎬 DEMO SETUP COMPLETE");
    console.log("═══════════════════════════════════════════════════");
    console.log("📋 Proposal ID:", proposalId.toString());
    console.log("🎯 Scam Address:", DEMO_SCAM_ADDRESS);
    console.log("⏰ Execute after:", endTime.toLocaleString());
    console.log("");
    console.log("👉 NEXT STEP: After the voting period ends, run:");
    console.log(
      `   npx hardhat run scripts/demo-execute.js --network monadTestnet`,
    );
    console.log("═══════════════════════════════════════════════════");
  } catch (err) {
    console.error("❌ Setup failed:", err.message);
  }
}

main().catch(console.error);
