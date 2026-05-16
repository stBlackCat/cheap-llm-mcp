import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type Client = "claude" | "codex";
type ProviderChoice = "deepseek" | "qwen" | "mimo" | "custom";

export type ProviderAnswers = {
  provider: ProviderChoice;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  chatPath?: string;
};

export type SetupOptions = {
  clients: Client[];
  provider: ProviderChoice;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  chatPath?: string;
  execute?: boolean;
};

const PACKAGE_SPEC = "cheap-llm-mcp@latest";
const SERVER_NAME = "cheap-llm";

function envPairsForProvider(answer: ProviderAnswers): Record<string, string> {
  const env: Record<string, string> = {
    SIMPLE_LLM_CHINESE_DEFAULT: "true",
    SIMPLE_LLM_STABILITY_DEFAULT: "true",
    SIMPLE_LLM_MAX_PROMPT_CHARS: "12000",
    SIMPLE_LLM_TIMEOUT_MS: "60000",
    SIMPLE_LLM_DEFAULT_PROVIDER: answer.provider === "custom" ? "custom" : answer.provider
  };

  if (answer.provider === "deepseek") {
    env.DEEPSEEK_BASE_URL = answer.baseUrl ?? "https://api.deepseek.com";
    env.DEEPSEEK_MODEL = answer.model ?? "deepseek-chat";
    env.DEEPSEEK_THINKING = "disabled";
    if (answer.apiKey) env.DEEPSEEK_API_KEY = answer.apiKey;
  } else if (answer.provider === "qwen") {
    env.QWEN_BASE_URL = answer.baseUrl ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
    env.QWEN_MODEL = answer.model ?? "qwen-plus";
    if (answer.apiKey) env.QWEN_API_KEY = answer.apiKey;
  } else if (answer.provider === "mimo") {
    env.MIMO_BASE_URL = answer.baseUrl ?? "";
    env.MIMO_MODEL = answer.model ?? "";
    env.MIMO_CHAT_PATH = answer.chatPath ?? "/chat/completions";
    if (answer.apiKey) env.MIMO_API_KEY = answer.apiKey;
  } else {
    const custom = {
      name: "custom",
      baseUrl: answer.baseUrl ?? "https://example.com/v1",
      chatPath: answer.chatPath ?? "/chat/completions",
      apiKeyEnv: "CUSTOM_LLM_API_KEY",
      model: answer.model ?? "your-model-id"
    };
    env.SIMPLE_LLM_PROVIDERS = JSON.stringify([custom]);
    if (answer.apiKey) env.CUSTOM_LLM_API_KEY = answer.apiKey;
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

export function commandToString(command: string[]): string {
  return command.map(shellQuote).join(" ");
}

export function codexTomlSnippet(answer: ProviderAnswers): string {
  const envLines = Object.entries(envPairsForProvider(answer))
    .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
    .join("\n");
  return `[mcp_servers.${SERVER_NAME}]
command = "npx"
args = ["-y", "${PACKAGE_SPEC}"]

[mcp_servers.${SERVER_NAME}.env]
${envLines}
`;
}

export function claudeJsonSnippet(answer: ProviderAnswers): string {
  return JSON.stringify(
    {
      type: "stdio",
      command: "npx",
      args: ["-y", PACKAGE_SPEC],
      env: envPairsForProvider(answer)
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
  const provider = (await choose("Which provider should cheap-llm-mcp use first?", ["deepseek", "qwen", "mimo", "custom"], 0)) as ProviderChoice;
  const apiKey = await ask("API key (leave blank if you already set an environment variable)");
  const baseUrl = provider === "mimo" || provider === "custom" ? await ask("Provider base URL") : await ask("Provider base URL", "");
  const model = await ask("Model id", provider === "deepseek" ? "deepseek-chat" : provider === "qwen" ? "qwen-plus" : "");
  const chatPath = provider === "mimo" || provider === "custom" ? await ask("Chat completions path", "/chat/completions") : "";
  const execute = (await choose("Execute these install commands now?", ["Yes", "No"], 0)) === "Yes";

  return {
    clients: clientChoice === "Both" ? ["claude", "codex"] : clientChoice === "Claude Code" ? ["claude"] : ["codex"],
    provider,
    apiKey: apiKey || undefined,
    baseUrl: baseUrl || undefined,
    model: model || undefined,
    chatPath: chatPath || undefined,
    execute
  };
}

export function commandsForSetup(options: SetupOptions): string[][] {
  const answer: ProviderAnswers = options;
  return options.clients.map((client) => (client === "claude" ? buildClaudeCommand(answer) : buildCodexCommand(answer)));
}

export async function runSetup(options?: SetupOptions): Promise<number> {
  const selected = options ?? (await collectSetupOptions());
  const commands = commandsForSetup(selected);
  output.write("\nCommands:\n");
  commands.forEach((command) => output.write(`  ${commandToString(command)}\n`));

  if (!selected.execute) {
    output.write("\nSkipped execution. Copy a command above, or run setup again and choose execution.\n");
    return 0;
  }

  for (const command of commands) {
    output.write(`\nRunning: ${commandToString(command)}\n`);
    const result =
      process.platform === "win32"
        ? spawnSync("cmd.exe", ["/d", "/s", "/c", commandToString(command)], { stdio: "inherit" })
        : spawnSync(command[0], command.slice(1), { stdio: "inherit" });
    if (result.status !== 0) {
      output.write("\nCommand failed. Manual Codex fallback:\n");
      output.write(codexTomlSnippet(selected));
      return result.status ?? 1;
    }
  }

  output.write("\nDone. Restart Claude Code or Codex, then check /mcp or run codex mcp list.\n");
  return 0;
}

export function printConfig(provider: ProviderChoice = "deepseek"): void {
  const answer: ProviderAnswers = { provider };
  output.write("Claude Code:\n");
  output.write(`${commandToString(buildClaudeCommand(answer))}\n\n`);
  output.write("Codex:\n");
  output.write(`${commandToString(buildCodexCommand(answer))}\n\n`);
  output.write("Codex config.toml fallback:\n");
  output.write(codexTomlSnippet(answer));
}
