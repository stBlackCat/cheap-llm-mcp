import test from "node:test";
import assert from "node:assert/strict";
import { getUsageSummary, recordUsage, resetUsage } from "../src/accounting.js";

test("summarizes provider-reported cheap model tokens", () => {
  resetUsage();
  recordUsage({
    provider: "deepseek",
    requestedModel: "deepseek-chat",
    response: {
      model: "deepseek-chat",
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      }
    }
  });
  recordUsage({
    provider: "qwen",
    requestedModel: "qwen-plus",
    response: {
      model: "qwen-plus",
      usage: {
        prompt_tokens: 20,
        completion_tokens: 7,
        total_tokens: 27
      }
    }
  });

  const summary = getUsageSummary();
  assert.equal(summary.calls, 2);
  assert.equal(summary.callsWithUsage, 2);
  assert.equal(summary.callsWithoutUsage, 0);
  assert.equal(summary.cheapModelPromptTokens, 30);
  assert.equal(summary.cheapModelCompletionTokens, 12);
  assert.equal(summary.cheapModelTotalTokens, 42);
  assert.equal(summary.estimatedPremiumTokensAvoided, 42);
  assert.equal(summary.byProviderModel.length, 2);
});

test("counts calls without provider usage", () => {
  resetUsage();
  recordUsage({
    provider: "custom",
    requestedModel: "model",
    response: {
      model: "model"
    }
  });

  const summary = getUsageSummary();
  assert.equal(summary.calls, 1);
  assert.equal(summary.callsWithUsage, 0);
  assert.equal(summary.callsWithoutUsage, 1);
  assert.equal(summary.cheapModelTotalTokens, 0);
});

test("resets usage counters", () => {
  resetUsage();
  recordUsage({
    provider: "deepseek",
    requestedModel: "deepseek-chat",
    response: {
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2
      }
    }
  });
  resetUsage();
  assert.equal(getUsageSummary().calls, 0);
});
