import { z } from "zod";
import { env, envFlag, envNumber } from "./env.js";
import type { ProviderConfig } from "./types.js";

export const providerJsonSchema = z.array(
  z.object({
    name: z.string().min(1),
    baseUrl: z.string().url(),
    chatPath: z.string().optional(),
    apiKey: z.string().optional(),
    apiKeyEnv: z.string().optional(),
    apiKeyHeader: z.string().optional(),
    apiKeyPrefix: z.string().optional(),
    model: z.string().min(1),
    headers: z.record(z.string()).optional(),
    defaultBody: z.record(z.unknown()).optional(),
    timeoutMs: z.number().int().positive().optional()
  })
);

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function normalizePath(path: string | undefined): string {
  const selected = path ?? "/chat/completions";
  return selected.startsWith("/") ? selected : `/${selected}`;
}

export function endpointFor(provider: ProviderConfig): string {
  return `${normalizeBaseUrl(provider.baseUrl)}${normalizePath(provider.chatPath)}`;
}

export function authHeadersFor(provider: ProviderConfig, apiKey: string): Record<string, string> {
  const header = provider.apiKeyHeader ?? "Authorization";
  const rawPrefix = provider.apiKeyPrefix;
  const prefix =
    rawPrefix === undefined
      ? "Bearer "
      : ["", "none", "empty", "false", "off"].includes(rawPrefix.toLowerCase())
        ? ""
        : rawPrefix.endsWith(" ")
          ? rawPrefix
          : `${rawPrefix} `;
  return {
    [header]: `${prefix}${apiKey}`
  };
}

export function builtInProviders(source: NodeJS.ProcessEnv = process.env): ProviderConfig[] {
  const providers: ProviderConfig[] = [
    {
      name: "cheap",
      baseUrl: env("CHEAP_LLM_BASE_URL", source) ?? "https://api.deepseek.com",
      chatPath: env("CHEAP_LLM_CHAT_PATH", source),
      apiKeyEnv: "CHEAP_LLM_API_KEY",
      apiKeyHeader: env("CHEAP_LLM_API_KEY_HEADER", source),
      apiKeyPrefix: env("CHEAP_LLM_API_KEY_PREFIX", source),
      model: env("CHEAP_LLM_MODEL", source) ?? "deepseek-v4-flash",
      timeoutMs: envNumber("CHEAP_LLM_TIMEOUT_MS", envNumber("SIMPLE_LLM_TIMEOUT_MS", 60000, source), source)
    },
    {
      name: "deepseek",
      baseUrl: env("DEEPSEEK_BASE_URL", source) ?? "https://api.deepseek.com",
      chatPath: env("DEEPSEEK_CHAT_PATH", source),
      apiKeyEnv: "DEEPSEEK_API_KEY",
      model: env("DEEPSEEK_MODEL", source) ?? "deepseek-v4-flash",
      timeoutMs: envNumber("DEEPSEEK_TIMEOUT_MS", envNumber("SIMPLE_LLM_TIMEOUT_MS", 60000, source), source),
      defaultBody:
        env("DEEPSEEK_THINKING", source) === "enabled"
          ? { thinking: { type: "enabled", reasoning_effort: env("DEEPSEEK_REASONING_EFFORT", source) ?? "high" } }
          : { thinking: { type: "disabled" } }
    },
    {
      name: "mimo",
      baseUrl: env("MIMO_BASE_URL", source) ?? "https://api.xiaomimimo.com/v1",
      chatPath: env("MIMO_CHAT_PATH", source),
      apiKeyEnv: "MIMO_API_KEY",
      apiKeyHeader: env("MIMO_API_KEY_HEADER", source),
      apiKeyPrefix: env("MIMO_API_KEY_PREFIX", source),
      model: env("MIMO_MODEL", source) ?? "mimo-v2.5-pro",
      timeoutMs: envNumber("MIMO_TIMEOUT_MS", envNumber("SIMPLE_LLM_TIMEOUT_MS", 60000, source), source)
    },
    {
      name: "qwen",
      baseUrl: env("QWEN_BASE_URL", source) ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
      chatPath: env("QWEN_CHAT_PATH", source),
      apiKey: env("QWEN_API_KEY", source) ?? env("DASHSCOPE_API_KEY", source),
      apiKeyEnv: "QWEN_API_KEY",
      model: env("QWEN_MODEL", source) ?? "qwen-plus",
      timeoutMs: envNumber("QWEN_TIMEOUT_MS", envNumber("SIMPLE_LLM_TIMEOUT_MS", 60000, source), source)
    }
  ];

  return providers;
}

export function customProviders(source: NodeJS.ProcessEnv = process.env): ProviderConfig[] {
  const raw = env("SIMPLE_LLM_PROVIDERS", source);
  if (!raw) {
    return [];
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid SIMPLE_LLM_PROVIDERS JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const parsed = providerJsonSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Invalid SIMPLE_LLM_PROVIDERS: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function validateProvider(provider: ProviderConfig, source: NodeJS.ProcessEnv = process.env): void {
  const url = new URL(provider.baseUrl);
  if (url.protocol !== "https:" && !envFlag("SIMPLE_LLM_ALLOW_HTTP", false, source)) {
    throw new Error(`Provider "${provider.name}" must use https. Set SIMPLE_LLM_ALLOW_HTTP=true only for local testing.`);
  }
}

export function allProviders(source: NodeJS.ProcessEnv = process.env): ProviderConfig[] {
  const byName = new Map<string, ProviderConfig>();
  for (const provider of [...builtInProviders(source), ...customProviders(source)]) {
    validateProvider(provider, source);
    byName.set(provider.name, provider);
  }
  return [...byName.values()];
}

export function resolveProvider(name?: string, source: NodeJS.ProcessEnv = process.env): ProviderConfig {
  const providers = allProviders(source);
  const selectedName = name ?? env("SIMPLE_LLM_DEFAULT_PROVIDER", source) ?? "cheap";
  const provider = providers.find((candidate) => candidate.name === selectedName);
  if (!provider) {
    throw new Error(`Unknown provider "${selectedName}". Available providers: ${providers.map((p) => p.name).join(", ")}`);
  }
  return provider;
}

export function apiKeyFor(provider: ProviderConfig, source: NodeJS.ProcessEnv = process.env): string {
  const key = provider.apiKey ?? (provider.apiKeyEnv ? env(provider.apiKeyEnv, source) : undefined);
  if (!key) {
    const hint = provider.apiKeyEnv ? ` Set ${provider.apiKeyEnv}.` : "";
    throw new Error(`Missing API key for provider "${provider.name}".${hint}`);
  }
  return key;
}

export function providerSetupStatus(source: NodeJS.ProcessEnv = process.env): Array<Record<string, unknown>> {
  return allProviders(source).map((provider) => {
    const apiKey = provider.apiKey ?? (provider.apiKeyEnv ? env(provider.apiKeyEnv, source) : undefined);
    const url = new URL(provider.baseUrl);
    return {
      name: provider.name,
      model: provider.model,
      endpoint: endpointFor(provider),
      apiKeyEnv: provider.apiKeyEnv,
      apiKeyHeader: provider.apiKeyHeader ?? "Authorization",
      hasApiKey: Boolean(apiKey),
      https: url.protocol === "https:",
      timeoutMs: provider.timeoutMs ?? envNumber("SIMPLE_LLM_TIMEOUT_MS", 60000, source)
    };
  });
}
