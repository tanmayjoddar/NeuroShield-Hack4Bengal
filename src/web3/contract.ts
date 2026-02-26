// Smart Contract Interaction Module for UnhackableWallet
// Handles all interactions with deployed smart contracts

interface ProposalExecutedEventArgs extends Result {
  proposalId: bigint;
  passed: boolean;
}

interface VoteCastEventArgs extends Result {
  proposalId: bigint;
  voter: string;
  support: boolean;
  tokens: bigint;
  power: bigint;
}

// Imports
import { Contract, formatUnits, parseUnits, ethers } from "ethers";
import walletConnector from "./wallet";
import { shortenAddress, isValidAddress } from "./utils";
import EventEmitter from "events";
import type { Result } from "ethers";
import addresses from "./addresses.json";

// ABI for the QuadraticVoting contract
const QUADRATIC_VOTING_ABI = [
  // View functions
  "function owner() view returns (address)",
  "function shieldToken() view returns (address)",
  "function getProposal(uint256 proposalId) view returns (tuple(address reporter, address suspiciousAddress, string description, string evidence, uint256 votesFor, uint256 votesAgainst, bool isActive))",
  "function getVote(uint256 proposalId, address voter) view returns (tuple(bool hasVoted, bool support, uint256 tokens, uint256 power))",
  "function isScammer(address) view returns (bool)",
  "function proposalCount() view returns (uint256)",

  // State-changing functions
  "function submitProposal(address _suspiciousAddress, string memory _description, string memory _evidence) returns (uint256)",
  "function castVote(uint256 _proposalId, bool _support, uint256 _tokens) returns (uint256)",
  "function executeProposal(uint256 _proposalId) returns (bool)",

  // Events
  "event ProposalCreated(uint256 indexed proposalId, address indexed reporter, address indexed suspiciousAddress, string description, string evidence)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 tokens, uint256 power)",
  "event ProposalExecuted(uint256 indexed proposalId, bool passed)",
];

// ABI for the SHIELD token contract
const SHIELD_TOKEN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

// Contract addresses for each network - load from environment variables when available
const CONTRACT_ADDRESSES: { [chainId: string]: string } = {
  // Mainnet and testnet addresses
  "1":
    import.meta.env.VITE_CONTRACT_ADDRESS_MAINNET ||
    "0x0000000000000000000000000000000000000000",
  "5":
    import.meta.env.VITE_CONTRACT_ADDRESS_GOERLI ||
    "0x0000000000000000000000000000000000000000",
  "11155111":
    import.meta.env.VITE_CONTRACT_ADDRESS_SEPOLIA ||
    "0x0000000000000000000000000000000000000000",
  "10143":
    import.meta.env.VITE_CONTRACT_ADDRESS_MONAD ||
    "0x7A791fe5A35131B7d98f854a64E7f94180F27C7b", // Monad testnet address
  // Fallback: some wallets/RPCs may report a different chain ID for Monad testnet
  "143":
    import.meta.env.VITE_CONTRACT_ADDRESS_MONAD ||
    "0x7A791fe5A35131B7d98f854a64E7f94180F27C7b",
};

/**
 * Smart contract interaction class for UnhackableWallet
 */
class ContractService extends EventEmitter {
  private contractInstance: Contract | null = null;

  private QUADRATIC_VOTING_ADDRESS =
    "0x7A791fe5A35131B7d98f854a64E7f94180F27C7b"; // Monad address
  private SHIELD_TOKEN_ADDRESS =
    (addresses as any).shieldToken ||
    import.meta.env.VITE_SHIELD_TOKEN_ADDRESS ||
    "0x0000000000000000000000000000000000000000";

  private votingContract: ethers.Contract | null = null;
  private shieldToken: ethers.Contract | null = null;

  private async getSignerContract() {
    if (!this.votingContract) {
      await this.init();
    }
    return {
      voting: this.votingContract,
      shield: this.shieldToken,
    };
  }

  // Forward contract events to EventEmitter
  private setupEventForwarding() {
    if (!this.votingContract) return;

    this.votingContract.on("ProposalCreated", (...args) => {
      this.emit("ProposalCreated", ...args);
    });

    this.votingContract.on("VoteCast", (...args) => {
      this.emit("VoteCast", ...args);
    });

    this.votingContract.on("ProposalExecuted", (...args) => {
      this.emit("ProposalExecuted", ...args);
    });
  }

