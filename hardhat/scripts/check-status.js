const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Address:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MON");

  const code = await ethers.provider.getCode(
    "0x7A791fe5A35131B7d98f854a64E7f94180F27C7b",
  );
  console.log("QuadraticVoting bytecode length:", code.length);
  console.log("Status:", code === "0x" ? "NOT DEPLOYED" : "DEPLOYED");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
