/**
 * PayCrow Seller Middleware
 *
 * Drop-in middleware for x402 service providers to require escrow protection.
 * When added to an x402 endpoint, the 402 response includes a PayCrow extension
 * that tells buyer agents: "Use PayCrow escrow to pay for this service."
 *
 * This is the PayPal playbook: sellers add "PayCrow protected" to their APIs,
 * which drives buyer agents to install and use PayCrow.
 *
 * Usage for service providers:
 *
 *   import { paycrowRequired } from "@paycrow/trust";
 *
 *   // Add to your x402 payment requirements
 *   const requirements = {
 *     x402Version: 2,
 *     accepts: [{ scheme: "exact", amount: "1000", ... }],
 *     extensions: {
 *       ...paycrowRequired({
 *         seller: "0xYourAddress",
 *         minTrustScore: 0,        // optional: require buyer trust score
 *         maxAmount: 100,           // optional: max payment amount
 *         disputeWindow: 30,        // optional: minutes for dispute window
 *       }),
 *     },
 *   };
 *
 * What buyer agents see in the 402 response:
 *
 *   {
 *     "extensions": {
 *       "paycrow": {
 *         "escrowRequired": true,
 *         "version": "1.2.0",
 *         "seller": "0x...",
 *         "escrowContract": "0xDcA5...",
 *         "trustApiUrl": "https://paycrow-app.fly.dev",
 *         "mcpPackage": "paycrow",
 *         "minTrustScore": 0,
 *         "maxAmount": 100,
 *         "disputeWindowMinutes": 30,
 *         "instructions": "Install paycrow MCP server and use safe_pay to pay this endpoint."
 *       }
 *     }
 *   }
 */

import { ESCROW_ADDRESSES } from "@paycrow/core";

export interface PayCrowRequiredConfig {
  /** Seller's Ethereum address (receives payment after escrow release) */
  seller: string;
  /** Minimum trust score required from the buyer (0-100, default: 0 = no minimum) */
  minTrustScore?: number;
  /** Maximum payment amount in USDC (default: 100) */
  maxAmount?: number;
  /** Dispute window in minutes (default: 30) */
  disputeWindow?: number;
  /** Chain: "base" or "base-sepolia" (default: "base") */
  chain?: "base" | "base-sepolia";
  /** Custom trust API URL (default: https://paycrow-app.fly.dev) */
  trustApiUrl?: string;
}

export interface PayCrowExtension {
  paycrow: {
    escrowRequired: true;
    version: string;
    seller: string;
    escrowContract: string;
    chain: string;
    trustApiUrl: string;
    mcpPackage: string;
    installCommand: string;
    minTrustScore: number;
    maxAmount: number;
    disputeWindowMinutes: number;
    instructions: string;
  };
}

/**
 * Generate the PayCrow extension for x402 PaymentRequirements.
 *
 * Add this to your 402 response's `extensions` field to tell buyer agents
 * that this endpoint requires escrow-protected payment via PayCrow.
 *
 * @example
 * ```ts
 * const requirements = {
 *   x402Version: 2,
 *   accepts: [{ scheme: "exact", amount: "1000", ... }],
 *   extensions: {
 *     ...paycrowRequired({ seller: "0xYourAddress" }),
 *   },
 * };
 * ```
 */
export function paycrowRequired(config: PayCrowRequiredConfig): PayCrowExtension {
  const chain = config.chain ?? "base";
  const chainId = chain === "base" ? 8453 : 84532;
  const escrowContract = ESCROW_ADDRESSES[chainId];
  const trustApiUrl = config.trustApiUrl ?? "https://paycrow-app.fly.dev";

  return {
    paycrow: {
      escrowRequired: true,
      version: "1.2.0",
      seller: config.seller,
      escrowContract: escrowContract ?? "",
      chain,
      trustApiUrl,
      mcpPackage: "paycrow",
      installCommand: "npx paycrow",
      minTrustScore: config.minTrustScore ?? 0,
      maxAmount: config.maxAmount ?? 100,
      disputeWindowMinutes: config.disputeWindow ?? 30,
      instructions: `This endpoint requires escrow-protected payment via PayCrow. Install the MCP server (npm install -g paycrow) and use the safe_pay tool to pay. Your payment will be held in escrow until delivery is verified. Trust score check: ${trustApiUrl}/trust/${config.seller}`,
    },
  };
}

/**
 * Check if a 402 response requires PayCrow escrow.
 *
 * Use this on the buyer/agent side to detect when a service
 * requires escrow-protected payment.
 *
 * @example
 * ```ts
 * const res = await fetch(url);
 * if (res.status === 402) {
 *   const requirements = await res.json();
 *   const escrow = detectPayCrowRequirement(requirements);
 *   if (escrow) {
 *     // Route through safe_pay instead of direct payment
 *     console.log(`Escrow required. Seller: ${escrow.seller}`);
 *   }
 * }
 * ```
 */
export function detectPayCrowRequirement(
  paymentRequirements: Record<string, unknown>
): PayCrowExtension["paycrow"] | null {
  const extensions = paymentRequirements.extensions as Record<string, unknown> | undefined;
  if (!extensions) return null;

  const paycrow = extensions.paycrow as PayCrowExtension["paycrow"] | undefined;
  if (!paycrow || !paycrow.escrowRequired) return null;

  return paycrow;
}
