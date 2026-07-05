---
title: Yggdrasil Mesh
tags: [networking, p2p]
---

# Yggdrasil Mesh

[Yggdrasil](https://yggdrasil-network.github.io/) is an end-to-end encrypted IPv6 overlay network. Every node has an Ed25519 keypair; the public key derives the node's IPv6 address. No central authority, no routing tables to maintain — peers discover each other and traffic flows over TLS-wrapped TCP.

Gensyn's **AXL** wraps Yggdrasil with an HTTP API at `127.0.0.1:9002` so applications can `POST /mcp/{peer_id}/{service}` (see [[mcp-protocol]]) and the daemon proxies the call to that peer's MCP service over the mesh. No Redis, no SQS, no central message bus.

This matters for the [[agentic-web-overview]] because it means agent-to-agent communication doesn't need a hosted broker. Two agents on opposite sides of the world (or two agents on a laptop in airplane mode) can exchange MCP calls without any intermediary you have to trust.

The Brainpedia [[brainpedia-architecture]] uses Yggdrasil/AXL as the routing fabric between the orchestrator and per-Brain processes — every fan-out is a real P2P hop.
