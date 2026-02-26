// Deploy script for UnhackableWallet contract
// To use:
// 1. Create a .env file with PRIVATE_KEY and INFURA_KEY (or other provider)
// 2. Run with: npx ts-node deploy.ts

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

async function main() {
  // Check for required environment variables
  if (!process.env.PRIVATE_KEY) {
    throw new Error('Please set your PRIVATE_KEY in a .env file');
  }

  // Get private key from environment
  const privateKey = process.env.PRIVATE_KEY;

  // RPC URL - default to Sepolia testnet, but use env variable if provided
  const rpcUrl = process.env.RPC_URL || 'https://sepolia.infura.io/v3/' + process.env.INFURA_KEY;

  console.log(' Connecting to network...');

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log(` Deploying contract with account: ${wallet.address}`);
  console.log(` Account balance: ${ethers.formatEther(balance)} ETH`);

  // Load the contract artifact (compiled contract)
  const contractPath = path.join(__dirname, '../contracts/UnhackableWallet.sol');
  const contractSource = fs.readFileSync(contractPath, 'utf8');

  console.log('Compiling contract...');

  // In a production scenario, you would use Hardhat or Truffle for compilation
  // This is a simplified example - for production, use a proper compilation workflow

  console.log(' Deploying UnhackableWallet contract...');

  // For deployment, we would normally use the compiled bytecode
  // As this is a simplified example, we'll just output guidance

  console.log('\n IMPORTANT: For actual deployment:');
  console.log('1. Install Hardhat: npm install --save-dev hardhat');
  console.log('2. Set up a Hardhat project: npx hardhat init');
  console.log('3. Add your contract to the contracts/ folder');
  console.log('4. Compile: npx hardhat compile');
  console.log('5. Create a deployment script in scripts/');
  console.log('6. Deploy: npx hardhat run scripts/deploy.js --network sepolia');

  console.log('\n For testing this contract with a local development network:');
  console.log('1. Start a local node: npx hardhat node');
  console.log('2. Deploy to local network: npx hardhat run scripts/deploy.js --network localhost');

  console.log('\n After deployment, update CONTRACT_ADDRESSES in contract.ts with your deployed address');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(' Deployment error:', error);
    process.exit(1);
  });
