// SPDX-License-Identifier: MIT
pragma solidity =0.8.30 ^0.8.20;

// src/lib/Errors.sol

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

// lib/openzeppelin-contracts/contracts/utils/StorageSlot.sol

// OpenZeppelin Contracts (last updated v5.1.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC-1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     // Define the slot. Alternatively, use the SlotDerivation library to derive the slot.
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(newImplementation.code.length > 0);
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 *
 * TIP: Consider using this library along with {SlotDerivation}.
 */
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct Int256Slot {
        int256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Int256Slot` with member `value` located at `slot`.
     */
    function getInt256Slot(bytes32 slot) internal pure returns (Int256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns a `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }
}

// lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol

// OpenZeppelin Contracts (last updated v5.5.0) (utils/ReentrancyGuard.sol)

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 *
 * IMPORTANT: Deprecated. This storage-based reentrancy guard will be removed and replaced
 * by the {ReentrancyGuardTransient} variant in v6.0.
 *
 * @custom:stateless
 */
abstract contract ReentrancyGuard {
    using StorageSlot for bytes32;

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant REENTRANCY_GUARD_STORAGE =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    /**
     * @dev A `view` only version of {nonReentrant}. Use to block view functions
     * from being called, preventing reading from inconsistent contract state.
     *
     * CAUTION: This is a "view" modifier and does not change the reentrancy
     * status. Use it only on view functions. For payable or non-payable functions,
     * use the standard {nonReentrant} modifier instead.
     */
    modifier nonReentrantView() {
        _nonReentrantBeforeView();
        _;
    }

    function _nonReentrantBeforeView() private view {
        if (_reentrancyGuardEntered()) {
            revert ReentrancyGuardReentrantCall();
        }
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        _nonReentrantBeforeView();

        // Any calls to nonReentrant after this point will fail
        _reentrancyGuardStorageSlot().getUint256Slot().value = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _reentrancyGuardStorageSlot().getUint256Slot().value == ENTERED;
    }

    function _reentrancyGuardStorageSlot() internal pure virtual returns (bytes32) {
        return REENTRANCY_GUARD_STORAGE;
    }
}

// src/RoyaltyDistributor.sol

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

interface IERC721Owner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title  RoyaltyDistributor
/// @author Brainpedia Team
/// @notice Settles a multi-Brain query payment in a single transaction.
///         Takes a list of (tokenId, amount) pairs and credits each amount
///         to the corresponding Brain owner's pending balance for later
///         pull-collection.
/// @dev    Audit finding #3: pull-payment pattern prevents a reverting Brain
///         owner from DoS-ing the entire batch. Each (tokenId, amount) pair
///         increments `pendingWithdrawals[ownerOf(tokenId)]`. Brain owners
///         call `withdraw()` to collect. Surplus `msg.value` is refunded to
///         the caller at the end of `distribute`.
contract RoyaltyDistributor is ReentrancyGuard {
    // ============ Immutables ============

    IERC721Owner public immutable BRAIN;

    // ============ Storage ============

    /// @notice Brain owner → pending native payment balance (wei).
    mapping(address brainOwner => uint256 amount) public pendingWithdrawals;

    // ============ Events ============

    /// @notice Per-recipient distribution log.
    event Distributed(
        uint256 indexed tokenId,
        address indexed brainOwner,
        address indexed payer,
        uint256 amount,
        bytes32 reason
    );
    event WithdrawnByOwner(address indexed brainOwner, uint256 amount);

    // ============ Constructor ============

    constructor(address brain_) {
        if (brain_ == address(0)) revert Errors.ZeroAddress();
        BRAIN = IERC721Owner(brain_);
    }

    // ============ External: distribute ============

    /// @param tokenIds the Brain iNFTs to pay
    /// @param amounts  amount-in-wei per Brain (must equal `tokenIds.length`)
    /// @param reason   free-form bytes32, typically keccak256(promptHash) for
    ///                 off-chain attribution. Pass 0x0 if not needed.
    function distribute(uint256[] calldata tokenIds, uint256[] calldata amounts, bytes32 reason)
        external
        payable
        nonReentrant
    {
        if (tokenIds.length != amounts.length) revert Errors.LengthMismatch();

        uint256 total;
        for (uint256 i; i < amounts.length; ++i) {
            total += amounts[i];
        }
        if (msg.value < total) revert Errors.InsufficientValue();

        for (uint256 i; i < tokenIds.length; ++i) {
            address brainOwner = BRAIN.ownerOf(tokenIds[i]);
            pendingWithdrawals[brainOwner] += amounts[i];
            emit Distributed(tokenIds[i], brainOwner, msg.sender, amounts[i], reason);
        }

        // Refund any surplus to msg.sender so over-pay doesn't get stuck.
        uint256 refund = msg.value - total;
        if (refund > 0) {
            (bool ok,) = msg.sender.call{ value: refund }("");
            if (!ok) revert Errors.TransferFailed();
        }
    }

    // ============ External: pull-payment withdrawal ============

    /// @notice Brain owners pull their accumulated distribution credits.
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert Errors.ZeroAmount();
        pendingWithdrawals[msg.sender] = 0;
        (bool ok,) = msg.sender.call{ value: amount }("");
        if (!ok) revert Errors.TransferFailed();
        emit WithdrawnByOwner(msg.sender, amount);
    }
}

