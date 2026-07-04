# Fable Idler

A production-grade, browser-based idle game. You are a **Fable Weaver**: click to weave ✨ **Inspiration**, hire whimsical generators (muses, ink sprites, talking ravens…), buy upgrades, unlock achievements and milestones, and **Publish the Tome** — a prestige reset that grants permanent 🪶 **Golden Quills**. In v2, Golden Quills became a currency: spend them in **The Gilded Atelier**, catch **Stray Sparks**, fill **The Bookshelf** with procedural fables, and (optionally) compete in the **Hall of Fables** online leaderboard. **v3 (The Long Road)** turns the mid/late game into a weeks-long arc: **14 generators** (six new tiers gated behind The New Wing), **deep-buy thresholds** to 500 with a **unique bonus at 200** on every generator, a **segmented prestige curve** that tames quill inflation, and eight more Atelier commissions + four late-game relics.

- **Stack:** React 18 + TypeScript + Vite. The game engine is pure TypeScript (`src/engine/`, zero dependencies, no DOM) with the UI as a thin rendering layer on top.
- **Client-side game, optional backend:** all game persistence is `localStorage` + timestamp-based offline progress. The only backend is a tiny zero-dependency Node server for the Hall of Fables leaderboard (`server/`) — the game runs 100% without it and degrades gracefully.
- **No Node.js required on the host.** Everything — dev server, tests, production build, the leaderboard API — runs through Docker / Docker Compose.

**Requirements:** Docker Desktop with Compose v2. Ports **8080** (production) and **5173** (dev) must be free.

---

## How to run

### Production (nginx + leaderboard API, the deliverable)

```bash
docker compose up --build
```

Then open **http://localhost:8080**.

This starts two services:

- **`web`** — the multi-stage `Dockerfile`: `node:22-alpine` installs dependencies (`npm ci`) and builds the bundle (`tsc --noEmit && vite build`), then `nginx:1.27-alpine` serves the static `dist/` with SPA fallback, immutable caching for hashed `/assets/`, and a reverse proxy for `/api/` to the leaderboard. Has a healthcheck, so other services (E2E) can wait for it.
- **`api`** — the Hall of Fables leaderboard (`server/`, Node 22, zero npm dependencies). **Internal only: no host port.** All traffic reaches it through nginx at `/api/`. Standings persist in the named Docker volume `leaderboard_data`.

**The game also runs entirely without the API:**

```bash
docker compose up --build web
```

nginx resolves the `api` hostname lazily, so `web` starts fine alone; the Hall of Fables panel simply shows an "offline" state (with cached standings if any) and every other system works normally.

### Development (hot reload)

```bash
docker compose --profile dev up dev
```

Then open **http://localhost:5173**. Source files are bind-mounted; Vite hot-reloads on save (polling is enabled for Windows file-watching). The `dev` service starts `api` too, and Vite proxies `/api` to it.

> **First run is slow (1–2 minutes):** the Node-based services (`dev`, `test-unit`, `test-e2e`) run `npm install` into a named Docker volume on first start. Subsequent runs reuse the volume and start in seconds. This is expected, not a bug.

### Stopping and cleaning up

```bash
docker compose down        # stop and remove containers (images and volumes kept)
docker compose down -v     # ALSO deletes the node_modules volumes AND the leaderboard data volume
```

> **Careful with `down -v`:** since v2 it also deletes `leaderboard_data` (all leaderboard entries and nickname reservations). Player game saves are unaffected — they live in each browser's `localStorage`, never on the server.

### Basic debugging

