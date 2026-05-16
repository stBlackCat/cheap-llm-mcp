import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type Client = "claude" | "codex";
type ProviderPreset = "deepseek" | "mimo" | "custom";

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
    baseUrl: "https://api.xiaomimimo.com/v1",
    model: "mimo-v2.5-pro",
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

function envPairsForProvider(answer: ProviderAnswers): Record<string, string> {
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

export async function collectSetupOptions(): Promise<SetupOptions> {
  const clientChoice = await choose("Which client should be configured?", ["Claude Code", "Codex", "Both"], 2);
  const providerChoice = await choose("Provider preset?", ["DeepSeek", "Xiaomi MiMo", "Custom OpenAI-compatible"], 0);
  const preset: ProviderPreset = providerChoice === "Xiaomi MiMo" ? "mimo" : providerChoice === "Custom OpenAI-compatible" ? "custom" : "deepseek";
  const defaults = PROVIDER_PRESETS[preset];
  const baseUrl = await ask("OpenAI-compatible base URL", defaults.baseUrl);
  const model = await ask("Model id", defaults.model);
  const chatPath = await ask("Chat completions path", defaults.chatPath);
  const apiKeyHeader = await ask("API key header", defaults.apiKeyHeader);
  const apiKeyPrefix = await ask("API key prefix (use none for headers like api-key)", defaults.apiKeyPrefix);
  const apiKey = await ask("API key (leave blank if you will fill it manually in the client config)");
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
    execute
  };
}

export function commandsForSetup(options: SetupOptions): string[][] {
  return options.clients.map((client) => (client === "claude" ? buildClaudeCommand(options) : buildCodexCommand(options)));
}

export async function runSetup(options?: SetupOptions): Promise<number> {
  const selected = options ?? (await collectSetupOptions());
  const commands = commandsForSetup(selected);
  output.write("\nCommands:\n");
  commands.forEach((command) => output.write(`  ${commandToString(command, { redactSecrets: true })}\n`));

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
