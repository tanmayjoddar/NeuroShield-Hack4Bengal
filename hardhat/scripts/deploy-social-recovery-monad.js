const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("📝 Deploying Social Recovery to Monad Testnet...");

  // Get the account that will deploy the contract
  const [deployer] = await ethers.getSigners();
  console.log("🔑 Deploying with account:", deployer.address);

  // Get the balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "MONAD");

  if (ethers.formatEther(balance) === "0.0") {
    console.log("❌ Error: No MONAD tokens found!");
    console.log("Please get tokens from Monad Testnet Faucet:");
    console.log("https://faucet.testnet.monad.xyz/");
    process.exit(1);
  }

  // Deploy the contract
  console.log("\n🚀 Deploying SocialRecoveryWallet...");
  const SocialRecovery = await ethers.getContractFactory(
    "SocialRecoveryWallet",
  );
  const threshold = 2; // Number of guardians required for recovery
  const socialRecovery = await SocialRecovery.deploy(threshold);
  await socialRecovery.waitForDeployment();

  const contractAddress = await socialRecovery.getAddress();
  console.log("✅ Social Recovery contract deployed to:", contractAddress);

  // Save the contract address
  const addressesPath = path.join(__dirname, "../../src/web3/addresses.json");
  let addresses = {};

  try {
    if (fs.existsSync(addressesPath)) {
      addresses = JSON.parse(fs.readFileSync(addressesPath));
    }
  } catch (err) {
    console.log("Creating new addresses.json file...");
  }

  addresses.socialRecoveryWallet = contractAddress;

  // Ensure the directory exists
  const dir = path.dirname(addressesPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("📄 Contract address saved to src/web3/addresses.json");

  // Verify contract on Monad Explorer
  console.log("\n🔍 Verifying contract on Monad Explorer...");
  console.log("Waiting for deployment transaction confirmation...");
  await new Promise((resolve) => setTimeout(resolve, 20000)); // Wait 20s for transaction propagation

  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [threshold],
    });
    console.log("✅ Contract verified successfully!");
  } catch (error) {
    console.log("⚠️ Verification failed:", error.message);
    console.log("You can try verifying manually with:");
    console.log(
      `npx hardhat verify --network monad_testnet ${contractAddress} ${threshold}`,
    );
  }

  // Summary
  console.log("\n=================================================");
  console.log("🎉 Deployment Summary");
  console.log("=================================================");
  console.log("📍 Contract:", contractAddress);
  console.log("👥 Guardian Threshold:", threshold);
  console.log("🌍 Network: Monad Testnet");
  console.log(
    "🔎 Explorer: https://explorer.testnet.monad.xyz/address/" +
      contractAddress,
  );
  console.log("=================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
