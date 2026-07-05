# Icaruz promo video (Remotion)

60-second explainer for Icaruz — specialist brains, mixture routing, prefix-stable RAG, and dual economics (BTL + x402).

## Preview

```bash
cd apps/video
bun install
bun run dev
```

## Render MP4

```bash
bun run render
# → out/icaruz-promo.mp4
```

## Screenshots

Source files live in the repo root `screenshots/` folder. They are copied into `public/screenshots/` for Remotion:

| File | Scene |
|------|-------|
| `landing.png` | Intro (background) |
| `brains.png` | Solution |
| `ask-detail.png` | Cache / prefix-stable RAG |
| `create.png` | Create |
| `ask.png` | (available; swap in CacheScene if preferred) |

After updating screenshots at the repo root:

```bash
cp ../../screenshots/*.png public/screenshots/
bun run render
```

## Scene breakdown (~60s)

1. **Intro** — tagline over landing page
2. **Problem** — rebilled context, unpaid expertise, rotting vaults
3. **Solution** — brains catalog screenshot
4. **How it works** — fan-out diagram
5. **Cache** — prefix-stable prompt + ask receipt screenshot
6. **Economics** — btlEconomics + creatorEconomics receipts
7. **Create** — publish vault screenshot
8. **Outro** — GitHub + BTL Runtime CTA

## Customize timing

Edit `SCENE_DURATIONS` in `src/IcaruzPromo.tsx`.