  private async init() {
    try {
      // Try to recover wallet connection if provider/signer are missing
      if (!walletConnector.provider || !walletConnector.signer) {
        if (typeof window !== "undefined" && window.ethereum) {
          const accounts = await window.ethereum.request({
            method: "eth_accounts",
          });
          if (accounts && accounts.length > 0) {
            const { BrowserProvider } = await import("ethers");
            walletConnector.provider = new BrowserProvider(window.ethereum);
            walletConnector.signer = await walletConnector.provider.getSigner();
            walletConnector.address = accounts[0];
            const network = await walletConnector.provider.getNetwork();
            walletConnector.chainId = Number(network.chainId);
            console.log(
              "init: Wallet auto-reconnected:",
              walletConnector.address,
            );
          } else {
            throw new Error("Wallet not connected");
          }
        } else {
          throw new Error("Wallet not connected");
        }
      }

      // Get the chain ID
      const network = await walletConnector.provider.getNetwork();
      const chainId = network.chainId.toString();

      console.log("Current network:", {
        chainId,
        name: network.name,
      });

      // Get the contract address for the current network
      const contractAddress = CONTRACT_ADDRESSES[chainId];
      console.log("Contract address for network:", {
        chainId,
        contractAddress,
      });

      if (
        !contractAddress ||
        contractAddress === "0x0000000000000000000000000000000000000000"
      ) {
        throw new Error(
          `No contract deployed on network ${chainId}. Please switch to a supported network.`,
        );
      }

      // Set the contract addresses
      this.QUADRATIC_VOTING_ADDRESS = contractAddress;

      // Initialize the voting contract
      this.votingContract = new ethers.Contract(
        this.QUADRATIC_VOTING_ADDRESS,
        QUADRATIC_VOTING_ABI,
        walletConnector.signer,
      );

      // Verify contract is accessible
      try {
        const owner = await this.votingContract.owner();
        console.log("Contract verified, owner:", owner);
      } catch (error) {
        console.warn("Could not verify contract owner (non-fatal):", error);
        // Don't throw — contract may still work for read/write operations
      }

      // Initialize SHIELD token contract from on-chain address
      try {
        const shieldTokenAddress = await this.votingContract.shieldToken();
        if (shieldTokenAddress && shieldTokenAddress !== ethers.ZeroAddress) {
          this.SHIELD_TOKEN_ADDRESS = shieldTokenAddress;
          this.shieldToken = new ethers.Contract(
            shieldTokenAddress,
            SHIELD_TOKEN_ABI,
            walletConnector.signer,
          );
          console.log("SHIELD token initialized at:", shieldTokenAddress);
        } else {
          console.warn(
            "SHIELD token address is zero — token features disabled",
          );
        }
      } catch (error) {
        console.warn("Could not initialize SHIELD token (non-fatal):", error);
      }

      // Set up event forwarding
      this.setupEventForwarding();

      console.log("Contract initialization complete:", {
        votingAddress: this.QUADRATIC_VOTING_ADDRESS,
        shieldTokenAddress: this.SHIELD_TOKEN_ADDRESS,
        chainId,
        initialized: true,
      });
    } catch (error) {
      console.error("Initialization error:", error);
      throw error;
    }
  }

  /**
   * Initialize the contract instance
   * @returns {Promise<Contract>} The contract instance
   */ async initContract(): Promise<Contract> {
    console.log("Initializing contract...");

    if (
      !walletConnector.provider ||
      !walletConnector.signer ||
      !walletConnector.chainId
    ) {
      throw new Error(
        "Wallet not connected. Please connect your wallet first.",
      );
    }

    const chainId = walletConnector.chainId.toString();
    console.log("Current chain ID:", chainId);

    // Get contract address for the current network
    const contractAddress = CONTRACT_ADDRESSES[chainId];
    console.log("Contract address from mapping:", contractAddress);

    // Validate contract address
    if (
      !contractAddress ||
      contractAddress === "0x0000000000000000000000000000000000000000"
    ) {
      throw new Error(
        `Contract not deployed on network ${walletConnector.networkName || chainId}. Please switch to Monad network.`,
      );
    }

    try {
      console.log("Creating contract instance with address:", contractAddress);
      this.contractInstance = new Contract(
        contractAddress,
        QUADRATIC_VOTING_ABI, // Use the QuadraticVoting ABI instead of UnhackableWallet
        walletConnector.signer,
      );

      // Verify the contract exists on the network by calling a view function
      await this.contractInstance.proposalCount();

      return this.contractInstance;
    } catch (error: any) {
      console.error("Failed to initialize contract:", error);
      if (error.message.includes("call revert exception")) {
        throw new Error(
          `Contract at ${contractAddress} doesn't match the expected ABI. Please check deployment.`,
        );
      }
      throw new Error(`Failed to connect to the contract: ${error.message}`);
    }
  }

