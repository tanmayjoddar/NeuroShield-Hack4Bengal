// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./WalletVerifier.sol";

/**
 * @title CivicGatedWallet
 * @dev Wallet contract with on-chain wallet verification for high-value transactions.
 * Transactions above the threshold require the sender to have a non-zero trust score.
 */
contract CivicGatedWallet {
    WalletVerifier public walletVerifier;
    uint256 public verificationThreshold;
    address public owner;

    event TransactionExecuted(address indexed to, uint256 value, bool verified);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    /**
     * @dev Initializes the contract with WalletVerifier address and a threshold amount
     * @param _walletVerifierAddress The deployed WalletVerifier contract address
     * @param _threshold Threshold amount above which wallet verification is required
     */
    constructor(address _walletVerifierAddress, uint256 _threshold) {
        require(_walletVerifierAddress != address(0), "Invalid WalletVerifier address");
        walletVerifier = WalletVerifier(_walletVerifierAddress);
        verificationThreshold = _threshold;
        owner = msg.sender;
    }

    /**
     * @dev Modifier to restrict access to the owner
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "CivicGatedWallet: Not owner");
        _;
    }

    /**
     * @dev Updates the threshold amount for verification
     * @param _newThreshold New threshold amount
     */
    function updateThreshold(uint256 _newThreshold) external onlyOwner {
        uint256 oldThreshold = verificationThreshold;
        verificationThreshold = _newThreshold;
        emit ThresholdUpdated(oldThreshold, _newThreshold);
    }

    /**
     * @dev Executes a transaction, requiring wallet verification for amounts above threshold.
     * Only the owner can execute transactions from this wallet.
     * @param _to Recipient address
     * @param _value Transaction amount
     * @return success Whether the transaction was successful
     */
    function executeTransaction(address payable _to, uint256 _value) external onlyOwner returns (bool success) {
        require(_to != address(0), "CivicGatedWallet: Invalid recipient");
        require(address(this).balance >= _value, "CivicGatedWallet: Insufficient balance");

        bool requiresVerification = _value >= verificationThreshold;

        if (requiresVerification) {
            (uint256 trustScore, , , , ) = walletVerifier.computeTrustScore(msg.sender);
            require(
                trustScore > 0,
                "CivicGatedWallet: Wallet verification required for high-value transaction"
            );
        }

        (success, ) = _to.call{value: _value}("");
        require(success, "CivicGatedWallet: Transaction failed");

        emit TransactionExecuted(_to, _value, requiresVerification);

        return success;
    }

    /**
     * @dev Allows the contract to receive ETH
     */
    receive() external payable {}
}
