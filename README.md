# cheap-llm-mcp

[![npm version](https://img.shields.io/npm/v/cheap-llm-mcp.svg)](https://www.npmjs.com/package/cheap-llm-mcp)
[![CI](https://github.com/stBlackCat/cheap-llm-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/stBlackCat/cheap-llm-mcp/actions/workflows/ci.yml)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English docs](README.en.md)

还在为 GPT Plus 的额度发愁？还在心疼自己的 Claude 会员 token 太贵？

这个 MCP 可以解决你的大部分分流问题：把可自包含的草稿、审查、推理和整理工作交给便宜或国产大模型，让主模型继续负责统筹、工具执行和最终决策。

`cheap-llm-mcp` 是一个本地 stdio MCP server，适用于 Claude Code、Codex 和其他 MCP 客户端。它可以把摘要、翻译、分类、抽取、小段代码、代码审查草稿、方案推理、设计批判和测试建议等可自包含任务交给国产模型分流处理。内置预设包括 DeepSeek、Xiaomi MiMo 和 Qwen / 阿里云百炼，也可以接入你自己填写的 OpenAI-compatible API。

## 快速开始

先一键安装 MCP：

```bash
npx -y cheap-llm-mcp@latest setup
```

向导会让你选择客户端、provider 预设、模型和 API key。填完 API key 后，它可以立刻发一个极小的公开 ping 测试接口连通性，不发送你的项目内容。

手动配置时，核心就是这几项：

```bash
CHEAP_LLM_BASE_URL=https://api.deepseek.com
CHEAP_LLM_MODEL=deepseek-v4-flash
CHEAP_LLM_API_KEY=sk-...
CHEAP_LLM_CHAT_PATH=/chat/completions
CHEAP_LLM_API_KEY_HEADER=Authorization
CHEAP_LLM_API_KEY_PREFIX=Bearer
```

DeepSeek、Xiaomi MiMo 和 Qwen 是明确支持的国产模型预设；其他平台只要提供兼容 chat completions 的接口，并且鉴权头能按下面的格式配置，就可以按自定义 OpenAI-compatible 接口尝试。

检查配置：

```bash
npx -y cheap-llm-mcp@latest doctor
```

打印手动配置：

```bash
npx -y cheap-llm-mcp@latest config
```

## Claude Code

向导会在你确认后执行类似命令：

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

重启 Claude Code 后运行：

```text
/mcp
```

## Codex

向导会在你确认后执行类似命令：

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

如果命令不可用，运行 `npx -y cheap-llm-mcp@latest config`，把输出的 TOML 写入 `~/.codex/config.toml`。

## 配置格式

推荐路径就是这几项：

```bash
CHEAP_LLM_BASE_URL=https://your-provider.example/v1
CHEAP_LLM_MODEL=your-cheap-model
CHEAP_LLM_API_KEY=your-api-key
CHEAP_LLM_CHAT_PATH=/chat/completions
CHEAP_LLM_API_KEY_HEADER=Authorization
CHEAP_LLM_API_KEY_PREFIX=Bearer
```

已明确支持的预设：

```bash
# DeepSeek
CHEAP_LLM_BASE_URL=https://api.deepseek.com
CHEAP_LLM_MODEL=deepseek-v4-flash

# Xiaomi MiMo
CHEAP_LLM_BASE_URL=https://api.mimo-v2.com/v1
CHEAP_LLM_MODEL=mimo-v2.5-pro

# Qwen / 阿里云百炼
CHEAP_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
CHEAP_LLM_MODEL=qwen-plus

# 其他 OpenAI-compatible 网关
CHEAP_LLM_BASE_URL=https://example.com/v1
CHEAP_LLM_MODEL=model-id
```

DeepSeek 使用 `Authorization: Bearer ...`，接口是 `https://api.deepseek.com/chat/completions`。Xiaomi MiMo 的 OpenAI-compatible 接口是 `https://api.mimo-v2.com/v1/chat/completions`；当前官方 curl 示例使用 `api-key` 头：

```bash
CHEAP_LLM_API_KEY_HEADER=api-key
CHEAP_LLM_API_KEY_PREFIX=none
```

如果你的 MiMo token-plan 账号给的是中国区网关，也可以把 base URL 填为 `https://token-plan-cn.xiaomimimo.com/v1`，鉴权通常使用 `Authorization: Bearer ...`。MiMo V2.5 Pro 是 reasoning 模型，MCP 会默认带上 `reasoning_effort=low`；如果你手动覆盖参数，不要把 `maxTokens` 设得太小，否则可能只返回 `reasoning_content`。

Qwen / 阿里云百炼使用 DashScope OpenAI-compatible endpoint：`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`，默认模型是 `qwen-plus`。

MCP 不会默认给输出设置 `max_tokens`；只有调用工具时显式传 `maxTokens` 才会限制输出。需要兼容不同 OpenAI-compatible 网关的扩展参数时，可以配置：

```bash
CHEAP_LLM_DEFAULT_BODY={"reasoning_effort":"low"}
```

参考文档：[DeepSeek API](https://api-docs.deepseek.com/zh-cn/)、[Xiaomi MiMo 首次调用 API](https://www.mimo-v2.com/zh/docs/quick-start/first-api-call) 和 [Alibaba Cloud Model Studio Qwen API](https://www.alibabacloud.com/help/en/model-studio/use-qwen-by-calling-api)。

高级用户仍然可以用 `SIMPLE_LLM_PROVIDERS` 配多个具名 provider，但默认体验就是一个便宜的 OpenAI-compatible endpoint。

## 什么任务适合外包？

适合：短文本摘要、翻译润色、简单分类、小段信息抽取成 JSON、正则草稿、简短命令解释、独立小代码片段。

不适合：架构决策、直接修改仓库、安全敏感代码审查、完整私有代码库上下文推理、密钥或敏感数据、复杂跨文件调试。

## 稳定性控制，但不浪费 token

便宜模型可以干活，但不能当负责人。

`cheap-llm-mcp` 默认会给便宜模型加一条很短的稳定性约束：只输出简洁草案，不做最终决策，不假装已经修改文件，不乱猜缺失事实，遇到不确定任务时用 `UNCERTAIN` 说明。

同时，MCP 工具描述会要求 Codex 或 Claude Code 的主 AI 对结果进行轻量审查：只对照原任务核对是否可用，不额外发大段上下文，也不默认让便宜模型再自我审查一遍。这样既能提升稳定性，也不会把省下来的 token 又花回去。

## Token 节省统计

运行 MCP 工具 `get_token_savings`，可以看到当前 MCP server 会话里实际有多少 token 被低费用模型处理了。

它会统计低费用模型的 prompt、completion、total token，按 provider/model 分组，并给出粗略的 `estimatedPremiumTokensAvoided`。这里默认只统计 token，不硬编码价格表，因为各家模型价格经常变。

## 默认中文约束

默认开启：

```bash
SIMPLE_LLM_CHINESE_DEFAULT=true
```

MCP 会自动注入中文优先 system prompt：默认使用简体中文回答，但保留代码、命令、文件路径、API 名称、模型名称、错误信息、配置键和英文技术术语原文。

## 安全边界

这个 MCP 只适合低风险、可自包含的小任务：

- 必须显式确认 `approvedForExternalApi=true`
- 必须提供 `dataClassification`
- `sensitive` 数据会直接拒绝
- 自动扫描常见 API key、token、password、AWS key、private key
- 默认只允许 HTTPS provider
- 默认 prompt 上限是 12000 字符
- 默认请求超时是 60000ms
- provider 错误会脱敏后返回
- setup 连通性测试只发送固定 public ping，不发送你的仓库、需求或业务数据

不要把密钥、敏感客户数据、完整私有仓库上下文、安全判断、复杂架构决策、大规模重构交给外部便宜模型。

## 为什么不是直接换小模型？

直接把主模型换小，省了 token，但规划、判断、安全边界、工具编排都会变弱。`cheap-llm-mcp` 的思路是强模型继续当负责人，只把小而明确的任务转交出去。

## 开发

```bash
npm install
npm run ci
```

## License

MIT
