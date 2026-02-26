/**
 * Deploy WalletVerifier — replaces CivicVerifier + MockCivicPass
 *
 * Uses existing deployed contracts:
 *   CivicSBT:        0xc5A1E1E6324Dff8dE996510C8CBc4AdE0D47ADcB
 *   QuadraticVoting:  0xC9755c1Be2c467c17679CeB5d379eF853641D846
 *
 * Steps:
 *   1. Deploy WalletVerifier(civicSBT, quadraticVoting)
 *   2. Authorize WalletVerifier in CivicSBT via addAuthorizedUpdater()
 *   3. Update addresses.json (remove mockCivicPass + civicVerifier, add walletVerifier)
 *   4. Print .env snippet
 *
 * Usage:
 *   npx hardhat run scripts/deploy-wallet-verifier.js --network monad_testnet
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Already-deployed addresses
const CIVIC_SBT_ADDRESS = "0xc5A1E1E6324Dff8dE996510C8CBc4AdE0D47ADcB";
const QUADRATIC_VOTING_ADDRESS = "0xC9755c1Be2c467c17679CeB5d379eF853641D846";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "\n🚀 DEPLOY: WalletVerifier (replaces CivicVerifier + MockCivicPass)",
  );
  console.log("═══════════════════════════════════════════════════════");
  console.log("📍 Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "MON\n");

  // ── 1. Deploy WalletVerifier ──
  console.log("1️⃣  Deploying WalletVerifier...");
  console.log("   CivicSBT:", CIVIC_SBT_ADDRESS);
  console.log("   QuadraticVoting:", QUADRATIC_VOTING_ADDRESS);

  const WalletVerifier = await ethers.getContractFactory("WalletVerifier");
  const walletVerifier = await WalletVerifier.deploy(
    CIVIC_SBT_ADDRESS,
    QUADRATIC_VOTING_ADDRESS,
  );
  await walletVerifier.waitForDeployment();
  const walletVerifierAddress = await walletVerifier.getAddress();
  console.log("   ✅ WalletVerifier:", walletVerifierAddress);

  // ── 2. Authorize in CivicSBT ──
  console.log("\n2️⃣  Authorizing WalletVerifier as SBT updater...");
  const civicSBT = await ethers.getContractAt("CivicSBT", CIVIC_SBT_ADDRESS);
  const tx = await civicSBT.addAuthorizedUpdater(walletVerifierAddress);
  await tx.wait();
  console.log("   ✅ WalletVerifier authorized in CivicSBT");

  // ── 3. Update addresses.json ──
  const addressesPath = path.join(__dirname, "../../src/web3/addresses.json");
  let addresses = {};
  try {
    addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  } catch (e) {
    console.log("   ⚠️  No existing addresses.json, creating new");
  }

  // Remove old Civic contracts
  delete addresses.mockCivicPass;
  delete addresses.civicVerifier;

  // Add WalletVerifier
  addresses.walletVerifier = walletVerifierAddress;

  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("\n3️⃣  Updated addresses.json");
  console.log("   Removed: mockCivicPass, civicVerifier");
  console.log("   Added: walletVerifier =", walletVerifierAddress);

  // ── 4. Summary ──
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🎉 DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════");
  console.log("  WalletVerifier:", walletVerifierAddress);
  console.log("═══════════════════════════════════════════════════════");

  console.log("\n📋 Update root .env:");
  console.log(`   REMOVE:  VITE_CIVIC_VERIFIER_ADDRESS=...`);
  console.log(
    `   ADD:     VITE_WALLET_VERIFIER_ADDRESS=${walletVerifierAddress}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deploy failed:", error);
    process.exit(1);
  });
