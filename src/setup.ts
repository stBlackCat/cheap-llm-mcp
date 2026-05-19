import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { callChatCompletion } from "./chat.js";

type Client = "claude" | "codex";
type ProviderPreset = "deepseek" | "mimo" | "qwen" | "custom";
type AuthMode = "default" | "api-key" | "bearer" | "custom";

export type ProviderAnswers = {
  preset?: ProviderPreset;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  chatPath?: string;
  apiKeyHeader?: string;
  apiKeyPrefix?: string;
};

export type SetupOptions = ProviderAnswers & {
  clients: Client[];
  execute?: boolean;
  testConnection?: boolean;
};

const PACKAGE_SPEC = "cheap-llm-mcp@latest";
const SERVER_NAME = "cheap-llm";
const SECRET_PLACEHOLDER = "<YOUR_API_KEY>";
const PROVIDER_PRESETS: Record<ProviderPreset, Required<Pick<ProviderAnswers, "baseUrl" | "model" | "chatPath" | "apiKeyHeader" | "apiKeyPrefix">>> = {
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    chatPath: "/chat/completions",
    apiKeyHeader: "Authorization",
    apiKeyPrefix: "Bearer"
  },
  mimo: {
    baseUrl: "https://api.mimo-v2.com/v1",
    model: "mimo-v2.5-pro",
    chatPath: "/chat/completions",
    apiKeyHeader: "api-key",
    apiKeyPrefix: "none"
  },
  qwen: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    chatPath: "/chat/completions",
    apiKeyHeader: "Authorization",
    apiKeyPrefix: "Bearer"
  },
  custom: {
    baseUrl: "https://api.example.com/v1",
    model: "model-id",
    chatPath: "/chat/completions",
    apiKeyHeader: "Authorization",
    apiKeyPrefix: "Bearer"
  }
};

function isSecretName(name: string): boolean {
  return /(TOKEN|SECRET|PASSWORD)$/i.test(name) || /(^|_)API_?KEY$/i.test(name);
}

function looksLikeTokenFragment(value: string | undefined): boolean {
  return Boolean(value && /^[A-Za-z0-9_\-.]{20,}$/.test(value));
}

function providerExtraBody(answer: ProviderAnswers): Record<string, unknown> | undefined {
  const model = answer.model ?? PROVIDER_PRESETS[answer.preset ?? "deepseek"].model;
  if (/mimo-v2\.5/i.test(model)) {
    return {
      reasoning_effort: "low"
    };
  }
  return undefined;
}

export function validateProviderAnswers(answer: ProviderAnswers): void {
  const preset = answer.preset ?? "deepseek";
  const defaults = PROVIDER_PRESETS[preset];
  const apiKeyHeader = answer.apiKeyHeader ?? defaults.apiKeyHeader;
  const apiKeyPrefix = answer.apiKeyPrefix ?? defaults.apiKeyPrefix;

  if (!/^[A-Za-z0-9-]+$/.test(apiKeyHeader)) {
    throw new Error(`Invalid API key header "${apiKeyHeader}". Use a header name such as Authorization or api-key.`);
  }

  if (
    preset !== "custom" &&
    apiKeyHeader !== defaults.apiKeyHeader &&
    apiKeyHeader !== "api-key" &&
    looksLikeTokenFragment(apiKeyPrefix)
  ) {
    throw new Error(
      `The API key header/prefix look like token fragments. For ${preset}, leave the auth mode at the default and paste the full API key only in the API key field.`
    );
  }
}

export function envPairsForProvider(answer: ProviderAnswers): Record<string, string> {
  validateProviderAnswers(answer);
  const preset = PROVIDER_PRESETS[answer.preset ?? "deepseek"];
  const env: Record<string, string> = {
    CHEAP_LLM_BASE_URL: answer.baseUrl ?? preset.baseUrl,
    CHEAP_LLM_MODEL: answer.model ?? preset.model,
    CHEAP_LLM_CHAT_PATH: answer.chatPath ?? preset.chatPath,
    CHEAP_LLM_API_KEY_HEADER: answer.apiKeyHeader ?? preset.apiKeyHeader,
    CHEAP_LLM_API_KEY_PREFIX: answer.apiKeyPrefix ?? preset.apiKeyPrefix,
    SIMPLE_LLM_DEFAULT_PROVIDER: "cheap",
    SIMPLE_LLM_CHINESE_DEFAULT: "true",
    SIMPLE_LLM_STABILITY_DEFAULT: "true",
    SIMPLE_LLM_MAX_PROMPT_CHARS: "12000",
    SIMPLE_LLM_TIMEOUT_MS: "60000"
  };

  if (answer.apiKey) {
    env.CHEAP_LLM_API_KEY = answer.apiKey;
  }

  return Object.fromEntries(Object.entries(env).filter(([, value]) => value.length > 0));
}

