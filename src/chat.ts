import { envNumber } from "./env.js";
import { apiKeyFor, authHeadersFor, endpointFor, resolveProvider } from "./providers.js";
import { assertSafeToSend, buildMessages, redactError } from "./safety.js";
import { recordUsage } from "./accounting.js";
import type { AskSimpleModelInput, ChatCompletionResponse, ProviderConfig } from "./types.js";

export function providerDefaultBody(provider: ProviderConfig, requestedModel?: string): Record<string, unknown> {
  const model = requestedModel ?? provider.model;
  if (/mimo-v2\.5/i.test(model)) {
    return {
      reasoning_effort: "low"
    };
  }
  return {};
}

export function buildRequestBody(input: AskSimpleModelInput, source: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const provider = resolveProvider(input.provider, source);
  const body: Record<string, unknown> = {
    ...providerDefaultBody(provider, input.model),
    ...provider.defaultBody,
    ...input.extraBody,
    model: input.model ?? provider.model,
    messages: buildMessages(input, source),
    temperature: input.temperature ?? 0.2,
    response_format: input.responseFormat ? { type: input.responseFormat } : undefined
  };
  if (input.maxTokens !== undefined) {
    body.max_tokens = input.maxTokens;
  }
  return body;
}

export function stringifyResult(response: ChatCompletionResponse, includeUsage: boolean): string {
  const choice = response.choices?.[0];
  const content = choice?.message?.content ?? "";
  const reasoning = choice?.message?.reasoning_content;
  const parts = [
    content.trim() ||
      (reasoning
        ? "UNCERTAIN: provider returned reasoning_content but no final message content; increase maxTokens or lower reasoning_effort."
        : "")
  ];

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

export function formatFetchError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause;
  const causeMessage =
    cause instanceof Error
      ? cause.message
      : cause && typeof cause === "object" && "message" in cause
        ? String((cause as { message: unknown }).message)
        : undefined;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause ? String((cause as { code: unknown }).code) : undefined;
  const details = [error.message, causeCode ? `cause code: ${causeCode}` : undefined, causeMessage ? `cause: ${causeMessage}` : undefined].filter(Boolean);
  return details.join("; ");
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
        "Content-Type": "application/json",
        ...provider.headers,
        ...authHeadersFor(provider, apiKey)
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Provider "${provider.name}" request timed out after ${timeoutMs}ms.`);
    }
    const message = formatFetchError(error);
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
