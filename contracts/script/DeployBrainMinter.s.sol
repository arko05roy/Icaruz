// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {BrainMinter} from "../src/BrainMinter.sol";

interface IBrainOwnable {
    function transferOwnership(address newOwner) external;
}

/// @notice Deploy BrainMinter wrapping the existing Brain.sol, then transfer
///         Brain.sol ownership to BrainMinter so anyone can self-mint.
///
/// Required env:
///   PRIVATE_KEY               deployer key (must currently own Brain.sol)
///   ZG_INFT_CONTRACT_ADDRESS  Brain.sol address on Galileo
///   MINT_FEE_WEI              optional anti-spam fee (default 0)
contract DeployBrainMinter is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address brainAddr = vm.envAddress("ZG_INFT_CONTRACT_ADDRESS");
        uint256 fee = vm.envOr("MINT_FEE_WEI", uint256(0));
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        BrainMinter minter = new BrainMinter(brainAddr, fee, deployer);
        // Hand Brain.sol's ownership to the minter so its mint() (onlyOwner)
        // can be called by the wrapper on behalf of any msg.sender. Brain
        // uses Ownable2Step, so this is a 2-call dance: deployer initiates,
        // then BrainMinter accepts via its claimBrainOwnership() wrapper.
        IBrainOwnable(brainAddr).transferOwnership(address(minter));
        minter.claimBrainOwnership();
        vm.stopBroadcast();

        console.log("BrainMinter:        ", address(minter));
        console.log("Brain.sol:          ", brainAddr);
        console.log("Brain new owner:    ", address(minter));
        console.log("Mint fee (wei):     ", fee);
        console.log("Minter admin:       ", deployer);
    }
}