  /**
   * Get the contract instance, initializing if necessary
   * @returns {Promise<Contract>} The contract instance
   */
  async getContract(): Promise<Contract> {
    if (!this.contractInstance) {
      return this.initContract();
    }
    return this.contractInstance;
  }

  /**
   * Verify that the contract on the connected network matches our ABI
   * @returns {Promise<boolean>} True if contract is valid
   */
  async verifyContract(): Promise<boolean> {
    try {
      const contract = await this.getContract();

      // Try to call a view function to verify the contract
      await contract.proposalCount();

      // If we got here, the contract is valid
      return true;
    } catch (error) {
      console.error("Contract verification failed:", error);
      return false;
    }
  }

  /**
   * Vote on a scam report (DAO functionality)
   * @param {string} proposalId - The ID of the report to vote on
   * @param {boolean} inSupport - Whether the user believes the report is valid
   * @returns {Promise<any>} Transaction result
   */
  async voteOnScamReport(
    proposalId: string,
    inSupport: boolean,
    tokens: string = "1000000000000000000", // Default: 1 SHIELD token (in wei)
  ): Promise<any> {
    try {
      // Check wallet connection
      if (!walletConnector.address) {
        throw new Error("Wallet not connected");
      }

      // Use the quadratic voting castVote which requires token staking
      console.log(
        `Casting quadratic vote on proposal ${proposalId}, support: ${inSupport}, tokens: ${tokens}`,
      );

      // Ensure SHIELD token approval first
      const needsApproval = await this.needsShieldApproval(tokens);
      if (needsApproval) {
        console.log("Approving SHIELD tokens for voting contract...");
        const approveTx = await this.approveShield(tokens);
        await approveTx.wait(1);
        console.log("SHIELD tokens approved");
      }

      const tx = await this.castQuadraticVote(proposalId, inSupport, tokens);
      return tx;
    } catch (error: any) {
      console.error("Vote error:", error);
      throw new Error(`Failed to vote on report: ${error.message}`);
    }
  }

  /**
   * Check if an address is marked as a scam
   * @param {string} address - The address to check
   * @returns {Promise<boolean>} True if address is confirmed scammer
   */
  async checkScamAddress(address: string): Promise<boolean> {
    try {
      if (!address || !isValidAddress(address)) {
        return false;
      }

      const contract = await this.getContract();
      const isConfirmedScammer = await contract.isScammer(address);

      return isConfirmedScammer;
    } catch (error: any) {
      console.error("Error checking scam address:", error);
      // Return false on error to avoid blocking legitimate transactions
      return false;
    }
  }

  /**
   * Check if user has enough balance for transaction including gas buffer
   * @param {string} amountEth - Amount in ETH to send
   * @returns {Promise<boolean>} True if sufficient balance
   */
  async hasEnoughBalance(amountEth: string): Promise<boolean> {
    try {
      if (!walletConnector.address) {
        return false;
      }

      const balance = await walletConnector.getBalance();
      const balanceNum = parseFloat(balance);
      const amountNum = parseFloat(amountEth);

      // Add 10% buffer for gas fees
      const requiredAmount = amountNum * 1.1;

      return balanceNum >= requiredAmount;
    } catch (error: any) {
      console.error("Error checking balance:", error);
      return false;
    }
  }

  /**
   * Get all legacy scam reports
   * @returns {Promise<any[]>} List of scam reports
   */
  async getLegacyScamReports(): Promise<any[]> {
    // Legacy method — redirects to QuadraticVoting-based reports
    // The old UnhackableWallet getReportCount/getReport functions are not in QuadraticVoting
    try {
      return await this.getScamReports();
    } catch (error: any) {
      console.error("Get reports error:", error);
      return [];
    }
  }

