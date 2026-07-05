---
title: TEE-Attested Inference
tags: [compute, 0g, security]
---

# TEE-Attested Inference

A TEE (Trusted Execution Environment — Intel TDX, AMD SEV, NVIDIA H100 confidential compute) lets a remote operator run code on their hardware while *cryptographically proving* to the caller that:

1. The exact binary that ran is the one they advertised.
2. The inputs the binary saw were the inputs the caller sent.
3. The output the caller received is what the binary produced.

For [[brainpedia-architecture]], this matters because Brain owners are claiming "Qwen 2.5 7B answered your question". Without TEE attestation, the operator could swap in a cheaper or fine-tuned model and pocket the difference.

0G's compute network publishes a TEE attestation per response. The Brainpedia handler verifies it before returning `verified: true` to the caller — the field isn't decorative, it's load-bearing.

Compare to OpenAI: you cannot prove that GPT-4 (and not a distilled GPT-3.5) answered your call. The platform is the trust root.
