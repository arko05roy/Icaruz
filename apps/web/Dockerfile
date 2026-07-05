# syntax=docker/dockerfile:1.7
# Brainpedia web — monorepo-aware build.
# Single install+build stage so bun's workspace symlinks survive intact;
# slim runner stage with only what `next start` needs.

FROM oven/bun:1.3-alpine AS builder
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile
# Turbo walks dependsOn:[^build] so workspace deps tsc to dist/ before
# Next.js webpack tries to resolve @brainpedia/* imports.
RUN bun run build --filter=@brainpedia/web

FROM oven/bun:1.3-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /repo /repo
EXPOSE 3000
CMD ["bun", "run", "--cwd", "apps/web", "start"]