  /**
   * Get scam reports filed by the connected address
   * @returns {Promise<any[]>} List of user's scam reports
   */
  async getUserReports(): Promise<any[]> {
    try {
      if (!walletConnector.address) return [];

      const reports = await this.getScamReports();
      return reports.filter(
        (report) =>
          report.reporter.toLowerCase() ===
          walletConnector.address?.toLowerCase(),
      );
    } catch (error) {
      console.error("Get user reports error:", error);
      return [];
    }
  }

  /**
   * Transfer funds using the secure transfer function of the wallet
   * @param {string} to - Recipient address
   * @param {string} amount - Amount in ETH
   * @returns {Promise<any>} Transaction result
   */
  async secureSendETH(to: string, amount: string): Promise<any> {
    try {
      // Check wallet connection
      if (!walletConnector.address) {
        throw new Error("Wallet not connected");
      }

      // Check if user has enough balance
      const hasBalance = await this.hasEnoughBalance(amount);
      if (!hasBalance) {
        throw new Error(
          "Insufficient balance for this transaction (including gas fees)",
        );
      }

      const contract = await this.getContract();

      // Convert ETH amount to Wei
      const amountWei = parseUnits(amount, 18);
      console.log(`Sending ${amount} ETH to ${shortenAddress(to)}`);

      // Use direct signer transfer (QuadraticVoting contract doesn't have secureTransfer)
      // First check if recipient is a known scammer
      let isSafe = true;
      try {
        isSafe = !(await this.isScamAddress(to));
      } catch (_) {
        /* continue even if check fails */
      }

      if (!isSafe) {
        console.warn(
          `⚠️ WARNING: Recipient ${shortenAddress(to)} is a DAO-confirmed scammer!`,
        );
      }

      const tx = await walletConnector.signer!.sendTransaction({
        to,
        value: amountWei,
      });

      return tx;
    } catch (error: any) {
      console.error("Secure send error:", error);
      // Check if user rejected the transaction
      if (error.code === 4001 || error.message?.includes("user rejected")) {
        throw new Error("Transaction cancelled by user");
      }
      throw new Error(`Failed to send transaction: ${error.message}`);
    }
  }

  // Shield Token Functions
  public async getShieldBalance(address: string): Promise<string> {
    if (!this.votingContract) await this.init();
    if (!this.shieldToken) {
      console.warn("SHIELD token not initialized — returning 0");
      return "0";
    }
    try {
      const balance = await this.shieldToken.balanceOf(address);
      return formatUnits(balance, 18);
    } catch (error) {
      console.warn("Failed to get SHIELD balance:", error);
      return "0";
    }
  }

  public async needsShieldApproval(amount: string): Promise<boolean> {
    if (!this.votingContract) await this.init();
    if (!this.shieldToken || !walletConnector.address) return true;

    const allowance = await this.shieldToken?.allowance(
      walletConnector.address,
      this.QUADRATIC_VOTING_ADDRESS,
    );

    return ethers.getBigInt(allowance || 0) < ethers.getBigInt(amount);
  }

  public async approveShield(
    amount: string,
  ): Promise<ethers.ContractTransactionResponse> {
    const { shield } = await this.getSignerContract();
    if (!shield) {
      throw new Error("SHIELD token not available on this network");
    }
    return shield.approve(this.QUADRATIC_VOTING_ADDRESS, amount);
  }

  // Quadratic Voting Functions
  public async getScamReports(): Promise<any[]> {
    if (!this.votingContract) await this.init();

    try {
      // Use proposalCount + getProposal to fetch all proposals
      const count = await this.votingContract?.proposalCount();
      const totalProposals = Number(count || 0);

      if (totalProposals === 0) return [];

      const reports = [];
      for (let i = 1; i <= totalProposals; i++) {
        try {
          const proposal = await this.votingContract?.getProposal(i);
          reports.push({
            id: i,
            reporter: proposal.reporter || proposal[0],
            suspiciousAddress: proposal.suspiciousAddress || proposal[1],
            description: proposal.description || proposal[2],
            evidence: proposal.evidence || proposal[3],
            timestamp: new Date(),
            votesFor: (proposal.votesFor || proposal[4]).toString(),
            votesAgainst: (proposal.votesAgainst || proposal[5]).toString(),
            status:
              (proposal.isActive ?? proposal[6])
                ? "active"
                : BigInt(proposal.votesFor || proposal[4]) >
                    BigInt(proposal.votesAgainst || proposal[5])
                  ? "approved"
                  : "rejected",
          });
        } catch (err) {
          console.warn(`Failed to fetch proposal ${i}:`, err);
        }
      }

      return reports;
    } catch (error) {
      console.error("Error fetching scam reports:", error);

      // Fallback: try event-based approach
      try {
        const filter = this.votingContract?.filters.ProposalCreated();
        const events = await this.votingContract?.queryFilter(filter);

        return (events || []).map((event, index) => {
          const args = (event as ethers.EventLog).args;
          return {
            id: Number(args?.[0] || index + 1),
            reporter: args?.[1] || "unknown",
            suspiciousAddress: args?.[2] || "unknown",
            description: args?.[3] || "Scam report",
            evidence: args?.[4] || "",
            timestamp: new Date(),
            votesFor: "0",
            votesAgainst: "0",
            status: "active",
          };
        });
      } catch (fallbackErr) {
        console.error("Event fallback also failed:", fallbackErr);
        return [];
      }
    }
  }

