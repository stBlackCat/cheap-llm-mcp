import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("stdio server exposes expected tools", async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: ["dist/index.js"] });
  const client = new Client({ name: "smoke-test", version: "0.0.0" });
  await client.connect(transport);
  const tools = await client.listTools();
  await client.close();
  const names = tools.tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, ["ask_simple_model", "check_simple_model_setup", "get_token_savings", "list_simple_model_providers"]);
});
