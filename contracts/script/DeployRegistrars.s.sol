// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {SubnameRegistrar} from "../src/SubnameRegistrar.sol";
import {AccessTokenRegistrar} from "../src/AccessTokenRegistrar.sol";

/// @notice Deploys the two ENS registrars — used on Sepolia (or mainnet).
///
/// Required env (sourced from contracts/.env.deploy via prep-deploy):
///   PRIVATE_KEY            deployer key
///   ENS_REGISTRY           ENS Registry address
///   ENS_PUBLIC_RESOLVER    ENS Public Resolver address
///   ENS_PARENT_NODE        namehash(parentName) — bytes32
///   ENS_CLIENT_PARENT_NODE namehash("client." + parentName) — bytes32
contract DeployRegistrars is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address ensRegistry = vm.envAddress("ENS_REGISTRY");
        address resolver = vm.envAddress("ENS_PUBLIC_RESOLVER");
        bytes32 parentNode = vm.envBytes32("ENS_PARENT_NODE");
        bytes32 clientParentNode = vm.envBytes32("ENS_CLIENT_PARENT_NODE");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        SubnameRegistrar subnames = new SubnameRegistrar(
            ensRegistry,
            resolver,
            parentNode,
            deployer
        );
        AccessTokenRegistrar accessTokens = new AccessTokenRegistrar(
            ensRegistry,
            resolver,
            clientParentNode,
            deployer
        );
        vm.stopBroadcast();

        console.log("SubnameRegistrar:     ", address(subnames));
        console.log("AccessTokenRegistrar: ", address(accessTokens));
        console.log("Deployer:             ", deployer);
    }
}
