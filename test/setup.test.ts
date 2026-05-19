import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClaudeCommand,
  buildCodexCommand,
  commandToString,
  commandsForSetup,
  envPairsForProvider,
  validateProviderAnswers
} from "../src/setup.js";

test("builds Claude Code npx install command", () => {
  const command = buildClaudeCommand({ apiKey: "sk-test", baseUrl: "https://api.example.com/v1", model: "cheap-model" });
  assert.deepEqual(command.slice(0, 7), ["claude", "mcp", "add", "--transport", "stdio", "--scope", "user"]);
  assert.equal(command.includes("cheap-llm"), true);
  assert.equal(commandToString(command).includes("npx -y cheap-llm-mcp@latest"), true);
  assert.equal(commandToString(command).includes("CHEAP_LLM_BASE_URL=https://api.example.com/v1"), true);
});

test("builds Codex npx install command", () => {
  const command = buildCodexCommand({ apiKey: "sk-test", baseUrl: "https://api.example.com/v1", model: "cheap-model" });
  assert.deepEqual(command.slice(0, 4), ["codex", "mcp", "add", "cheap-llm"]);
  assert.equal(commandToString(command).includes("CHEAP_LLM_API_KEY=sk-test"), true);
});

test("redacts API keys in displayed commands", () => {
  const command = buildCodexCommand({ apiKey: "sk-test", baseUrl: "https://api.example.com/v1", model: "cheap-model" });
  const displayed = commandToString(command, { redactSecrets: true });
  assert.equal(displayed.includes("sk-test"), false);
  assert.equal(displayed.includes("CHEAP_LLM_API_KEY=<YOUR_API_KEY>"), true);
});

test("builds Xiaomi MiMo preset config", () => {
  const command = buildCodexCommand({ preset: "mimo", apiKey: "mimo-test-key" });
  const displayed = commandToString(command, { redactSecrets: true });
  assert.equal(displayed.includes("CHEAP_LLM_BASE_URL=https://api.mimo-v2.com/v1"), true);
  assert.equal(displayed.includes("CHEAP_LLM_MODEL=mimo-v2.5-pro"), true);
  assert.equal(displayed.includes("CHEAP_LLM_API_KEY_HEADER=api-key"), true);
  assert.equal(displayed.includes("CHEAP_LLM_API_KEY_PREFIX=none"), true);
  assert.equal(displayed.includes("mimo-test-key"), false);
});

test("uses Authorization Bearer defaults for Xiaomi token-plan endpoint", () => {
  const command = buildCodexCommand({
    preset: "mimo",
    baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
    apiKey: "mimo-test-key"
  });
  const displayed = commandToString(command, { redactSecrets: true });
  assert.equal(displayed.includes("CHEAP_LLM_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1"), true);
  assert.equal(displayed.includes("CHEAP_LLM_API_KEY_HEADER=Authorization"), true);
  assert.equal(displayed.includes("CHEAP_LLM_API_KEY_PREFIX=Bearer"), true);
});

test("normalizes known Xiaomi MiMo model casing", () => {
  const env = envPairsForProvider({
    preset: "mimo",
    model: "MiMo-V2.5-Pro",
    apiKey: "mimo-test-key"
  });
  assert.equal(env.CHEAP_LLM_MODEL, "mimo-v2.5-pro");
});

test("builds Qwen preset config", () => {
  const command = buildCodexCommand({ preset: "qwen", apiKey: "qwen-test-key" });
  const displayed = commandToString(command, { redactSecrets: true });
  assert.equal(displayed.includes("CHEAP_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1"), true);
  assert.equal(displayed.includes("CHEAP_LLM_MODEL=qwen-plus"), true);
  assert.equal(displayed.includes("CHEAP_LLM_API_KEY_HEADER=Authorization"), true);
  assert.equal(displayed.includes("CHEAP_LLM_API_KEY_PREFIX=Bearer"), true);
  assert.equal(displayed.includes("qwen-test-key"), false);
});

test("builds runtime env for api-key header connectivity checks", () => {
  const env = envPairsForProvider({
    preset: "mimo",
    apiKey: "mimo-test-key",
    apiKeyHeader: "api-key",
    apiKeyPrefix: "none"
  });
  assert.equal(env.CHEAP_LLM_BASE_URL, "https://api.mimo-v2.com/v1");
  assert.equal(env.CHEAP_LLM_MODEL, "mimo-v2.5-pro");
  assert.equal(env.CHEAP_LLM_API_KEY_HEADER, "api-key");
  assert.equal(env.CHEAP_LLM_API_KEY_PREFIX, "none");
  assert.equal(env.CHEAP_LLM_API_KEY, "mimo-test-key");
});

test("rejects likely token fragments entered as auth header settings", () => {
  assert.throws(
    () =>
      validateProviderAnswers({
        preset: "mimo",
        apiKeyHeader: "tp",
        apiKeyPrefix: "ctyxa8rn1ttmqnc5vg2ulh9257gij6zwkeewezkt2k276pc0",
        apiKey: "tp-redacted"
      }),
    /token fragments/
  );
});

test("setup dry run can target both clients", () => {
  const commands = commandsForSetup({
    clients: ["claude", "codex"],
    apiKey: "sk-test",
    execute: false
  });
  assert.equal(commands.length, 2);
  assert.equal(commands[0][0], "claude");
  assert.equal(commands[1][0], "codex");
});
