import test from "node:test";
import assert from "node:assert/strict";
import { buildRequestBody, stringifyResult } from "../src/chat.js";
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
  assert.match(messages[1].content, /默认使用简体中文回答/);
  assert.match(messages[1].content, /文件路径/);
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

test("does not cap output tokens unless maxTokens is provided", () => {
  const body = buildRequestBody(
    {
      prompt: "Summarize this",
      approvedForExternalApi: true,
      dataClassification: "public"
    },
    {}
  );
  assert.equal("max_tokens" in body, false);
});

test("defaults MiMo v2.5 requests to low reasoning effort", () => {
  const body = buildRequestBody(
    {
      prompt: "Reply ok",
      approvedForExternalApi: true,
      dataClassification: "public"
    },
    {
      CHEAP_LLM_MODEL: "mimo-v2.5-pro"
    }
  );
  assert.equal(body.reasoning_effort, "low");
});

test("lets caller override MiMo reasoning effort", () => {
  const body = buildRequestBody(
    {
      prompt: "Reply ok",
      extraBody: { reasoning_effort: "medium" },
      approvedForExternalApi: true,
      dataClassification: "public"
    },
    {
      CHEAP_LLM_MODEL: "mimo-v2.5-pro"
    }
  );
  assert.equal(body.reasoning_effort, "medium");
});

test("explains reasoning-only provider responses", () => {
  const text = stringifyResult(
    {
      choices: [{ message: { content: "", reasoning_content: "thinking only" }, finish_reason: "length" }],
      model: "mimo-v2.5-pro"
    },
    false
  );
  assert.match(text, /reasoning_content but no final message content/);
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
  const fakeKey = `sk-${"1".repeat(30)}`;
  assert.throws(
    () =>
      assertSafeToSend({
        prompt: `token ${fakeKey}`,
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
  const fakeKey = `sk-${"x".repeat(24)}`;
  const fakeBearer = `Bearer ${"a".repeat(24)}`;
  const redacted = redactError(
    `bad key ${fakeKey} and ${fakeBearer}`,
    { name: "x", baseUrl: "https://example.com", model: "m", apiKeyEnv: "X_KEY" },
    fakeKey,
    { X_KEY: fakeKey }
  );
  assert.equal(redacted.includes(fakeKey), false);
  assert.equal(redacted.includes(fakeBearer), false);
});
