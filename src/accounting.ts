import { appendFile } from "node:fs/promises";
import { env } from "./env.js";
import type { ChatCompletionResponse } from "./types.js";

export type UsageEntry = {
  timestamp: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  hasUsage: boolean;
};

export type UsageSummary = {
  startedAt: string;
  calls: number;
  callsWithUsage: number;
  callsWithoutUsage: number;
  cheapModelPromptTokens: number;
  cheapModelCompletionTokens: number;
  cheapModelTotalTokens: number;
  estimatedPremiumTokensAvoided: number;
  byProviderModel: Array<{
    provider: string;
    model: string;
    calls: number;
    callsWithUsage: number;
    callsWithoutUsage: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>;
  notes: string[];
};

const startedAt = new Date().toISOString();
const entries: UsageEntry[] = [];

function numberOrZero(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function recordUsage(input: {
  provider: string;
  requestedModel: string;
  response: ChatCompletionResponse;
  source?: NodeJS.ProcessEnv;
}): void {
  const usage = input.response.usage;
  const entry: UsageEntry = {
    timestamp: new Date().toISOString(),
    provider: input.provider,
    model: input.response.model ?? input.requestedModel,
    promptTokens: numberOrZero(usage?.prompt_tokens),
    completionTokens: numberOrZero(usage?.completion_tokens),
    totalTokens: numberOrZero(usage?.total_tokens),
    hasUsage: Boolean(usage)
  };
  entries.push(entry);

  const logPath = env("SIMPLE_LLM_USAGE_LOG", input.source);
  if (logPath) {
    appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8").catch(() => {
      // Usage logging must never break the MCP tool response.
    });
  }
}

export function resetUsage(): void {
  entries.length = 0;
}

export function getUsageSummary(): UsageSummary {
  const byKey = new Map<string, UsageSummary["byProviderModel"][number]>();
  const totals = {
    calls: 0,
    callsWithUsage: 0,
    callsWithoutUsage: 0,
    cheapModelPromptTokens: 0,
    cheapModelCompletionTokens: 0,
    cheapModelTotalTokens: 0
  };

  for (const entry of entries) {
    totals.calls += 1;
    totals.callsWithUsage += entry.hasUsage ? 1 : 0;
    totals.callsWithoutUsage += entry.hasUsage ? 0 : 1;
    totals.cheapModelPromptTokens += entry.promptTokens;
    totals.cheapModelCompletionTokens += entry.completionTokens;
    totals.cheapModelTotalTokens += entry.totalTokens;

    const key = `${entry.provider}\u0000${entry.model}`;
    const bucket =
      byKey.get(key) ??
      {
        provider: entry.provider,
        model: entry.model,
        calls: 0,
        callsWithUsage: 0,
        callsWithoutUsage: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };
    bucket.calls += 1;
    bucket.callsWithUsage += entry.hasUsage ? 1 : 0;
    bucket.callsWithoutUsage += entry.hasUsage ? 0 : 1;
    bucket.promptTokens += entry.promptTokens;
    bucket.completionTokens += entry.completionTokens;
    bucket.totalTokens += entry.totalTokens;
    byKey.set(key, bucket);
  }

  return {
    startedAt,
    ...totals,
    estimatedPremiumTokensAvoided: totals.cheapModelTotalTokens,
    byProviderModel: [...byKey.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    notes: [
      "Only provider-reported usage is counted as actual cheap-model tokens.",
      "estimatedPremiumTokensAvoided is a rough token-volume proxy, not a billing guarantee.",
      "Host AI review tokens are not tracked by this MCP server."
    ]
  };
}
