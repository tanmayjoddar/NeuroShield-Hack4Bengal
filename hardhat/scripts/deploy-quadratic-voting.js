/**
 * ═══════════════════════════════════════════════════════
 * DEPLOY ALL CORE CONTRACTS — ShieldToken + QuadraticVoting
 * ═══════════════════════════════════════════════════════
 *
 * Deploys:
 *  1. ShieldToken (ERC-20 governance token)
 *  2. QuadraticVoting (DAO contract, needs ShieldToken address)
 *
 * Automatically updates src/web3/addresses.json with new addresses.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-quadratic-voting.js --network monad_testnet
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n🚀 DEPLOYING CORE CONTRACTS");
  console.log("═══════════════════════════════════════════════════");
  console.log("📍 Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "MON");

  if (balance === 0n) {
    console.log(
      "❌ No MON tokens! Get some from https://faucet.testnet.monad.xyz/",
    );
    process.exit(1);
  }

  // ─────────────────────────────────────────
  // STEP 1: Deploy ShieldToken
  // ─────────────────────────────────────────
  console.log("\n🛡️  Step 1: Deploying ShieldToken (ERC-20)...");
  const ShieldToken = await ethers.getContractFactory("ShieldToken");
  const shieldToken = await ShieldToken.deploy();
  await shieldToken.waitForDeployment();

  const shieldTokenAddr = await shieldToken.getAddress();
  console.log("   ✅ ShieldToken deployed to:", shieldTokenAddr);

  const totalSupply = await shieldToken.totalSupply();
  console.log("   📊 Total supply:", ethers.formatEther(totalSupply), "SHIELD");

  // ─────────────────────────────────────────
  // STEP 2: Deploy QuadraticVoting
  // ─────────────────────────────────────────
  console.log("\n🗳️  Step 2: Deploying QuadraticVoting...");
  const QuadraticVoting = await ethers.getContractFactory("QuadraticVoting");
  const quadraticVoting = await QuadraticVoting.deploy(shieldTokenAddr);
  await quadraticVoting.waitForDeployment();

  const quadraticVotingAddr = await quadraticVoting.getAddress();
  console.log("   ✅ QuadraticVoting deployed to:", quadraticVotingAddr);

  // Verify shieldToken() returns correct address
  const linkedToken = await quadraticVoting.shieldToken();
  console.log("   🔗 Linked SHIELD token:", linkedToken);

  // ─────────────────────────────────────────
  // STEP 3: Save addresses
  // ─────────────────────────────────────────
  const addressesPath = path.join(__dirname, "../../src/web3/addresses.json");
  let addresses = {};
  try {
    if (fs.existsSync(addressesPath)) {
      addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    }
  } catch (err) {
    console.log("   Creating new addresses.json...");
  }

  addresses.shieldToken = shieldTokenAddr;
  addresses.quadraticVoting = quadraticVotingAddr;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("   📄 Addresses saved to src/web3/addresses.json");

  // ─────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("🎉 CORE CONTRACT DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log("📍 ShieldToken:      ", shieldTokenAddr);
  console.log("📍 QuadraticVoting:  ", quadraticVotingAddr);
  console.log("🌍 Network:          Monad Testnet (10143)");
  console.log("═══════════════════════════════════════════════════");
  console.log("\n📋 Add to your .env:");
  console.log(`VITE_CONTRACT_ADDRESS_MONAD=${quadraticVotingAddr}`);
  console.log(`VITE_SHIELD_TOKEN_ADDRESS=${shieldTokenAddr}`);
  console.log("\n⚠️  NEXT STEPS:");
  console.log("   1. Update QUADRATIC_VOTING_ADDRESS in scripts/demo-setup.js");
  console.log(
    "   2. Update QUADRATIC_VOTING_ADDRESS in scripts/demo-execute.js",
  );
  console.log(
    "   3. Run: npx hardhat run scripts/deploy-civic.js --network monad_testnet",
  );
  console.log(
    "   4. Run: npx hardhat run scripts/demo-setup.js --network monad_testnet",
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
