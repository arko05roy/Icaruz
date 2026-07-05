# syntax=docker/dockerfile:1.7
# Brainpedia brain — JSON-RPC MCP server for the Brain side.
# Monorepo build: install once, turbo `dependsOn: ["^build"]` compiles every
# workspace dep (storage-0g, compute-0g, ens) to dist/ before brain itself.

FROM oven/bun:1.3-alpine AS builder
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build --filter=@brainpedia/brain

FROM oven/bun:1.3-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
# Railway injects PORT — cli.ts falls back to it if BRAIN_PORT is unset.
COPY --from=builder /repo /repo
EXPOSE 7100
CMD ["node", "apps/brain/dist/cli.js"]