export function buildClaudeCommand(answer: ProviderAnswers): string[] {
  const envArgs = Object.entries(envPairsForProvider(answer)).flatMap(([key, value]) => ["--env", `${key}=${value}`]);
  return ["claude", "mcp", "add", "--transport", "stdio", "--scope", "user", ...envArgs, SERVER_NAME, "--", "npx", "-y", PACKAGE_SPEC];
}

export function buildCodexCommand(answer: ProviderAnswers): string[] {
  const envArgs = Object.entries(envPairsForProvider(answer)).flatMap(([key, value]) => ["--env", `${key}=${value}`]);
  return ["codex", "mcp", "add", SERVER_NAME, ...envArgs, "--", "npx", "-y", PACKAGE_SPEC];
}

export function shellQuote(value: string): string {
  return /\s|["']/.test(value) ? JSON.stringify(value) : value;
}

function redactCommandPart(value: string): string {
  const match = /^([^=]+)=(.*)$/.exec(value);
  if (match && isSecretName(match[1])) {
    return `${match[1]}=${SECRET_PLACEHOLDER}`;
  }
  return value;
}

export function commandToString(command: string[], options: { redactSecrets?: boolean } = {}): string {
  return command.map((part) => shellQuote(options.redactSecrets ? redactCommandPart(part) : part)).join(" ");
}

export function codexTomlSnippet(answer: ProviderAnswers, options: { redactSecrets?: boolean } = {}): string {
  const envLines = Object.entries(envPairsForProvider(answer))
    .map(([key, value]) => `${key} = ${JSON.stringify(options.redactSecrets && isSecretName(key) ? SECRET_PLACEHOLDER : value)}`)
    .join("\n");
  return `[mcp_servers.${SERVER_NAME}]
command = "npx"
args = ["-y", "${PACKAGE_SPEC}"]

[mcp_servers.${SERVER_NAME}.env]
${envLines}
`;
}

export function claudeJsonSnippet(answer: ProviderAnswers): string {
  const env = envPairsForProvider(answer);
  return JSON.stringify(
    {
      type: "stdio",
      command: "npx",
      args: ["-y", PACKAGE_SPEC],
      env
    },
    null,
    2
  );
}

async function choose(prompt: string, choices: string[], defaultIndex = 0): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    output.write(`${prompt}\n`);
    choices.forEach((choice, index) => output.write(`  ${index + 1}. ${choice}${index === defaultIndex ? " (default)" : ""}\n`));
    const raw = await rl.question("> ");
    const index = raw.trim() ? Number(raw.trim()) - 1 : defaultIndex;
    return choices[index] ?? choices[defaultIndex];
  } finally {
    rl.close();
  }
}

async function ask(prompt: string, defaultValue = ""): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const suffix = defaultValue ? ` (${defaultValue})` : "";
    const answer = await rl.question(`${prompt}${suffix}: `);
    return answer.trim() || defaultValue;
  } finally {
    rl.close();
  }
}

async function collectAuthFields(preset: ProviderPreset): Promise<Pick<ProviderAnswers, "apiKeyHeader" | "apiKeyPrefix">> {
  const defaults = PROVIDER_PRESETS[preset];
  if (preset !== "custom") {
    const defaultAuthLabel =
      defaults.apiKeyPrefix === "none"
        ? `Default ${defaults.apiKeyHeader} header without prefix`
        : `Default ${defaults.apiKeyHeader} ${defaults.apiKeyPrefix}`;
    const alternateAuthLabel = defaults.apiKeyHeader === "api-key" ? "Authorization Bearer" : "api-key header without prefix";
    const authChoice = await choose(
      "Authentication mode?",
      [defaultAuthLabel, alternateAuthLabel, "Custom header/prefix"],
      0
    );
    const mode: AuthMode =
      authChoice === "api-key header without prefix"
        ? "api-key"
        : authChoice === "Authorization Bearer"
          ? "bearer"
          : authChoice === "Custom header/prefix"
            ? "custom"
            : "default";
    if (mode === "default") {
      return {
        apiKeyHeader: defaults.apiKeyHeader,
        apiKeyPrefix: defaults.apiKeyPrefix
      };
    }
    if (mode === "api-key") {
      return {
        apiKeyHeader: "api-key",
        apiKeyPrefix: "none"
      };
    }
    if (mode === "bearer") {
      return {
        apiKeyHeader: "Authorization",
        apiKeyPrefix: "Bearer"
      };
    }
  }

  return {
    apiKeyHeader: await ask("API key header name", defaults.apiKeyHeader),
    apiKeyPrefix: await ask("API key prefix (Bearer, or none for raw api-key headers)", defaults.apiKeyPrefix)
  };
}

