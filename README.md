# Fable Idler

A production-grade, browser-based idle game. You are a **Fable Weaver**: click to weave ✨ **Inspiration**, hire whimsical generators (muses, ink sprites, talking ravens…), buy upgrades, unlock achievements and milestones, and finally **Publish the Tome** — a prestige reset that grants permanent 🪶 **Golden Quills**.

- **Stack:** React 18 + TypeScript + Vite. The game engine is pure TypeScript (`src/engine/`, zero dependencies, no DOM) with the UI as a thin rendering layer on top.
- **No backend:** all persistence is `localStorage` + timestamp-based offline progress.
- **No Node.js required on the host.** Everything — dev server, tests, production build — runs through Docker / Docker Compose.

**Requirements:** Docker Desktop with Compose v2. Ports **8080** (production) and **5173** (dev) must be free.

---

## How to run

### Production (nginx, the deliverable)

```bash
docker compose up --build
```

Then open **http://localhost:8080**.

This runs the multi-stage `Dockerfile`: `node:22-alpine` installs dependencies (`npm ci`) and builds the bundle (`tsc --noEmit && vite build`), then `nginx:1.27-alpine` serves the static `dist/` with SPA fallback and immutable caching for hashed `/assets/`. The container has a healthcheck, so other services (E2E) can wait for it.

### Development (hot reload)

```bash
docker compose --profile dev up dev
```

Then open **http://localhost:5173**. Source files are bind-mounted; Vite hot-reloads on save (polling is enabled for Windows file-watching).

> **First run is slow (1–2 minutes):** the Node-based services (`dev`, `test-unit`, `test-e2e`) run `npm install` into a named Docker volume on first start. Subsequent runs reuse the volume and start in seconds. This is expected, not a bug.

### Stopping and cleaning up

```bash
docker compose down        # stop and remove containers (images and volumes kept)
docker compose down -v     # also delete the node_modules volumes (forces fresh npm install next time)
```

### Basic debugging

```bash
docker compose ps                      # what is running + health status of `web`
docker compose logs web                # nginx logs (add -f to follow)
docker compose logs dev                # Vite dev server output
docker compose build --no-cache web    # force a full image rebuild (e.g. suspected stale layer)
```

If port 8080 or 5173 is already taken, `docker compose up` fails with a bind error — stop the conflicting container/app first (`docker ps` to find it).

---

## Quick start for players

