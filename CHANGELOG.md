# Changelog

## 0.1.2

- Added explicit DeepSeek and Xiaomi MiMo setup presets.
- Added configurable API-key auth headers for providers that use `api-key` instead of `Authorization: Bearer`.
- Updated docs and examples to separate tested presets from generic OpenAI-compatible endpoints.

## 0.1.1

- Redacted API keys in setup command previews, running logs, and fallback config output.

## 0.1.0

- Initial productized MCP server.
- Added DeepSeek, Qwen, MiMo, and custom OpenAI-compatible provider support.
- Added CLI modes: stdio server, `setup`, `doctor`, and `config`.
- Added Chinese-first default system prompt.
- Added safety gates for external API approval, data classification, secret scanning, HTTPS, prompt length, timeouts, and error redaction.
