# cheap-llm-mcp

[![npm version](https://img.shields.io/npm/v/cheap-llm-mcp.svg)](https://www.npmjs.com/package/cheap-llm-mcp)
[![CI](https://github.com/stBlackCat/cheap-llm-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/stBlackCat/cheap-llm-mcp/actions/workflows/ci.yml)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Still worried about GPT Plus limits? Still watching your Claude subscription tokens burn on tiny chores?

`cheap-llm-mcp` solves a big chunk of that pain: use cheap AI for cheap work, while your premium model stays in charge.

[Chinese homepage](README.md)

This is a local stdio MCP server for Claude Code, Codex, and other MCP clients. It routes simple, low-risk, self-contained tasks to tested DeepSeek, Xiaomi MiMo, and Qwen / Alibaba Cloud Bailian presets, or to a custom OpenAI-compatible chat completions API. Your main AI still plans, reviews, edits, and decides. The cheap model just handles small drafts.

## Quickstart

Install the MCP server first:

```bash
npx -y cheap-llm-mcp@latest setup
```

Then fill in one OpenAI-compatible endpoint. The setup wizard can also send a tiny public connectivity test after you enter the API key.

```bash
CHEAP_LLM_BASE_URL=https://api.deepseek.com
CHEAP_LLM_MODEL=deepseek-v4-flash
CHEAP_LLM_API_KEY=sk-...
CHEAP_LLM_CHAT_PATH=/chat/completions
CHEAP_LLM_API_KEY_HEADER=Authorization
CHEAP_LLM_API_KEY_PREFIX=Bearer
```

DeepSeek, Xiaomi MiMo, and Qwen are first-class presets. Other OpenAI-compatible providers may work when they expose a compatible chat completions endpoint and use a supported API-key header.

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
  --env CHEAP_LLM_API_KEY=sk-... \
  --env CHEAP_LLM_BASE_URL=https://api.deepseek.com \
  --env CHEAP_LLM_MODEL=deepseek-v4-flash \
  --env CHEAP_LLM_CHAT_PATH=/chat/completions \
  --env CHEAP_LLM_API_KEY_HEADER=Authorization \
  --env CHEAP_LLM_API_KEY_PREFIX=Bearer \
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
  --env CHEAP_LLM_API_KEY=sk-... \
  --env CHEAP_LLM_BASE_URL=https://api.deepseek.com \
  --env CHEAP_LLM_MODEL=deepseek-v4-flash \
  --env CHEAP_LLM_CHAT_PATH=/chat/completions \
  --env CHEAP_LLM_API_KEY_HEADER=Authorization \
  --env CHEAP_LLM_API_KEY_PREFIX=Bearer \
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

## Stability Without Wasting Tokens

Cheap models are useful, but they are not the boss.

`cheap-llm-mcp` adds a compact default instruction that tells the cheap model to return a concise draft only, avoid final decisions, avoid pretending it edited files, avoid guessing missing facts, and say `UNCERTAIN` when the task is ambiguous.

The MCP tool description also tells the host AI to lightly review the result against the original task before using it. This keeps the premium model in control without asking the cheap model to produce long self-review reports.

## OpenAI-Compatible Config

```bash
CHEAP_LLM_BASE_URL=https://your-provider.example/v1
CHEAP_LLM_MODEL=your-cheap-model
CHEAP_LLM_API_KEY=your-api-key
CHEAP_LLM_CHAT_PATH=/chat/completions
CHEAP_LLM_API_KEY_HEADER=Authorization
CHEAP_LLM_API_KEY_PREFIX=Bearer
```

Tested presets:

```bash
# DeepSeek
CHEAP_LLM_BASE_URL=https://api.deepseek.com
CHEAP_LLM_MODEL=deepseek-v4-flash

# Xiaomi MiMo
CHEAP_LLM_BASE_URL=https://api.xiaomimimo.com/v1
CHEAP_LLM_MODEL=mimo-v2.5-pro

# Qwen / Alibaba Cloud Bailian
CHEAP_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
CHEAP_LLM_MODEL=qwen-plus
```

Xiaomi MiMo also documents an `api-key` header. To switch to that form:

```bash
CHEAP_LLM_API_KEY_HEADER=api-key
CHEAP_LLM_API_KEY_PREFIX=none
```

Qwen / Alibaba Cloud Bailian uses the DashScope OpenAI-compatible endpoint: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`, with `qwen-plus` as the default model.

Reference docs: [DeepSeek API](https://api-docs.deepseek.com/zh-cn/), [Xiaomi MiMo first API call](https://platform.xiaomimimo.com/docs/zh-CN/quick-start/first-api-call), and [Alibaba Cloud Model Studio Qwen API](https://www.alibabacloud.com/help/en/model-studio/use-qwen-by-calling-api).

## Token Savings

Run the MCP tool `get_token_savings` to see how many provider-reported tokens were handled by cheap models during the current MCP server session.

For a persistent audit trail, set:

```bash
SIMPLE_LLM_USAGE_LOG=/path/to/cheap-llm-usage.jsonl
```

The usage log records provider, model, token counts, and timestamp only. It does not record prompts or model outputs.

## Safety Defaults

- Calls require `approvedForExternalApi=true`.
- Calls require `dataClassification`.
- `dataClassification=sensitive` is rejected.
- Common secret patterns are rejected.
- HTTP providers are rejected unless `SIMPLE_LLM_ALLOW_HTTP=true`.
- Prompt size is capped by `SIMPLE_LLM_MAX_PROMPT_CHARS` (default: `12000`).
- Requests time out via `SIMPLE_LLM_TIMEOUT_MS` (default: `60000`).
- Provider errors are redacted before being returned.

## Chinese Default

Chinese-first output is enabled by default:

```bash
SIMPLE_LLM_CHINESE_DEFAULT=true
```

## Development

```bash
npm install
npm run ci
```

## License

MIT
