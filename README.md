# MCP Offload Router

Self-hosted MCP server that routes offload tasks from Claude Code, Cursor, Kimi Code, Codex CLI, and Grok to MiniMax, SyntheticNew (GLM-5.2), and z.ai (GLM coding plan — the same backend pi/kimi use).

## Prerequisites

- [Bun](https://bun.sh/) (v1.2+)
- Docker and Docker Compose (optional, for containerized usage)

## Quick start

1. Copy `.env.example` to `.env` and fill in at least your API keys and provider settings (rate limits, default provider, etc.).
2. Run locally with Bun: `bun run dev`
3. Or build and run with Docker:
   - For MCP stdio integration: `docker compose run --rm mcp-offload-router`
   - `docker compose up` is intended for HTTP/SSE mode, which is not implemented in v1.

> **Note:** v1 only supports `TRANSPORT=stdio`. Set `TRANSPORT=stdio` in your `.env` for Claude Code / Cursor / Kimi Code / Codex CLI integration.

## Claude Code configuration

Add to your Claude Code MCP config (e.g., `~/.claude/config.json`), replacing `/absolute/path/to/mcp-offload-router` with your clone path:

```json
{
  "mcpServers": {
    "offload-router": {
      "command": "docker",
      "args": [
        "compose",
        "-f",
        "/absolute/path/to/mcp-offload-router/docker-compose.yml",
        "run",
        "--rm",
        "mcp-offload-router"
      ]
    }
  }
}
```

## Cursor configuration

Add to your Cursor MCP config (e.g., `~/.cursor/mcp.json`), replacing `/absolute/path/to/mcp-offload-router` with your clone path:

```json
{
  "mcpServers": {
    "offload-router": {
      "command": "docker",
      "args": [
        "compose",
        "-f",
        "/absolute/path/to/mcp-offload-router/docker-compose.yml",
        "run",
        "--rm",
        "mcp-offload-router"
      ]
    }
  }
}
```

## Available tools

All tools accept these parameters:

- `prompt` (string, required) — the main instruction or content
- `context` (string, optional) — additional background context
- `provider_preference` ("auto" | "minimax" | "syntheticnew" | "zai", optional) — default is `"auto"`
- `max_tokens` (number, optional) — default is `2048`

Tools:

- `summarize` — Summarize text
- `rewrite` — Rewrite text to a style or constraints
- `generate_code` — Generate code
- `review_code` — Review code
- `rag_lookup` — Answer a question from provided context
- `delegate_task` — Delegate a multi-step task

## Development

```bash
bun install
bun run typecheck
bun run test
bun run build
```

## Configuration

See `.env.example` for all environment variables.
