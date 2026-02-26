const { ethers } = require("hardhat");

async function main() {
  const addr = "0x01CA6bB78503E8945Ff6D4f5B39DBA7915484606";
  const wv = await ethers.getContractAt(
    "WalletVerifier",
    "0x78d8Ff95a4C4dc864AAD94932A39CcB4AcBDdD30",
  );

  console.log("\n🔍 WalletVerifier.computeTrustScore(" + addr + ")");
  console.log("═══════════════════════════════════════════════");

  const score = await wv.computeTrustScore(addr);
  console.log("Total:          ", score[0].toString());
  console.log("Wallet score:   ", score[1].toString(), "/ 40");
  console.log("DAO accuracy:   ", score[2].toString(), "/ 30");
  console.log("DAO particip:   ", score[3].toString(), "/ 30");
  console.log("Level:          ", score[4].toString());

  const bal = await ethers.provider.getBalance(addr);
  console.log("\nRaw balance:    ", ethers.formatEther(bal), "MON");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
