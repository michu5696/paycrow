// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Agora402Escrow} from "../src/Agora402Escrow.sol";
import {Agora402EscrowRouter} from "../src/Agora402EscrowRouter.sol";
import {Agora402Reputation} from "../src/Agora402Reputation.sol";

/// @notice Deploy ALL Agora402 contracts to Base MAINNET in a single broadcast.
///         This is the production deployment — real USDC, real money.
///
///         1. Agora402Escrow (with router + reputation support)
///         2. Agora402Reputation (on-chain trust ledger)
///         3. Agora402EscrowRouter (atomic x402 settlement)
///         4. Wire them together
contract DeployMainnetScript is Script {
    // Base mainnet USDC (Circle official)
    address constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint256 constant DEFAULT_FEE_BPS = 200; // 2%

    function run() external {
        address arbiter = vm.envAddress("ARBITER_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("=== Agora402 Base MAINNET Deployment ===");
        console.log("USDC:", BASE_MAINNET_USDC);
        console.log("Arbiter:", arbiter);
        console.log("Treasury:", treasury);
        console.log("Fee: 200 bps (2%)");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Escrow
        Agora402Escrow escrow = new Agora402Escrow(
            BASE_MAINNET_USDC,
            arbiter,
            treasury,
            DEFAULT_FEE_BPS
        );
        console.log("Agora402Escrow:      ", address(escrow));

        // 2. Deploy Reputation
        Agora402Reputation reputation = new Agora402Reputation();
        console.log("Agora402Reputation:  ", address(reputation));

        // 3. Deploy Router
        Agora402EscrowRouter router = new Agora402EscrowRouter(
            BASE_MAINNET_USDC,
            address(escrow)
        );
        console.log("Agora402EscrowRouter:", address(router));

        // 4. Wire: Escrow ↔ Reputation
        escrow.setReputation(address(reputation));
        reputation.setEscrowContract(address(escrow));

        // 5. Wire: Escrow ← Router (authorize)
        escrow.setRouter(address(router), true);

        console.log("");
        console.log("=== Wiring complete ===");
        console.log("Escrow.reputation:", address(escrow.reputation()));
        console.log("Reputation.escrowContract:", reputation.escrowContract());
        console.log("Router authorized:", escrow.authorizedRouters(address(router)));

        vm.stopBroadcast();
    }
}
