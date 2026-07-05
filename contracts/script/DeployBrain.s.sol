// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Brain} from "../src/Brain.sol";
import {BrainOracle} from "../src/BrainOracle.sol";

/// @notice Deploys Brain.sol + BrainOracle.sol and wires them together.
///         Brain.setOracle(BrainOracle) is called in the same broadcast so
///         the iNFT is canonical-ERC-7857 from block one. Used on 0G mainnet
///         (Aristotle, chain id 16661) and on the Galileo testnet.
///
/// Required env:
///   PRIVATE_KEY              deployer key (becomes initialOwner of both)
///   ORACLE_ATTESTOR_ADDRESS  EOA that signs TransferAttestation EIP-712 proofs.
///                            For mainnet demo this is the Brainpedia operator
///                            address; production swaps in a 0G Compute TEE
///                            attestor.
contract DeployBrain is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address attestor = vm.envAddress("ORACLE_ATTESTOR_ADDRESS");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        Brain brain = new Brain(deployer);
        BrainOracle oracle = new BrainOracle(deployer, attestor);
        brain.setOracle(address(oracle));
        vm.stopBroadcast();

        console.log("Brain:        ", address(brain));
        console.log("BrainOracle:  ", address(oracle));
        console.log("Attestor:     ", attestor);
        console.log("Deployer:     ", deployer);
    }
}
