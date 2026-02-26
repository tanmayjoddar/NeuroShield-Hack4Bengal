// Script to deploy Civic integration contracts

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying Civic integration contracts...");

  // Deploy mock Civic Pass for testing
  // In production, you would use the actual Civic Pass contract address
  const MockCivicPass = await ethers.getContractFactory("MockCivicPass");
  const mockCivicPass = await MockCivicPass.deploy();
  await mockCivicPass.waitForDeployment();
  const mockCivicPassAddr = await mockCivicPass.getAddress();
  console.log(`MockCivicPass deployed to: ${mockCivicPassAddr}`);

  // Deploy CivicSBT (Soulbound Token)
  const CivicSBT = await ethers.getContractFactory("CivicSBT");
  const civicSBT = await CivicSBT.deploy();
  await civicSBT.waitForDeployment();
  const civicSBTAddr = await civicSBT.getAddress();
  console.log(`CivicSBT deployed to: ${civicSBTAddr}`);

  // Deploy CivicVerifier (requires both CivicPass + SBT addresses)
  const CivicVerifier = await ethers.getContractFactory("CivicVerifier");
  const civicVerifier = await CivicVerifier.deploy(
    mockCivicPassAddr,
    civicSBTAddr,
  );
  await civicVerifier.waitForDeployment();
  const civicVerifierAddr = await civicVerifier.getAddress();
  console.log(`CivicVerifier deployed to: ${civicVerifierAddr}`);

  // Authorize CivicVerifier as SBT updater so it can mint/update tokens
  const addUpdaterTx = await civicSBT.addAuthorizedUpdater(civicVerifierAddr);
  await addUpdaterTx.wait();
  console.log(`CivicVerifier authorized as SBT updater`);

  // Deploy CivicGatedWallet (needs CivicVerifier, NOT MockCivicPass)
  const threshold = ethers.parseEther("1.0");
  const CivicGatedWallet = await ethers.getContractFactory("CivicGatedWallet");
  const civicGatedWallet = await CivicGatedWallet.deploy(
    civicVerifierAddr,
    threshold,
  );
  await civicGatedWallet.waitForDeployment();
  const civicGatedWalletAddr = await civicGatedWallet.getAddress();
  console.log(`CivicGatedWallet deployed to: ${civicGatedWalletAddr}`);

  console.log("\nDeployment completed!");
  console.log("─────────────────────────────────────");
  console.log(`MockCivicPass:    ${mockCivicPassAddr}`);
  console.log(`CivicSBT:         ${civicSBTAddr}`);
  console.log(`CivicVerifier:    ${civicVerifierAddr}`);
  console.log(`CivicGatedWallet: ${civicGatedWalletAddr}`);
  console.log("─────────────────────────────────────");
  console.log(
    "\nSet VITE_CIVIC_VERIFIER_ADDRESS=" + civicVerifierAddr + " in your .env",
  );

  // Save addresses to src/web3/addresses.json
  const addressesPath = path.join(__dirname, "../../src/web3/addresses.json");
  let addresses = {};
  try {
    addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  } catch (e) {
    // File doesn't exist yet
  }
  addresses.civicSBT = civicSBTAddr;
  addresses.civicVerifier = civicVerifierAddr;
  addresses.civicGatedWallet = civicGatedWalletAddr;
  addresses.mockCivicPass = mockCivicPassAddr;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log(`\nAddresses saved to ${addressesPath}`);

  // Generate .env snippet
  console.log("\n📋 Add to your .env:");
  console.log(`VITE_CIVIC_SBT_ADDRESS=${civicSBTAddr}`);
  console.log(`VITE_CIVIC_VERIFIER_ADDRESS=${civicVerifierAddr}`);
  console.log(`CIVIC_SBT_ADDRESS=${civicSBTAddr}`);
  console.log(`CIVIC_VERIFIER_ADDRESS=${civicVerifierAddr}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
