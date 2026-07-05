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

interface ITextResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
}

/// @title  SubnameRegistrar
/// @author Brainpedia Team
/// @notice Issues `<label>.<parent>` subnames for Brain owners. The parent
///         node hash and ENS contract addresses are constructor params:
///         deploy-time configuration so the same contract works against
///         Sepolia, mainnet, or any custom registry without code changes.
/// @dev    Production version should integrate with the ENS Name Wrapper
///         and use fuses to lock subname permissions trustlessly.
contract SubnameRegistrar is Ownable2Step {
    // ============ Immutables ============

    IENS public immutable ENS_REGISTRY;
    ITextResolver public immutable RESOLVER;
    bytes32 public immutable PARENT_NODE;

    // ============ Storage ============

    /// @notice label hash → registered owner. Used to enforce one-shot registration.
    mapping(bytes32 labelHash => address owner) public ownerOfLabel;

    // ============ Events ============

    event SubnameRegistered(bytes32 indexed labelHash, string label, address indexed owner);
    event TextRecordsBatched(bytes32 indexed node, uint256 count);

    // ============ Constructor ============

    constructor(address ens_, address resolver_, bytes32 parentNode_, address initialOwner)
        Ownable(initialOwner)
    {
        ENS_REGISTRY = IENS(ens_);
        RESOLVER = ITextResolver(resolver_);
        PARENT_NODE = parentNode_;
    }

    // ============ External: register ============

    function register(string calldata label, address owner_) external returns (bytes32 node) {
        bytes32 labelHash = keccak256(bytes(label));
        if (ownerOfLabel[labelHash] != address(0)) revert Errors.LabelAlreadyTaken();

        ownerOfLabel[labelHash] = owner_;
        ENS_REGISTRY.setSubnodeRecord(PARENT_NODE, labelHash, owner_, address(RESOLVER), 0);

        node = keccak256(abi.encodePacked(PARENT_NODE, labelHash));
        emit SubnameRegistered(labelHash, label, owner_);
    }

    // ============ External: text records ============

    /// @notice Batched text record write. Caller must own the subname.
    function setTextRecords(
        string calldata label,
        string[] calldata keys,
        string[] calldata values
    ) external {
        bytes32 labelHash = keccak256(bytes(label));
        if (ownerOfLabel[labelHash] != msg.sender) revert Errors.NotLabelOwner();
        require(keys.length == values.length, Errors.LengthMismatch());

        bytes32 node = keccak256(abi.encodePacked(PARENT_NODE, labelHash));
        for (uint256 i; i < keys.length; ++i) {
            RESOLVER.setText(node, keys[i], values[i]);
        }
        emit TextRecordsBatched(node, keys.length);
    }
}
