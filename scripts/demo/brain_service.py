#!/usr/bin/env python3
"""
Per-Brain MCP service. One process per Brain — registers a single tool
`query(prompt, accessToken?)` against the local AXL daemon.

Day 4 wires:
  - 0G Storage Log fetch for the Brain's snapshot manifest (retrieval)
  - 0G Compute call for inference
  - ENS access-token validation (resolve agent<hash>.client.<parent>)

Today this is a stub that echoes the prompt with a per-Brain prefix —
enough to prove the AXL routing works end-to-end.

Usage:
    python brain_service.py \
        --name defi \
        --axl-api http://127.0.0.1:9012 \
        --specialty defi-yield-strategies
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from typing import Any

# AXL ships a Python helper for MCP service registration; in real use this
# would import from `axl.mcp` or similar (see gensyn-ai/axl/examples/python-client).
# We keep the surface explicit so the wiring is obvious during the demo.


SERVICE_NAME = "brainpedia.brain"


async def handle_query(brain_name: str, specialty: str, params: dict[str, Any]) -> dict[str, Any]:
    prompt = params.get("prompt", "")
    # Day 4: retrieve top-K articles from 0G Storage Log,
    #        call 0G Compute with system prompt + retrieved context.
    return {
        "answer": f"[{brain_name}/{specialty}] stub answer for: {prompt}",
        "citations": [],
        "confidence": 0.0,
        "brainEnsName": f"{brain_name}.brainpedia.eth",
        "storageRoot": None,
    }


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True, help="Brain name (label).")
    parser.add_argument("--axl-api", required=True, help="Local AXL daemon HTTP API.")
    parser.add_argument("--specialty", required=True, help="Brain specialty.")
    args = parser.parse_args()

    # Day 4: register the service against the AXL daemon. The exact API
    # depends on the version of axl/python-client in use — see
    # https://github.com/gensyn-ai/axl/tree/main/examples/python-client
    print(
        json.dumps(
            {
                "status": "registered",
                "service": SERVICE_NAME,
                "brain": args.name,
                "specialty": args.specialty,
                "axl_api": args.axl_api,
            }
        )
    )

    # Keep the process alive — the AXL daemon proxies requests to this
    # process via the MCP transport once Day 4 wiring lands.
    try:
        while True:
            await asyncio.sleep(60)
    except asyncio.CancelledError:
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