```bash
docker compose ps                      # what is running + health status of `web` and `api`
docker compose logs web                # nginx logs (add -f to follow)
docker compose logs api                # leaderboard API logs
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
5. At **1,000** total earned, keep an eye out — a ✨ **Stray Spark** occasionally drifts across the screen. Click it before it escapes for a random reward.
6. Keep expanding — new generators, upgrades, achievements (each one gives +1% global production) and quantity milestones (25/50/100 of a generator doubles its output) reveal themselves as you grow.
7. At **100,000** total earned this run, the **Publish the Tome** panel activates. Publishing resets your run but grants **Golden Quills** (+30% production each, forever) — and after your first Tome, opens **Act 2**: **The Gilded Atelier** (spend quills on permanent upgrades — spending never lowers your production bonus), **The Bookshelf** (every Tome pens a fable worth +2% production), and the **Hall of Fables** (optional leaderboard).
8. **The Long Road (v3):** save **25 🪶** for **The New Wing** in the Atelier — it unlocks tier-9 **Saga Citadel** and five more generators, in three levels (25 / 2,500 / 60,000 🪶). Keep **deep-buying** a generator past 100: **150** doubles it, **200** lights its **unique bonus** (a permanent-flavored twist, one per generator), and **500** is a ×4 grand-finale badge. Runs and prestige now stretch into days and weeks — the segmented quill curve rewards pushing further before each Publish.
9. The game **saves automatically** and earns while you are away (50% efficiency, up to 8 h — both improvable in v2/v3, up to 48 h). Just close the tab and come back later.
10. Back up your progress any time: **⚙️ Settings → Export** (see [Known limitations](#known-limitations)).

---

## How to test

### Unit + server tests (Vitest, 399 tests)

```bash
docker compose run --rm test-unit
```

One command runs both suites (via `vite.config.ts` `test.include`):

- **`tests/unit/` — 380 engine tests** (Node environment, no DOM): number formatting, generator costs/bulk buying, the full production multiplier stack, click power + crits, tick delta-time determinism (including deterministic auto-buy), achievements, milestones, prestige formula + reset/persist split, offline progress, save round-trip/**v1→v2→v3 migration**/corruption fallback, settings persistence, the Gilded Atelier, Stray Spark rewards, procedural fables/Bookshelf, and the v3 longevity systems: the **Deep Shelves** band-tapered cost curve, the **segmented prestige curve** (a 200k-sample property test proving it is bit-identical to v1 below the 1e9 knee), the **14 unique bonuses** at 200 owned, and New Wing gating / re-scalers / Atlas / relics.
- **`tests/server/` — 19 leaderboard API tests**: real HTTP against the actual server (`createApp().listen(0)` in-process, ephemeral port, injected clock) — claim/update/rename flows, validation errors with exact `field`, best-keeping semantics, all four sort orders + tie-breaks, rate limiting with `Retry-After`, persistence round-trip, and corrupted-data-file recovery. No Docker-in-Docker involved.

Typecheck on its own:

```bash
docker compose run --rm test-unit sh -c "npm install --no-audit --no-fund && npx tsc --noEmit"
```

### End-to-end tests (Playwright)

```bash
docker compose run --rm --build test-e2e
```

This (re)builds the `web` image, waits for the **healthchecks** of both `web` and `api` to pass, then runs the Playwright specs from `tests/e2e/` (**18 tests across 14 specs**, covering v1 gameplay, the v2 Atelier/leaderboard/spark/bookshelf/migration flows, and the v3 New-Wing → Saga-Citadel → unique-bonus flow) inside the official `mcr.microsoft.com/playwright:v1.49.1-noble` image against **the real production nginx build** (`PW_BASE_URL=http://web:80` over the compose network) — including the real leaderboard API behind nginx. No `--profile test` flag is needed — `docker compose run` activates the service's profile implicitly.

E2E specs use a test hook: loading the game with `?test=1` exposes `window.__FABLE_TEST__` (`getState` / `dispatch` / `addInspiration` / `fastForward` / `saveNow` / `forceSpark`). Without the query parameter the hook is completely inert — it exists so tests can exercise the exact artifact that ships.

> **Playwright version pin — invariant:** `@playwright/test` is pinned to **1.49.1** (exact, no caret) in `package.json`, and the E2E image tag is **`v1.49.1-noble`** in `docker-compose.yml`. **These two must always be changed together, in the same commit.** A mismatch means the browsers baked into the image don't match the npm package, and E2E fails with cryptic "browser not found" errors.

> The E2E suite leaves entries in the `leaderboard_data` volume between runs (`down` without `-v` keeps it) — nicknames from previous runs stay reserved.

---

## How to build

The production build is produced inside Docker (stage 2 of the `Dockerfile` runs `npm run build`, which is `tsc --noEmit && vite build`):

```bash
docker compose build web          # build the production game image only
docker compose build api          # build the leaderboard API image only
docker compose up --build         # build + run everything
docker compose build --no-cache web   # force a clean rebuild, ignoring layer cache
```

The result is a fully static bundle (~272 KB JS, ~85 KB gzipped, plus ~52 KB CSS and self-hosted woff2 fonts — zero CDN/external requests) baked into the nginx image. The API image is `node:22-alpine` + the plain `.mjs` sources from `server/src/` — no build step, no npm dependencies. There is no build output on the host; `dist/` on the host only appears if you run a build via a bind-mounted container yourself.

---

## Project structure

