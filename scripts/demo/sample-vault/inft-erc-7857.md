---
title: iNFT (ERC-7857)
tags: [standards, 0g]
---

# iNFT — ERC-7857

ERC-7857 (the "intelligent NFT" standard, championed by 0G) extends ERC-721 with **mutable on-chain intelligence**: each token carries an array of `IntelligentData{ storageRoot, createdAt, description }`. Owners append new entries as the underlying intelligence (model weights, knowledge snapshot, fine-tune dataset) evolves.

Three reasons it's the right primitive for [[brainpedia-architecture]]:

1. **Ownership is portable** — sell/lease/burn like any NFT.
2. **Memory is verifiable** — the storage root resolves to bytes anyone can fetch and merkle-verify.
3. **Authorization is on-chain** — `authorizeUsage(agent, ttl)` grants pay-per-call access without an off-chain auth service. Pairs naturally with [[on-chain-payments]] and [[ens-as-identity]].

Compare to the Hugging Face / Replicate model: the model is a row in a database the platform controls. iNFTs make the asset itself the source of truth.
