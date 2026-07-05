// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// forgefmt: disable-start
//
//        ██████╗ ██████╗  █████╗ ██╗███╗   ██╗██████╗ ███████╗██████╗ ██╗ █████╗
//        ██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║██╔══██╗██╔════╝██╔══██╗██║██╔══██╗
//        ██████╔╝██████╔╝███████║██║██╔██╗ ██║██████╔╝█████╗  ██║  ██║██║███████║
//        ██╔══██╗██╔══██╗██╔══██║██║██║╚██╗██║██╔═══╝ ██╔══╝  ██║  ██║██║██╔══██║
//        ██████╔╝██║  ██║██║  ██║██║██║ ╚████║██║     ███████╗██████╔╝██║██║  ██║
//        ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚═╝     ╚══════╝╚═════╝ ╚═╝╚═╝  ╚═╝
//
//        Specialty AI Brains as iNFTs · Agent-paid knowledge marketplace
//
// forgefmt: disable-end

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";

import { Errors } from "./lib/Errors.sol";

interface IENS {
    function setSubnodeRecord(
        bytes32 node,
        bytes32 label,
        address owner,
        address resolver,
        uint64 ttl
    ) external;
}

/// @title  AccessTokenRegistrar
/// @author Brainpedia Team
/// @notice Issues TTL-bounded subnames under `client.<parent>` as one-time
///         capability tokens. When an agent pays to query a Brain, this
///         registrar mints `agent<hash>.client.<parent>` for them; the
///         Brain validates by resolving the name on-chain (or by reading
///         `expiresAt` here directly).
/// @dev    Capability tokens are bound to (agent, brainNameHash, ttl). They
///         can be consumed exactly once by an authorized issuer (the brain
///         server or a payment processor). Owner can revoke at any time.
contract AccessTokenRegistrar is Ownable2Step {
    // ============ Types ============

    struct Token {
        address agent;
        bytes32 brainNameHash; // namehash of the Brain ENS name this grants access to
        uint64 expiresAt;
        bool consumed;
    }

    // ============ Immutables ============

    IENS public immutable ENS_REGISTRY;
    address public immutable RESOLVER;
    /// @notice node hash for `client.<parent>`
    bytes32 public immutable CLIENT_PARENT_NODE;

    // ============ Storage ============

    /// @notice label hash → token state.
    mapping(bytes32 labelHash => Token token) public tokens;

    /// @notice Issuer allow-list. Only listed addresses can mint or consume tokens.
    mapping(address issuer => bool allowed) public issuers;

    // ============ Events ============

    event Issued(
        bytes32 indexed labelHash, address indexed agent, bytes32 brainNameHash, uint64 expiresAt
    );
    event Consumed(bytes32 indexed labelHash, address indexed agent);
    event Revoked(bytes32 indexed labelHash);
    event IssuerSet(address indexed issuer, bool allowed);

    // ============ Constructor ============

    constructor(address ens_, address resolver_, bytes32 clientParentNode_, address initialOwner)
        Ownable(initialOwner)
    {
        ENS_REGISTRY = IENS(ens_);
        RESOLVER = resolver_;
        CLIENT_PARENT_NODE = clientParentNode_;
    }

    // ============ External: admin ============

    function setIssuer(address issuer, bool allowed) external onlyOwner {
        issuers[issuer] = allowed;
        emit IssuerSet(issuer, allowed);
    }

    // ============ External: lifecycle ============

    function issue(string calldata label, address agent, bytes32 brainNameHash, uint64 ttlSeconds)
        external
        returns (bytes32 node)
    {
        if (!issuers[msg.sender]) revert Errors.NotIssuer();
        bytes32 labelHash = keccak256(bytes(label));
        if (tokens[labelHash].agent != address(0)) revert Errors.LabelAlreadyTaken();

        uint64 expiresAt = uint64(block.timestamp) + ttlSeconds;
        tokens[labelHash] = Token({
            agent: agent,
            brainNameHash: brainNameHash,
            expiresAt: expiresAt,
            consumed: false
        });

        ENS_REGISTRY.setSubnodeRecord(CLIENT_PARENT_NODE, labelHash, agent, RESOLVER, ttlSeconds);
        node = keccak256(abi.encodePacked(CLIENT_PARENT_NODE, labelHash));
        emit Issued(labelHash, agent, brainNameHash, expiresAt);
    }

    function consume(string calldata label) external returns (Token memory t) {
        if (!issuers[msg.sender]) revert Errors.NotIssuer();
        bytes32 labelHash = keccak256(bytes(label));
        t = tokens[labelHash];
        if (t.agent == address(0)) revert Errors.TokenNotFound();
        if (t.expiresAt < block.timestamp) revert Errors.TokenExpired();

        tokens[labelHash].consumed = true;
        emit Consumed(labelHash, t.agent);
    }

    function revoke(string calldata label) external onlyOwner {
        bytes32 labelHash = keccak256(bytes(label));
        delete tokens[labelHash];
        emit Revoked(labelHash);
    }

    // ============ Views ============

    function isValid(string calldata label, address agent) external view returns (bool) {
        bytes32 labelHash = keccak256(bytes(label));
        Token memory t = tokens[labelHash];
        return t.agent == agent && !t.consumed && t.expiresAt >= block.timestamp;
    }
}
