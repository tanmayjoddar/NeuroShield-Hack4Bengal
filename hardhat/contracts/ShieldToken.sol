// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ShieldToken
 * @dev ERC-20 governance token for NeuroShield's QuadraticVoting DAO.
 * Voters stake SHIELD tokens to cast quadratic votes on scam reports.
 * Tokens are returned after each proposal is executed.
 *
 * Initial supply: 1,000,000 SHIELD minted to deployer.
 * The owner can mint more if needed for community distribution.
 */
contract ShieldToken is ERC20, Ownable {
    constructor() ERC20("SHIELD", "SHIELD") {
        // Mint 1 million SHIELD to deployer for initial distribution
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    /**
     * @dev Mint new tokens (owner only).
     * Used for community airdrops, faucet top-ups, etc.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
