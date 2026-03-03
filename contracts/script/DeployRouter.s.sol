// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Agora402EscrowRouter} from "../src/Agora402EscrowRouter.sol";
import {Agora402Escrow} from "../src/Agora402Escrow.sol";

/// @notice Deploy Agora402EscrowRouter and authorize it on the existing escrow contract
contract DeployRouterScript is Script {
    address constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        address escrowAddress = vm.envAddress("ESCROW_CONTRACT_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy router
        Agora402EscrowRouter router = new Agora402EscrowRouter(
            BASE_SEPOLIA_USDC,
            escrowAddress
        );
        console.log("Agora402EscrowRouter deployed at:", address(router));

        // Authorize router on escrow contract
        Agora402Escrow escrow = Agora402Escrow(escrowAddress);
        escrow.setRouter(address(router), true);
        console.log("Router authorized on escrow contract");

        // Verify
        bool isAuthorized = escrow.authorizedRouters(address(router));
        console.log("Router authorized:", isAuthorized);

        vm.stopBroadcast();
    }
}