```
Fable Idler/
├── index.html                  # Vite entry (root div + anti-flash background)
├── package.json                # scripts: dev / build / test / test:e2e
├── tsconfig.json               # strict TS; includes src + tests/unit
├── vite.config.ts              # React plugin, /api dev proxy, Vitest config (tests/unit + tests/server)
├── playwright.config.ts        # testDir tests/e2e, baseURL from PW_BASE_URL
├── Dockerfile                  # web: node:22-alpine (deps → build) → nginx:1.27-alpine + healthcheck
├── docker-compose.yml          # services: web (8080), api (internal), dev (5173), test-unit, test-e2e
├── nginx.conf                  # SPA fallback + /api/ reverse proxy (lazy DNS) + immutable cache for /assets/
├── ai-memory/                  # design & implementation docs written by the AI agents
├── tools/
│   ├── economy-sim.mjs         # standalone economy balance simulator (v1)
│   ├── economy-sim-v2.mjs      # v2 economy simulator (Atelier / sparks / fables)
│   ├── economy-sim-longevity.mjs  # v3 economy simulator (RUN L0–L10: 30/56-day casual arc, prestige sweep)
│   └── screenshots.mjs         # visual QA: captures at 3 viewports (run in the test-e2e container)
├── server/                     # Hall of Fables leaderboard API — Node 22, ZERO npm dependencies
│   ├── Dockerfile              # node:22-alpine, non-root, /data volume, healthcheck
│   └── src/
│       ├── server.mjs          # entrypoint: env config → createApp().listen, graceful SIGTERM flush
│       ├── app.mjs             # routes: POST /api/leaderboard/submit, GET /api/leaderboard/top, GET /api/health
│       ├── store.mjs           # in-memory Map + atomic JSON snapshots to /data (corruption-safe boot)
│       ├── validate.mjs        # nickname + score validation (same rules the client mirrors)
│       ├── rate-limit.mjs      # fixed-window per-IP limits (10 submit/min, 60 read/min)
│       └── app.d.mts           # hand-written type declarations for the Vitest suite
├── src/
│   ├── main.tsx                # bootstrap: load save → offline report → create store → leaderboard client → render → start loop
│   ├── engine/                 # PURE TypeScript game engine — no React, no DOM, no network (localStorage injectable)
│   │   ├── config.ts           # every balance number lives here and only here (v1 + v2 + v3)
│   │   ├── types.ts            # GameState (run/meta split), Action union, literal id types
│   │   ├── state.ts            # initial-state factories (Atelier-aware run construction)
│   │   ├── generators.ts       # cost curve (v3 Deep Shelves band taper), buy 1/10/max, best-payback
│   │   ├── upgrades.ts         # unlock evaluation + purchase
│   │   ├── atelier.ts          # v2/v3: Gilded Atelier purchases, levels, relic helpers, New Wing level
│   │   ├── spark.ts            # v2: Stray Spark weights, reward computation, collection
│   │   ├── fables.ts           # v2: procedural fable titles (append-only word tables), Bookshelf
│   │   ├── unique-bonuses.ts   # v3: the 14 per-generator unique bonuses at 200 (or 150) owned
│   │   ├── achievements.ts     # 36 achievement conditions (idempotent checks)
│   │   ├── milestones.ts       # 21 reveal milestones + qty:<gen>:<25|50|100|150|200|300|400|500>
│   │   ├── buff.ts             # Moment of Inspiration (epoch-ms based, Atelier-aware cooldown)
│   │   ├── prestige.ts         # segmented quill formula (net of seeded), Publish the Tome, fables, run rebuild
│   │   ├── offline.ts          # offline report (efficiency + cap, relic/Atelier-aware)
│   │   ├── selectors.ts        # ALL derived values (per-second, click power + crits, multipliers)
│   │   ├── tick.ts             # pure tick(state, now, dt) — delta-time deterministic, incl. auto-buy
│   │   ├── save.ts             # versioned schema v3, v1→v2→v3 migration, export/import, corruption guard
│   │   ├── format-numbers.ts   # 1.23K … 1.23e35
│   │   ├── game-loop.ts        # createGameStore(): setInterval shell, dispatch, autosave, events
│   │   └── index.ts            # the engine's public API — UI imports only from here
│   └── ui/
│       ├── App.tsx / App.css   # responsive layout (3 columns / 2 / mobile bottom-nav), Act-2 reveal
│       ├── leaderboard-client.ts  # Hall of Fables client: fetch + backoff, offline cache, submit triggers
│       ├── components/         # ClickButton, GeneratorList, UpgradeList, AchievementGrid,
│       │                       # PrestigePanel, OfflineModal, SettingsPanel, Toast, …
│       │                       # v2: AtelierPanel, BookshelfPanel, HallOfFablesPanel, StraySpark
│       ├── hooks/              # useGameStore (useSyncExternalStore), useLayoutMode, useStraySpark
│       ├── styles/             # design tokens + animations (reduced-motion aware)
│       ├── test-hook.ts        # window.__FABLE_TEST__ (only with ?test=1)
│       └── icons.ts / meta.ts / format.ts
└── tests/
    ├── unit/                   # Vitest — 23 test files + helpers, 380 tests, engine only (v1 + v2 + v3)
    ├── server/                 # Vitest — 19 real-HTTP tests against the leaderboard server (in-process)
    └── e2e/                    # Playwright — 18 tests in 14 specs, against the production nginx build + real API
```

