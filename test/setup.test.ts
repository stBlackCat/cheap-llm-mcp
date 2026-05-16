import test from "node:test";
import assert from "node:assert/strict";
import { buildClaudeCommand, buildCodexCommand, commandToString, commandsForSetup } from "../src/setup.js";

test("builds Claude Code npx install command", () => {
  const command = buildClaudeCommand({ provider: "deepseek", apiKey: "sk-test" });
  assert.deepEqual(command.slice(0, 7), ["claude", "mcp", "add", "--transport", "stdio", "--scope", "user"]);
  assert.equal(command.includes("cheap-llm"), true);
  assert.equal(commandToString(command).includes("npx -y cheap-llm-mcp@latest"), true);
});

test("builds Codex npx install command", () => {
  const command = buildCodexCommand({ provider: "qwen", apiKey: "sk-test" });
  assert.deepEqual(command.slice(0, 4), ["codex", "mcp", "add", "cheap-llm"]);
  assert.equal(commandToString(command).includes("QWEN_API_KEY=sk-test"), true);
});

test("setup dry run can target both clients", () => {
  const commands = commandsForSetup({
    clients: ["claude", "codex"],
    provider: "deepseek",
    apiKey: "sk-test",
    execute: false
  });
  assert.equal(commands.length, 2);
  assert.equal(commands[0][0], "claude");
  assert.equal(commands[1][0], "codex");
});
