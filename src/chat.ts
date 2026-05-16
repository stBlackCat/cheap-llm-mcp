import { envNumber } from "./env.js";
import { apiKeyFor, endpointFor, resolveProvider } from "./providers.js";
import { assertSafeToSend, buildMessages, redactError } from "./safety.js";
import { recordUsage } from "./accounting.js";
import type { AskSimpleModelInput, ChatCompletionResponse } from "./types.js";

export function buildRequestBody(input: AskSimpleModelInput, source: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const provider = resolveProvider(input.provider, source);
  return {
    ...provider.defaultBody,
    ...input.extraBody,
    model: input.model ?? provider.model,
    messages: buildMessages(input, source),
    temperature: input.temperature ?? 0.2,
    max_tokens: input.maxTokens ?? 800,
    response_format: input.responseFormat ? { type: input.responseFormat } : undefined
  };
}

export function stringifyResult(response: ChatCompletionResponse, includeUsage: boolean): string {
  const choice = response.choices?.[0];
  const content = choice?.message?.content ?? "";
  const reasoning = choice?.message?.reasoning_content;
  const parts = [content.trim()];

  if (includeUsage && response.usage) {
    parts.push(
      [
        "",
        "---",
        `model: ${response.model ?? "unknown"}`,
        `finish_reason: ${choice?.finish_reason ?? "unknown"}`,
        `prompt_tokens: ${response.usage.prompt_tokens ?? "unknown"}`,
        `completion_tokens: ${response.usage.completion_tokens ?? "unknown"}`,
        `total_tokens: ${response.usage.total_tokens ?? "unknown"}`
      ].join("\n")
    );
  }

  if (reasoning && includeUsage) {
    parts.push(["", "---", "reasoning_content:", reasoning.trim()].join("\n"));
  }

  return parts.filter(Boolean).join("\n");
}

export async function callChatCompletion(input: AskSimpleModelInput, source: NodeJS.ProcessEnv = process.env): Promise<string> {
  assertSafeToSend(input, source);
  const provider = resolveProvider(input.provider, source);
  const apiKey = apiKeyFor(provider, source);
  const body = buildRequestBody(input, source);

  const controller = new AbortController();
  const timeoutMs = input.requestTimeoutMs ?? provider.timeoutMs ?? envNumber("SIMPLE_LLM_TIMEOUT_MS", 60000, source);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(endpointFor(provider), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...provider.headers
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Provider "${provider.name}" request timed out after ${timeoutMs}ms.`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Provider "${provider.name}" request failed: ${redactError(message, provider, apiKey, source)}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Provider "${provider.name}" returned HTTP ${response.status}: ${redactError(text, provider, apiKey, source).slice(0, 1000)}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  recordUsage({
    provider: provider.name,
    requestedModel: input.model ?? provider.model,
    response: data,
    source
  });
  return stringifyResult(data, input.includeUsage ?? false);
}
