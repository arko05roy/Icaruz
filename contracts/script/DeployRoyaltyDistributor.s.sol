// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {RoyaltyDistributor} from "../src/RoyaltyDistributor.sol";

/// @notice Deploy RoyaltyDistributor wired to the existing Brain.sol.
///
/// Required env:
///   PRIVATE_KEY       deployer key
///   ZG_INFT_CONTRACT_ADDRESS  Brain.sol address on Galileo
contract DeployRoyaltyDistributor is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address brain = vm.envAddress("ZG_INFT_CONTRACT_ADDRESS");

        vm.startBroadcast(pk);
        RoyaltyDistributor distributor = new RoyaltyDistributor(brain);
        vm.stopBroadcast();

        console.log("RoyaltyDistributor:", address(distributor));
        console.log("Brain.sol:         ", brain);
    }
}
