# cheap-llm-mcp

[![npm version](https://img.shields.io/npm/v/cheap-llm-mcp.svg)](https://www.npmjs.com/package/cheap-llm-mcp)
[![CI](https://github.com/yourname/cheap-llm-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/yourname/cheap-llm-mcp/actions/workflows/ci.yml)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Still worried about GPT Plus limits? Still watching your Claude subscription tokens burn on tiny chores?

`cheap-llm-mcp` solves a big chunk of that pain: use cheap AI for cheap work, while your premium model stays in charge.

[中文文档](README.zh-CN.md)

This is a local stdio MCP server for Claude Code, Codex, and other MCP clients. It routes simple, low-risk, self-contained tasks to DeepSeek, Qwen, MiMo, or any OpenAI-compatible chat completions API. Your main AI still plans, reviews, edits, and decides. The cheap model just handles small drafts.

## Quickstart

Install and configure interactively:

```bash
npx -y cheap-llm-mcp@latest setup
```

Check your setup:

```bash
npx -y cheap-llm-mcp@latest doctor
```

Print manual config:

```bash
npx -y cheap-llm-mcp@latest config
```

## Claude Code

The setup wizard can run this after confirmation:

```bash
claude mcp add --transport stdio --scope user \
  --env DEEPSEEK_API_KEY=sk-... \
  --env DEEPSEEK_BASE_URL=https://api.deepseek.com \
  --env DEEPSEEK_MODEL=deepseek-chat \
  --env SIMPLE_LLM_CHINESE_DEFAULT=true \
  --env SIMPLE_LLM_STABILITY_DEFAULT=true \
  cheap-llm -- npx -y cheap-llm-mcp@latest
```

Restart Claude Code and run:

```text
/mcp
```

## Codex

The setup wizard can run this after confirmation:

```bash
codex mcp add cheap-llm \
  --env DEEPSEEK_API_KEY=sk-... \
  --env DEEPSEEK_BASE_URL=https://api.deepseek.com \
  --env DEEPSEEK_MODEL=deepseek-chat \
  --env SIMPLE_LLM_CHINESE_DEFAULT=true \
  --env SIMPLE_LLM_STABILITY_DEFAULT=true \
  -- npx -y cheap-llm-mcp@latest
```

Restart Codex and verify:

```bash
codex mcp list
```

If `codex mcp add` is unavailable, run:

```bash
npx -y cheap-llm-mcp@latest config
```

Then paste the printed TOML into `~/.codex/config.toml`.

## What should be delegated?

Good cheap-model tasks:

- summarize a short note
- translate or rewrite text
- classify a small snippet
- extract fields into JSON
- draft a regex
- explain a short command
- produce a tiny isolated code snippet

Bad cheap-model tasks:

- decide architecture
- edit your repo directly
- review security-sensitive code
- reason over a full private codebase
- handle secrets or sensitive data
- debug complex cross-file behavior

## Stability without wasting tokens

Cheap models are useful, but they are not the boss.

`cheap-llm-mcp` adds a compact default instruction that tells the cheap model to:

- return a concise draft only
- avoid final decisions
- avoid pretending it edited files
- avoid guessing missing facts
- say `UNCERTAIN` when the task is ambiguous

The MCP tool description also tells the host AI to lightly review the result against the original task before using it. This keeps the premium model in control without asking the cheap model to produce long self-review reports.

Disable this default only if you know what you are doing:

```bash
SIMPLE_LLM_STABILITY_DEFAULT=false
```

## 30-second demo

1. Run `npx -y cheap-llm-mcp@latest setup`.
2. Restart Claude Code or Codex.
3. Ask: "Use the cheap LLM MCP to summarize this short text."
4. Your host AI delegates the small task, then checks the draft before using it.

Available tools:

- `ask_simple_model`: call a configured cheap model for a self-contained task.
- `list_simple_model_providers`: show configured providers without leaking API keys.
- `check_simple_model_setup`: validate local provider configuration without making a model request.
- `get_token_savings`: show how many provider-reported tokens were routed to cheap models.

## Providers

Built-ins:

- DeepSeek: `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`
- Qwen: `QWEN_API_KEY` or `DASHSCOPE_API_KEY`, `QWEN_BASE_URL`, `QWEN_MODEL`
- MiMo: `MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_MODEL`

Custom OpenAI-compatible provider:

```bash
SIMPLE_LLM_PROVIDERS='[{"name":"custom","baseUrl":"https://example.com/v1","apiKeyEnv":"CUSTOM_LLM_API_KEY","model":"model-id"}]'
CUSTOM_LLM_API_KEY=...
```

## Token savings

Run the MCP tool `get_token_savings` to see how many tokens were actually handled by cheap models during the current MCP server session.

It reports prompt, completion, and total cheap-model tokens, plus a provider/model breakdown and a rough `estimatedPremiumTokensAvoided` token-volume proxy. This is token-based by design; provider prices change often, so `cheap-llm-mcp` does not hardcode pricing tables.

For a persistent audit trail, set:

```bash
SIMPLE_LLM_USAGE_LOG=/path/to/cheap-llm-usage.jsonl
```

The usage log records provider, model, token counts, and timestamp only. It does not record prompts or model outputs.

## Safety defaults

`cheap-llm-mcp` is for low-risk delegation, not blind outsourcing.

- Calls require `approvedForExternalApi=true`.
- Calls require `dataClassification`.
- `dataClassification=sensitive` is rejected.
- Common API key, token, password, AWS key, and private key patterns are rejected.
- HTTP providers are rejected unless `SIMPLE_LLM_ALLOW_HTTP=true`.
- Prompt size is capped by `SIMPLE_LLM_MAX_PROMPT_CHARS` (default: `12000`).
- Requests time out via `SIMPLE_LLM_TIMEOUT_MS` (default: `60000`).
- Provider errors are redacted before being returned.
- Optional usage logs contain provider/model/token counts only, not prompts or outputs.

## Chinese default

Chinese-first output is enabled by default:

```bash
SIMPLE_LLM_CHINESE_DEFAULT=true
```

The server asks the cheap model to answer in Simplified Chinese while preserving code, commands, paths, API names, model names, error messages, config keys, and English technical terms. Disable it with:

```bash
SIMPLE_LLM_CHINESE_DEFAULT=false
```

## Why not just use a smaller main model?

A smaller main model saves tokens, but it also becomes responsible for planning, safety, code changes, and tool orchestration. `cheap-llm-mcp` keeps your strongest model in charge and only delegates small, self-contained work. That preserves judgment while cutting premium-model spend.

## Development

```bash
npm install
npm run ci
```

Start the MCP server locally:

```bash
npm run build
node dist/index.js
```

## License

MIT
