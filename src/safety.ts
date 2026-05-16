import { envFlag, envNumber } from "./env.js";
import type { AskSimpleModelInput, ChatMessage, ProviderConfig } from "./types.js";

export const CHINESE_DEFAULT_SYSTEM_PROMPT =
  "默认使用简体中文回答。保留代码、命令、文件路径、API 名称、模型名称、错误信息、配置键、英文专有名词的原文；不要为了中文化而改写代码或命令。回答应简洁、直接、适合中文技术协作语境。若用户明确要求英文或双语，则遵循用户要求。";

export const STABILITY_DEFAULT_SYSTEM_PROMPT =
  "You are a cheap subtask model. Return a concise draft only. Do not make final decisions, claim to edit files, or assume missing facts. If the task is ambiguous or unsupported, say UNCERTAIN and why in one short sentence. The host AI will review your output before use.";

export function maxPromptChars(source: NodeJS.ProcessEnv = process.env): number {
  return envNumber("SIMPLE_LLM_MAX_PROMPT_CHARS", 12000, source);
}

export function shouldUseChineseDefault(source: NodeJS.ProcessEnv = process.env): boolean {
  return envFlag("SIMPLE_LLM_CHINESE_DEFAULT", true, source);
}

export function shouldUseStabilityDefault(source: NodeJS.ProcessEnv = process.env): boolean {
  return envFlag("SIMPLE_LLM_STABILITY_DEFAULT", true, source);
}

export function buildMessages(input: Pick<AskSimpleModelInput, "system" | "prompt">, source: NodeJS.ProcessEnv = process.env): ChatMessage[] {
  return [
    ...(shouldUseStabilityDefault(source) ? [{ role: "system" as const, content: STABILITY_DEFAULT_SYSTEM_PROMPT }] : []),
    ...(shouldUseChineseDefault(source) ? [{ role: "system" as const, content: CHINESE_DEFAULT_SYSTEM_PROMPT }] : []),
    ...(input.system ? [{ role: "system" as const, content: input.system }] : []),
    { role: "user" as const, content: input.prompt }
  ];
}

export function findSecretLikeText(text: string): string | undefined {
  const patterns: Array<[string, RegExp]> = [
    ["OpenAI-style API key", /\bsk-[A-Za-z0-9_\-]{20,}\b/],
    ["Bearer token", /\bBearer\s+[A-Za-z0-9._\-]{20,}\b/i],
    ["API key assignment", /\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*['"]?[^'"\s]{8,}/i],
    ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
    ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/]
  ];
  return patterns.find(([, pattern]) => pattern.test(text))?.[0];
}

export function assertSafeToSend(input: AskSimpleModelInput, source: NodeJS.ProcessEnv = process.env): void {
  if (input.approvedForExternalApi !== true) {
    throw new Error(
      "Refusing to call external provider: approvedForExternalApi must be true after confirming the prompt is safe to send to a third-party API."
    );
  }

  if (!input.dataClassification) {
    throw new Error("Refusing to call external provider: dataClassification must be public, internal, private, or sensitive.");
  }

  if (input.dataClassification === "sensitive") {
    throw new Error("Refusing to call external provider with dataClassification=sensitive.");
  }

  const combined = [input.system, input.prompt, input.extraBody ? JSON.stringify(input.extraBody) : undefined].filter(Boolean).join("\n\n");
  if (combined.length > maxPromptChars(source)) {
    throw new Error(`Refusing to call external provider: prompt is ${combined.length} chars, limit is ${maxPromptChars(source)}.`);
  }

  const secretMatch = findSecretLikeText(combined);
  if (secretMatch) {
    throw new Error(`Refusing to call external provider: prompt appears to contain ${secretMatch}.`);
  }
}

export function redactError(text: string, provider: ProviderConfig, apiKey: string, source: NodeJS.ProcessEnv = process.env): string {
  let redacted = text.replaceAll(apiKey, "[REDACTED_API_KEY]");
  if (provider.apiKeyEnv) {
    const envKey = source[provider.apiKeyEnv];
    if (envKey) {
      redacted = redacted.replaceAll(envKey, "[REDACTED_API_KEY]");
    }
  }
  redacted = redacted.replace(/\bsk-[A-Za-z0-9_\-]{12,}\b/g, "sk-[REDACTED]");
  redacted = redacted.replace(/\bBearer\s+[A-Za-z0-9._\-]{12,}\b/gi, "Bearer [REDACTED]");
  return redacted;
}
