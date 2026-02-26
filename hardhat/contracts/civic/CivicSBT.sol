// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title CivicSBT
 * @dev Soulbound Token (SBT) for Civic verification status and voter reputation.
 * Tokens can be minted but not transferred, following SBT principles.
 *
 * Authorized updaters (CivicVerifier, QuadraticVoting) can modify metadata
 * to reflect changes in verification level, trust score, and voting accuracy.
 */
contract CivicSBT is ERC721URIStorage {
    using Counters for Counters.Counter;
    using Strings for uint256;

    struct TokenMetadata {
        uint256 issuedAt;
        uint256 verificationLevel; // 1 = low, 2 = medium, 3 = high
        uint256 trustScore;        // 0-100
        uint256 votingAccuracy;    // 0-100
        uint256 doiParticipation;  // Number of DAO votes cast
    }

    Counters.Counter private _tokenIds;
    address public admin;

    // Authorized contracts that can mint SBTs and update metadata
    mapping(address => bool) public authorizedUpdaters;

    mapping(address => uint256) private _addressToTokenId;
    mapping(uint256 => TokenMetadata) private _tokenMetadata;

    event SBTMinted(address indexed to, uint256 indexed tokenId);
    event MetadataUpdated(uint256 indexed tokenId, string newUri);
    event AuthorizedUpdaterAdded(address indexed updater);
    event AuthorizedUpdaterRemoved(address indexed updater);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedUpdaters[msg.sender], "Not authorized to update SBT");
        _;
    }

    constructor() ERC721("CivicSBT", "CSBT") {
        admin = msg.sender;
        // Admin is always authorized
        authorizedUpdaters[msg.sender] = true;
    }

    // ════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ════════════════════════════════════════════

    /**
     * @dev Add an authorized updater (e.g., CivicVerifier or QuadraticVoting contract)
     */
    function addAuthorizedUpdater(address _updater) external onlyAdmin {
        require(_updater != address(0), "Invalid address");
        authorizedUpdaters[_updater] = true;
        emit AuthorizedUpdaterAdded(_updater);
    }

    /**
     * @dev Remove an authorized updater
     */
    function removeAuthorizedUpdater(address _updater) external onlyAdmin {
        authorizedUpdaters[_updater] = false;
        emit AuthorizedUpdaterRemoved(_updater);
    }

    /**
     * @dev Transfer admin role
     */
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid address");
        authorizedUpdaters[admin] = false;
        admin = _newAdmin;
        authorizedUpdaters[_newAdmin] = true;
    }

    // ════════════════════════════════════════════
    // CORE FUNCTIONS
    // ════════════════════════════════════════════

    /**
     * @dev Mint a new SBT to a specific address.
     * Can only be called by authorized contracts (CivicVerifier).
     * @param _to Address to receive the SBT
     * @param verificationLevel Civic verification level (1-3)
     * @param trustScore Initial trust score (0-100)
     * @param votingAccuracy Initial voting accuracy (0-100)
     * @param doiParticipation Initial participation count
     */
    function mint(
        address _to,
        uint256 verificationLevel,
        uint256 trustScore,
        uint256 votingAccuracy,
        uint256 doiParticipation
    ) public onlyAuthorized returns (uint256) {
        require(!hasSBT(_to), "Address already has an SBT");
        require(_to != address(0), "Invalid address");

        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        TokenMetadata memory metadata = TokenMetadata({
            issuedAt: block.timestamp,
            verificationLevel: verificationLevel,
            trustScore: trustScore,
            votingAccuracy: votingAccuracy,
            doiParticipation: doiParticipation
        });

        _tokenMetadata[newTokenId] = metadata;
        _addressToTokenId[_to] = newTokenId;
        _safeMint(_to, newTokenId);

        string memory tokenURI = generateTokenURI(newTokenId);
        _setTokenURI(newTokenId, tokenURI);

        emit SBTMinted(_to, newTokenId);
        return newTokenId;
    }

    /**
     * @dev Update an existing token's metadata.
     * Can be called by any authorized updater (CivicVerifier or QuadraticVoting).
     */
    function updateMetadata(
        address holder,
        uint256 verificationLevel,
        uint256 trustScore,
        uint256 votingAccuracy,
        uint256 doiParticipation
    ) public onlyAuthorized {
        require(hasSBT(holder), "Address has no SBT");

        uint256 tokenId = _addressToTokenId[holder];
        TokenMetadata storage metadata = _tokenMetadata[tokenId];

        metadata.verificationLevel = verificationLevel;
        metadata.trustScore = trustScore;
        metadata.votingAccuracy = votingAccuracy;
        metadata.doiParticipation = doiParticipation;

        string memory newUri = generateTokenURI(tokenId);
        _setTokenURI(tokenId, newUri);

        emit MetadataUpdated(tokenId, newUri);
    }

    // ════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ════════════════════════════════════════════

    /**
     * @dev Check if an address has an SBT.
     */
    function hasSBT(address owner) public view returns (bool) {
        return _addressToTokenId[owner] > 0;
    }

    /**
     * @dev Get the token ID for a given address.
     * Required by the frontend to call tokenURI(tokenId) for the real on-chain Base64 URI.
     */
    function getTokenIdForAddress(address owner) public view returns (uint256) {
        require(hasSBT(owner), "Address has no SBT");
        return _addressToTokenId[owner];
    }

    /**
     * @dev Get token metadata for an address.
     */
    function getTokenMetadata(address owner) public view returns (TokenMetadata memory) {
        require(hasSBT(owner), "Address has no SBT");
        return _tokenMetadata[_addressToTokenId[owner]];
    }

    /**
     * @dev Generate on-chain JSON token URI containing metadata.
     */
    function generateTokenURI(uint256 tokenId) internal view returns (string memory) {
        TokenMetadata memory metadata = _tokenMetadata[tokenId];

        bytes memory dataURI = abi.encodePacked(
            '{',
            '"name": "Civic Soulbound Token #', tokenId.toString(), '",',
            '"description": "Non-transferable token representing Civic identity verification and DAO reputation",',
            '"image": "https://civic.me/api/sbt-image/', tokenId.toString(), '",',
            '"attributes": [',
            '{"trait_type": "Issued At", "value": "', metadata.issuedAt.toString(), '"},',
            '{"trait_type": "Verification Level", "value": "', metadata.verificationLevel.toString(), '"},',
            '{"trait_type": "Trust Score", "value": "', metadata.trustScore.toString(), '"},',
            '{"trait_type": "Voting Accuracy", "value": "', metadata.votingAccuracy.toString(), '"},',
            '{"trait_type": "DOI Participation", "value": "', metadata.doiParticipation.toString(), '"}',
            ']}'
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(dataURI)
            )
        );
    }

    // ════════════════════════════════════════════
    // SBT TRANSFER RESTRICTIONS
    // ════════════════════════════════════════════

    /**
     * @dev Override transfer to prevent transfers (Soulbound).
     */
    function _transfer(address, address, uint256) internal virtual override {
        revert("SBTs cannot be transferred");
    }

    function transferFrom(address, address, uint256) public virtual override(ERC721, IERC721) {
        revert("SBTs cannot be transferred");
    }

    function safeTransferFrom(address, address, uint256) public virtual override(ERC721, IERC721) {
        revert("SBTs cannot be transferred");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public virtual override(ERC721, IERC721) {
        revert("SBTs cannot be transferred");
    }
}
