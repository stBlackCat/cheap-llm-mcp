# cheap-llm-mcp

还在为 GPT Plus 的额度发愁？还在心疼自己的 Claude 会员 token 太贵？

这个 MCP 可以解决你的大部分小任务成本问题：用便宜的 AI 做便宜的事情，让贵的主模型继续负责统筹、审查和最终决策。

`cheap-llm-mcp` 是一个本地 stdio MCP server，适用于 Claude Code、Codex 和其他 MCP 客户端。它可以把摘要、翻译、分类、抽取、小段代码等低风险任务交给任意 OpenAI-compatible API。

## 快速开始

先一键安装 MCP：

```bash
npx -y cheap-llm-mcp@latest setup
```

下一步只填一个兼容 OpenAI 的接口：

```bash
CHEAP_LLM_BASE_URL=https://api.deepseek.com
CHEAP_LLM_MODEL=deepseek-chat
CHEAP_LLM_API_KEY=sk-...
CHEAP_LLM_CHAT_PATH=/chat/completions
```

就这么简单。DeepSeek、Qwen、MiMo、硅基流动、OpenRouter、本地 OpenAI-compatible 网关，只要提供 chat completions 兼容接口，都按这套配置走。

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
  --env CHEAP_LLM_MODEL=deepseek-chat \
  --env CHEAP_LLM_CHAT_PATH=/chat/completions \
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
  --env CHEAP_LLM_MODEL=deepseek-chat \
  --env CHEAP_LLM_CHAT_PATH=/chat/completions \
  --env SIMPLE_LLM_CHINESE_DEFAULT=true \
  --env SIMPLE_LLM_STABILITY_DEFAULT=true \
  -- npx -y cheap-llm-mcp@latest
```

如果命令不可用，运行 `npx -y cheap-llm-mcp@latest config`，把输出的 TOML 写入 `~/.codex/config.toml`。

## 配置格式

推荐路径只有这四项：

```bash
CHEAP_LLM_BASE_URL=https://your-provider.example/v1
CHEAP_LLM_MODEL=your-cheap-model
CHEAP_LLM_API_KEY=your-api-key
CHEAP_LLM_CHAT_PATH=/chat/completions
```

常见例子：

```bash
# DeepSeek
CHEAP_LLM_BASE_URL=https://api.deepseek.com
CHEAP_LLM_MODEL=deepseek-chat

# Qwen compatible mode
CHEAP_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
CHEAP_LLM_MODEL=qwen-plus

# 其他 OpenAI-compatible 网关
CHEAP_LLM_BASE_URL=https://example.com/v1
CHEAP_LLM_MODEL=model-id
```

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

不要把密钥、敏感客户数据、完整私有仓库上下文、安全判断、复杂架构决策、大规模重构交给外部便宜模型。

## 为什么不是直接换小模型？

直接把主模型换小，省了 token，但规划、判断、安全边界、工具编排都会变弱。`cheap-llm-mcp` 的思路是强模型继续当负责人，只把小而明确的任务转交出去。

## 开发

```bash
npm install
npm run ci
```
