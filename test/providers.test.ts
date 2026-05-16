import test from "node:test";
import assert from "node:assert/strict";
import { allProviders, endpointFor, resolveProvider } from "../src/providers.js";

test("loads DeepSeek and Qwen built-ins", () => {
  const providers = allProviders({});
  assert.deepEqual(
    providers.map((provider) => provider.name),
    ["deepseek", "qwen"]
  );
  assert.equal(resolveProvider("deepseek", {}).model, "deepseek-chat");
  assert.equal(resolveProvider("qwen", {}).model, "qwen-plus");
});

test("loads MiMo when base URL and model are configured", () => {
  const providers = allProviders({
    MIMO_BASE_URL: "https://mimo.example.com/v1",
    MIMO_MODEL: "mimo-chat"
  });
  assert.ok(providers.some((provider) => provider.name === "mimo"));
});

test("loads custom OpenAI-compatible provider", () => {
  const providers = allProviders({
    SIMPLE_LLM_PROVIDERS: JSON.stringify([
      {
        name: "custom",
        baseUrl: "https://api.example.com/v1",
        chatPath: "chat/completions",
        apiKeyEnv: "CUSTOM_API_KEY",
        model: "custom-model"
      }
    ])
  });
  const custom = providers.find((provider) => provider.name === "custom");
  assert.equal(custom?.model, "custom-model");
  assert.equal(endpointFor(custom!), "https://api.example.com/v1/chat/completions");
});

test("rejects http providers by default", () => {
  assert.throws(
    () =>
      allProviders({
        SIMPLE_LLM_PROVIDERS: JSON.stringify([{ name: "local", baseUrl: "http://localhost:1234", model: "local" }])
      }),
    /must use https/
  );
});

test("allows http providers when explicitly enabled", () => {
  const providers = allProviders({
    SIMPLE_LLM_ALLOW_HTTP: "true",
    SIMPLE_LLM_PROVIDERS: JSON.stringify([{ name: "local", baseUrl: "http://localhost:1234", model: "local" }])
  });
  assert.ok(providers.some((provider) => provider.name === "local"));
});
