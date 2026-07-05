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

/// @title  Errors
/// @author Brainpedia Team
/// @notice Custom errors used across the Brainpedia contract suite.
/// @dev    Library of error declarations. Replaces every `require(cond, "string")`
///         in Brain, BrainOracle, BrainMinter, RoyaltyDistributor, SubnameRegistrar,
///         and AccessTokenRegistrar. Custom errors are gas-efficient and fully
///         typed for off-chain decoding.
library Errors {
    // ----- Generic input validation -----

    /// @notice Thrown when an address parameter is the zero address.
    error ZeroAddress();

    /// @notice Thrown when an amount parameter is zero.
    error ZeroAmount();

    /// @notice Thrown when two arrays that must be the same length are not.
    error LengthMismatch();

    /// @notice Thrown when a native ETH transfer fails.
    error EthTransferFailed();

    /// @notice Thrown when ECDSA recovery does not return the configured signer.
    error InvalidSignature();

    // ----- Brain (ERC-7857 iNFT) -----

    /// @notice Thrown when `msg.sender` is not the owner of the targeted tokenId.
    error NotBrainOwner();

    /// @notice Thrown when authorizeUsage is called with msg.value below the
    ///         Brain's configured per-query minimum payment.
    error InsufficientPayment();

    /// @notice Thrown when the per-query payment forward from the Brain contract
    ///         to the Brain owner fails (e.g., recipient is a contract that reverts
    ///         on receive).
    error PaymentForwardFailed();

    /// @notice Thrown when a view function is called on a tokenId that has no
    ///         IntelligentData records yet (i.e., was never minted or was burned).
    error NoIntelligence();

    // ----- ERC-7857 canonical transfer path -----

    /// @notice Thrown when a caller invokes `transferFrom` or `safeTransferFrom`
    ///         directly. ERC-7857 mandates the oracle-attested `secureTransfer`
    ///         path so that the per-Brain symmetric key can be re-sealed for the
    ///         new owner. Standard ERC-721 transfers would leave the recipient
    ///         with an undecryptable Brain.
    error UseSecureTransfer();

    /// @notice Thrown when secureTransfer is called before an oracle is set.
    error OracleNotSet();

    /// @notice Thrown when the configured oracle rejects the supplied proof.
    error InvalidOracleProof();

    // ----- BrainOracle attestation -----

    /// @notice Thrown when verifyProof is called while the attestor is unset.
    error AttestorNotSet();

    /// @notice Thrown when the EIP-712 TransferAttestation deadline has passed.
    error AttestationExpired();

    /// @notice Thrown when the supplied oracle proof is malformed (e.g., too
    ///         short to ABI-decode as a TransferAttestation).
    error InvalidProofFormat();

    // ----- BrainMinter anti-spam -----

    /// @notice Thrown when mintToSender is called with msg.value below the
    ///         currently-configured anti-spam mint fee.
    error InsufficientFee();

    /// @notice Thrown when an internal native-token transfer fails (fee sweep,
    ///         payment forward, refund).
    error TransferFailed();

    // ----- RoyaltyDistributor -----

    /// @notice Thrown when distribute() is called with msg.value below the
    ///         sum of per-Brain payment amounts.
    error InsufficientValue();

    // ----- ENS subname + access-token registrars -----

    /// @notice Thrown when a registrar tries to issue a subname whose label
    ///         hash is already registered.
    error LabelAlreadyTaken();

    /// @notice Thrown when a subname text-record write is attempted by an
    ///         account that does not own the label.
    error NotLabelOwner();

    /// @notice Thrown when a non-issuer account calls a function gated by
    ///         the issuer allow-list on AccessTokenRegistrar.
    error NotIssuer();

    /// @notice Thrown when an AccessTokenRegistrar operation references a
    ///         label that has never been issued.
    error TokenNotFound();

    /// @notice Thrown when an AccessTokenRegistrar operation references a
    ///         label whose TTL has elapsed.
    error TokenExpired();
}
