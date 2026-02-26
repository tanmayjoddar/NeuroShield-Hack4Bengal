// Web3 Utility Functions for UnhackableWallet
// Common helper functions for Ethereum address and value formatting

import { ethers, formatUnits, parseUnits } from "ethers";

/**
 * Network information by chain ID
 */
export const NETWORK_INFO = {
  "1": {
    name: "Ethereum Mainnet",
    displayName: "Mainnet",
    currency: "ETH",
    explorer: "https://etherscan.io",
    blockTime: 15, // seconds
    isTestnet: false,
    logoUrl: "/ethereum.svg",
  },
  "5": {
    name: "Goerli",
    displayName: "Testnet",
    currency: "ETH",
    explorer: "https://goerli.etherscan.io",
    blockTime: 15,
    isTestnet: true,
    logoUrl: "/ethereum.svg",
  },
  "11155111": {
    name: "Sepolia",
    displayName: "Testnet",
    currency: "ETH",
    explorer: "https://sepolia.etherscan.io",
    blockTime: 15,
    isTestnet: true,
    logoUrl: "/ethereum.svg",
  },
  "10143": {
    name: "Monad",
    displayName: "Testnet",
    currency: "MON",
    explorer: "https://testnet.monadexplorer.com",
    blockTime: 2, // Monad has much faster block times
    isTestnet: true,
    logoUrl: "/monad.svg",
    recommended: true,
    rpcUrl: "https://testnet-rpc.monad.xyz",
  },
  "143": {
    name: "Monad",
    displayName: "Testnet",
    currency: "MON",
    explorer: "https://testnet.monadexplorer.com",
    blockTime: 2,
    isTestnet: true,
    logoUrl: "/monad.svg",
    recommended: true,
    rpcUrl: "https://testnet-rpc.monad.xyz",
  },
};

/**
 * Check if the current network is Monad
 * @param {string} chainId - The current chain ID (can be in decimal or hex format)
 * @returns {boolean} True if on Monad network
 */
export function isMonadNetwork(chainId: string | null | undefined): boolean {
  if (!chainId) return false;

  // Handle both decimal and hex formats
  if (
    chainId === "10143" ||
    chainId === "0x279F" ||
    chainId === "0x279f" ||
    chainId === "143"
  ) {
    return true;
  }

  // Handle the case where it might be a hex string without '0x' prefix
  try {
    const chainIdNum = parseInt(chainId);
    return chainIdNum === 10143 || chainIdNum === 143;
  } catch {
    return false;
  }
}

/**
 * Get transaction confirmation threshold based on network
 * @param {string} chainId - The current chain ID
 * @returns {number} Number of confirmations to wait for
 */
export function getConfirmationThreshold(
  chainId: string | null | undefined,
): number {
  return isMonadNetwork(chainId) ? 1 : 3; // Monad needs fewer confirmations
}

/**
 * Get recommended polling interval for transaction status
 * @param {string} chainId - The current chain ID
 * @returns {number} Polling interval in milliseconds
 */
export function getTxPollInterval(chainId: string | null | undefined): number {
  return isMonadNetwork(chainId) ? 500 : 3000; // Poll faster on Monad
}

/**
 * Get explorer URL for a transaction
 * @param {string} txHash - Transaction hash
 * @param {string} chainId - Chain ID
 * @returns {string} Explorer URL
 */
export function getExplorerTxUrl(txHash: string, chainId: string): string {
  const network = NETWORK_INFO[chainId as keyof typeof NETWORK_INFO];
  if (!network) return "";
  return `${network.explorer}/tx/${txHash}`;
}

/**
 * Get explorer URL for an address
 * @param {string} address - Ethereum address
 * @param {string} chainId - Chain ID
 * @returns {string} Explorer URL
 */
export function getExplorerAddressUrl(
  address: string,
  chainId: string,
): string {
  const network = NETWORK_INFO[chainId as keyof typeof NETWORK_INFO];
  if (!network) return "";
  return `${network.explorer}/address/${address}`;
}