export async function collectSetupOptions(): Promise<SetupOptions> {
  const clientChoice = await choose("Which client should be configured?", ["Claude Code", "Codex", "Both"], 2);
  const providerChoice = await choose("Provider preset?", ["DeepSeek", "Xiaomi MiMo", "Qwen / Alibaba Cloud Bailian", "Custom OpenAI-compatible"], 0);
  const preset: ProviderPreset =
    providerChoice === "Xiaomi MiMo"
      ? "mimo"
      : providerChoice === "Qwen / Alibaba Cloud Bailian"
        ? "qwen"
        : providerChoice === "Custom OpenAI-compatible"
          ? "custom"
          : "deepseek";
  const defaults = PROVIDER_PRESETS[preset];
  const baseUrl = await ask("OpenAI-compatible base URL", defaults.baseUrl);
  const model = await ask("Model id", defaults.model);
  const chatPath = await ask("Chat completions path", defaults.chatPath);
  const { apiKeyHeader, apiKeyPrefix } = await collectAuthFields(preset);
  const apiKey = await ask("API key (leave blank if you will fill it manually in the client config)");
  const testConnection = Boolean(apiKey) && (await choose("Send a tiny API connectivity test now?", ["Yes", "No"], 0)) === "Yes";
  const execute = (await choose("Execute these install commands now?", ["Yes", "No"], 0)) === "Yes";

  return {
    clients: clientChoice === "Both" ? ["claude", "codex"] : clientChoice === "Claude Code" ? ["claude"] : ["codex"],
    preset,
    apiKey: apiKey || undefined,
    baseUrl,
    model,
    chatPath,
    apiKeyHeader,
    apiKeyPrefix,
    testConnection,
    execute
  };
}

export function commandsForSetup(options: SetupOptions): string[][] {
  return options.clients.map((client) => (client === "claude" ? buildClaudeCommand(options) : buildCodexCommand(options)));
}

export async function testProviderConnection(answer: ProviderAnswers): Promise<string> {
  return callChatCompletion(
    {
      prompt: 'Reply exactly: cheap-llm-mcp-ok',
      system: "This is a CLI connectivity check. Reply with the exact requested text only.",
      temperature: 0,
      maxTokens: 512,
      includeUsage: true,
      extraBody: providerExtraBody(answer),
      approvedForExternalApi: true,
      dataClassification: "public"
    },
    envPairsForProvider(answer)
  );
}

export async function runSetup(options?: SetupOptions): Promise<number> {
  const selected = options ?? (await collectSetupOptions());
  const commands = commandsForSetup(selected);
  let connectionOk = true;
  output.write("\nCommands:\n");
  commands.forEach((command) => output.write(`  ${commandToString(command, { redactSecrets: true })}\n`));

  if (selected.testConnection) {
    if (!selected.apiKey) {
      output.write("\nSkipped API connectivity test because no API key was provided.\n");
    } else {
      output.write("\nTesting API connectivity with a tiny public ping...\n");
      try {
        const result = await testProviderConnection(selected);
        output.write(`API connectivity OK:\n${result.slice(0, 800)}\n`);
      } catch (error) {
        connectionOk = false;
        const message = error instanceof Error ? error.message : String(error);
        output.write(`API connectivity test failed:\n${message}\n`);
        output.write("Fix the provider settings, API key, network, proxy, or TLS issue, then run setup again.\n");
      }
    }
  }

  if (selected.execute && !connectionOk && !options) {
    const installAnyway = (await choose("API test failed. Install this MCP config anyway?", ["No", "Yes"], 0)) === "Yes";
    if (!installAnyway) {
      output.write("\nSkipped installation because the connectivity test failed.\n");
      output.write("\nManual Codex fallback:\n");
      output.write(codexTomlSnippet(selected, { redactSecrets: true }));
      return 1;
    }
  }

  if (!selected.execute) {
    output.write("\nSkipped execution. Copy a command above, or run setup again and choose execution.\n");
    output.write("\nManual Codex fallback:\n");
    output.write(codexTomlSnippet(selected, { redactSecrets: true }));
    if (selected.apiKey) {
      output.write(`\nReplace ${SECRET_PLACEHOLDER} with your actual API key in your local client config.\n`);
    }
    return 0;
  }

  for (const command of commands) {
    output.write(`\nRunning: ${commandToString(command, { redactSecrets: true })}\n`);
    const result =
      process.platform === "win32"
        ? spawnSync("cmd.exe", ["/d", "/s", "/c", commandToString(command)], { stdio: "inherit" })
        : spawnSync(command[0], command.slice(1), { stdio: "inherit" });
    if (result.status !== 0) {
      output.write("\nCommand failed. Manual Codex fallback:\n");
      output.write(codexTomlSnippet(selected, { redactSecrets: true }));
      if (selected.apiKey) {
        output.write(`\nReplace ${SECRET_PLACEHOLDER} with your actual API key in your local client config.\n`);
      }
      return result.status ?? 1;
    }
  }

  output.write("\nDone. Restart Claude Code or Codex, then check /mcp or run codex mcp list.\n");
  return 0;
}

export function printConfig(): void {
  const answer: ProviderAnswers = {};
  output.write("Claude Code:\n");
  output.write(`${commandToString(buildClaudeCommand(answer))}\n\n`);
  output.write("Codex:\n");
  output.write(`${commandToString(buildCodexCommand(answer))}\n\n`);
  output.write("Codex config.toml fallback:\n");
  output.write(codexTomlSnippet(answer));
}
