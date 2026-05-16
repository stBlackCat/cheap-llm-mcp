# Security Policy

## Supported Versions

Security fixes target the latest published version of `cheap-llm-mcp`.

## Reporting a Vulnerability

Please report security issues privately through GitHub Security Advisories once the repository is created. If advisories are not available, open an issue with minimal reproduction details and avoid posting secrets, tokens, or private data.

## Security Model

`cheap-llm-mcp` sends selected prompts to third-party model APIs. It does not make that safe automatically.

The server rejects sensitive classifications, scans for common secret patterns, requires external API approval, enforces HTTPS by default, caps prompt size, times out provider requests, and redacts provider errors.

Users remain responsible for provider trust, API key handling, and deciding what data may leave their machine.