  public async castQuadraticVote(
    proposalId: string,
    support: boolean,
    tokens: string,
  ): Promise<ethers.ContractTransactionResponse> {
    const { voting } = await this.getSignerContract();
    return voting.castVote(proposalId, support, tokens);
  }
  public async reportScam(
    suspiciousAddress: string,
    description: string,
    evidence: string,
  ): Promise<ethers.ContractTransactionResponse> {
    try {
      console.log("Starting report submission...");

      // Ensure wallet connector has provider/signer — re-connect if needed
      if (!walletConnector.provider || !walletConnector.signer) {
        console.log(
          "Wallet connector missing provider/signer, reconnecting...",
        );
        if (typeof window !== "undefined" && window.ethereum) {
          const { BrowserProvider } = await import("ethers");
          const accounts = await window.ethereum.request({
            method: "eth_accounts",
          });
          if (accounts && accounts.length > 0) {
            walletConnector.provider = new BrowserProvider(window.ethereum);
            walletConnector.signer = await walletConnector.provider.getSigner();
            walletConnector.address = accounts[0];
            const network = await walletConnector.provider.getNetwork();
            walletConnector.chainId = Number(network.chainId);
            console.log(
              "Wallet reconnected:",
              walletConnector.address,
              "chain:",
              walletConnector.chainId,
            );
          } else {
            throw new Error("Please connect your wallet first");
          }
        } else {
          throw new Error("No wallet provider found. Please install MetaMask.");
        }
      }

      // Make sure contract is initialized
      if (!this.votingContract) {
        console.log("Initializing contract...");
        await this.init();
      }

      if (!walletConnector.address) {
        throw new Error("Please connect your wallet first");
      }

      if (!walletConnector.signer) {
        throw new Error("No signer available. Please check wallet connection.");
      }

      // Get network info and verify chain
      const network = await walletConnector.provider?.getNetwork();
      const chainId = Number(network?.chainId || 0);

      if (chainId !== 10143 && chainId !== 143) {
        throw new Error("Please switch to Monad network (chain ID 10143)");
      }

      console.log("Network info:", {
        chainId,
        name: network?.name,
        contractAddress: this.QUADRATIC_VOTING_ADDRESS,
      });

      if (!isValidAddress(suspiciousAddress)) {
        throw new Error("Please enter a valid address to report");
      }

      // Normalize address to proper EIP-55 checksum
      suspiciousAddress = ethers.getAddress(suspiciousAddress);

      // Verify we have the contract address
      if (
        !this.QUADRATIC_VOTING_ADDRESS ||
        this.QUADRATIC_VOTING_ADDRESS === "0x..."
      ) {
        throw new Error("Contract address not properly initialized");
      }

      // Check if we have enough gas
      const balance = await walletConnector.provider?.getBalance(
        walletConnector.address,
      );
      if (balance && balance <= 0n) {
        throw new Error("Insufficient funds for gas");
      }

      console.log("Submitting scam report:", {
        reporter: walletConnector.address,
        suspiciousAddress,
        description: description.slice(0, 50) + "...",
        evidenceLength: evidence?.length || 0,
        chainId,
        contractAddress: this.QUADRATIC_VOTING_ADDRESS,
      });

      // Prepare transaction with gas estimate
      const gasEstimate = await this.votingContract.submitProposal.estimateGas(
        suspiciousAddress,
        description,
        evidence,
      );

      console.log("Gas estimate:", gasEstimate.toString()); // Submit transaction with enough gas and handle gas price
      const feeData = await walletConnector.provider?.getFeeData();
      console.log("Current gas price:", feeData?.gasPrice?.toString());

      const tx = await this.votingContract.submitProposal(
        suspiciousAddress,
        description,
        evidence,
        {
          gasLimit: (gasEstimate * 120n) / 100n, // Add 20% buffer
          gasPrice: feeData?.gasPrice,
        },
      );

      console.log("Transaction submitted:", tx.hash);

      // Wait for transaction confirmation
      console.log("Waiting for transaction confirmation...");
      const receipt = await tx.wait(1);

      console.log("Transaction confirmed:", {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });

      return tx;
    } catch (error: any) {
      console.error("Error submitting scam report:", {
        error,
        message: error.message,
        code: error.code,
        data: error.data,
      });

      if (error.code === 4001 || error.message?.includes("user rejected")) {
        throw new Error("Transaction rejected by user");
      } else if (error.message.includes("insufficient funds")) {
        throw new Error("Insufficient funds for gas");
      } else if (error.message.includes("contract not properly initialized")) {
        throw new Error(
          "Smart contract not properly loaded. Please refresh the page and try again.",
        );
      } else {
        throw new Error(`Failed to submit report: ${error.message}`);
      }
    }
  }

