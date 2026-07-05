---
title: MCP Protocol
tags: [protocol, anthropic]
---

# MCP Protocol (Model Context Protocol)

Anthropic's [Model Context Protocol](https://modelcontextprotocol.io) is a JSON-RPC standard that lets a host LLM (Claude Desktop, IDE plugins, custom agents) call **tools** exposed by external **servers**. The protocol defines:

- **Tools** — typed functions the host can invoke (`name`, `inputSchema`, `description`).
- **Resources** — read-only data the host can fetch by URI.
- **Prompts** — pre-baked prompt templates.
- **stdio + SSE transports** — local processes (stdio) and remote (Server-Sent Events).

Why it matters for the [[agentic-web-overview]]: any service that speaks MCP becomes a first-class capability the host LLM can call without bespoke client code. Brainpedia exposes Brains *as* MCP services — Claude Desktop's user can call `query_brain('defi-yield-strategies', "what's safe?")` and the response composes into the chat naturally.

Combined with [[yggdrasil-mesh]], MCP also works peer-to-peer: AXL's `POST /mcp/{peer_id}/{service}` proxies an MCP envelope to a remote agent over the encrypted mesh.
