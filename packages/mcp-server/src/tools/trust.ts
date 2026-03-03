import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createPublicClient, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import {
  agora402ReputationAbi,
  formatUsdc,
  type OnChainReputation,
} from "@agora402/core";

const REPUTATION_ADDRESS =
  (process.env.REPUTATION_CONTRACT_ADDRESS as Address) ??
  "0x2A216a829574e88dD632e7C95660d43bCE627CDf";

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

async function queryOnChainReputation(
  address: Address
): Promise<{ score: number; reputation: OnChainReputation }> {
  const [score, repData] = await Promise.all([
    publicClient.readContract({
      address: REPUTATION_ADDRESS,
      abi: agora402ReputationAbi,
      functionName: "getScore",
      args: [address],
    }),
    publicClient.readContract({
      address: REPUTATION_ADDRESS,
      abi: agora402ReputationAbi,
      functionName: "getReputation",
      args: [address],
    }),
  ]);

  const [
    totalCompleted,
    totalDisputed,
    totalRefunded,
    totalAsProvider,
    totalAsClient,
    totalVolume,
    firstSeen,
    lastSeen,
  ] = repData;

  return {
    score: Number(score),
    reputation: {
      totalCompleted: Number(totalCompleted),
      totalDisputed: Number(totalDisputed),
      totalRefunded: Number(totalRefunded),
      totalAsProvider: Number(totalAsProvider),
      totalAsClient: Number(totalAsClient),
      totalVolume,
      firstSeen,
      lastSeen,
    },
  };
}

export function registerTrustTools(server: McpServer): void {
  server.tool(
    "trust_score_query",
    "Look up the on-chain trust score of an agent address before transacting. Queries the Agora402 Reputation contract on Base Sepolia. Score is 0-100 based on escrow history.",
    {
      address: z
        .string()
        .describe("Ethereum address of the agent to look up"),
    },
    async ({ address }) => {
      try {
        const { score, reputation } = await queryOnChainReputation(
          address as Address
        );

        const totalEscrows =
          reputation.totalCompleted +
          reputation.totalDisputed +
          reputation.totalRefunded;

        // Unknown agent — no on-chain history
        if (totalEscrows === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    address,
                    score: 50,
                    source: "on-chain",
                    message:
                      "No on-chain escrow history found. This is a new/unknown agent — proceed with caution and use small escrow amounts.",
                    recommendation: "low_trust",
                    contract: REPUTATION_ADDRESS,
                    chain: "base-sepolia",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const successRate =
          totalEscrows > 0
            ? ((reputation.totalCompleted / totalEscrows) * 100).toFixed(1)
            : "0";

        let recommendation: string;
        if (score >= 80) recommendation = "high_trust";
        else if (score >= 50) recommendation = "moderate_trust";
        else recommendation = "low_trust";

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  address,
                  score,
                  source: "on-chain",
                  totalEscrows,
                  successfulEscrows: reputation.totalCompleted,
                  disputedEscrows: reputation.totalDisputed,
                  refundedEscrows: reputation.totalRefunded,
                  asProvider: reputation.totalAsProvider,
                  asClient: reputation.totalAsClient,
                  totalVolume: formatUsdc(reputation.totalVolume),
                  successRate: `${successRate}%`,
                  firstSeen:
                    reputation.firstSeen > 0n
                      ? new Date(
                          Number(reputation.firstSeen) * 1000
                        ).toISOString()
                      : null,
                  lastSeen:
                    reputation.lastSeen > 0n
                      ? new Date(
                          Number(reputation.lastSeen) * 1000
                        ).toISOString()
                      : null,
                  recommendation,
                  contract: REPUTATION_ADDRESS,
                  chain: "base-sepolia",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                address,
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to query on-chain reputation",
                fallback:
                  "Could not reach reputation contract. The agent may be on a different network or the contract is unavailable.",
              }),
            },
          ],
        };
      }
    }
  );
}
