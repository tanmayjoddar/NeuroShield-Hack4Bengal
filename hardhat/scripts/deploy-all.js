/**
 * ═══════════════════════════════════════════════════════════
 * DEPLOY ALL — One-shot deployment of every NeuroShield contract
 * ═══════════════════════════════════════════════════════════════
 *
 * Deploys in order:
 *  1. ShieldToken (ERC-20)
 *  2. QuadraticVoting (needs ShieldToken)
 *  3. MockCivicPass
 *  4. CivicSBT
 *  5. CivicVerifier (needs MockCivicPass + CivicSBT)
 *  6. CivicGatedWallet (needs CivicVerifier)
 *
 * Automatically updates src/web3/addresses.json and prints .env snippet.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-all.js --network monad_testnet
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n🚀 FULL DEPLOYMENT — All NeuroShield Contracts");
  console.log("═══════════════════════════════════════════════════════");
  console.log("📍 Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "MON\n");

  if (balance === 0n) {
    console.log(
      "❌ No MON tokens! Get some from https://faucet.testnet.monad.xyz/",
    );
    process.exit(1);
  }

  const deployed = {};

  // ──────────────────────────────────────────────────
  // 1. ShieldToken
  // ──────────────────────────────────────────────────
  console.log("1️⃣  Deploying ShieldToken...");
  const ShieldToken = await ethers.getContractFactory("ShieldToken");
  const shieldToken = await ShieldToken.deploy();
  await shieldToken.waitForDeployment();
  deployed.shieldToken = await shieldToken.getAddress();
  console.log("   ✅", deployed.shieldToken);

  // ──────────────────────────────────────────────────
  // 2. QuadraticVoting
  // ──────────────────────────────────────────────────
  console.log("2️⃣  Deploying QuadraticVoting...");
  const QuadraticVoting = await ethers.getContractFactory("QuadraticVoting");
  const quadraticVoting = await QuadraticVoting.deploy(deployed.shieldToken);
  await quadraticVoting.waitForDeployment();
  deployed.quadraticVoting = await quadraticVoting.getAddress();
  console.log("   ✅", deployed.quadraticVoting);

  // ──────────────────────────────────────────────────
  // 3. MockCivicPass
  // ──────────────────────────────────────────────────
  console.log("3️⃣  Deploying MockCivicPass...");
  const MockCivicPass = await ethers.getContractFactory("MockCivicPass");
  const mockCivicPass = await MockCivicPass.deploy();
  await mockCivicPass.waitForDeployment();
  deployed.mockCivicPass = await mockCivicPass.getAddress();
  console.log("   ✅", deployed.mockCivicPass);

  // ──────────────────────────────────────────────────
  // 4. CivicSBT
  // ──────────────────────────────────────────────────
  console.log("4️⃣  Deploying CivicSBT...");
  const CivicSBT = await ethers.getContractFactory("CivicSBT");
  const civicSBT = await CivicSBT.deploy();
  await civicSBT.waitForDeployment();
  deployed.civicSBT = await civicSBT.getAddress();
  console.log("   ✅", deployed.civicSBT);

  // ──────────────────────────────────────────────────
  // 5. CivicVerifier
  // ──────────────────────────────────────────────────
  console.log("5️⃣  Deploying CivicVerifier...");
  const CivicVerifier = await ethers.getContractFactory("CivicVerifier");
  const civicVerifier = await CivicVerifier.deploy(
    deployed.mockCivicPass,
    deployed.civicSBT,
  );
  await civicVerifier.waitForDeployment();
  deployed.civicVerifier = await civicVerifier.getAddress();
  console.log("   ✅", deployed.civicVerifier);

  // Authorize CivicVerifier as SBT updater
  console.log("   🔗 Authorizing CivicVerifier as SBT updater...");
  const addUpdaterTx = await civicSBT.addAuthorizedUpdater(
    deployed.civicVerifier,
  );
  await addUpdaterTx.wait();
  console.log("   ✅ Authorized");

  // ──────────────────────────────────────────────────
  // 6. CivicGatedWallet
  // ──────────────────────────────────────────────────
  console.log("6️⃣  Deploying CivicGatedWallet...");
  const threshold = ethers.parseEther("1.0");
  const CivicGatedWallet = await ethers.getContractFactory("CivicGatedWallet");
  const civicGatedWallet = await CivicGatedWallet.deploy(
    deployed.civicVerifier,
    threshold,
  );
  await civicGatedWallet.waitForDeployment();
  deployed.civicGatedWallet = await civicGatedWallet.getAddress();
  console.log("   ✅", deployed.civicGatedWallet);

  // ──────────────────────────────────────────────────
  // Save all addresses
  // ──────────────────────────────────────────────────
  const addressesPath = path.join(__dirname, "../../src/web3/addresses.json");
  fs.writeFileSync(addressesPath, JSON.stringify(deployed, null, 2));
  console.log("\n📄 All addresses saved to src/web3/addresses.json");

  // ──────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🎉 FULL DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════");
  Object.entries(deployed).forEach(([name, addr]) => {
    console.log(`  ${name.padEnd(20)} ${addr}`);
  });
  console.log("═══════════════════════════════════════════════════════");

  console.log("\n📋 Add to your root .env:");
  console.log(`VITE_CONTRACT_ADDRESS_MONAD=${deployed.quadraticVoting}`);
  console.log(`VITE_SHIELD_TOKEN_ADDRESS=${deployed.shieldToken}`);
  console.log(`VITE_CIVIC_SBT_ADDRESS=${deployed.civicSBT}`);
  console.log(`VITE_CIVIC_VERIFIER_ADDRESS=${deployed.civicVerifier}`);

  console.log("\n⚠️  NEXT STEPS:");
  console.log("   1. Copy the .env lines above into your root .env file");
  console.log(
    "   2. Update QUADRATIC_VOTING_ADDRESS in scripts/demo-setup.js and demo-execute.js",
  );
  console.log(
    "   3. Run: npx hardhat run scripts/demo-setup.js --network monad_testnet",
  );
  console.log(
    "   4. Wait 1 hour, then run: npx hardhat run scripts/demo-execute.js --network monad_testnet",
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
