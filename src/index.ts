#!/usr/bin/env node
import { runDoctor } from "./doctor.js";
import { printConfig, runSetup } from "./setup.js";
import { startStdioServer } from "./server.js";

function printHelp(): void {
  process.stdout.write(`cheap-llm-mcp

Save premium-model tokens by routing simple tasks to cheap OpenAI-compatible LLMs.

Usage:
  cheap-llm-mcp                 Start the stdio MCP server
  cheap-llm-mcp setup           Interactive Claude Code/Codex setup
  cheap-llm-mcp doctor          Check local setup and MCP startup
  cheap-llm-mcp config          Print manual config snippets
  cheap-llm-mcp --help          Show this help

Examples:
  npx -y cheap-llm-mcp@latest setup
  npx -y cheap-llm-mcp@latest doctor
`);
}

async function main(): Promise<number> {
  const command = process.argv[2];
  if (!command) {
    await startStdioServer();
    return 0;
  }

  if (command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return 0;
  }

  if (command === "setup") {
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
      process.stdout.write("Usage: cheap-llm-mcp setup\n\nRuns an interactive setup wizard for Claude Code and Codex.\n");
      return 0;
    }
    return runSetup();
  }

  if (command === "doctor") {
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
      process.stdout.write("Usage: cheap-llm-mcp doctor\n\nChecks Node, npx, provider env vars, and MCP startup.\n");
      return 0;
    }
    return runDoctor();
  }

  if (command === "config") {
    printConfig();
    return 0;
  }

  process.stderr.write(`Unknown command: ${command}\n\n`);
  printHelp();
  return 1;
}

main()
  .then((code) => {
    if (code !== 0) {
      process.exitCode = code;
    }
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
