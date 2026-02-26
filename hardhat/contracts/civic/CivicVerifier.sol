// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CivicVerifier
 * @dev Manages Civic Pass verification and bridges identity to SBT minting.
 * 
 * Access control:
 *   - Admin can update contract addresses
 *   - Anyone can trigger verification for their own address (if Civic Pass valid)
 *   - SBT minting is delegated to CivicSBT (this contract is authorized updater)
 */

interface ICivicPass {
    function isValid(address _addr) external view returns (bool);
}

interface ICivicSBT {
    function mint(
        address _to,
        uint256 verificationLevel,
        uint256 trustScore,
        uint256 votingAccuracy,
        uint256 doiParticipation
    ) external returns (uint256);

    function updateMetadata(
        address holder,
        uint256 verificationLevel,
        uint256 trustScore,
        uint256 votingAccuracy,
        uint256 doiParticipation
    ) external;

    function hasSBT(address owner) external view returns (bool);
}

contract CivicVerifier {
    ICivicPass public civicPass;
    ICivicSBT public sbtContract;
    address public admin;

    event CivicPassUpdated(address indexed oldPass, address indexed newPass);
    event SBTContractUpdated(address indexed oldSBT, address indexed newSBT);
    event UserVerified(address indexed user, uint256 verificationLevel);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    struct UserVerification {
        bool isVerified;
        uint256 verificationLevel;
        uint256 timestamp;
        uint256 trustScore;
        uint256 votingAccuracy;
        uint256 doiParticipation;
    }

    mapping(address => UserVerification) private userVerifications;

    modifier onlyAdmin() {
        require(msg.sender == admin, "CivicVerifier: Only admin");
        _;
    }

    /**
     * @dev Initializes the contract with Civic Pass and SBT contract addresses
     */
    constructor(address _civicPassAddress, address _sbtAddress) {
        require(_civicPassAddress != address(0), "Invalid CivicPass address");
        require(_sbtAddress != address(0), "Invalid SBT address");
        civicPass = ICivicPass(_civicPassAddress);
        sbtContract = ICivicSBT(_sbtAddress);
        admin = msg.sender;
    }

    /**
     * @dev Updates the Civic Pass contract address (admin only)
     */
    function updateCivicPass(address _newCivicPass) external onlyAdmin {
        require(_newCivicPass != address(0), "Invalid CivicPass address");
        address oldPass = address(civicPass);
        civicPass = ICivicPass(_newCivicPass);
        emit CivicPassUpdated(oldPass, _newCivicPass);
    }

    /**
     * @dev Updates the SBT contract address (admin only)
     */
    function updateSBTContract(address _newSBT) external onlyAdmin {
        require(_newSBT != address(0), "Invalid SBT address");
        address oldSBT = address(sbtContract);
        sbtContract = ICivicSBT(_newSBT);
        emit SBTContractUpdated(oldSBT, _newSBT);
    }

    /**
     * @dev Transfer admin role
     */
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid admin address");
        address oldAdmin = admin;
        admin = _newAdmin;
        emit AdminTransferred(oldAdmin, _newAdmin);
    }

    /**
     * @dev Modifier to restrict access to Civic Pass verified users
     */
    modifier onlyCivicVerified() {
        require(civicPass.isValid(msg.sender), "CivicVerifier: Sender not verified");
        _;
    }

    /**
     * @dev Checks if a user is verified with Civic Pass and internal data
     */
    function isVerified(address _userAddress) public view returns (bool) {
        return userVerifications[_userAddress].isVerified && civicPass.isValid(_userAddress);
    }

    /**
     * @dev Returns the verification level of a user (0 = not verified)
     */
    function getVerificationLevel(address _userAddress) public view returns (uint256) {
        if (!isVerified(_userAddress)) return 0;
        return userVerifications[_userAddress].verificationLevel;
    }

    /**
     * @dev Returns the full verification data for a user
     */
    function getUserVerification(address _userAddress) external view returns (UserVerification memory) {
        return userVerifications[_userAddress];
    }

    /**
     * @dev Registers or updates a user's verification and manages SBT accordingly.
     * Mints SBT to the USER address (not msg.sender/this contract).
     */
    function registerVerification(
        address _userAddress,
        uint256 _verificationLevel,
        uint256 _trustScore,
        uint256 _votingAccuracy,
        uint256 _doiParticipation
    ) external {
        require(civicPass.isValid(_userAddress), "User not verified by CivicPass");
        require(_verificationLevel > 0 && _verificationLevel <= 3, "Invalid verification level");

        userVerifications[_userAddress] = UserVerification({
            isVerified: true,
            verificationLevel: _verificationLevel,
            timestamp: block.timestamp,
            trustScore: _trustScore,
            votingAccuracy: _votingAccuracy,
            doiParticipation: _doiParticipation
        });

        // Mint SBT to the USER (not to this contract)
        if (!sbtContract.hasSBT(_userAddress)) {
            sbtContract.mint(
                _userAddress,
                _verificationLevel,
                _trustScore,
                _votingAccuracy,
                _doiParticipation
            );
        } else {
            sbtContract.updateMetadata(
                _userAddress,
                _verificationLevel,
                _trustScore,
                _votingAccuracy,
                _doiParticipation
            );
        }

        emit UserVerified(_userAddress, _verificationLevel);
    }
}
