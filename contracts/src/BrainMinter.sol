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

interface IBrainMintable {
    function mint(
        address to,
        bytes32 initialStorageRoot,
        bytes calldata encryptedURI,
        bytes32 metadataHash,
        string calldata description,
        bytes calldata sealedKey
    ) external returns (uint256 tokenId);

    function transferOwnership(address newOwner) external;
    function acceptOwnership() external;
}

/// @title  BrainMinter
/// @author Brainpedia Team
/// @notice Owns Brain.sol (after Brain.transferOwnership(BrainMinter)) and
///         exposes a permissionless mint so anyone can self-onboard a Brain
///         from their own Obsidian vault. They call mintToSender() and the
///         minted iNFT is owned by msg.sender. No owner gating.
/// @dev    Brain.sol carries canonical ERC-7857 metadata: an encrypted URI
///         (private manifest on 0G Storage, sealed for the owner), a
///         metadata commit hash, and a sealed symmetric key emitted in the
///         KeySealed event for the new owner to decrypt off chain.
///
///         Optional anti-spam fee can be set by the wrapper's admin. Default
///         is 0 wei, so anyone can mint for gas only.
///
///         If we ever need to migrate again, this contract has its own
///         `transferBrainOwnership(newOwner)` which forwards the call to
///         Brain.transferOwnership. Escape hatch if BrainMinter v2 ships.
contract BrainMinter is Ownable2Step {
    // ============ Immutables ============

    IBrainMintable public immutable BRAIN;

    // ============ Storage ============

    /// @notice Anti-spam fee in wei. 0 = free.
    uint256 public mintFeeWei;

    // ============ Events ============

    event Minted(
        uint256 indexed tokenId,
        address indexed minter,
        bytes32 storageRoot,
        bytes32 metadataHash
    );
    event MintFeeUpdated(uint256 newFeeWei);
    event FeesSwept(address indexed to, uint256 amount);

    // ============ Constructor ============

    constructor(address brain_, uint256 initialFeeWei, address initialOwner)
        Ownable(initialOwner)
    {
        if (brain_ == address(0)) revert Errors.ZeroAddress();
        BRAIN = IBrainMintable(brain_);
        mintFeeWei = initialFeeWei;
    }

    // ============ External: mint ============

    /// @notice Mint a fresh Brain iNFT to msg.sender. Permissionless.
    /// @param  initialStorageRoot 0G Storage merkle root of the public snapshot
    /// @param  encryptedURI       encrypted ref to private metadata on 0G Storage
    ///                            (empty for public-only Brains)
    /// @param  metadataHash       keccak256 commit of the canonical plaintext
    ///                            metadata (zero hash for public-only Brains)
    /// @param  description        free-form (specialty / brief / etc.)
    /// @param  sealedKey          symmetric key sealed for msg.sender's pubkey
    ///                            (empty for public-only Brains)
    /// @return tokenId            the new token id (assigned by Brain.sol)
    function mintToSender(
        bytes32 initialStorageRoot,
        bytes calldata encryptedURI,
        bytes32 metadataHash,
        string calldata description,
        bytes calldata sealedKey
    ) external payable returns (uint256 tokenId) {
        require(msg.value >= mintFeeWei, Errors.InsufficientFee());
        tokenId = BRAIN.mint(
            msg.sender, initialStorageRoot, encryptedURI, metadataHash, description, sealedKey
        );
        emit Minted(tokenId, msg.sender, initialStorageRoot, metadataHash);
    }

    // ============ External: admin ============

    /// @notice Update anti-spam fee. Owner-only.
    function setMintFee(uint256 newFeeWei) external onlyOwner {
        mintFeeWei = newFeeWei;
        emit MintFeeUpdated(newFeeWei);
    }

    /// @notice Sweep accumulated mint fees to a recipient. Owner-only.
    function sweepFees(address payable to) external onlyOwner {
        if (to == address(0)) revert Errors.ZeroAddress();
        uint256 bal = address(this).balance;
        (bool ok,) = to.call{ value: bal }("");
        require(ok, Errors.TransferFailed());
        emit FeesSwept(to, bal);
    }

    /// @notice Escape hatch. Hand Brain.sol ownership to a new minter
    ///         contract if we ever ship v2. Owner-only, irreversible.
    function transferBrainOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert Errors.ZeroAddress();
        BRAIN.transferOwnership(newOwner);
    }

    /// @notice Accept pending ownership of Brain.sol. Permissionless because
    ///         Ownable2Step's acceptOwnership() reverts unless this contract
    ///         is already the pending owner. Used by the deploy script right
    ///         after Brain.transferOwnership(this) to complete the 2-step.
    function claimBrainOwnership() external {
        BRAIN.acceptOwnership();
    }
}
