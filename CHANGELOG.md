# Changelog

## Unreleased

- Updated the Xiaomi MiMo preset to the current `https://api.mimo-v2.com/v1` endpoint and `api-key` authentication shown in the official curl example.
- Made setup authentication choices clearer for provider presets and reject likely API-key fragments entered as header/prefix fields.
- Stopped sending a default `max_tokens` cap unless `maxTokens` is explicitly provided, and raised the tool schema cap for large compatible models.
- Added `CHEAP_LLM_DEFAULT_BODY` / `SIMPLE_LLM_DEFAULT_BODY` support for provider-specific OpenAI-compatible request parameters.
- Improved MiMo V2.5 Pro behavior with low reasoning defaults, clearer reasoning-only response diagnostics, and less fragile setup pings.

## 0.1.3

- Made the GitHub homepage README Chinese-first with a separate English docs link.
- Added an optional tiny public API connectivity test to the setup wizard.
- Added Qwen / Alibaba Cloud Bailian to the setup wizard and documented it as a first-class domestic model preset.

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
