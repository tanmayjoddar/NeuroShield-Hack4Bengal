// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title QuadraticVoting
 * @dev DAO governance with quadratic voting for community-driven scam detection.
 * 
 * Part of NeuroShield's Dual-Layer Defense system:
 *   Layer 1 (Instant): ML model flags suspicious transactions in real-time
 *   Layer 2 (Long-term): Community curates scam database via quadratic voting
 *   Flywheel: DAO-confirmed scams feed back into ML training data
 *
 * Quadratic voting ensures fairness:
 *   - 1 token   = 1 vote power
 *   - 100 tokens = 10 vote power  
 *   - 10000 tokens = 100 vote power
 *   This prevents whales from dominating governance.
 *
 * Voter reputation tracking:
 *   - Accuracy score tracks how often you vote with the majority
 *   - Participation count rewards active community members
 *   - Both feed into future voting weight calculations
 */
contract QuadraticVoting is Ownable, ReentrancyGuard {
    // ════════════════════════════════════════════
    // STATE VARIABLES
    // ════════════════════════════════════════════

    IERC20 public shieldToken;
    uint256 public proposalCount;
    uint256 public votingPeriod = 3 days;
    uint256 public constant SCAM_THRESHOLD = 60; // 60% of vote power must agree

    // ════════════════════════════════════════════
    // DATA STRUCTURES
    // ════════════════════════════════════════════

    struct Proposal {
        address reporter;
        address suspiciousAddress;
        string description;
        string evidence;
        uint256 votesFor;       // Accumulated quadratic vote power FOR (confirms scam)
        uint256 votesAgainst;   // Accumulated quadratic vote power AGAINST
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool executed;
    }

    struct VoteInfo {
        bool hasVoted;
        bool support;       // true = confirms scam, false = not a scam
        uint256 tokens;     // Raw tokens staked
        uint256 power;      // Quadratic vote power (sqrt of tokens)
    }

    // ════════════════════════════════════════════
    // STORAGE MAPPINGS
    // ════════════════════════════════════════════

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => VoteInfo)) public votes;
    mapping(uint256 => address[]) private proposalVoters;

    // Scam tracking: fed back to ML layer for dual-layer defense
    mapping(address => bool) public isScammer;
    mapping(address => uint256) public scamScore;           // 0-100

    // Voter reputation: used for weighted voting in future proposals
    mapping(address => uint256) public voterAccuracy;       // 0-100
    mapping(address => uint256) public voterParticipation;  // Total proposals voted on

    // ════════════════════════════════════════════
    // EVENTS (must match frontend ABI exactly)
    // ════════════════════════════════════════════

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed reporter,
        address indexed suspiciousAddress,
        string description,
        string evidence
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 tokens,
        uint256 power
    );

    event ProposalExecuted(uint256 indexed proposalId, bool passed);
    event ScamAddressConfirmed(address indexed scamAddress, uint256 score);

    // ════════════════════════════════════════════
    // CONSTRUCTOR
    // ════════════════════════════════════════════

    constructor(address _shieldToken) {
        require(_shieldToken != address(0), "Invalid token address");
        shieldToken = IERC20(_shieldToken);
    }

    // ════════════════════════════════════════════
    // CORE FUNCTIONS
    // ════════════════════════════════════════════

    /**
     * @dev Submit a new scam report proposal.
     * Anyone can submit a report; the community votes on its validity.
     * @param _suspiciousAddress Address being reported as scam
     * @param _description Description of suspicious activity
     * @param _evidence IPFS hash or URL to evidence
     * @return proposalId The ID of the created proposal
     */
    function submitProposal(
        address _suspiciousAddress,
        string memory _description,
        string memory _evidence
    ) external returns (uint256) {
        require(_suspiciousAddress != address(0), "Invalid address");
        require(bytes(_description).length > 0, "Description required");

        proposalCount++;

        proposals[proposalCount] = Proposal({
            reporter: msg.sender,
            suspiciousAddress: _suspiciousAddress,
            description: _description,
            evidence: _evidence,
            votesFor: 0,
            votesAgainst: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + votingPeriod,
            isActive: true,
            executed: false
        });

        emit ProposalCreated(
            proposalCount,
            msg.sender,
            _suspiciousAddress,
            _description,
            _evidence
        );

        return proposalCount;
    }

    /**
     * @dev Cast a quadratic vote on a proposal.
     * Vote power = sqrt(tokens staked), preventing plutocratic control.
     * Reputation bonus: voters with >80% accuracy and 5+ votes get 20% boost.
     *
     * @param _proposalId ID of the proposal
     * @param _support true = confirm scam, false = not a scam
     * @param _tokens Number of SHIELD tokens to stake for this vote
     * @return votePower The quadratic vote power applied
     */
    function castVote(
        uint256 _proposalId,
        bool _support,
        uint256 _tokens
    ) external nonReentrant returns (uint256) {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.isActive, "Proposal not active");
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp <= proposal.endTime, "Voting period ended");
        require(!votes[_proposalId][msg.sender].hasVoted, "Already voted");
        require(_tokens > 0, "Must stake tokens");

        // Transfer tokens from voter to contract (staking for vote)
        require(
            shieldToken.transferFrom(msg.sender, address(this), _tokens),
            "Token transfer failed"
        );

        // Quadratic vote power: sqrt(tokens)
        uint256 votePower = Math.sqrt(_tokens);
        require(votePower > 0, "Vote power too low");

        // Reputation bonus: accurate + active voters get 20% boost
        if (voterAccuracy[msg.sender] > 80 && voterParticipation[msg.sender] >= 5) {
            votePower = votePower + (votePower * 20) / 100;
        }

        // Record the vote
        votes[_proposalId][msg.sender] = VoteInfo({
            hasVoted: true,
            support: _support,
            tokens: _tokens,
            power: votePower
        });

        // Track voter for this proposal (needed for reputation + token return)
        proposalVoters[_proposalId].push(msg.sender);

        // Update vote counts
        if (_support) {
            proposal.votesFor += votePower;
        } else {
            proposal.votesAgainst += votePower;
        }

        // Update voter participation count
        voterParticipation[msg.sender]++;

        emit VoteCast(_proposalId, msg.sender, _support, _tokens, votePower);
        return votePower;
    }

    /**
     * @dev Execute a proposal after voting period ends.
     * If passed: marks address as scammer, updates scam score.
     * Updates voter accuracy for ALL voters on this proposal.
     * Returns staked tokens to all voters.
     *
     * This is the critical junction of the dual-layer defense:
     * DAO-confirmed scams are added to the on-chain scam database
     * which the ML model queries for enhanced detection.
     *
     * @param _proposalId ID of the proposal
     * @return passed Whether the scam report was confirmed
     */
    function executeProposal(uint256 _proposalId) external returns (bool) {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.isActive, "Proposal not active");
        require(block.timestamp > proposal.endTime, "Voting period not ended");
        require(!proposal.executed, "Already executed");

        proposal.executed = true;
        proposal.isActive = false;

        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        bool passed = false;

        if (totalVotes > 0) {
            // Passed if forVotes exceed threshold percentage
            passed = (proposal.votesFor * 100) / totalVotes >= SCAM_THRESHOLD;
        }

        if (passed) {
            // Mark address as confirmed scammer
            isScammer[proposal.suspiciousAddress] = true;

            // Update scam score (increases with each confirmed report, caps at 100)
            uint256 newScore = scamScore[proposal.suspiciousAddress] + 25;
            if (newScore > 100) newScore = 100;
            scamScore[proposal.suspiciousAddress] = newScore;

            emit ScamAddressConfirmed(proposal.suspiciousAddress, newScore);
        }

        // Update voter accuracy for ALL voters on this specific proposal
        _updateVoterAccuracy(_proposalId, passed);

        // Return staked tokens to all voters
        _returnStakedTokens(_proposalId);

        emit ProposalExecuted(_proposalId, passed);
        return passed;
    }

    // ════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ════════════════════════════════════════════

    /**
     * @dev Update accuracy score for all voters on a proposal.
     * Voters who voted with the majority get accuracy boost.
     * This creates the self-improving flywheel:
     *   accurate voters -> more vote weight -> better curation -> better ML data
     */
    function _updateVoterAccuracy(uint256 _proposalId, bool proposalPassed) internal {
        address[] storage voters = proposalVoters[_proposalId];

        for (uint256 i = 0; i < voters.length; i++) {
            address voter = voters[i];
            VoteInfo storage voteInfo = votes[_proposalId][voter];

            bool votedCorrectly = (voteInfo.support == proposalPassed);

            if (votedCorrectly) {
                uint256 current = voterAccuracy[voter];
                if (current == 0) {
                    voterAccuracy[voter] = 75; // First correct vote starts at 75
                } else {
                    uint256 newAcc = current + 5;
                    voterAccuracy[voter] = newAcc > 100 ? 100 : newAcc;
                }
            } else {
                uint256 current = voterAccuracy[voter];
                voterAccuracy[voter] = current >= 10 ? current - 10 : 0;
            }
        }
    }

    /**
     * @dev Return staked tokens to all voters after proposal execution.
     * All voters get their tokens back regardless of outcome.
     */
    function _returnStakedTokens(uint256 _proposalId) internal {
        address[] storage voters = proposalVoters[_proposalId];

        for (uint256 i = 0; i < voters.length; i++) {
            address voter = voters[i];
            uint256 stakedTokens = votes[_proposalId][voter].tokens;

            if (stakedTokens > 0) {
                shieldToken.transfer(voter, stakedTokens);
            }
        }
    }

    // ════════════════════════════════════════════
    // VIEW FUNCTIONS (matching frontend ABI)
    // ════════════════════════════════════════════

    /**
     * @dev Get proposal details (matches frontend tuple shape exactly)
     */
    function getProposal(uint256 proposalId) external view returns (
        address reporter,
        address suspiciousAddress,
        string memory description,
        string memory evidence,
        uint256 votesFor,
        uint256 votesAgainst,
        bool _isActive
    ) {
        Proposal storage p = proposals[proposalId];
        return (
            p.reporter,
            p.suspiciousAddress,
            p.description,
            p.evidence,
            p.votesFor,
            p.votesAgainst,
            p.isActive
        );
    }

    /**
     * @dev Get vote details for a specific voter on a proposal
     */
    function getVote(uint256 proposalId, address voter) external view returns (
        bool hasVoted,
        bool support,
        uint256 tokens,
        uint256 power
    ) {
        VoteInfo storage v = votes[proposalId][voter];
        return (v.hasVoted, v.support, v.tokens, v.power);
    }

    /**
     * @dev Get voter reputation stats (accuracy + participation)
     */
    function getVoterStats(address voter) external view returns (
        uint256 accuracy,
        uint256 participation
    ) {
        return (voterAccuracy[voter], voterParticipation[voter]);
    }

    /**
     * @dev Get number of voters on a proposal
     */
    function getProposalVoterCount(uint256 proposalId) external view returns (uint256) {
        return proposalVoters[proposalId].length;
    }

    // ════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ════════════════════════════════════════════

    function setVotingPeriod(uint256 _newPeriod) external onlyOwner {
        require(_newPeriod >= 1 hours && _newPeriod <= 30 days, "Invalid period");
        votingPeriod = _newPeriod;
    }

    function setShieldToken(address _newToken) external onlyOwner {
        require(_newToken != address(0), "Invalid address");
        shieldToken = IERC20(_newToken);
    }
}