/**
 * Shorten an Ethereum address for display
 * @param {string} address - The address to shorten
 * @param {number} chars - Number of characters to keep at start and end (default: 4)
 * @returns {string} Shortened address (e.g., 0x1234...5678)
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return "";

  const prefix = address.startsWith("0x") ? "0x" : "";
  const start = prefix.length;

  if (address.length <= start + chars * 2) {
    return address;
  }

  return `${address.substring(0, start + chars)}...${address.substring(address.length - chars)}`;
}

/**
 * Format a number to a specific number of decimal places
 * @param {number|string} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 4)
 * @returns {string} Formatted number
 */
export function formatDecimal(
  value: number | string,
  decimals: number = 4,
): string {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return numValue.toFixed(decimals);
}

/**
 * Format Wei to ETH
 * @param {bigint|string} wei - The amount in Wei
 * @param {number} decimals - Number of decimal places for display (default: 4)
 * @returns {string} Formatted ETH amount
 */
export function formatEth(wei: bigint | string, decimals: number = 4): string {
  const ethValue = formatUnits(wei, 18);
  return formatDecimal(ethValue, decimals);
}

/**
 * Parse ETH to Wei
 * @param {string} eth - The amount in ETH
 * @returns {bigint} Amount in Wei
 */
export function parseEth(eth: string): bigint {
  return parseUnits(eth, 18);
}

/**
 * Check if a string is a valid Ethereum address
 * @param {string} address - The address to validate
 * @returns {boolean} Whether the address is valid
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

/**
 * Format timestamp to human-readable date
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Format transaction hash for display
 * @param {string} hash - Transaction hash
 * @param {number} chars - Number of characters to keep at start and end (default: 6)
 * @returns {string} Shortened transaction hash
 */
export function formatTxHash(hash: string, chars: number = 6): string {
  return shortenAddress(hash, chars);
}

/**
 * Generate Etherscan URL for an address or transaction
 * @param {string} value - Address or transaction hash
 * @param {string} type - Type of URL ('address' or 'tx')
 * @param {number} chainId - Network chain ID
 * @returns {string} Etherscan URL
 */
export function getEtherscanUrl(
  value: string,
  type: "address" | "tx",
  chainId: number = 1,
): string {
  // Base URLs for different networks
  const baseUrls: Record<number, string> = {
    1: "https://etherscan.io",
    5: "https://goerli.etherscan.io",
    11155111: "https://sepolia.etherscan.io",
    137: "https://polygonscan.com",
    80001: "https://mumbai.polygonscan.com",
    56: "https://bscscan.com",
    97: "https://testnet.bscscan.com",
    42161: "https://arbiscan.io",
    10143: "https://testnet.monadexplorer.com",
    // Add more networks as needed
  };

  const baseUrl = baseUrls[chainId] || "https://etherscan.io";

  return `${baseUrl}/${type}/${value}`;
}

/**
 * Format currency value for display
 * @param {number} value - Amount to format
 * @param {string} currency - Currency symbol
 * @returns {string} Formatted currency string
 */
export function formatCurrency(
  value: number,
  currency: string = "USD",
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Calculate gas fee in ETH
 * @param {number} gasLimit - Gas limit for transaction
 * @param {bigint} gasPrice - Gas price in Wei
 * @returns {string} Gas fee formatted in ETH
 */
export function calculateGasFee(gasLimit: number, gasPrice: bigint): string {
  const gasFee = gasPrice * BigInt(gasLimit);
  return formatUnits(gasFee, 18);
}

/**
 * Get network explorer URL based on chain ID
 * @param {number} chainId - Network chain ID
 * @returns {string} Explorer base URL
 */
export function getExplorerUrl(chainId: number): string {
  const explorers: Record<number, string> = {
    1: "https://etherscan.io",
    5: "https://goerli.etherscan.io",
    11155111: "https://sepolia.etherscan.io",
    137: "https://polygonscan.com",
    80001: "https://mumbai.polygonscan.com",
    56: "https://bscscan.com",
    97: "https://testnet.bscscan.com",
    42161: "https://arbiscan.io",
    10143: "https://testnet.monadexplorer.com",
    // Add more networks as needed
  };

  return explorers[chainId] || "https://etherscan.io";
}
