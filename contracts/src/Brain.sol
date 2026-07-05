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

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IBrain, IOracle } from "./IBrain.sol";
import { Errors } from "./lib/Errors.sol";

/// @title  Brain — ERC-7857 canonical iNFT for Brainpedia
/// @author Brainpedia Team
/// @notice Each tokenId stores an append-only list of IntelligentData
///         (public 0G Storage merkle root + encrypted private metadata ref
///         + commit hash), per-agent usage authorization with TTL, and the
///         canonical sealed-key transfer path required by ERC-7857
///         (`secureTransfer`).
/// @dev    Standard ERC-721 transferFrom / safeTransferFrom are blocked:
///         transfers MUST go through secureTransfer with a fresh sealed
///         key for the recipient and an oracle-verified attestation that
///         binds (tokenId, from, to) to the live call context (audit
///         finding #1: prevents proof replay across transfers).
///
///         Per-Brain payments (authorizeUsage) use a pull-payment pattern
///         via `pendingWithdrawals` to prevent a reverting Brain owner
///         from bricking the entire authorization flow (audit finding #7).
contract Brain is ERC721, Ownable2Step, ReentrancyGuard, IBrain {
    // ============ Storage ============

    uint256 private _nextTokenId;
    IOracle private _oracle;

    mapping(uint256 tokenId => IntelligentData[]) private _intelligence;
    mapping(uint256 tokenId => mapping(address agent => uint64 expiresAt)) private _authExpiry;

    /// @notice tokenId → minimum payment (wei) required for authorizeUsage.
    mapping(uint256 tokenId => uint256 minPayment) public minPaymentOf;

    /// @notice Brain owner → pending native payment balance (wei). Pull pattern
    ///         so a reverting receiver cannot brick authorizeUsage.
    mapping(address brainOwner => uint256 amount) public pendingWithdrawals;

    // ============ Events ============

    event WithdrawnByOwner(address indexed brainOwner, uint256 amount);

    // ============ Constructor ============

    constructor(address initialOwner) ERC721("Brainpedia Brain", "BRAIN") Ownable(initialOwner) {}

    // ============ Oracle administration ============

    function setOracle(address oracle_) external override onlyOwner {
        if (oracle_ == address(0)) revert Errors.ZeroAddress();
        _oracle = IOracle(oracle_);
        emit OracleUpdated(oracle_);
    }

    function oracle() external view override returns (address) {
        return address(_oracle);
    }

    // ============ Minting and append ============

    function mint(
        address to,
        bytes32 initialStorageRoot,
        bytes calldata encryptedURI,
        bytes32 metadataHash,
        string calldata description,
        bytes calldata sealedKey
    ) external override onlyOwner returns (uint256 tokenId) {
        tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        _intelligence[tokenId].push(
            IntelligentData({
                storageRoot: initialStorageRoot,
                encryptedURI: encryptedURI,
                metadataHash: metadataHash,
                createdAt: uint64(block.timestamp),
                description: description
            })
        );
        emit BrainMinted(tokenId, to, initialStorageRoot, metadataHash);
        if (sealedKey.length > 0) {
            emit KeySealed(tokenId, to, sealedKey);
        }
    }

    function appendStorageRoot(
        uint256 tokenId,
        bytes32 storageRoot,
        bytes calldata encryptedURI,
        bytes32 metadataHash,
        string calldata description,
        bytes calldata sealedKey
    ) external override {
        require(ownerOf(tokenId) == msg.sender, Errors.NotBrainOwner());
        _intelligence[tokenId].push(
            IntelligentData({
                storageRoot: storageRoot,
                encryptedURI: encryptedURI,
                metadataHash: metadataHash,
                createdAt: uint64(block.timestamp),
                description: description
            })
        );
        emit StorageRootAppended(tokenId, storageRoot, metadataHash, description);
        if (sealedKey.length > 0) {
            emit KeySealed(tokenId, msg.sender, sealedKey);
        }
    }

    function setMinPayment(uint256 tokenId, uint256 amount) external {
        require(ownerOf(tokenId) == msg.sender, Errors.NotBrainOwner());
        minPaymentOf[tokenId] = amount;
    }

    // ============ Usage authorization ============

    /// @notice Pay to authorize an agent for `ttlSeconds`. Extends the agent's
    ///         existing authorization if any; never shortens it (audit finding
    ///         #2). Payment is credited to the Brain owner's pendingWithdrawals
    ///         for pull-collection (audit finding #7).
    function authorizeUsage(uint256 tokenId, address agent, uint64 ttlSeconds)
        external
        payable
        override
    {
        require(msg.value >= minPaymentOf[tokenId], Errors.InsufficientPayment());
        uint64 newExpiresAt = uint64(block.timestamp) + ttlSeconds;
        uint64 currentExpiresAt = _authExpiry[tokenId][agent];

        // Only extend; never shorten a paid grant.
        if (newExpiresAt > currentExpiresAt) {
            _authExpiry[tokenId][agent] = newExpiresAt;
        }

        if (msg.value > 0) {
            address brainOwner = ownerOf(tokenId);
            pendingWithdrawals[brainOwner] += msg.value;
            emit BrainPayment(tokenId, msg.sender, brainOwner, msg.value, bytes32(0));
        }
        emit UsageAuthorized(tokenId, agent, _authExpiry[tokenId][agent]);
    }

    function revokeAuthorization(uint256 tokenId, address agent) external override {
        require(ownerOf(tokenId) == msg.sender, Errors.NotBrainOwner());
        delete _authExpiry[tokenId][agent];
        emit UsageRevoked(tokenId, agent);
    }

    function isAuthorized(uint256 tokenId, address agent) external view override returns (bool) {
        return _authExpiry[tokenId][agent] >= block.timestamp;
    }

    /// @notice Brain owners pull their accumulated authorizeUsage payments.
    ///         Uses CEI + nonReentrant for defense in depth.
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert Errors.ZeroAmount();
        pendingWithdrawals[msg.sender] = 0;
        (bool ok,) = msg.sender.call{ value: amount }("");
        if (!ok) revert Errors.PaymentForwardFailed();
        emit WithdrawnByOwner(msg.sender, amount);
    }

    // ============ ERC-7857 canonical secure transfer ============

    /// @notice Transfer the iNFT with a fresh sealed key for the recipient
    ///         and an oracle-attested proof of correct key re-encryption.
    /// @dev    The proof bytes are decoded by the oracle, which cross-checks
    ///         the embedded (tokenId, from, to) against the live transfer
    ///         context supplied here (audit finding #1: prevents replay of a
    ///         valid proof for one transfer against a different transfer).
    function secureTransfer(
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata oracleProof
    ) external override nonReentrant {
        require(ownerOf(tokenId) == msg.sender, Errors.NotBrainOwner());
        if (address(_oracle) == address(0)) revert Errors.OracleNotSet();
        if (!_oracle.verifyProof(oracleProof, tokenId, msg.sender, to)) {
            revert Errors.InvalidOracleProof();
        }

        address from = msg.sender;
        _transfer(from, to, tokenId);

        if (sealedKey.length > 0) {
            emit KeySealed(tokenId, to, sealedKey);
        }
        emit SecureTransferCompleted(tokenId, from, to);
    }

    // ============ Standard ERC-721 transfers blocked ============

    function transferFrom(address, address, uint256) public pure override {
        revert Errors.UseSecureTransfer();
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert Errors.UseSecureTransfer();
    }

    // ============ Views ============

    function intelligenceOf(uint256 tokenId)
        external
        view
        override
        returns (IntelligentData[] memory)
    {
        return _intelligence[tokenId];
    }

    function currentStorageRoot(uint256 tokenId) external view override returns (bytes32) {
        IntelligentData[] storage list = _intelligence[tokenId];
        require(list.length > 0, Errors.NoIntelligence());
        return list[list.length - 1].storageRoot;
    }

    function currentMetadataHash(uint256 tokenId) external view override returns (bytes32) {
        IntelligentData[] storage list = _intelligence[tokenId];
        require(list.length > 0, Errors.NoIntelligence());
        return list[list.length - 1].metadataHash;
    }

    function currentEncryptedURI(uint256 tokenId) external view override returns (bytes memory) {
        IntelligentData[] storage list = _intelligence[tokenId];
        require(list.length > 0, Errors.NoIntelligence());
        return list[list.length - 1].encryptedURI;
    }
}
