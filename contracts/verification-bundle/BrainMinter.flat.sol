// SPDX-License-Identifier: MIT
pragma solidity =0.8.30 ^0.8.20;

// lib/openzeppelin-contracts/contracts/utils/Context.sol

// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

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

// lib/openzeppelin-contracts/contracts/access/Ownable.sol

// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// lib/openzeppelin-contracts/contracts/access/Ownable2Step.sol

// OpenZeppelin Contracts (last updated v5.1.0) (access/Ownable2Step.sol)

/**
 * @dev Contract module which provides access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * This extension of the {Ownable} contract includes a two-step mechanism to transfer
 * ownership, where the new owner must call {acceptOwnership} in order to replace the
 * old one. This can help prevent common mistakes, such as transfers of ownership to
 * incorrect accounts, or to contracts that are unable to interact with the
 * permission system.
 *
 * The initial owner is specified at deployment time in the constructor for `Ownable`. This
 * can later be changed with {transferOwnership} and {acceptOwnership}.
 *
 * This module is used through inheritance. It will make available all functions
 * from parent (Ownable).
 */
abstract contract Ownable2Step is Ownable {
    address private _pendingOwner;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Returns the address of the pending owner.
     */
    function pendingOwner() public view virtual returns (address) {
        return _pendingOwner;
    }

    /**
     * @dev Starts the ownership transfer of the contract to a new account. Replaces the pending transfer if there is one.
     * Can only be called by the current owner.
     *
     * Setting `newOwner` to the zero address is allowed; this can be used to cancel an initiated ownership transfer.
     */
    function transferOwnership(address newOwner) public virtual override onlyOwner {
        _pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner(), newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`) and deletes any pending owner.
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual override {
        delete _pendingOwner;
        super._transferOwnership(newOwner);
    }

    /**
     * @dev The new owner accepts the ownership transfer.
     */
    function acceptOwnership() public virtual {
        address sender = _msgSender();
        if (pendingOwner() != sender) {
            revert OwnableUnauthorizedAccount(sender);
        }
        _transferOwnership(sender);
    }
}

// src/BrainMinter.sol

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

