import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { providerSetupStatus } from "./providers.js";

function hasCommand(command: string): boolean {
  const result = spawnSync(process.platform === "win32" ? "where.exe" : "which", [command], { encoding: "utf8" });
  return result.status === 0;
}

export async function runDoctor(): Promise<number> {
  const checks: Array<[string, boolean, string, boolean]> = [];
  const major = Number(process.versions.node.split(".")[0]);
  checks.push(["Node.js >= 20", major >= 20, process.version, true]);
  checks.push(["npx available", hasCommand("npx"), "needed by Claude Code/Codex install commands", true]);
  checks.push(["claude available", hasCommand("claude"), "optional, needed for Claude Code auto setup", false]);
  checks.push(["codex available", hasCommand("codex"), "optional, needed for Codex auto setup", false]);

  let providersOk = false;
  let providerText = "";
  try {
    const providers = providerSetupStatus();
    providersOk = providers.some((provider) => provider.hasApiKey);
    providerText = JSON.stringify(providers, null, 2);
  } catch (error) {
    providerText = error instanceof Error ? error.message : String(error);
  }
  checks.push(["provider API key configured", providersOk, providerText, true]);

  let mcpOk = false;
  let mcpText = "";
  try {
    const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL("./index.js", import.meta.url))] });
    const client = new Client({ name: "cheap-llm-mcp-doctor", version: "0.0.0" });
    await client.connect(transport);
    const tools = await client.listTools();
    await client.close();
    const names = tools.tools.map((tool) => tool.name);
    mcpOk = ["ask_simple_model", "list_simple_model_providers", "check_simple_model_setup"].every((name) => names.includes(name));
    mcpText = names.join(", ");
  } catch (error) {
    mcpText = error instanceof Error ? error.message : String(error);
  }
  checks.push(["stdio MCP server starts", mcpOk, mcpText, true]);

  for (const [name, ok, detail] of checks) {
    process.stdout.write(`${ok ? "OK" : "WARN"} ${name}: ${detail}\n`);
  }

  return checks.every(([, ok, , required]) => ok || !required) ? 0 : 1;
}
