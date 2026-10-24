// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title dVote: public, wallet-based Yes/No governance for learning and demonstrations.
/// @notice Wallets are not verified people. Votes and proposal contents are public.
contract Voting {
    uint256 public constant MIN_DURATION = 60;
    uint256 public constant MAX_DURATION = 30 days;
    uint256 public constant MAX_TITLE_BYTES = 120;
    uint256 public constant MAX_DESCRIPTION_BYTES = 2000;

    struct Proposal {
        uint256 id;
        string title;
        string description;
        address creator;
        uint256 deadline;
        uint256 yesVotes;
        uint256 noVotes;
    }

    Proposal[] private proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    error InvalidTitle();
    error InvalidDescription();
    error InvalidDuration();
    error ProposalNotFound(uint256 proposalId);
    error VotingClosed(uint256 proposalId);
    error AlreadyVoted(uint256 proposalId, address voter);
    error InvalidPageSize();

    event ProposalCreated(uint256 indexed proposalId, address indexed creator, string title, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);

    function createProposal(string calldata title, string calldata description, uint256 duration) external returns (uint256 id) {
        if (bytes(title).length == 0 || bytes(title).length > MAX_TITLE_BYTES || !_hasContent(bytes(title))) revert InvalidTitle();
        if (bytes(description).length == 0 || bytes(description).length > MAX_DESCRIPTION_BYTES || !_hasContent(bytes(description))) revert InvalidDescription();
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert InvalidDuration();
        id = proposals.length;
        uint256 deadline = block.timestamp + duration;
        proposals.push(Proposal(id, title, description, msg.sender, deadline, 0, 0));
        emit ProposalCreated(id, msg.sender, title, deadline);
    }

    function vote(uint256 proposalId, bool support) external {
        if (proposalId >= proposals.length) revert ProposalNotFound(proposalId);
        Proposal storage proposal = proposals[proposalId];
        if (block.timestamp >= proposal.deadline) revert VotingClosed(proposalId);
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted(proposalId, msg.sender);
        hasVoted[proposalId][msg.sender] = true;
        if (support) proposal.yesVotes++; else proposal.noVotes++;
        emit VoteCast(proposalId, msg.sender, support);
    }

    function proposalCount() external view returns (uint256) { return proposals.length; }
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        if (proposalId >= proposals.length) revert ProposalNotFound(proposalId);
        return proposals[proposalId];
    }
    /// @dev Convenience method for small demos; use getProposals for growing collections.
    function getAllProposals() external view returns (Proposal[] memory) { return proposals; }
    function getProposals(uint256 offset, uint256 limit) external view returns (Proposal[] memory page) {
        if (limit == 0 || limit > 100) revert InvalidPageSize();
        if (offset >= proposals.length) return new Proposal[](0);
        uint256 count = proposals.length - offset;
        if (count > limit) count = limit;
        page = new Proposal[](count);
        for (uint256 i; i < count; i++) page[i] = proposals[offset + i];
    }
    function _hasContent(bytes memory value) private pure returns (bool) {
        for (uint256 i; i < value.length; i++) if (uint8(value[i]) > 32) return true;
        return false;
    }
}
