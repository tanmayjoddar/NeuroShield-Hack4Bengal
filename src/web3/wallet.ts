// Web3 Wallet Connection Module for UnhackableWallet
// Handles connecting to MetaMask and other Ethereum wallet providers

import {
  ethers,
  BrowserProvider,
  Signer,
  formatUnits,
  parseUnits,
  Contract,
} from "ethers";
import { NETWORK_INFO, isMonadNetwork } from "./utils";
import { IMEVProtection, createMEVProtection } from "./mev-protection";

/**
 * Patch a BrowserProvider to force legacy (type 0) transactions.
 * Monad testnet does NOT support EIP-1559 (eth_maxPriorityFeePerGas),
 * so we override getFeeData to return only gasPrice and null out EIP-1559 fields.
 */
export function patchProviderForMonad(
  provider: BrowserProvider,
): BrowserProvider {
  const originalGetFeeData = provider.getFeeData.bind(provider);
  provider.getFeeData = async () => {
    try {
      const fee = await originalGetFeeData();
      return new ethers.FeeData(
        fee.gasPrice,
        null, // maxFeePerGas — disable EIP-1559
        null, // maxPriorityFeePerGas — disable EIP-1559
      );
    } catch {
      // If even gasPrice fails, use a safe default (50 gwei)
      return new ethers.FeeData(ethers.parseUnits("50", "gwei"), null, null);
    }
  };
  return provider;
}

/**
 * Simple functions for basic wallet connection
 * These are exported separately for simpler use in components
 */

/**
 * Switch to Monad testnet
 * @returns {Promise<boolean>} True if successful
 */
export const switchToMonadNetwork = async (): Promise<boolean> => {
  if (!window.ethereum) {
    alert("Please install MetaMask!");
    return false;
  }

  const chainId = "0x279F"; // 10143 in hex

  try {
    // Try to switch to Monad testnet
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
    return true;
  } catch (error: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId,
              chainName: "Monad Testnet",
              nativeCurrency: {
                name: "MON",
                symbol: "MON",
                decimals: 18,
              },
              rpcUrls: ["https://testnet-rpc.monad.xyz"],
              blockExplorerUrls: ["https://testnet.monadexplorer.com"],
            },
          ],
        });
        return true;
      } catch (addError) {
        console.error("Error adding Monad network:", addError);
        return false;
      }
    } else {
      console.error("Error switching to Monad network:", error);
      return false;
    }
  }
};

/**
 * Simple functions for basic wallet connection
 * These are exported separately for simpler use in components
 */

/**
 * Connect to MetaMask wallet
 * @param {boolean} preferMonad - Whether to switch to Monad after connecting
 * @returns {Promise<string|null>} Connected wallet address or null if failed
 */
export const connectWallet = async (
  preferMonad: boolean = true,
): Promise<string | null> => {
  if (!window.ethereum) {
    alert("Please install MetaMask!");
    return null;
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    // If preferMonad is true, switch to Monad network after connecting
    if (preferMonad) {
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (!isMonadNetwork(chainId)) {
        await switchToMonadNetwork();
      }
    }

    return accounts[0];
  } catch (error) {
    console.error("Error connecting to wallet:", error);
    return null;
  }
};

/**
 * Get provider for reading blockchain data
 * @returns {BrowserProvider|null} Ethers provider or null if MetaMask not available
 */
export const getProvider = (): BrowserProvider | null => {
  if (!window.ethereum) return null;
  return patchProviderForMonad(new BrowserProvider(window.ethereum));
};

/**
 * Get signer for transactions
 * @returns {Promise<Signer|null>} Ethers signer or null if connection fails
 */
export const getSigner = async (): Promise<Signer | null> => {
  const provider = getProvider();
  if (!provider) return null;

  try {
    return await provider.getSigner();
  } catch (error) {
    console.error("Error getting signer:", error);
    return null;
  }
};

/**
 * Wallet connection class for handling Ethereum wallet interactions
 * This class provides more advanced functionality and state management
 */
class WalletConnector {
  provider: BrowserProvider | null;
  signer: Signer | null;
  address: string | null;
  chainId: number | null;
  networkName: string | null;

