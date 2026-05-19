import test from "node:test";
import assert from "node:assert/strict";
import { allProviders, authHeadersFor, endpointFor, resolveProvider } from "../src/providers.js";
import { formatFetchError } from "../src/chat.js";

test("loads generic cheap provider plus compatibility built-ins", () => {
  const providers = allProviders({});
  assert.deepEqual(
    providers.map((provider) => provider.name),
    ["cheap", "deepseek", "mimo", "qwen"]
  );
  assert.equal(resolveProvider(undefined, {}).name, "cheap");
  assert.equal(resolveProvider("cheap", {}).model, "deepseek-v4-flash");
  assert.equal(resolveProvider("deepseek", {}).model, "deepseek-v4-flash");
  assert.equal(resolveProvider("mimo", {}).model, "mimo-v2.5-pro");
  assert.equal(resolveProvider("qwen", {}).model, "qwen-plus");
});

test("uses Xiaomi MiMo OpenAI-compatible defaults", () => {
  const mimo = resolveProvider("mimo", {});
  assert.equal(endpointFor(mimo), "https://api.mimo-v2.com/v1/chat/completions");
  assert.deepEqual(authHeadersFor(mimo, "test-key"), { "api-key": "test-key" });
});

test("supports api-key auth header without bearer prefix", () => {
  const cheap = resolveProvider("cheap", {
    CHEAP_LLM_API_KEY_HEADER: "api-key",
    CHEAP_LLM_API_KEY_PREFIX: "none"
  });
  assert.deepEqual(authHeadersFor(cheap, "test-key"), { "api-key": "test-key" });
});

test("loads default request body from environment JSON", () => {
  const cheap = resolveProvider("cheap", {
    CHEAP_LLM_DEFAULT_BODY: JSON.stringify({ reasoning_effort: "low" })
  });
  assert.deepEqual(cheap.defaultBody, { reasoning_effort: "low" });
});

test("rejects invalid default request body JSON", () => {
  assert.throws(
    () =>
      resolveProvider("cheap", {
        CHEAP_LLM_DEFAULT_BODY: "[]"
      }),
    /expected a JSON object/
  );
});

test("loads custom OpenAI-compatible provider", () => {
  const providers = allProviders({
    SIMPLE_LLM_PROVIDERS: JSON.stringify([
      {
        name: "custom",
        baseUrl: "https://api.example.com/v1",
        chatPath: "chat/completions",
        apiKeyEnv: "CUSTOM_API_KEY",
        apiKeyHeader: "api-key",
        apiKeyPrefix: "none",
        model: "custom-model"
      }
    ])
  });
  const custom = providers.find((provider) => provider.name === "custom");
  assert.equal(custom?.model, "custom-model");
  assert.equal(endpointFor(custom!), "https://api.example.com/v1/chat/completions");
  assert.deepEqual(authHeadersFor(custom!, "test-key"), { "api-key": "test-key" });
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

test("includes fetch cause details in provider network errors", () => {
  const error = new TypeError("fetch failed", {
    cause: Object.assign(new Error("getaddrinfo ENOTFOUND api.example.invalid"), { code: "ENOTFOUND" })
  });
  const formatted = formatFetchError(error);
  assert.match(formatted, /fetch failed/);
  assert.match(formatted, /ENOTFOUND/);
  assert.match(formatted, /getaddrinfo/);
});
