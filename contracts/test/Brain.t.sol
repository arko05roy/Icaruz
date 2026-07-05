// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";

import { Brain } from "../src/Brain.sol";
import { BrainOracle } from "../src/BrainOracle.sol";
import { IBrain } from "../src/IBrain.sol";
import { Errors } from "../src/lib/Errors.sol";

/// @dev Helper that accepts ERC721 mints (returns the magic selector) but
///      always reverts on plain ETH receive. Used to verify pull-payment
///      behaviour: a reverting brainOwner must not brick authorizeUsage.
contract RevertingReceiver {
    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    receive() external payable {
        revert("RevertingReceiver: not accepting ETH");
    }
}

contract BrainTest is Test {
    Brain brain;
    BrainOracle oracle;

    address owner = address(0xA11CE);
    address alice = address(0xA11CEB0B);
    address agent = address(0xBEEF);
    address mallory = address(0xBAD1);

    /// @dev Generate a deterministic attestor keypair so we can sign EIP-712
    ///      proofs from inside the tests.
    uint256 internal attestorPk = uint256(keccak256("brainpedia-test-attestor"));
    address internal attestor;

    function setUp() public {
        attestor = vm.addr(attestorPk);

        vm.startPrank(owner);
        brain = new Brain(owner);
        oracle = new BrainOracle(owner, attestor);
        brain.setOracle(address(oracle));
        vm.stopPrank();
    }

    // ============ Mint and append ============

    function test_mint_storesInitialIntelligence() public {
        bytes32 root = bytes32(uint256(0x1234));
        bytes32 mhash = keccak256("metadata-v1");
        bytes memory encURI = bytes("zg://encrypted/abc");
        bytes memory sealedKey = bytes("sealed-key-v1");

        vm.prank(owner);
        uint256 id = brain.mint(alice, root, encURI, mhash, "v1", sealedKey);

        assertEq(brain.ownerOf(id), alice);
        assertEq(brain.currentStorageRoot(id), root);
        assertEq(brain.currentMetadataHash(id), mhash);
        assertEq(brain.currentEncryptedURI(id), encURI);
        assertEq(brain.intelligenceOf(id).length, 1);
    }

    function test_appendStorageRoot_onlyOwnerCanAppend() public {
        vm.prank(owner);
        uint256 id = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");

        bytes32 newRoot = bytes32(uint256(2));
        bytes32 newHash = keccak256("metadata-v2");
        vm.prank(alice);
        brain.appendStorageRoot(id, newRoot, "", newHash, "v2", "");

        assertEq(brain.currentStorageRoot(id), newRoot);
        assertEq(brain.currentMetadataHash(id), newHash);
        assertEq(brain.intelligenceOf(id).length, 2);

        // Non-owner reverts
        vm.expectRevert(Errors.NotBrainOwner.selector);
        vm.prank(agent);
        brain.appendStorageRoot(id, bytes32(uint256(3)), "", bytes32(0), "v3", "");
    }

    // ============ Usage authorization ============

    function test_authorizeUsage_creditsPendingInsteadOfPushing() public {
        vm.prank(owner);
        uint256 id = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");

        vm.prank(alice);
        brain.setMinPayment(id, 1 ether);

        vm.deal(agent, 5 ether);
        uint256 aliceBalanceBefore = alice.balance;
        vm.prank(agent);
        brain.authorizeUsage{ value: 1 ether }(id, agent, 60);

        assertTrue(brain.isAuthorized(id, agent));
        // Pull-pattern: alice's wallet balance does NOT change here. Funds
        // are credited to pendingWithdrawals until alice pulls them.
        assertEq(alice.balance, aliceBalanceBefore);
        assertEq(brain.pendingWithdrawals(alice), 1 ether);
    }

    function test_withdraw_paysOwnerAndZeroesPending() public {
        vm.prank(owner);
        uint256 id = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");

        vm.deal(agent, 5 ether);
        vm.prank(agent);
        brain.authorizeUsage{ value: 2 ether }(id, agent, 60);

        uint256 aliceBalanceBefore = alice.balance;
        vm.prank(alice);
        brain.withdraw();
        assertEq(alice.balance, aliceBalanceBefore + 2 ether);
        assertEq(brain.pendingWithdrawals(alice), 0);
    }

    function test_withdraw_revertsWhenNothingPending() public {
        vm.expectRevert(Errors.ZeroAmount.selector);
        vm.prank(alice);
        brain.withdraw();
    }

    function test_authorizeUsage_revertsBelowMinPayment() public {
        vm.prank(owner);
        uint256 id = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");

        vm.prank(alice);
        brain.setMinPayment(id, 1 ether);

        vm.deal(agent, 1 ether);
        vm.expectRevert(Errors.InsufficientPayment.selector);
        vm.prank(agent);
        brain.authorizeUsage{ value: 0.5 ether }(id, agent, 60);
    }

    function test_isAuthorized_expiresOverTime() public {
        vm.prank(owner);
        uint256 id = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");
        vm.deal(agent, 1 ether);
        vm.prank(agent);
        brain.authorizeUsage{ value: 0 }(id, agent, 60);
        assertTrue(brain.isAuthorized(id, agent));
        vm.warp(block.timestamp + 61);
        assertFalse(brain.isAuthorized(id, agent));
    }

    /// @notice Audit finding #2: a third-party caller cannot shorten an
    ///         agent's existing authorization by paying for a tiny TTL.
    function test_authorizeUsage_extendOnly_cannotShortenExistingGrant() public {
        vm.prank(owner);
        uint256 id = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");

        // Agent gets a long authorization first.
        vm.deal(agent, 1 ether);
        vm.prank(agent);
        brain.authorizeUsage{ value: 0 }(id, agent, 1000);
        uint64 longExpiry = uint64(block.timestamp + 1000);

        // Mallory tries to grief by setting TTL = 1.
        vm.deal(mallory, 1 ether);
        vm.prank(mallory);
        brain.authorizeUsage{ value: 0 }(id, agent, 1);

        // After 100 seconds, agent is still authorized (the 1s TTL was rejected).
        vm.warp(block.timestamp + 100);
        assertTrue(brain.isAuthorized(id, agent));
    }

    function test_authorizeUsage_extendOnly_canExtendExistingGrant() public {
        vm.prank(owner);
        uint256 id = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");

        vm.prank(agent);
        brain.authorizeUsage{ value: 0 }(id, agent, 100);
        uint64 firstExpiry = uint64(block.timestamp + 100);

        // Second call with larger TTL extends.
        vm.prank(agent);
        brain.authorizeUsage{ value: 0 }(id, agent, 500);

        vm.warp(block.timestamp + 200);
        assertTrue(brain.isAuthorized(id, agent));
    }

    /// @notice Audit finding #7: a reverting brainOwner does not brick
    ///         authorizeUsage. Payment is credited to pendingWithdrawals.
    function test_authorizeUsage_revertingOwnerDoesNotBlock() public {
        RevertingReceiver evilOwner = new RevertingReceiver();
        vm.prank(owner);
        uint256 id = brain.mint(address(evilOwner), bytes32(uint256(1)), "", bytes32(0), "v1", "");

        vm.deal(agent, 5 ether);
        vm.prank(agent);
        // This MUST succeed even though the brain owner is a reverting contract.
        brain.authorizeUsage{ value: 1 ether }(id, agent, 60);

        assertTrue(brain.isAuthorized(id, agent));
        assertEq(brain.pendingWithdrawals(address(evilOwner)), 1 ether);
    }

    // ============ ERC-7857 canonical transfer ============

    function test_transferFrom_isBlocked() public {
        vm.prank(owner);
        uint256 id = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");

        vm.expectRevert(Errors.UseSecureTransfer.selector);
        vm.prank(alice);
        brain.transferFrom(alice, agent, id);
    }

    function test_safeTransferFrom_isBlocked() public {
        vm.prank(owner);
        uint256 id = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");

        vm.expectRevert(Errors.UseSecureTransfer.selector);
        vm.prank(alice);
        brain.safeTransferFrom(alice, agent, id, "");
    }

    function test_secureTransfer_revertsWithoutOracle() public {
        vm.prank(owner);
        Brain bareBrain = new Brain(owner);
        vm.prank(owner);
        uint256 id = bareBrain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");

        bytes memory proof =
            _validProof(id, alice, agent, bytes32(0), uint64(block.timestamp + 1 hours));

        vm.expectRevert(Errors.OracleNotSet.selector);
        vm.prank(alice);
        bareBrain.secureTransfer(agent, id, "", proof);
    }

    function test_secureTransfer_acceptsValidAttestorSignature() public {
        vm.prank(owner);
        uint256 id = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");

        bytes memory sealedKey = bytes("sealed-for-agent");
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory proof = _validProof(id, alice, agent, keccak256(sealedKey), deadline);

        vm.prank(alice);
        brain.secureTransfer(agent, id, sealedKey, proof);

        assertEq(brain.ownerOf(id), agent);
    }

    function test_secureTransfer_rejectsForgedSignature() public {
        vm.prank(owner);
        uint256 id = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");

        uint64 deadline = uint64(block.timestamp + 1 hours);
        uint256 wrongPk = uint256(keccak256("not-the-attestor"));
        bytes memory proof = _proofWithKey(wrongPk, id, alice, agent, bytes32(0), deadline);

        vm.expectRevert(Errors.InvalidSignature.selector);
        vm.prank(alice);
        brain.secureTransfer(agent, id, "", proof);
    }

    function test_secureTransfer_rejectsExpiredAttestation() public {
        vm.prank(owner);
        uint256 id = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");

        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory proof = _validProof(id, alice, agent, bytes32(0), deadline);

        vm.warp(uint256(deadline) + 1);

        vm.expectRevert(Errors.AttestationExpired.selector);
        vm.prank(alice);
        brain.secureTransfer(agent, id, "", proof);
    }

    /// @notice Audit finding #1 — proof signed for transfer to `agent` cannot
    ///         be reused to transfer to a different recipient.
    function test_secureTransfer_rejectsRecipientMismatch() public {
        vm.prank(owner);
        uint256 id = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");

        // Attestor signs proof for (id, alice, agent).
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory proof = _validProof(id, alice, agent, bytes32(0), deadline);

        // Alice tries to use that proof to transfer to mallory instead.
        vm.expectRevert(Errors.InvalidOracleProof.selector);
        vm.prank(alice);
        brain.secureTransfer(mallory, id, "", proof);
    }

    /// @notice Audit finding #1 — proof signed for one tokenId cannot be reused
    ///         for a different tokenId.
    function test_secureTransfer_rejectsTokenIdMismatch() public {
        vm.startPrank(owner);
        uint256 id1 = brain.mint(alice, bytes32(uint256(1)), "", bytes32(0), "v1", "");
        uint256 id2 = brain.mint(alice, bytes32(uint256(2)), "", bytes32(0), "v1", "");
        vm.stopPrank();

        // Attestor signs proof for tokenId=id1.
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory proofForId1 = _validProof(id1, alice, agent, bytes32(0), deadline);

        // Alice tries to use that proof to transfer id2.
        vm.expectRevert(Errors.InvalidOracleProof.selector);
        vm.prank(alice);
        brain.secureTransfer(agent, id2, "", proofForId1);
    }

    // ============ Admin guards ============

    function test_setOracle_revertsOnZeroAddress() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        vm.prank(owner);
        brain.setOracle(address(0));
    }

    // ============ EIP-712 helpers ============

    function _validProof(
        uint256 tokenId,
        address from,
        address to,
        bytes32 sealedKeyHash,
        uint64 deadline
    ) internal view returns (bytes memory) {
        return _proofWithKey(attestorPk, tokenId, from, to, sealedKeyHash, deadline);
    }

    function _proofWithKey(
        uint256 pk,
        uint256 tokenId,
        address from,
        address to,
        bytes32 sealedKeyHash,
        uint64 deadline
    ) internal view returns (bytes memory) {
        bytes32 digest = oracle.hashTransferAttestation(tokenId, from, to, sealedKeyHash, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);
        return abi.encode(tokenId, from, to, sealedKeyHash, deadline, sig);
    }
}