  public async isScamAddress(address: string): Promise<boolean> {
    if (!this.votingContract) await this.init();
    try {
      return await this.votingContract?.isScammer(address);
    } catch (error) {
      console.warn("isScammer check failed (non-fatal):", error);
      return false;
    }
  }

  public async getScamScore(address: string): Promise<number> {
    if (!this.votingContract) await this.init();

    try {
      const reports = await this.getScamReports();
      const addressReports = reports.filter(
        (r) => r.suspiciousAddress.toLowerCase() === address.toLowerCase(),
      );

      if (addressReports.length === 0) return 0;

      // Calculate weighted score based on votes
      // Note: votesFor/votesAgainst are already quadratic (sqrt applied on-chain), don't double-sqrt
      let totalScore = 0;
      for (const report of addressReports) {
        const votePowerFor = Number(report.votesFor);
        const votePowerAgainst = Number(report.votesAgainst);
        const total = votePowerFor + votePowerAgainst;
        if (total > 0) {
          totalScore += ((votePowerFor - votePowerAgainst) / total) * 100;
        }
      }

      return Math.max(0, Math.min(100, totalScore / addressReports.length));
    } catch (err) {
      console.error("Error calculating scam score:", err);
      return 0;
    }
  }

  public async getUserVotingStats(address: string) {
    if (!this.votingContract) await this.init();

    try {
      // Get all votes cast by the user
      const voteFilter = this.votingContract?.filters.VoteCast(null, address);
      const voteEvents = await this.votingContract?.queryFilter(voteFilter);

      // Get all executed proposals
      const executedFilter = this.votingContract?.filters.ProposalExecuted();
      const executedEvents =
        await this.votingContract?.queryFilter(executedFilter);

      // Map proposal outcomes
      const proposalOutcomes = new Map(
        executedEvents?.map((event) => {
          const args = (event as ethers.EventLog)
            .args as unknown as ProposalExecutedEventArgs;
          return [args.proposalId.toString(), args.passed];
        }),
      );

      // Calculate stats
      let totalVotes = 0;
      let correctVotes = 0;

      voteEvents?.forEach((event) => {
        const args = (event as ethers.EventLog)
          .args as unknown as VoteCastEventArgs;
        const outcome = proposalOutcomes.get(args.proposalId.toString());

        // Only count votes on executed proposals
        if (typeof outcome !== "undefined") {
          totalVotes++;
          if (args.support === outcome) correctVotes++;
        }
      });

      return {
        totalVotes,
        accuracy:
          totalVotes > 0 ? Math.round((correctVotes / totalVotes) * 100) : 0,
      };
    } catch (err) {
      console.error("Error getting user voting stats:", err);
      return { totalVotes: 0, accuracy: 0 };
    }
  }
}

// Create a singleton instance
const contractService = new ContractService();

// Standalone functions for Step 6

/**
 * Get a contract instance
 * @returns {Promise<Contract>} Contract instance
 */
