# Fable Idler

A production-grade, browser-based idle game. You are a **Fable Weaver**: click to weave ✨ **Inspiration**, hire whimsical generators (muses, ink sprites, talking ravens…), buy upgrades, unlock achievements and milestones, and **Publish the Tome** — a prestige reset that grants permanent 🪶 **Golden Quills**. In v2, Golden Quills became a currency: spend them in **The Gilded Atelier**, catch **Stray Sparks**, fill **The Bookshelf** with procedural fables, and (optionally) compete in the **Hall of Fables** online leaderboard.

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
8. The game **saves automatically** and earns while you are away (50% efficiency, up to 8 h — both improvable in v2). Just close the tab and come back later.
9. Back up your progress any time: **⚙️ Settings → Export** (see [Known limitations](#known-limitations)).

---

## How to test

### Unit + server tests (Vitest, 297 tests)

```bash
docker compose run --rm test-unit
```

One command runs both suites (via `vite.config.ts` `test.include`):

- **`tests/unit/` — 278 engine tests** (Node environment, no DOM): number formatting, generator costs/bulk buying, the full production multiplier stack, click power + crits, tick delta-time determinism (including deterministic auto-buy), achievements, milestones, prestige formula + reset/persist split, offline progress, save round-trip/**v1→v2 migration**/corruption fallback, settings persistence, the Gilded Atelier, Stray Spark rewards, procedural fables/Bookshelf, v2 selectors, and a deterministic progression-speed simulation.
- **`tests/server/` — 19 leaderboard API tests**: real HTTP against the actual server (`createApp().listen(0)` in-process, ephemeral port, injected clock) — claim/update/rename flows, validation errors with exact `field`, best-keeping semantics, all four sort orders + tie-breaks, rate limiting with `Retry-After`, persistence round-trip, and corrupted-data-file recovery. No Docker-in-Docker involved.

Typecheck on its own:

```bash
docker compose run --rm test-unit sh -c "npm install --no-audit --no-fund && npx tsc --noEmit"
```

### End-to-end tests (Playwright)

```bash
docker compose run --rm --build test-e2e
```

This (re)builds the `web` image, waits for the **healthchecks** of both `web` and `api` to pass, then runs the Playwright specs from `tests/e2e/` inside the official `mcr.microsoft.com/playwright:v1.49.1-noble` image against **the real production nginx build** (`PW_BASE_URL=http://web:80` over the compose network) — including the real leaderboard API behind nginx. No `--profile test` flag is needed — `docker compose run` activates the service's profile implicitly.

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

The result is a fully static bundle (~255 KB JS, ~80 KB gzipped, plus ~52 KB CSS and self-hosted woff2 fonts — zero CDN/external requests) baked into the nginx image. The API image is `node:22-alpine` + the plain `.mjs` sources from `server/src/` — no build step, no npm dependencies. There is no build output on the host; `dist/` on the host only appears if you run a build via a bind-mounted container yourself.

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
│   │   ├── config.ts           # every balance number lives here and only here (v1 + v2)
│   │   ├── types.ts            # GameState (run/meta split), Action union, literal id types
│   │   ├── state.ts            # initial-state factories (Atelier-aware run construction)
│   │   ├── generators.ts       # cost curve, buy 1/10/max
│   │   ├── upgrades.ts         # unlock evaluation + purchase
│   │   ├── atelier.ts          # v2: Gilded Atelier purchases, levels, relic helpers
│   │   ├── spark.ts            # v2: Stray Spark weights, reward computation, collection
│   │   ├── fables.ts           # v2: procedural fable titles (append-only word tables), Bookshelf
│   │   ├── achievements.ts     # 24 achievement conditions (idempotent checks)
│   │   ├── milestones.ts       # 15 reveal milestones + qty:<gen>:<25|50|100>
│   │   ├── buff.ts             # Moment of Inspiration (epoch-ms based, Atelier-aware cooldown)
│   │   ├── prestige.ts         # quill formula, Publish the Tome, fables, relic-aware run rebuild
│   │   ├── offline.ts          # offline report (efficiency + cap, relic/Atelier-aware)
│   │   ├── selectors.ts        # ALL derived values (per-second, click power + crits, multipliers)
│   │   ├── tick.ts             # pure tick(state, now, dt) — delta-time deterministic, incl. auto-buy
│   │   ├── save.ts             # versioned schema v2, v1→v2 migration, export/import, corruption guard
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
    ├── unit/                   # Vitest — 18 test files + helpers, 278 tests, engine only
    ├── server/                 # Vitest — 19 real-HTTP tests against the leaderboard server (in-process)
    └── e2e/                    # Playwright — runs against the production nginx build + real API
```

---

## Game systems

### Resource: Inspiration ✨

One primary resource. Earned actively (clicking **Weave**) and passively (generators). Formatted with suffixes (`1.23K`, `45.6M`, … `No`) and scientific notation from 1e33.

### Generators (8)

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
| Myth Engine (v2) | 300,000,000 | 45,000 | ×1.12 |

The **Myth Engine** is tier 8, added in v2 — see [Myth Engine](#myth-engine-v2) below: it never appears in the shop without its Atelier blueprint.

### Upgrades (11)

One-time purchases with unlock conditions: **Sharpened Nib** (click ×2), **Muse's Chorus** (Muse ×2), **Golden Inkwell** (all production ×1.5), **Raven's Gossip** (+5% Ink Sprite per Raven), **Weaver's Rhythm** (+10% Enchanted Quill per Loom), **Lucid Dreaming** (offline 50%→75%, cap 8h→12h), **Burst of Genius** (buff lasts 50% longer), **Ink Echo** (each click adds 1% of your /sec), **Patron's Favor** (generators cost −5%), **Bound Anthology** (achievement bonus +1%→+2% each), and **Quill Resonance** (the Golden Quill bonus also applies to clicks — persists through prestige; unlocked after your first Tome). In v2, the Atelier's **Second Bookmark** can carry your cheapest owned upgrades through a Publish.

### Moment of Inspiration (buff)

Unlocked at 500 total earned. On activation: **production ×2 and click power ×5 for 15 s** (22.5 s with Burst of Genius), 90 s cooldown measured from activation (75/60 s with the Atelier's Restless Heart). Does not apply to offline gains.

### Achievements (24)

Permanent (survive prestige). Each grants **+1% global production** (additive; +2% each with Bound Anthology). 14 from v1 ("First Words" … "Serial Novelist") plus 10 v2 achievements covering the Atelier, sparks, fables, relics, the Myth Engine, and joining the leaderboard.

### Milestones

- **15 reveal milestones** (re-earned after prestige): 12 driven by total earned this run — progressively unlocking the shop, each generator, the Upgrades tab, the buff, the Achievements panel, the Prestige panel, and (at 1,000) Stray Sparks — plus 3 unlocked by your first published Tome: the Gilded Atelier, the Bookshelf, and the Hall of Fables ("Act 2").
- **Quantity milestones:** owning **25 / 50 / 100** of a generator multiplies that generator's output **×2 each time** (×8 at 100). Applies to the Myth Engine too.

### Prestige — Publish the Tome

Available at **≥ 100,000 total earned in the current run**.

```
Golden Quills gained = floor( sqrt( totalEarnedThisRun / 100,000 ) )
```

(100k → 1, 400k → 2, 900k → 3, 10M → 10.) Publishing **resets** the run: balance, total earned, generators, run upgrades (minus Second Bookmark keeps), milestones, buff. It **keeps**: Golden Quills, Tomes published, achievements, lifetime stats, settings, Quill Resonance, all Atelier upgrades, relics, and the Bookshelf. Each Publish also **pens a new fable** onto the Bookshelf, and with Editor's Due grants **+1 bonus quill**.

**The golden rule (v2):** the permanent **+30% production per Golden Quill** is computed from your **lifetime quills earned**, not your current balance. Spending quills in the Atelier **never** lowers your production bonus — the header chip shows your spendable purse, the tooltip shows the lifetime anchor.

### The Gilded Atelier (v2)

Unlocked by your first Publish. A permanent shop of **10 upgrades** (some multi-level) that spend Golden Quills from your purse — **92 quills** to fully commission everything:

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

Purchases costing **≥ 10 🪶** ask for confirmation. Story Fragments from sparks bind into a free quill at **5 fragments**.

### Relics of the Published (v2)

Trophies derived purely from your **Tomes published** count (never stored in the save — they can't be lost or faked in):

| Relic | Tomes | Effect |
|---|---:|---|
| Dog-Eared Page | 3 | Start each run with 300 Inspiration |
| Standing Ovation | 7 | The first manual buff each run lasts twice as long |
| Ink That Remembers | 15 | Global production +1% per Tome published, forever |
| The Reader's Letter | 30 | Offline efficiency +10 percentage points |

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

### Hall of Fables (v2, optional leaderboard)

An opt-in online leaderboard, unlocked with Act 2:

- **Join with just a nickname** (3–20 characters: letters, digits, spaces, `_`, `-`). The server answers with a **guest token** (shown once, then kept in your save's settings) — no account, no email. Taken nicknames get an inline "already taken" error.
- **Four boards:** lifetime Inspiration, Tomes published, lifetime Golden Quills, fastest Publish. Top 20 + your own rank. The server keeps your **best** — resubmitting lower scores never regresses anything.
- **Your save stays local.** The only data that ever leaves the browser is your nickname and four score numbers, submitted same-origin via `/api/` (nginx proxies to the internal API). In local-only mode the game makes **zero** network requests.
- **Graceful degradation:** if the API is unreachable you get a small "courier" badge and cached standings ("as of HH:MM"); the game itself is unaffected.
- Inactive entries expire server-side after **90 days** (configurable via `LEADERBOARD_TTL_DAYS`).

### Offline progress

While the tab is closed — or the device sleeps with the tab open (any gap over 60 s takes the same path) — you earn `production/sec × elapsed × efficiency`. Base: **50%, capped at 8 hours**. Lucid Dreaming: 75% / 12 h. The Atelier's Night Owl Pact adds **+12 h** to the cap (20 h, or 24 h combined), and the Reader's Letter relic adds **+10 percentage points** of efficiency (up to 85% combined). On return, a "While you were away" modal reports the gain (shown when you were away ≥ 60 s and actually earned something). Buffs never apply offline.

### Saving

- **Autosave** every ~10 s, plus on tab hide/close and immediately after critical actions (upgrade/Atelier purchase, prestige, spark collection, import, settings change).
- **Save key:** `localStorage["fable-idler-save-v1"]` (historic name — the payload carries the real schema version, now **v2**; v1 saves are migrated automatically and losslessly on first load, with your old tomes appearing as faded fables). A corrupted save never crashes the game — the raw string is moved to `fable-idler-save-v1:corrupt` and a fresh game starts.
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
- Tunables via environment on `api`: `LEADERBOARD_DATA_FILE`, `LEADERBOARD_TTL_DAYS` (default 90), `RATE_SUBMIT_PER_MIN`, `RATE_READ_PER_MIN`.

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
