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

/// @title  IOracle — ERC-7857 attestation oracle
/// @author Brainpedia Team
/// @notice Verifies transfer proofs (TEE attestation or ZK proof) before
///         the iNFT changes hands. Brainpedia ships a default oracle
///         (`BrainOracle.sol`) that accepts an EIP-712 signed attestation
///         from a trusted attestor address as the proof format. Production
///         deployments can swap in a real TEE node or ZK verifier without
///         changing Brain.sol — the only contract surface is this one method.
/// @dev    The verifier receives the live transfer context (tokenId, from, to)
///         alongside the opaque proof bytes. Implementations MUST cross-check
///         the proof's embedded fields against the supplied context to prevent
///         proof replay across different transfers (audit finding #1).
interface IOracle {
    function verifyProof(bytes calldata proof, uint256 tokenId, address from, address to)
        external
        view
        returns (bool);
}

/// @title  IBrain — ERC-7857 canonical intelligent NFT for Brainpedia
/// @author Brainpedia Team
/// @notice Each tokenId is one specialty AI Brain. Public reference data
///         lives at `storageRoot` on 0G Storage (anyone can fetch and verify
///         the snapshot). Private metadata — system prompt, royalty terms,
///         owner notes, anything kept out of the public snapshot — lives at
///         `encryptedURI`, encrypted with a per-Brain symmetric key sealed
///         for the current owner. Transfers require an oracle proof that
///         the key has been re-sealed for the new owner (`secureTransfer`).
/// @dev    The interface intentionally omits error declarations; all errors
///         used by the Brain contract suite live in `src/lib/Errors.sol`.
interface IBrain {
    // ============ Types ============

    struct IntelligentData {
        bytes32 storageRoot; //  public 0G Storage Log layer merkle root
        bytes encryptedURI; //   encrypted ref to private metadata blob on
        //                       0G Storage. Empty bytes = no encrypted
        //                       metadata (public-only Brain).
        bytes32 metadataHash; // keccak256(canonical plaintext metadata) commit.
        //                       Zero hash = no metadata commit.
        uint64 createdAt; //     block.timestamp at the time of append
        string description; //   free-form ("snapshot v3, added 12 articles")
    }

    // ============ Events ============

    event BrainMinted(
        uint256 indexed tokenId, address indexed owner, bytes32 storageRoot, bytes32 metadataHash
    );
    event StorageRootAppended(
        uint256 indexed tokenId, bytes32 storageRoot, bytes32 metadataHash, string description
    );
    event UsageAuthorized(uint256 indexed tokenId, address indexed agent, uint64 expiresAt);
    event UsageRevoked(uint256 indexed tokenId, address indexed agent);
    event BrainPayment(
        uint256 indexed tokenId,
        address indexed payer,
        address indexed brainOwner,
        uint256 amount,
        bytes32 queryHash
    );
    event OracleUpdated(address indexed oracle);
    event KeySealed(uint256 indexed tokenId, address indexed sealedFor, bytes sealedKey);
    event SecureTransferCompleted(uint256 indexed tokenId, address indexed from, address indexed to);

    // ============ Mint and append ============

    function mint(
        address to,
        bytes32 initialStorageRoot,
        bytes calldata encryptedURI,
        bytes32 metadataHash,
        string calldata description,
        bytes calldata sealedKey
    ) external returns (uint256 tokenId);

    function appendStorageRoot(
        uint256 tokenId,
        bytes32 storageRoot,
        bytes calldata encryptedURI,
        bytes32 metadataHash,
        string calldata description,
        bytes calldata sealedKey
    ) external;

    // ============ Usage authorization ============

    function authorizeUsage(uint256 tokenId, address agent, uint64 ttlSeconds) external payable;
    function revokeAuthorization(uint256 tokenId, address agent) external;
    function isAuthorized(uint256 tokenId, address agent) external view returns (bool);

    // ============ Canonical ERC-7857 secure transfer ============

    function setOracle(address oracle_) external;
    function oracle() external view returns (address);
    function secureTransfer(
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata oracleProof
    ) external;

    // ============ Views ============

    function intelligenceOf(uint256 tokenId) external view returns (IntelligentData[] memory);
    function currentStorageRoot(uint256 tokenId) external view returns (bytes32);
    function currentMetadataHash(uint256 tokenId) external view returns (bytes32);
    function currentEncryptedURI(uint256 tokenId) external view returns (bytes memory);
}