1. **Click the big “Weave ✨” button.** Each click earns Inspiration.
2. At **10** total Inspiration the shop opens — buy your first **Wandering Muse** (15 ✨). Generators produce Inspiration automatically; watch the **/sec** counter.
3. At **100** total earned the **Upgrades** tab appears. **Sharpened Nib** (click power ×2) is a great first buy.
4. At **500** total earned the **Moment of Inspiration** button unlocks: ×2 production and ×5 click power for 15 s, on a 90 s cooldown. Use it every time it is ready.
5. Keep expanding — new generators, upgrades, achievements (each one gives +1% global production) and quantity milestones (25/50/100 of a generator doubles its output) reveal themselves as you grow.
6. At **100,000** total earned this run, the **Publish the Tome** panel activates. Publishing resets your run but grants **Golden Quills** (+30% production each, forever). The second run is noticeably faster — that is the point.
7. The game **saves automatically** and earns while you are away (50% efficiency, up to 8 h). Just close the tab and come back later.
8. Back up your progress any time: **⚙️ Settings → Export** (see [Known limitations](#known-limitations)).

---

## How to test

### Unit tests (Vitest, 156 tests)

```bash
docker compose run --rm test-unit
```

Runs the whole engine suite (`tests/unit/`, Node environment, no DOM): number formatting, generator costs/bulk buying, the full production multiplier stack, click power, tick delta-time determinism, achievements, milestones, prestige formula + reset/persist split, offline progress, save round-trip/migration/corruption fallback, settings persistence, and a deterministic progression-speed simulation.

Typecheck on its own:

```bash
docker compose run --rm test-unit sh -c "npm install --no-audit --no-fund && npx tsc --noEmit"
```

### End-to-end tests (Playwright)

```bash
docker compose run --rm --build test-e2e
```

This (re)builds the `web` image, waits for its **healthcheck** to pass, then runs Playwright inside the official `mcr.microsoft.com/playwright:v1.49.1-noble` image against **the real production nginx build** (`PW_BASE_URL=http://web:80` over the compose network). No `--profile test` flag is needed — `docker compose run` activates the service's profile implicitly.

E2E specs use a test hook: loading the game with `?test=1` exposes `window.__FABLE_TEST__` (`getState` / `dispatch` / `addInspiration` / `fastForward` / `saveNow`). Without the query parameter the hook is completely inert — it exists so tests can exercise the exact artifact that ships.

> **Playwright version pin — invariant:** `@playwright/test` is pinned to **1.49.1** (exact, no caret) in `package.json`, and the E2E image tag is **`v1.49.1-noble`** in `docker-compose.yml`. **These two must always be changed together, in the same commit.** A mismatch means the browsers baked into the image don't match the npm package, and E2E fails with cryptic "browser not found" errors.

---

## How to build

The production build is produced inside Docker (stage 2 of the `Dockerfile` runs `npm run build`, which is `tsc --noEmit && vite build`):

```bash
docker compose build web          # build the production image only
docker compose up --build         # build + run
docker compose build --no-cache web   # force a clean rebuild, ignoring layer cache
```

The result is a fully static bundle (~200 KB JS, ~63 KB gzipped, plus CSS and self-hosted woff2 fonts — zero CDN/external requests) baked into the nginx image. There is no build output on the host; `dist/` on the host only appears if you run a build via a bind-mounted container yourself.

---

## Project structure

```
Fable Idler/
├── index.html                  # Vite entry (root div + anti-flash background)
├── package.json                # scripts: dev / build / test / test:e2e
├── tsconfig.json               # strict TS; includes src + tests/unit
├── vite.config.ts              # React plugin, Vitest config (tests/unit, node env)
├── playwright.config.ts        # testDir tests/e2e, baseURL from PW_BASE_URL
├── Dockerfile                  # node:22-alpine (deps → build) → nginx:1.27-alpine + healthcheck
├── docker-compose.yml          # services: web (8080), dev (5173), test-unit, test-e2e
├── nginx.conf                  # SPA fallback + immutable cache for /assets/
├── ai-memory/                  # design & implementation docs written by the AI agents
├── tools/
│   ├── economy-sim.mjs         # standalone economy balance simulator
│   └── screenshots.mjs         # visual QA: captures at 3 viewports (run in the test-e2e container)
├── src/
│   ├── main.tsx                # bootstrap: load save → offline report → create store → render → start loop
│   ├── engine/                 # PURE TypeScript game engine — no React, no DOM (localStorage injectable)
│   │   ├── config.ts           # every balance number lives here and only here
│   │   ├── types.ts            # GameState (run/meta split), Action union, literal id types
│   │   ├── state.ts            # initial-state factories
│   │   ├── generators.ts       # cost curve, buy 1/10/max
│   │   ├── upgrades.ts         # unlock evaluation + purchase
│   │   ├── achievements.ts     # 14 achievement conditions (idempotent checks)
│   │   ├── milestones.ts       # 11 reveal milestones + qty:<gen>:<25|50|100>
│   │   ├── buff.ts             # Moment of Inspiration (epoch-ms based)
│   │   ├── prestige.ts         # quill formula, Publish the Tome
│   │   ├── offline.ts          # offline report (efficiency + cap)
│   │   ├── selectors.ts        # ALL derived values (per-second, click power, multipliers)
│   │   ├── tick.ts             # pure tick(state, now, dt) — delta-time deterministic
│   │   ├── save.ts             # versioned schema v1, migrations, export/import, corruption guard
│   │   ├── format-numbers.ts   # 1.23K … 1.23e35
│   │   ├── game-loop.ts        # createGameStore(): setInterval shell, dispatch, autosave, events
│   │   └── index.ts            # the engine's public API — UI imports only from here
│   └── ui/
│       ├── App.tsx / App.css   # responsive layout (3 columns / 2 / mobile bottom-nav)
│       ├── components/         # ClickButton, GeneratorList, UpgradeList, AchievementGrid,
│       │                       # PrestigePanel, OfflineModal, SettingsPanel, Toast, …
│       ├── hooks/              # useGameStore (useSyncExternalStore), useLayoutMode
│       ├── styles/             # design tokens + animations (reduced-motion aware)
│       ├── test-hook.ts        # window.__FABLE_TEST__ (only with ?test=1)
│       └── icons.ts / meta.ts / format.ts
└── tests/
    ├── unit/                   # Vitest — 13 test files + helpers, 156 tests, engine only
    └── e2e/                    # Playwright — runs against the production nginx build
```

---

## Game systems

### Resource: Inspiration ✨

One primary resource. Earned actively (clicking **Weave**) and passively (generators). Formatted with suffixes (`1.23K`, `45.6M`, … `No`) and scientific notation from 1e33.

### Generators (7)

Cost scales as `baseCost × growth^owned` (rounded up). Bought ×1, ×10, or ×Max.

| Generator | Base cost | Base /sec | Growth |
|---|---:|---:|---:|
| Wandering Muse | 15 | 0.1 | ×1.15 |
| Ink Sprite | 100 | 1 | ×1.15 |
| Talking Raven | 1,100 | 8 | ×1.14 |
| Enchanted Quill | 12,000 | 47 | ×1.13 |
| Story Loom | 130,000 | 260 | ×1.13 |
| Dream Library | 1,400,000 | 1,400 | ×1.12 |
| Fable Forge | 20,000,000 | 7,800 | ×1.12 |

### Upgrades (11)

One-time purchases with unlock conditions: **Sharpened Nib** (click ×2), **Muse's Chorus** (Muse ×2), **Golden Inkwell** (all production ×1.5), **Raven's Gossip** (+5% Ink Sprite per Raven), **Weaver's Rhythm** (+10% Enchanted Quill per Loom), **Lucid Dreaming** (offline 50%→75%, cap 8h→12h), **Burst of Genius** (buff lasts 50% longer), **Ink Echo** (each click adds 1% of your /sec), **Patron's Favor** (generators cost −5%), **Bound Anthology** (achievement bonus +1%→+2% each), and **Quill Resonance** (the Golden Quill bonus also applies to clicks — the only upgrade that **persists through prestige**; unlocked after your first Tome).

### Moment of Inspiration (buff)

Unlocked at 500 total earned. On activation: **production ×2 and click power ×5 for 15 s** (22.5 s with Burst of Genius), 90 s cooldown measured from activation. Does not apply to offline gains.

### Achievements (14)

Permanent (survive prestige). Each grants **+1% global production** (additive; +2% each with Bound Anthology). Range from "First Words" (first click) to "Serial Novelist" (publish 3 Tomes).

### Milestones

- **11 reveal milestones per run** (re-earned after prestige): progressively unlock the shop, each generator, the Upgrades tab, the buff, the Achievements panel, and the Prestige panel — driven by total earned this run.
- **Quantity milestones:** owning **25 / 50 / 100** of a generator multiplies that generator's output **×2 each time** (×8 at 100).

### Prestige — Publish the Tome

Available at **≥ 100,000 total earned in the current run**.

```
Golden Quills gained = floor( sqrt( totalEarnedThisRun / 100,000 ) )
```

(100k → 1, 400k → 2, 900k → 3, 10M → 10.) Each Golden Quill gives a permanent **+30% global production** (additive between quills). Publishing **resets** the run: balance, total earned, generators, run upgrades, milestones, buff. It **keeps**: Golden Quills, Tomes published, achievements, lifetime stats, settings, and Quill Resonance.

### Offline progress

While the tab is closed — or the device sleeps with the tab open (any gap over 60 s takes the same path) — you earn `production/sec × elapsed × 50%`, capped at **8 hours** (75% / **12 hours** with Lucid Dreaming). On return, a "While you were away" modal reports the gain (shown when you were away ≥ 60 s and actually earned something). The buff never applies offline.

### Saving

- **Autosave** every ~10 s, plus on tab hide/close and immediately after critical actions (upgrade purchase, prestige, import, settings change).
- **Save key:** `localStorage["fable-idler-save-v1"]` (versioned JSON schema with a migration chain). A corrupted save never crashes the game — the raw string is moved to `fable-idler-save-v1:corrupt` and a fresh game starts.
- **Backup / restore:** ⚙️ **Settings → Export** gives a base64 string (copy it somewhere safe); **Import** restores it. Do this before experimenting or switching browsers/machines.
- **Hard reset** is double-confirmed (including typing `RESET`) and offers export first.

---

## Known limitations

- **Multi-tab: last-writer-wins.** Two tabs on the same save both write to `localStorage`; whichever saves last silently wins, so a few seconds of progress can be lost. Play in one tab. (Accepted for v1; no locking.)
- **Playwright pin invariant** (worth repeating): `@playwright/test 1.49.1` ↔ image `v1.49.1-noble` must be bumped **together**, or E2E breaks cryptically.
- **First `npm install` into the named volumes takes 1–2 min** on Windows (that is also why `node_modules` lives in named volumes instead of the bind mount — host bind mounts are slow and the host has no Node anyway).
- **No backend / no cloud sync.** Progress lives in the browser profile of one machine. Clearing site data deletes it — use Settings → Export for backups.
- **Native `number` (double) math.** Fine with huge headroom for the v1 economy (endgame ~1e15 vs double's ~1.8e308); values ≥ 1e33 display in scientific notation.
- **Test hook ships in the production bundle** but is completely inert without `?test=1`; the game is local single-player, so this is not a cheat surface beyond what localStorage already allows.
- **Tablet/mobile layouts** are implemented per the design spec but received less in-browser visual QA than the desktop layout (Playwright runs at 1280×720).
