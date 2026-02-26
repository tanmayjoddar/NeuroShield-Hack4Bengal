const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🛡️  Deploying SHIELD Token to Monad Testnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("🔑 Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "MON");

  if (balance === 0n) {
    console.log(
      "❌ No MON tokens! Get some from https://faucet.testnet.monad.xyz/",
    );
    process.exit(1);
  }

  // Deploy ShieldToken
  console.log("\n🚀 Deploying ShieldToken (ERC-20)...");
  const ShieldToken = await ethers.getContractFactory("ShieldToken");
  const shieldToken = await ShieldToken.deploy();
  await shieldToken.waitForDeployment();

  const tokenAddress = await shieldToken.getAddress();
  console.log("✅ SHIELD Token deployed to:", tokenAddress);

  // Verify supply
  const totalSupply = await shieldToken.totalSupply();
  console.log("📊 Total supply:", ethers.formatEther(totalSupply), "SHIELD");

  // Save address
  const addressesPath = path.join(__dirname, "../../src/web3/addresses.json");
  let addresses = {};
  try {
    if (fs.existsSync(addressesPath)) {
      addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    }
  } catch (err) {
    console.log("Creating new addresses.json...");
  }

  addresses.shieldToken = tokenAddress;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("📄 Address saved to src/web3/addresses.json");

  // Summary
  console.log("\n=================================================");
  console.log("🎉 SHIELD Token Deployment Summary");
  console.log("=================================================");
  console.log("📍 Token Address:", tokenAddress);
  console.log("📊 Total Supply:  1,000,000 SHIELD");
  console.log("🌍 Network:       Monad Testnet (10143)");
  console.log(
    "🔎 Explorer:      https://testnet.monadexplorer.com/address/" +
      tokenAddress,
  );
  console.log("=================================================");
  console.log(
    "\n⚠️  NEXT STEP: Update SHIELD_TOKEN_ADDRESS in src/web3/contract.ts",
  );
  console.log(
    `   Replace '0x0000000000000000000000000000000000000000' with '${tokenAddress}'`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