  // Event handlers
  private _handleAccountsChanged: ((accounts: string[]) => void) | null;
  private _handleChainChanged: ((chainId: string) => void) | null;
  private _handleDisconnect: ((error: any) => void) | null;

  // MEV Protection
  private mevProtection: IMEVProtection | null = null;

  constructor() {
    this.provider = null;
    this.signer = null;
    this.address = null;
    this.chainId = null;
    this.networkName = null;

    // Initialize event handlers as null
    this._handleAccountsChanged = null;
    this._handleChainChanged = null;
    this._handleDisconnect = null;
  }

  /**
   * Check if MetaMask is installed
   * @returns {boolean} True if MetaMask is installed
   */
  isMetaMaskInstalled(): boolean {
    return typeof window !== "undefined" && window.ethereum !== undefined;
  }
  /**
   * Connect to wallet (MetaMask)
   * @returns {Promise<string>} Connected wallet address
   */
  async connect(): Promise<string> {
    if (!this.isMetaMaskInstalled()) {
      throw new Error(
        "MetaMask is not installed. Please install MetaMask browser extension.",
      );
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length === 0) {
        throw new Error(
          "No accounts found. Please unlock your MetaMask wallet.",
        );
      }

      // Get provider, signer and address
      this.provider = patchProviderForMonad(
        new BrowserProvider(window.ethereum),
      );
      this.signer = await this.provider.getSigner();
      this.address = accounts[0];

      // Get network information
      const network = await this.provider.getNetwork();
      this.chainId = Number(network.chainId); // Always try to switch to Monad if not already on it
      if (
        !isMonadNetwork(this.chainId.toString()) &&
        !isMonadNetwork("0x" + this.chainId.toString(16))
      ) {
        await switchToMonadNetwork();
        // Refresh network info after switch
        const newNetwork = await this.provider.getNetwork();
        this.chainId = Number(newNetwork.chainId);
      }

      this.networkName = "Monad Testnet"; // Always show as Monad Testnet

      // Set up event listeners
      this._setupEventListeners();

      return this.address;
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    }
  }

  /**
   * Disconnect from the wallet (clear state)
   */
  disconnect(): void {
    this.provider = null;
    this.signer = null;
    this.address = null;
    this.chainId = null;
    this.networkName = null;

    // Remove event listeners if needed
    if (window.ethereum) {
      if (this._handleAccountsChanged) {
        window.ethereum.removeListener(
          "accountsChanged",
          this._handleAccountsChanged,
        );
      }
      if (this._handleChainChanged) {
        window.ethereum.removeListener(
          "chainChanged",
          this._handleChainChanged,
        );
      }
      if (this._handleDisconnect) {
        window.ethereum.removeListener("disconnect", this._handleDisconnect);
      }
    }
  }
  /**
   * Get wallet balance in ETH
   * @returns {Promise<string>} Balance formatted in ETH
   */
  async getBalance(): Promise<string> {
    if (!this.signer || !this.address) {
      throw new Error("Wallet not connected");
    }

    const balance = await this.provider!.getBalance(this.address);
    return formatUnits(balance, 18);
  }

  /**
   * Get token balance for an ERC20 token
   * @param {string} tokenAddress - The ERC20 token contract address
   * @returns {Promise<string>} Token balance formatted with decimals
   */ async getTokenBalance(tokenAddress: string): Promise<string> {
    if (!this.signer || !this.address) {
      throw new Error("Wallet not connected");
    }

    // ERC20 standard ABI for balanceOf function
    const minABI = [
      {
        constant: true,
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        type: "function",
      },
    ];

    const tokenContract = new Contract(tokenAddress, minABI, this.provider!);
    const balance = await tokenContract.balanceOf(this.address);
    const decimals = await tokenContract.decimals();

    return formatUnits(balance, decimals);
  }

  /**
   * Sign a message with the connected wallet
   * @param {string} message - Message to sign
   * @returns {Promise<string>} Signed message signature
   */
  async signMessage(message: string): Promise<string> {
    if (!this.signer) {
      throw new Error("Wallet not connected");
    }

    return await this.signer.signMessage(message);
  }

  /**
   * Switch to a different Ethereum network
   * @param {number|string} chainId - Chain ID to switch to (in hex or decimal)
   */
  async switchNetwork(chainId: number | string): Promise<void> {
    if (!this.provider) {
      throw new Error("Wallet not connected");
    }

    // Convert to hex format if it's a number
    const chainIdHex =
      typeof chainId === "number" ? `0x${chainId.toString(16)}` : chainId;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (error: any) {
      // This error code means the chain has not been added to MetaMask
      if (error.code === 4902) {
        throw new Error(
          "This network is not available in your MetaMask, please add it first",
        );
      }
      throw error;
    }
  }

  /**
   * Get friendly name for Ethereum network
   * @param {number} chainId - Network Chain ID
   * @returns {string} Network name
   */ getNetworkName(chainId: number): string {
    // Get network info from utils
    const networkInfo = NETWORK_INFO[chainId.toString()];
    if (networkInfo) {
      // If it's Monad, just return "Monad"
      if (isMonadNetwork(chainId.toString())) {
        return networkInfo.name;
      }
      // For other networks, use displayName if available, otherwise use name
      return networkInfo.displayName || networkInfo.name;
    }

    // Fallback for networks not in NETWORK_INFO
    const networks: Record<number, string> = {
      1: "Mainnet",
      3: "Testnet",
      4: "Testnet",
      5: "Testnet",
      42: "Testnet",
      56: "Mainnet",
      97: "Testnet",
      137: "Mainnet",
      80001: "Testnet",
      43114: "Mainnet",
      43113: "Testnet",
      42161: "Mainnet",
      421613: "Testnet",
      10: "Optimism",
      420: "Optimism Goerli",
      // Add more networks as needed
    };

    return networks[chainId] || `Unknown Network (${chainId})`;
  }

  /**
   * Setup event listeners for MetaMask events
   * @private
   */
  _setupEventListeners(): void {
    if (!window.ethereum) return;

    // Handle account changes
    this._handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected their wallet
        this.disconnect();
        window.dispatchEvent(new CustomEvent("wallet_disconnected"));
      } else if (accounts[0] !== this.address) {
        // User switched accounts
        this.address = accounts[0];
        window.dispatchEvent(
          new CustomEvent("wallet_accountChanged", {
            detail: { address: this.address },
          }),
        );
      }
    };

    // Handle chain/network changes
    this._handleChainChanged = (chainId: string) => {
      // Need to reload the page as recommended by MetaMask
      window.location.reload();
    };

    // Handle disconnect
    this._handleDisconnect = (error: any) => {
      this.disconnect();
      window.dispatchEvent(
        new CustomEvent("wallet_disconnected", {
          detail: { error },
        }),
      );
    };

    // Add event listeners
    window.ethereum.on("accountsChanged", this._handleAccountsChanged);
    window.ethereum.on("chainChanged", this._handleChainChanged);
    window.ethereum.on("disconnect", this._handleDisconnect);
  }

  /**
   * Send a transaction with MEV protection
   */
  async sendProtectedTransaction(
    tx: ethers.TransactionRequest,
  ): Promise<ethers.TransactionResponse> {
    if (!this.provider || !this.address) {
      throw new Error("Wallet not connected");
    }

    if (!this.mevProtection) {
      // Initialize MEV protection if not already done
      this.mevProtection = await createMEVProtection(this.provider, {
        enabled: true,
        useFlashbots: true,
        slippageTolerance: 0.5,
      });
    }

    return this.mevProtection.protectTransaction(tx);
  }

  /**
   * Check if a transaction is protected against MEV
   */
  async isTransactionProtected(
    tx: ethers.TransactionRequest,
  ): Promise<boolean> {
    if (!this.provider || !this.address) {
      throw new Error("Wallet not connected");
    }

    if (!this.mevProtection) {
      this.mevProtection = await createMEVProtection(this.provider, {
        enabled: true,
        useFlashbots: true,
        slippageTolerance: 0.5,
      });
    }

    return this.mevProtection.isTransactionProtected(tx);
  }
}

// Create a singleton instance
const walletConnector = new WalletConnector();

export default walletConnector;

// Add TypeScript declarations for Ethereum provider in window object
declare global {
  interface Window {
    ethereum?: any;
  }
}