---

## Game systems

### Resource: Inspiration ✨

One primary resource. Earned actively (clicking **Weave**) and passively (generators). Formatted with suffixes (`1.23K`, `45.6M`, … `No`) and scientific notation from 1e33.

### Generators (14)

Cost scales as `baseCost × growth^owned` (rounded up), gentled above 100 owned by [Deep Shelves](#deep-shelves-v3). Bought ×1, ×10, or ×Max. Tiers 1–8 are unchanged; tiers 9–14 (v3) are gated behind [The New Wing](#the-new-wing-tiers-914-v3) and never render without their wing level.

| # | Generator | Base cost | Base /sec | Growth | Gate |
|---:|---|---:|---:|---:|---|
| 1 | Wandering Muse | 15 | 0.1 | ×1.15 | — |
| 2 | Ink Sprite | 100 | 1 | ×1.15 | — |
| 3 | Talking Raven | 1,100 | 8 | ×1.14 | — |
| 4 | Enchanted Quill | 12,000 | 47 | ×1.13 | — |
| 5 | Story Loom | 130,000 | 260 | ×1.13 | — |
| 6 | Dream Library | 1,400,000 | 1,400 | ×1.12 | — |
| 7 | Fable Forge | 20,000,000 | 7,800 | ×1.12 | — |
| 8 | Myth Engine (v2) | 300,000,000 | 45,000 | ×1.12 | Blueprint of Myths (12 🪶) |
| 9 | Saga Citadel (v3) | 6e9 | 320,000 | ×1.11 | The New Wing L1 |
| 10 | The Narrators' Guild (v3) | 1.3e11 | 2.4M | ×1.11 | The New Wing L1 |
| 11 | Pantheon Press (v3) | 3e12 | 18M | ×1.11 | The New Wing L2 |
| 12 | World-Tree Archive (v3) | 7e13 | 140M | ×1.10 | The New Wing L2 |
| 13 | The Sleeping City (v3) | 1.7e15 | 1.05B | ×1.11 | The New Wing L3 |
| 14 | Once Upon a Time (v3) | 4.2e16 | 8B | ×1.12 | The New Wing L3 |

The **Myth Engine** (tier 8, v2) never appears without its Atelier blueprint — see [Myth Engine](#myth-engine-v2). The six v3 tiers cost ×20–25 per step and continue the same "never render without the gate" rule, one wing level per pair.

### Upgrades (11)

One-time purchases with unlock conditions: **Sharpened Nib** (click ×2), **Muse's Chorus** (Muse ×2), **Golden Inkwell** (all production ×1.5), **Raven's Gossip** (+5% Ink Sprite per Raven), **Weaver's Rhythm** (+10% Enchanted Quill per Loom), **Lucid Dreaming** (offline 50%→75%, cap 8h→12h), **Burst of Genius** (buff lasts 50% longer), **Ink Echo** (each click adds 1% of your /sec), **Patron's Favor** (generators cost −5%), **Bound Anthology** (achievement bonus +1%→+2% each), and **Quill Resonance** (the Golden Quill bonus also applies to clicks — persists through prestige; unlocked after your first Tome). In v2, the Atelier's **Second Bookmark** can carry your cheapest owned upgrades through a Publish.

### Moment of Inspiration (buff)

Unlocked at 500 total earned. On activation: **production ×2 and click power ×5 for 15 s** (22.5 s with Burst of Genius), 90 s cooldown measured from activation (75/60 s with the Atelier's Restless Heart). Does not apply to offline gains.

### Achievements (36)

Permanent (survive prestige). Each grants **+1% global production** (additive; +2% each with Bound Anthology). 14 from v1 ("First Words" … "Serial Novelist"), 10 from v2 (Atelier, sparks, fables, relics, the Myth Engine, joining the leaderboard), plus **12 v3 achievements** for the long arc: buying your first tier-9 generator, owning all 14, hitting 200 and 500 of one generator, reaching 1e15 in a run and 1e21 lifetime Inspiration, maxing The New Wing, 1,000 lifetime quills, 50 and 200 Tomes, 100 × Once Upon a Time, and 100% completion (all relics + all Atelier upgrades).

### Milestones

- **21 reveal milestones** (re-earned after prestige): 12 driven by total earned this run — progressively unlocking the shop, each v1 generator, the Upgrades tab, the buff, the Achievements panel, the Prestige panel, and (at 1,000) Stray Sparks — plus 3 unlocked by your first published Tome (the Gilded Atelier, the Bookshelf, the Hall of Fables = "Act 2"), plus **6 v3 reveals** for tiers 9–14 (each fires once its total-earned threshold is passed *and* the matching New Wing level is owned).
- **Quantity milestones:** owning **25 / 50 / 100** of a generator multiplies its output **×2 each time** (×8 at 100). v3 adds deeper steps — see [Deep-buy thresholds](#deep-buy-thresholds--unique-bonuses-v3). Applies to every generator, the Myth Engine included.

### Prestige — Publish the Tome

Available at **≥ 100,000 total earned in the current run**. The reward is a **segmented curve (v3)** — pure `sqrt` up to the 1e9 knee (identical to v1/v2), then gentler roots so quills don't explode over the weeks-long arc:

```
Golden Quills = floor( sqrt( net / 100,000 ) )                 for net ≤ 1e9   (EXACT v1/v2)
              = floor( 100  × (net / 1e9)^(1/6) )              for 1e9 < net ≤ 1e15
              = floor( 1000 × (net / 1e15)^(1/12) )            for net > 1e15
```

`net` is `totalEarnedThisRun` minus any **seeded** starting capital (Dog-Eared Page + Foreword by the Editor), so a head-start can't be re-published for free quills. The curve is continuous and monotonic at both knees: 100k → 1, 400k → 2, 10M → 10, **1e9 → 100 (identical to v1)**, 1e15 → 1,000, 1e21 → 3,162. (The old pure `sqrt` would have handed out 100,000 at 1e15 — the v3 curve gives 1,000, a ×100 brake.) Publishing **resets** the run: balance, total earned, generators, run upgrades (minus Second Bookmark / Perpetual Manuscript keeps), milestones, buff. It **keeps**: Golden Quills, Tomes published, achievements, lifetime stats, settings, Quill Resonance, all Atelier upgrades, relics, and the Bookshelf. Each Publish also **pens a new fable** onto the Bookshelf, and with Editor's Due (and Divine Royalties) grants bonus quills.

**The golden rule (v2):** the permanent **+30% production per Golden Quill** is computed from your **lifetime quills earned**, not your current balance. Spending quills in the Atelier **never** lowers your production bonus — the header chip shows your spendable purse, the tooltip shows the lifetime anchor.

### The Gilded Atelier (v2 + v3)

Unlocked by your first Publish. A permanent shop of **16 upgrades** (some multi-level) that spend Golden Quills from your purse — **470,852 quills** to fully commission everything (the six v3 entries are the multi-week sink):

| Upgrade | Cost (🪶) | Effect |
|---|---|---|
| Apprentice Muse | 1 / 3 / 8 | Start each run with 5 / 15 / 30 Wandering Muses |
| Self-Writing Contract | 4 | Auto-buys 1 Muse per second while she costs ≤1% of your Inspiration |
| Stroke of Genius | 2 / 6 | 5% / 10% chance a click crits for ×10 |
| Blueprint of Myths | 12 | Unlocks generator 8: the Myth Engine |
| Restless Heart | 3 / 7 | Buff cooldown 90s → 75s → 60s |
| Thunderous Applause | 4 | Activating the buff instantly grants 20 s of current production |
| Night Owl Pact | 5 | Offline cap +12 h (8h → 20h; with Lucid Dreaming 12h → 24h) |
| Sparkcatcher's Net | 2 / 5 | Sparks appear twice as often; then spark rewards ×2 |
| Second Bookmark | 6 / 14 | Your 2 / 4 cheapest owned run upgrades survive each Publish |
| Editor's Due | 10 | Each Publish grants +1 bonus Golden Quill |
| **The New Wing** (v3) | 25 / 2,500 / 60,000 | Unlocks generator tiers 9–10 / 11–12 / 13–14 (each level, one pair) |
| **Clockwork Understudy** (v3) | 40 | Auto-buys *every* generator (best payback first; needs Self-Writing Contract) |
| **Curator's Patience** (v3) | 75 | Offline cap +24 h (up to 48 h combined) |
| **Perpetual Manuscript** (v3) | 120 | All 10 v1 run upgrades survive each Publish (the 7 v3 re-scalers never do) |
| **Strength of the Stacks** (v3) | 8,000 | Quantity thresholds above 100 give ×2.5 instead of ×2 (and ×5 at 500) |
| **Atlas of Untold Lands** (v3) | 400,000 | Global production ×2, forever — the capstone |

Purchases costing **≥ 10 🪶** ask for confirmation. Story Fragments from sparks bind into a free quill at **5 fragments** (3 with Pilgrims' Pages).

### Relics of the Published (v2 + v3)

Trophies derived purely from your **Tomes published** count (never stored in the save — they can't be lost or faked in):

| Relic | Tomes | Effect |
|---|---:|---|
| Dog-Eared Page | 3 | Start each run with 300 Inspiration |
| Standing Ovation | 7 | The first manual buff each run lasts twice as long |
| Ink That Remembers | 15 | Global production +1% per Tome published, forever |
| The Reader's Letter | 30 | Offline efficiency +10 percentage points |
| **Foreword by the Editor** (v3) | 50 | Start each run with 0.1% of last run's total earned (cap 1e18; seeded, so not re-publishable for quills) |
| **Pilgrims' Pages** (v3) | 75 | Story Fragments per Golden Quill 5 → 3 |
| **The Hundredth Telling** (v3) | 100 | Unique bonuses fire at 150 owned instead of 200 |
| **The Endless Shelf** (v3) | 200 | Bookshelf cap 25 → 100 counted fables (+200% max) |

### Stray Spark (v2)

Unlocked at **1,000 total earned** (milestone "A Light at the Window"). While the tab is visible, a spark drifts across the screen every **150–330 s** (avg ~4 min; twice as often with Sparkcatcher's Net) and flies for **10 s** — click it before it escapes. Rewards (weighted roll):

| Reward | Chance | Effect |
|---|---:|---|
| Ink Burst | 45% | Instantly grants 45 s of current production (min: 50 clicks' worth) |
| Quill Frenzy | 20% | Click power ×7 for 30 s |
| Gossip Bonanza | 15% | Muses, Sprites and Ravens ×5 for 60 s |
| Time Slip | 10% | Moment of Inspiration cooldown reset + a free activation |
| Story Fragment | 8% | +1 fragment — every 5 bind into a Golden Quill |
| Golden Quill Drop | 2% | +1 Golden Quill, instantly |

Sparkcatcher's Net L2 doubles amounts/durations (never Time Slip). Sparks are never saved — an uncaught spark is simply gone, and none spawn while the tab is hidden or offline.

### The Bookshelf (v2)

Every Publish pens a **procedural fable** (title generated from append-only word tables, seeded by the run) onto your shelf. Each **unique** title grants **+2% global production**, counted up to **25 fables (+50% max)** — duplicates are "a reprint!" and count once. A spine turns **gilded** when its publish earned ≥ 5 quills. Tomes published before v2 appear as **faded** spines with regenerated titles — they still count.

### Myth Engine (v2)

The tier-8 generator. It requires **both** the **Blueprint of Myths** (12 🪶, Atelier) and 150M total earned this run to appear in the shop — without the Blueprint the row doesn't render at all (not even as a teaser). Quantity milestones apply normally; the v1 "Well-Rounded Library" achievement deliberately excludes it, so v1 goals stay reachable without the Atelier.

### The New Wing — tiers 9–14 (v3)

The three-level Atelier commission that opens the late game. Each level unlocks one *pair* of generators and, like the Myth Engine, a locked tier's row does not render at all — no teaser leaks a tier you can't reach:

- **L1 (25 🪶):** Saga Citadel (9) + The Narrators' Guild (10)
- **L2 (2,500 🪶):** Pantheon Press (11) + World-Tree Archive (12)
- **L3 (60,000 🪶):** The Sleeping City (13) + Once Upon a Time (14)

A tier also has a normal reveal threshold (Saga Citadel at 3e9 total earned, and so on), so even with the wing you still have to earn your way to it. The whole arc — L1 on day 1, L2 mid-week-1, L3 in week 2, all 14 generators deep into the weeks — is the spine of the longevity design.

### Deep-buy thresholds + unique bonuses (v3)

Beyond the v1 steps (25/50/100), **every generator** rewards deep-buying:

| Owned | Effect |
|---:|---|
| 150 | production ×2 (×2.5 with Strength of the Stacks) |
| **200** | **the generator's UNIQUE bonus** — no multiplier, a one-of-a-kind twist |
| 300 | production ×2 (×2.5) |
| 400 | production ×2 (×2.5) |
| 500 | production ×4 (×5) — gold "grand finale" badge |

At 500 that's ×256 on top of the base (×625 with Strength of the Stacks). The **unique bonus at 200** (150 with The Hundredth Telling) is the personality reward — each is different and shows a violet/gold `✦ badge` on the card. A few: Wandering Muse → *A Hundred Whispers* (click ×2); Story Loom → *Warp and Weft* (tiers 1–4 ×3); Saga Citadel → *The Garrison Sallies Forth* (sparks 25% more often); Pantheon Press → *Divine Royalties* (+1 quill per Publish); Once Upon a Time → *…Happily Ever After* (global production ×2). Like all quantity milestones, they're run-scoped and re-earned each run.

### Deep Shelves (v3)

So the deep thresholds stay reachable under the numeric ceiling, the cost growth flattens in bands above 100 owned — *"word gets around: the more you have, the easier they come."* Units 1–100 keep the **exact** v1 price (invariant); then the growth exponent tapers by band (×0.8 / ×0.6 / ×0.45 of `growth − 1`, floor 1.04). It is purely beneficial and additive, so it never touches the first-40-minutes run or any older save.

### Run re-scalers (v3)

Seven late run upgrades (Inspiration, reset at prestige) keep tiers 1–7 relevant in the tier-12+ era, each unlocking at **150 owned** of its generator: A Hundred Names of the Muse (Muse ×1000), The Ink Tide (Sprite ×800), Parliament of Ravens (Raven ×600), Quillstorm (Quill ×500), The Great Tapestry (Loom ×400), The Infinite Stacks (Library ×300), Forge of Legends (Forge ×200). These are never kept by Perpetual Manuscript — long runs keep their own shopping arc.

### Hall of Fables (v2, optional leaderboard)

An opt-in online leaderboard, unlocked with Act 2:

- **Join with just a nickname** (3–20 characters: letters, digits, spaces, `_`, `-`). The server answers with a **guest token** (shown once, then kept in your save's settings) — no account, no email. Taken nicknames get an inline "already taken" error.
- **Four boards:** lifetime Inspiration, Tomes published, lifetime Golden Quills, fastest Publish. Top 20 + your own rank. The server keeps your **best** — resubmitting lower scores never regresses anything.
- **Your save stays local.** The only data that ever leaves the browser is your nickname and four score numbers, submitted same-origin via `/api/` (nginx proxies to the internal API). In local-only mode the game makes **zero** network requests.
- **Graceful degradation:** if the API is unreachable you get a small "courier" badge and cached standings ("as of HH:MM"); the game itself is unaffected.
- Inactive entries expire server-side after **90 days** (configurable via `LEADERBOARD_TTL_DAYS`).

### Offline progress

While the tab is closed — or the device sleeps with the tab open (any gap over 60 s takes the same path) — you earn `production/sec × elapsed × efficiency`. Base: **50%, capped at 8 hours**. Lucid Dreaming: 75% / 12 h. The cap is raised by Night Owl Pact (**+12 h**), the v3 Curator's Patience commission (**+24 h**, up to **48 h** combined) and the Deep Roots unique bonus (**+12 h**); efficiency is raised by the Reader's Letter relic (**+10 pp**) and The Library Never Closes unique bonus (**+5 pp**, capped at 90% overall). On return, a "While you were away" modal reports the gain (shown when you were away ≥ 60 s and actually earned something). Buffs never apply offline.

### Saving

- **Autosave** every ~10 s, plus on tab hide/close and immediately after critical actions (upgrade/Atelier purchase, prestige, spark collection, import, settings change).
- **Save key:** `localStorage["fable-idler-save-v1"]` (historic name — the payload carries the real schema version, now **v3**; v1 and v2 saves are migrated automatically and losslessly on first load through the `v1→v2→v3` chain — v1 tomes appear as faded fables, and the v2→v3 step is purely additive: the six new generators start at 0, the new upgrades unbought, production term-for-term identical). A corrupted save never crashes the game — the raw string is moved to `fable-idler-save-v1:corrupt` and a fresh game starts.
- **Backup / restore:** ⚙️ **Settings → Export** gives a base64 string (copy it somewhere safe); **Import** restores it. Do this before experimenting or switching browsers/machines. Note: the export **includes your leaderboard token** — it is both your backup and your proof of nickname ownership.
- **Hard reset** is double-confirmed (including typing `RESET`) and offers export first.

---

## Hosting on a server

The compose file works as-is on any VPS with Docker:

```bash
git clone <repo> && cd "Fable Idler"
docker compose up -d --build       # web on :8080 + internal leaderboard api
```

- **Put a reverse proxy in front.** The `web` container serves plain HTTP on port 8080; point your domain at it through Caddy / nginx / Traefik with TLS. One port covers everything — the game **and** `/api/` (nginx inside `web` proxies to `api` over the compose network; the API container never binds a host port).
- **Restart policy is already set** (`restart: unless-stopped` on `web` and `api`) — containers survive reboots as long as the Docker daemon starts on boot.
- **Back up one thing: the `leaderboard_data` volume.** It holds a single JSON snapshot of the standings (entries + SHA-256-hashed tokens). Example (check the exact volume name with `docker volume ls`):

  ```bash
  docker run --rm -v fableidler_leaderboard_data:/data -v "$PWD:/backup" alpine \
    tar czf /backup/leaderboard-$(date +%F).tgz -C /data .
  ```

- **Player saves are not your problem** — the game is fully client-side; every player's progress lives in their own browser `localStorage`. Backing up the server backs up the leaderboard, nothing else.
- **Be honest about anti-cheat:** scores are **client-authoritative**. The server validates shape and ranges, hashes tokens, and rate-limits per IP (10 submits/min, 60 reads/min via the `X-Real-IP` nginx sets) — but it cannot verify a score was actually earned. This is a friendly "on trust" leaderboard, suitable for a community, not for serious competition.
- **If you terminate TLS at your own proxy in front of `web`,** the per-IP rate limiting needs one line of config or it becomes *global* (every player shares the same forwarded IP — the proxy's — so the whole community shares 10 submits/min). Either (a) have your front proxy set `X-Real-IP` to the real client IP, or (b) uncomment the `set_real_ip_from <your-proxy-CIDR>;` + `real_ip_header X-Forwarded-For;` lines in [`nginx.conf`](nginx.conf) so the bundled nginx trusts the forwarded client IP. Hitting `:8080` directly (no front proxy) already keys correctly on the un-spoofable socket address.
- **The store has a hard entry cap** (`LEADERBOARD_MAX_ENTRIES`, default 100 000 ≈ 26 MB) so a botnet of fresh IPs cannot fill the disk/RAM with permanent claims — new *claims* past the cap get `503 leaderboard_full` (a TTL GC pass runs first); existing players' token *updates* are never blocked.
- Tunables via environment on `api`: `LEADERBOARD_DATA_FILE`, `LEADERBOARD_TTL_DAYS` (default 90), `LEADERBOARD_MAX_ENTRIES` (default 100 000), `RATE_SUBMIT_PER_MIN`, `RATE_READ_PER_MIN`.

---

## Known limitations

- **Leaderboard scores are client-authoritative.** The game runs in the browser, so the Hall of Fables is "on trust": the server enforces shape, ranges, best-keeping and rate limits, but anyone can submit fabricated numbers with a crafted request. Accepted trade-off for a no-account guest leaderboard.
- **The leaderboard token lives in your local save.** It is issued exactly once at claim; clearing site data without a Settings → Export loses your nickname's ownership (the name stays reserved until the server-side TTL, 90 days, expires it). Conversely, an exported save contains the token — treat exports like a password.
- **Multi-tab: last-writer-wins.** Two tabs on the same save both write to `localStorage`; whichever saves last silently wins, so a few seconds of progress can be lost. Play in one tab. (Unchanged from v1; no locking.)
- **Playwright pin invariant** (worth repeating): `@playwright/test 1.49.1` ↔ image `v1.49.1-noble` must be bumped **together**, or E2E breaks cryptically.
- **First `npm install` into the named volumes takes 1–2 min** on Windows (that is also why `node_modules` lives in named volumes instead of the bind mount — host bind mounts are slow and the host has no Node anyway).
- **No cloud sync for game saves.** Progress lives in the browser profile of one machine; the backend only holds leaderboard scores. Clearing site data deletes your save — use Settings → Export for backups.
- **Native `number` (double) math.** Fine with huge headroom for the current economy (double's range is ~1.8e308); values ≥ 1e33 display in scientific notation.
- **Test hook ships in the production bundle** but is completely inert without `?test=1`; scores being client-authoritative anyway, this adds no cheat surface beyond what localStorage/devtools already allow.
- **Tablet/mobile layouts** are implemented per the design spec but received less in-browser visual QA than the desktop layout (Playwright runs at 1280×720).
