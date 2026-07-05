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
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

import { IOracle } from "./IBrain.sol";
import { Errors } from "./lib/Errors.sol";

/// @title  BrainOracle — ERC-7857 attestor for Brainpedia
/// @author Brainpedia Team
/// @notice Default IOracle implementation. Accepts an EIP-712 signed
///         attestation from a trusted attestor address as the proof
///         format passed into Brain.secureTransfer.
/// @dev    The attestor signs a TransferAttestation struct that commits
///         to (tokenId, from, to, sealedKeyHash, deadline). The signed
///         struct is then ABI-encoded into the `oracleProof` argument.
///         The oracle verifies the signature recovers to `attestor`, the
///         deadline has not passed, AND the decoded (tokenId, from, to)
///         match the live transfer context supplied by Brain.secureTransfer
///         (audit finding #1: prevents proof replay across transfers).
///
///         For the hackathon submission the attestor is the Brainpedia
///         operator address. Production upgrade swaps this for an
///         attestor address controlled by a 0G Compute TEE node that
///         signs only after verifying off-chain key re-sealing.
contract BrainOracle is IOracle, Ownable2Step, EIP712 {
    // ============ Constants ============

    /// @notice EIP-712 type hash for transfer attestations.
    bytes32 public constant TRANSFER_ATTESTATION_TYPEHASH = keccak256(
        "TransferAttestation(uint256 tokenId,address from,address to,bytes32 sealedKeyHash,uint64 deadline)"
    );

    // ============ Storage ============

    address public attestor;

    // ============ Events ============

    event AttestorUpdated(address indexed oldAttestor, address indexed newAttestor);

    // ============ Constructor ============

    constructor(address initialOwner, address initialAttestor)
        Ownable(initialOwner)
        EIP712("BrainOracle", "1")
    {
        if (initialAttestor == address(0)) revert Errors.ZeroAddress();
        attestor = initialAttestor;
        emit AttestorUpdated(address(0), initialAttestor);
    }

    // ============ External: admin ============

    /// @notice Rotate the attestor address. Owner-only.
    function setAttestor(address newAttestor) external onlyOwner {
        if (newAttestor == address(0)) revert Errors.ZeroAddress();
        emit AttestorUpdated(attestor, newAttestor);
        attestor = newAttestor;
    }

    // ============ External: verification ============

    /// @notice Verify an oracle proof for a transfer.
    /// @param  proof      abi.encode(uint256 tokenId, address from, address to,
    ///                               bytes32 sealedKeyHash, uint64 deadline,
    ///                               bytes signature)
    /// @param  tokenId    live transfer tokenId from Brain.secureTransfer
    /// @param  from       live transfer sender (msg.sender of secureTransfer)
    /// @param  to         live transfer recipient
    /// @return            true iff the proof's embedded (tokenId, from, to) match
    ///                    the live context, the attestation has not expired, and
    ///                    the signature recovers to the configured attestor.
    function verifyProof(bytes calldata proof, uint256 tokenId, address from, address to)
        external
        view
        override
        returns (bool)
    {
        if (attestor == address(0)) revert Errors.AttestorNotSet();
        if (proof.length < 32) revert Errors.InvalidProofFormat();

        (
            uint256 pTokenId,
            address pFrom,
            address pTo,
            bytes32 sealedKeyHash,
            uint64 deadline,
            bytes memory signature
        ) = abi.decode(proof, (uint256, address, address, bytes32, uint64, bytes));

        // Bind the proof to the live transfer context.
        if (pTokenId != tokenId) revert Errors.InvalidOracleProof();
        if (pFrom != from) revert Errors.InvalidOracleProof();
        if (pTo != to) revert Errors.InvalidOracleProof();

        if (block.timestamp > deadline) revert Errors.AttestationExpired();

        bytes32 structHash = keccak256(
            abi.encode(TRANSFER_ATTESTATION_TYPEHASH, pTokenId, pFrom, pTo, sealedKeyHash, deadline)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        if (signer != attestor) revert Errors.InvalidSignature();

        return true;
    }

    // ============ View helpers for off-chain SDKs ============

    /// @notice Compute the EIP-712 digest an attestor must sign.
    function hashTransferAttestation(
        uint256 tokenId,
        address from,
        address to,
        bytes32 sealedKeyHash,
        uint64 deadline
    ) external view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    TRANSFER_ATTESTATION_TYPEHASH, tokenId, from, to, sealedKeyHash, deadline
                )
            )
        );
    }
}
