# Brainpedia AXL demo

Daemon-per-Brain reference deployment: spins up four separate AXL nodes
(one orchestrator + three Brains), each its own process with its own
Ed25519 key, and runs a Mixture-of-Brains query through them.

## Prereqs

1. Build the AXL `node` binary from [gensyn-ai/axl](https://github.com/gensyn-ai/axl):

   ```bash
   git clone https://github.com/gensyn-ai/axl
   cd axl && go build -o node ./cmd/node
   export AXL_BIN="$PWD/node"
   ```

2. Python deps:

   ```bash
   cd scripts/demo
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```

## Run

```bash
AXL_BIN=$AXL_BIN python axl_demo.py
```

Expected output:

```
orchestrator up on http://127.0.0.1:9002  peer=ab12cd34ef56…
  brain[defi] up on http://127.0.0.1:9012  peer=…
  brain[malaysia] up on http://127.0.0.1:9013  peer=…
  brain[mushroom] up on http://127.0.0.1:9014  peer=…

orchestrator sees 3 peers

=== fan-out results ===
[defi]      { "result": { "answer": "[defi/...] stub answer for: ..." } }
[malaysia]  { ... }
[mushroom]  { ... }

=== synthesized ===
...
```

## What's plumbed today vs. Day 4

| Piece | Today | Day 4 |
|---|---|---|
| Per-Brain AXL daemon | ✅ separate process, separate key | — |
| Orchestrator AXL daemon | ✅ | — |
| Topology / mesh formation | ✅ via `/topology` | — |
| `POST /mcp/{peer}/{service}` routing | ✅ | — |
| Brain `query` tool registration | stub `brain_service.py` | wire AXL Python MCP integration |
| 0G Storage retrieval inside Brain | — | fetch snapshot + top-K articles |
| 0G Compute inference inside Brain | — | broker + OpenAI-compat call |
| Synthesis on orchestrator | placeholder concat | 0G Compute call |
| ENS access-token validation | — | resolve `agent<hash>.client.<parent>` |