export const getContract = async (): Promise<Contract> => {
  return contractService.getContract();
};

/**
 * Send ETH securely
 * @param to Recipient address
 * @param amountEth Amount in ETH
 * @returns Transaction hash
 */
export const sendTransaction = async (
  to: string,
  amountEth: string,
): Promise<string> => {
  try {
    const tx = await contractService.secureSendETH(to, amountEth);
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error("Send transaction error:", error);
    throw new Error(`Transaction failed: ${error.message}`);
  }
};

/**
 * Report scammer
 * @param scammer Address to report
 * @param reason Reason for the report
 * @param evidence Evidence URL or documentation (optional)
 * @returns Transaction hash
 */
export const reportScam = async (
  scammer: string,
  reason: string,
  evidence: string = "",
): Promise<string> => {
  try {
    console.log("Starting scam report submission...", {
      scammer,
      reason,
      evidence,
    });

    // Validate inputs
    if (!isValidAddress(scammer)) {
      throw new Error("Invalid address format");
    }
    // Normalize to proper EIP-55 checksum so any valid hex address works
    scammer = ethers.getAddress(scammer);
    if (!reason.trim()) {
      throw new Error("Reason is required");
    }

    const tx = await contractService.reportScam(scammer, reason, evidence);
    console.log("Transaction sent:", tx.hash);

    // Wait for one confirmation
    const receipt = await tx.wait(1);
    console.log("Transaction confirmed:", receipt.hash);

    return receipt.hash;
  } catch (error: any) {
    console.error("Report scam error:", error);
    // Check if user rejected the transaction
    if (error.code === 4001 || error.message?.includes("user rejected")) {
      throw new Error("Report cancelled by user");
    }
    throw new Error(
      error.message || "Report submission failed. Please try again.",
    );
  }
};

/**
 * Vote on a proposal
 * @param proposalId ID of the proposal
 * @param inSupport Whether to vote in support
 * @returns Transaction hash
 */
export const voteOnProposal = async (
  proposalId: string,
  inSupport: boolean,
  tokens: string = "1000000000000000000",
): Promise<string> => {
  try {
    const tx = await contractService.voteOnScamReport(
      proposalId,
      inSupport,
      tokens,
    );
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error("Vote error:", error);
    throw new Error(`Vote submission failed: ${error.message}`);
  }
};

export default contractService;

// Utility function to handle ENS resolution based on network support
async function resolveAddressOrENS(
  provider: ethers.Provider,
  addressOrENS: string,
): Promise<string> {
  // Check if it's already a valid address
  if (isValidAddress(addressOrENS)) {
    return addressOrENS;
  }

  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId); // Convert bigint to number for comparison

    // Immediately return for non-ENS networks to avoid unnecessary ENS calls
    if (chainId === 10143) {
      throw new Error("Only valid addresses are supported on this network");
    }

    // Only attempt ENS resolution on supported networks
    const supportedENSNetworks = [1, 5, 11155111]; // Mainnet, Goerli, Sepolia
    if (!supportedENSNetworks.includes(chainId)) {
      throw new Error("ENS resolution not supported on this network");
    }

    const address = await provider.resolveName(addressOrENS);
    if (!address) {
      throw new Error("ENS resolution failed");
    }
    return address;
  } catch (error) {
    // Always return the original input if it's a valid address
    if (isValidAddress(addressOrENS)) {
      return addressOrENS;
    }
    throw new Error("Please enter a valid address");
  }
}

export const getQuadraticVotingContract = async (
  provider: ethers.Provider,
  address: string,
) => {
  // Create contract instance
  const contract = new Contract(address, QUADRATIC_VOTING_ABI, provider);

  // Wrap the contract to handle addresses correctly for the network
  return {
    ...contract,
    submitProposal: async (
      suspiciousAddress: string,
      description: string,
      evidence: string,
    ) => {
      // For Monad network, only accept valid addresses directly
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      if (chainId === 10143) {
        if (!isValidAddress(suspiciousAddress)) {
          throw new Error("Please enter a valid address");
        }
        return contract.submitProposal(
          suspiciousAddress,
          description,
          evidence,
        );
      }

      // For other networks, attempt address resolution
      const resolvedAddress = await resolveAddressOrENS(
        provider,
        suspiciousAddress,
      );
      return contract.submitProposal(resolvedAddress, description, evidence);
    },
  };
};
