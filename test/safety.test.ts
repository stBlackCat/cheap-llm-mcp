import test from "node:test";
import assert from "node:assert/strict";
import { buildRequestBody } from "../src/chat.js";
import { assertSafeToSend, CHINESE_DEFAULT_SYSTEM_PROMPT, redactError, STABILITY_DEFAULT_SYSTEM_PROMPT } from "../src/safety.js";

test("injects Chinese default system prompt", () => {
  const body = buildRequestBody(
    {
      prompt: "Summarize this",
      approvedForExternalApi: true,
      dataClassification: "public"
    },
    {}
  );
  const messages = body.messages as Array<{ role: string; content: string }>;
  assert.equal(messages[0].role, "system");
  assert.equal(messages[0].content, STABILITY_DEFAULT_SYSTEM_PROMPT);
  assert.equal(messages[1].content, CHINESE_DEFAULT_SYSTEM_PROMPT);
});

test("can disable Chinese default system prompt", () => {
  const body = buildRequestBody(
    {
      prompt: "Summarize this",
      approvedForExternalApi: true,
      dataClassification: "public"
    },
    { SIMPLE_LLM_CHINESE_DEFAULT: "false" }
  );
  const messages = body.messages as Array<{ role: string; content: string }>;
  assert.equal(messages[0].content, STABILITY_DEFAULT_SYSTEM_PROMPT);
  assert.equal(messages[1].role, "user");
});

test("keeps caller system prompt after Chinese default", () => {
  const body = buildRequestBody(
    {
      prompt: "Summarize this",
      system: "Return bullets.",
      approvedForExternalApi: true,
      dataClassification: "public"
    },
    {}
  );
  const messages = body.messages as Array<{ role: string; content: string }>;
  assert.equal(messages[0].content, STABILITY_DEFAULT_SYSTEM_PROMPT);
  assert.equal(messages[1].content, CHINESE_DEFAULT_SYSTEM_PROMPT);
  assert.equal(messages[2].content, "Return bullets.");
});

test("can disable stability default system prompt", () => {
  const body = buildRequestBody(
    {
      prompt: "Summarize this",
      approvedForExternalApi: true,
      dataClassification: "public"
    },
    { SIMPLE_LLM_STABILITY_DEFAULT: "false" }
  );
  const messages = body.messages as Array<{ role: string; content: string }>;
  assert.equal(messages[0].content, CHINESE_DEFAULT_SYSTEM_PROMPT);
});

test("rejects missing external API approval", () => {
  assert.throws(() => assertSafeToSend({ prompt: "hello", dataClassification: "public" }), /approvedForExternalApi/);
});

test("rejects missing data classification", () => {
  assert.throws(() => assertSafeToSend({ prompt: "hello", approvedForExternalApi: true }), /dataClassification/);
});

test("rejects sensitive data classification", () => {
  assert.throws(
    () => assertSafeToSend({ prompt: "hello", approvedForExternalApi: true, dataClassification: "sensitive" }),
    /sensitive/
  );
});

test("rejects secret-like prompts", () => {
  assert.throws(
    () =>
      assertSafeToSend({
        prompt: "token sk-123456789012345678901234567890",
        approvedForExternalApi: true,
        dataClassification: "public"
      }),
    /API key/
  );
});

test("rejects overlong prompt", () => {
  assert.throws(
    () =>
      assertSafeToSend(
        {
          prompt: "x".repeat(11),
          approvedForExternalApi: true,
          dataClassification: "public"
        },
        { SIMPLE_LLM_MAX_PROMPT_CHARS: "10" }
      ),
    /limit is 10/
  );
});

test("redacts secrets in provider errors", () => {
  const redacted = redactError(
    "bad key sk-real-secret-value and Bearer abcdefghijklmnopqrst",
    { name: "x", baseUrl: "https://example.com", model: "m", apiKeyEnv: "X_KEY" },
    "sk-real-secret-value",
    { X_KEY: "sk-real-secret-value" }
  );
  assert.equal(redacted.includes("sk-real-secret-value"), false);
  assert.equal(redacted.includes("Bearer abcdefghijklmnopqrst"), false);
});
