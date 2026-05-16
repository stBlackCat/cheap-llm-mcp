# Contributing

Thanks for improving `cheap-llm-mcp`.

## Development

```bash
npm install
npm run ci
```

## Pull Requests

- Keep provider additions OpenAI-compatible unless there is a strong reason not to.
- Preserve safe defaults.
- Add tests for provider parsing, safety gates, and CLI output.
- Do not commit real API keys or provider credentials.

## Release

Releases are published from tags by GitHub Actions after `npm run ci` passes.
