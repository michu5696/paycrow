// ── CLI: `npx agora402 init` ────────────────────────────────────────
if (process.argv[2] === "init") {
  const { generatePrivateKey, privateKeyToAccount } = await import(
    "viem/accounts"
  );

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  console.log(`
  Agora402 — Agent Wallet Setup
  ─────────────────────────────

  Your new agent wallet:
    Address:     ${account.address}
    Private Key: ${privateKey}

  SAVE THE PRIVATE KEY — it cannot be recovered.

  Next steps:
    1. Fund the wallet with ETH (for gas) + USDC on Base
       Send to: ${account.address}

    2. Add to Claude Desktop config (~/.claude/claude_desktop_config.json):

       {
         "mcpServers": {
           "agora402": {
             "command": "npx",
             "args": ["agora402"],
             "env": {
               "PRIVATE_KEY": "${privateKey}"
             }
           }
         }
       }

    3. Restart Claude Desktop — your agent now has escrow protection.

  That's it. Your agent can now use:
    - x402_protected_call  — pay for APIs with escrow protection
    - escrow_create         — lock USDC in escrow
    - trust_score_query     — check any agent's reputation
`);

  process.exit(0);
}

// ── MCP Server (lazy imports — only loaded when actually serving) ────
const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = await import(
  "@modelcontextprotocol/sdk/server/stdio.js"
);
const { registerEscrowTools } = await import("./tools/escrow.js");
const { registerTrustTools } = await import("./tools/trust.js");
const { registerX402Tools } = await import("./tools/x402.js");

const server = new McpServer({
  name: "agora402",
  version: "0.2.0",
});

registerEscrowTools(server);
registerTrustTools(server);
registerX402Tools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
