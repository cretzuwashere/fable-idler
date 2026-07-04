# 06 — Testing Strategy (Agent 8: Testing & QA)

> Starea la 2026-07-04 (după Agent QA v3 — E2E longevity): **380 teste unit (Vitest) + 19 teste server (Vitest, HTTP real) = 399** + **18 teste E2E în 14 spec-uri (Playwright)**. Totul rulează exclusiv prin Docker — pe host nu există Node.
>
> Istoric: v1 = 156 unit + 11 E2E; v2 = 278 unit + 19 server + 17 E2E (13 spec-uri); v3 = **380 unit** (+102: cele 5 fișiere noi din §1.1 + 5 fișiere v1/v2 actualizate legitim) + 19 server + **18 E2E** (14 spec-uri: +`14-longevity.spec.ts`).

---

## 1. Piramida de teste

```
        ┌────────────────────────┐
        │  E2E (Playwright)      │  18 teste / 14 spec-uri
        │  build PROD + nginx    │  fluxuri reale de utilizator, contract UI↔engine,
        │  + api (compose)       │  leaderboard REAL + degradare, migrare v1→v2, New Wing v3
        ├────────────────────────┤
        │  Server (Vitest)       │  19 teste / 1 fișier (tests/server/)
        │  createApp().listen(0) │  API-ul Hall of Fables prin HTTP real, în proces
        ├────────────────────────┤
        │  Unit (Vitest)         │  380 teste / 23 fișiere
        │  doar src/engine       │  matematica jocului, determinism, save, acțiuni, longevity v3
        └────────────────────────┘
```

Fără nivel intermediar de teste de componente React (decizie 02 §6): engine-ul pur acoperă toată logica, iar E2E acoperă integrarea UI — un strat de teste de componente ar dubla costul de întreținere fără să prindă clase noi de bug-uri la dimensiunea acestui proiect.

### 1.0 Cum rulează serverul în teste (v2)

- **Nivelul server** (`tests/server/leaderboard-api.test.ts`, 19 teste): NU pornește Docker și NU folosește rețeaua compose — importă `createApp` din `server/src/app.mjs`, îl pornește pe **port efemer în proces** (`listen(0)`) și îl lovește cu `fetch`-ul nativ Node 22. `now` injectat (rate-limit/tie-break/uptime deterministe), `dataFile` în `mkdtemp`. Rulează în `test-unit` (inclus prin `test.include` din vite.config).
- **Nivelul E2E**: `test-e2e` are `depends_on` pe `web` ȘI `api` (ambele `service_healthy`) — stack-ul REAL pornește automat; clientul vorbește cu api-ul prin proxy-ul nginx `/api/` al lui `web` (același drum ca în producție). Serviciul `api` nu publică port pe host; volumul `leaderboard_data` persistă între rulări (nickname-urile E2E sunt unice per încercare, cu sufix timestamp).

### 1.1 Nivelul unit (Vitest, `tests/unit/`, environment `node`)

Importă DOAR din `src/engine` — zero DOM, zero React, timere injectabile (`deps.now`, `deps.storage`). Fișiere și ce garantează:

| Fișier | Acoperă |
|---|---|
| `format-numbers.test.ts` | praguri exacte de formatare (999/1K/1.23K/1e33…) |
| `generators.test.ts` | cost geometric + ceil, bulk ×10 all-or-nothing, ×Max exact la buget, Patron's Favor |
| `production.test.ts` | ordinea EXACTĂ a multiplicatorilor (03 §2), sinergii, valori calculate de mână |
| `click.test.ts` | click power, Sharpened Nib, Ink Echo (fără ×5 sub buff), Quill Resonance |
| `tick.test.ts` | **determinism delta-time: 10×tick(100ms) ≡ 1×tick(1000ms)**, clamp 60s, buff expirând în fereastră |
| `achievements.test.ts` | fiecare condiție exact o dată, bonus global, persistă în meta |
| `milestones.test.ts` | pragurile #1–11, `qty:<gen>:<n>`, re-parcurgere după prestige |
| `prestige.test.ts` | formula quills (granițe), reset-vs-persistă câmp cu câmp, per-run nu lifetime |
| `offline.test.ts` | eficiență 50/75%, plafon 8h/12h, fără buff, Night Shift |
| `save.test.ts` | round-trip, corupere → backup + fallback, migrare, hardReset cu/fără confirm, sanitizare importuri ostile (dedupe achievements/milestones, clamp buff, invariant inspiration≤totalEarned) |
| `game-loop.test.ts` | (Agent 9) gap foreground >60s → ramura offline (creditare 50%, plafon, event `offline`, persist imediat); importSave fără evenimente de unlock |
| `settings.test.ts` | setSettings merge parțial, persistență imediată, supraviețuire prestige |
| `progression-speed.test.ts` | runda 2 măsurabil mai rapidă (simulare deterministă) |
| `atelier.test.ts` (v2, 26) | cele 10 upgrade-uri: costuri/niveluri/no-op la maxat sau fără fonduri, regula de aur la cumpărare |
| `spark.test.ts` (v2, 22) | rollSparkKind pe praguri exacte, sparkRewardSummary/applySparkReward per kind, Net L2 |
| `fables.test.ts` (v2, 11) | titluri procedurale DETERMINISTE (hardcodate — gardă anti-reordonare a tabelelor de cuvinte), uniqueFableCount |
| `save-migration-v2.test.ts` (v2, 19) | MIGRATIONS[1] real: regula de aur (wallet≡lifetime), fabule faded plafonate, payload-uri ostile; fixture-ul v1 migrează acum până la v3 |
| `selectors-v2.test.ts` (v2, 15) | crit/clickValue, bookshelfMultiplier, offlineCapMs/Efficiency, sparkIntervalRange, isGeneratorVisibleInShop |
| `deep-shelves.test.ts` (v3, 14) | growth-uri de bandă (taper relativ ×0.8/×0.6/×0.45, podea 1.04), invarianta index 0–100 bit-identică v1, prețuri de graniță 99/100/101/199/200/299/300 hand-computed, bulk pe benzi la granițe, Patron's Favor + Conspiracy of Ravens |
| `prestige-v3.test.ts` (v3, 18) | **property-test 200k eșantioane** `q(te)==floor(sqrt(te/1e5))` sub 1e9; breakpoints 14 §5.3; continuitate la 1e9±1 și 1e15±1e6 (garda 1e-9); monotonie pe grilă log; net-seed anti-exploit (publish instant post-Foreword = 0 🪶); `seedInspirationForNextRun` |
| `save-migration-v3.test.ts` (v3, 14) | MIGRATIONS[2] v2→v3 câmp-cu-câmp pe fixture v2 REAL; lanțul v1→v2→v3; producție post-migrare IDENTICĂ (hand-computed); round-trip v3; sanitize `seededInspiration` clamp [0,te] + generatori 9–14 + atelier v3 |
| `unique-bonuses.test.ts` (v3, 20) | pragul 200/150 (Hundredth Telling); praguri extinse cu Strength of the Stacks (×2.5/×5); fiecare din cele 14 bonusuri unice cu efectul exact |
| `v3-systems.test.ts` (v3, 30) | New Wing gating tiers 9–14 (L1/L2/L3 + revealAt); cele 7 re-scalere (mult exact, unlock 150); Perpetual Manuscript păstrează cele 10 v1 dar NU re-scalerele; Clockwork Understudy auto-buy determinist; Atlas ×2 / Endless Shelf 100 / Pilgrims 5→3 / City spark ×2/×4; achievements + reveal milestones + praguri qty; **invarianta „primele 40 min identice"** |

**Nivelul server** (`tests/server/leaderboard-api.test.ts`, 19): contractul 10 §1.4 byte-cu-byte — claim/update/rename, 401/409/422/429 cu `field`/`Retry-After`, best-keeping, sortări+tie-break, `me`, persistență round-trip pe fișier, fișier corupt → backup `.corrupt-<ts>`.

### 1.2 Nivelul E2E (Playwright, `tests/e2e/`, chromium)

Rulează pe **build-ul de PRODUCȚIE servit de nginx** (serviciul `web`, `PW_BASE_URL=http://web:80`) — testează exact artefactul livrat, nu un build de test. Viewport implicit 1280×720 = layout desktop.

| Spec | Teste | Scenariul |
|---|---|---|
| `01-smoke-click.spec.ts` | 2 | pagina se încarcă (titlu + heading „Fable Idler"), click-area vizibil, contorul crește exact cu click power (pur, fără hook, fără `?test=1`) |
| `02-generators.spec.ts` | 2 | Wandering Muse cumpărată din 15 click-uri reale; `+0.1/sec`; soldul crește FĂRĂ click în 2,5s (citit ca float prin hook); buy disabled sub cost |
| `03-upgrades.spec.ts` | 1 | `addInspiration(200)` → Sharpened Nib cumpărat din UI → delta pe click 1 → 2 (exact, fără generatori); cardul în secțiunea „Purchased (1)" cu ✓ |
| `04-unlocks.spec.ts` | 1 | toast `data-toast-kind="milestone"` la „The First Spark"; secțiunea Achievements după primul achievement („1/14"); tab-ul Upgrades la exact 100 totalEarned |
| `05-persistence.spec.ts` | 1 | click + buy generator + buy upgrade → `saveNow` → `page.reload()` → count/upgrade identice, sold ≥ cel salvat (+buget mic de producție), fără modal offline sub 60s |
| `06-offline.spec.ts` | 2 | `addInitScript` scrie save valid cu `savedAt = now − 1h` SUB cheia importată `SAVE_KEY` → modalul „While you were away" cu „10.8K" (6/s × 1h × 50%), „at 50% efficiency", sold creditat „11.8K"; contra-test: fără save → fără modal |
| `07-prestige.spec.ts` | 1 | `addInspiration(500000)` → preview „+2" 🪶 → dialog cu checkbox obligatoriu → overlay prestigeFade apare și dispare → quills=2 în header și în stare, run resetat la zero, achievements păstrate + `publishedAuthor` |
| `08-export-import-reset.spec.ts` | 1 | BONUS: export base64 → hard reset dublu (buton final armat doar de textul „RESET") → import invalid = eroare inline → import valid = stare restaurată (1.23K) |
| `09-atelier.spec.ts` (v2) | 1 | publish REAL prin UI → tab-atelier → Apprentice Muse cu 1 🪶: purse 2→1, lifetime IMOBIL la 2 (regula de aur în UI + stare), `perSecond` nu scade (asertat cu selectorul engine-ului; poate CREȘTE prin achievement-ul patronOfTheArts), 4 relics locked cu progres; al 2-lea publish → runda pornește cu 5 muses, atelierul persistă |
| `10-leaderboard.spec.ts` (v2) | 2 | (a) API-ul REAL din compose: 409 inline pe nume rezervat (POST direct prealabil), claim liber → `data-state=active` + rândul propriu, identitatea în save + `nameInLights`, reload → direct active; (b) `route.abort('**/api/**')` + identitate injectată → `data-state=offline` + badge courier, jocul funcțional, consola curată |
| `11-spark.spec.ts` (v2) | 1 | `forceSpark('inkBurst')` post-`aLightAtTheWindow` → catch prin `dispatchEvent('pointerdown')` → toast `spark` cu „+50 Inspiration" + 1000→1050 EXACT + `sparksCaught=1`; spark neprins + reload → nu re-apare, nimic acordat |
| `12-bookshelf.spec.ts` (v2) | 1 | publish prin UI → toast `fable` + raft cu EXACT 1 cotor (nefaded) + tooltip (titlu/„Tome #1"/„Earned"); al 2-lea publish → 2 cotoare + header `+{unique×2}%` (calculat din titlurile unice din stare) |
| `13-migration.spec.ts` (v2) | 1 | save v1 REAL injectat (`addInitScript` + `SAVE_KEY`; quills 3, tomes 3) → load curat: portofel 3 ȘI lifetime 3, 3 fabule faded cu titluri `generateFadedTitle(n)`, achievements păstrate, producția EXACT ×1.9 (raport de selectori), UI complet (chip/raft/atelier), fără modal offline |
| `14-longevity.spec.ts` (v3) | 1 | flux New Wing 100% prin UI: `addInspiration(1e9)` → publish real (+100 🪶 = sqrt sub genunchiul 1e9) → tab-atelier → Saga Citadel (tier 9) **ABSENTĂ** chiar și după ce totalEarned depășește reveal-ul 3e9 (gate de wing, nu doar reveal: `toHaveCount(0)`) → **The New Wing L1 cumpărată cu dialogul de confirmare ≥10 🪶** (25 🪶: purse 100→75, `newWingLevel=1`, pips „Level 1 of 3") → **Saga Citadel APARE** în shop; cumpărare cu inspiration reală → count crește; deep-buy la pragul unic 200 (buget uriaș + `buyGenerator qty:'max'`) → **badge UNIC violet/gold** `✦ The Garrison Sallies Forth` + `isUniqueBonusActive` true. Consolă curată prin fixture. |

**`fixtures.ts`** — obligatoriu în toate spec-urile: suprascrie fixture-ul `page` ca să colecteze `page.on('pageerror')` + mesajele console de tip `error` și **pică testul la teardown** dacă a apărut vreunul. Așa, criteriul „fără erori critice în consolă" e verificat în FIECARE scenariu. Tot aici: helperii `waitForHook/hookState/addInspiration/fastForward/saveNow` peste `window.__FABLE_TEST__` (contractul 02 §6.3, activ doar cu `?test=1`).
**Excepție v2 (singura):** mesajele `Failed to load resource: …` emise de **Chromium însuși** (nu de aplicație — nesuprimabile din JS) sunt ignorate DOAR când URL-ul sursă conține `/api/` — necesare scenariilor de degradare și răspunsurilor 4xx legitime (409 la claim). Orice alt console.error pică testul în continuare.

---

## 2. Cum se rulează (host = Windows fără Node; totul prin Docker)

```bash
docker compose run --rm test-unit            # Vitest (399: 380 unit + 19 server, în proces)
docker compose run --rm --build test-e2e     # rebuild web + healthcheck web+api + Playwright (18 teste)
docker compose down                          # curățenie la final (FĂRĂ -v: păstrează node_modules + leaderboard_data)
```

Note operaționale:
- Prima rulare face `npm install` în named volume (~1–2 min); rulările următoare refolosesc volumul.
- `--build` la test-e2e e important: reconstruiește imaginea `web` ca Playwright să testeze ULTIMUL cod, nu un build vechi.
- `test-e2e` pornește singur serviciile `web` ȘI `api` (depends_on + healthcheck pe ambele) — nu trebuie pornite manual. Portul 8080 pe host trebuie să fie liber (alt proiect pe 8080 = `web` nu pornește).
- Volumul `leaderboard_data` persistă între rulări: spec-ul 10 folosește nickname-uri unice per încercare (sufix timestamp base36) — NU curățați volumul ca „fix" de test.
- Typecheck complet: `docker compose run --rm test-unit sh -c "npm install --no-audit --no-fund && npx tsc --noEmit && npx vitest run"`.
- Artefacte la eșec: `test-results/` (trace Playwright, `retain-on-failure`; se vizualizează cu `npx playwright show-trace <zip>` oriunde există Playwright).

---

## 3. Cum se adaugă teste noi

**Unit:** fișier nou `tests/unit/<modul>.test.ts` (vite.config include `tests/unit/**/*.test.ts`), importă DOAR din `src/engine`, folosește factory-ul din `tests/unit/helpers.ts` pentru stare. Valorile numerice se calculează independent (nu copiate din selectors) și se hardcodează ca literali. Timpul se injectează (`createGameStore(state, { now, storage })`) — niciodată `Date.now()` direct în asserturi.

**E2E:** fișier nou `tests/e2e/NN-nume.spec.ts` cu `import { test, expect } from './fixtures'` (NU din `@playwright/test` — altfel pierzi guard-ul de console errors). Reguli:
- Selectezi exclusiv prin `data-testid` (contractul complet e în 05-implementation-log.md §Agent UI). Element nou în UI ⇒ întâi adaugi testid-ul în componentă și îl documentezi acolo.
- `?test=1` doar dacă ai nevoie de hook; ține acțiunile pe UI-ul real și folosește hook-ul preponderent pentru citit starea (asserturi exacte pe float, nu pe text formatat cu floor).
- Constante din engine (chei de save, praguri) se IMPORTĂ din `../../src/engine`, nu se hardcodează.
- `tests/e2e` NU intră în tsconfig-ul aplicației (02 §8.8) — Playwright își transpileaza singur spec-urile; nu „reparați" asta.
- Save fabricat pentru scenarii de load: minim `{version:1, savedAt, run:{inspiration,totalEarned,generators}, meta:{goldenQuills,tomesPublished}}`; restul primește default-uri de la validator.
- Ferește-te de texte formatate: `formatNumber` face floor (0.9 → „0"), deci progresul sub-unitar se verifică prin stare, nu prin DOM.

**Pin-ul Playwright:** `@playwright/test` 1.49.1 (package.json) ↔ imaginea `mcr.microsoft.com/playwright:v1.49.1-noble` (docker-compose.yml) se schimbă ÎMPREUNĂ, altfel lipsesc browserele din imagine.

---

## 4. Limitări — ce NU e testat automat

| Zonă | Stare | Mitigare |
|---|---|---|
| **Vizual/pixel** (culori, spacing, fonturi, vignetă) | netestat automat | verificare manuală; contractul vizual e 04-ui-ux-decisions.md |
| **Layout tablet/mobil real** (<720px, 720–1099px, bottom nav, safe-area) | E2E rulează DOAR la 1280×720 (desktop) | walkthrough manual la 375/768/1100px (rămas din raportul Agent UI) |
| **Accesibilitate** (axe audit, contrast măsurat, screen reader) | netestat automat | atributele aria există; audit axe DevTools manual |
| **Performanță** (FPS la click-spam, jank la animații) | netestat; doar pool-ul ≤12 FloatingNumbers e garantat în cod | măsurătoare manuală în DevTools |
| **Cross-browser** | doar chromium în CI; Firefox/Safari niciodată | acceptat pentru v1 (proiectul e chromium-first) |
| **Multi-tab concurrent** | netestat | last-writer-wins documentat ca limitare v1 (02 §Riscuri) |
| **Sesiuni offline REAL lungi** (8h+, sleep de laptop) | simulat prin save fabricat + unit tests pe plafon; ramura foreground (gap >60s cu tab-ul deschis) e unit-testată în `game-loop.test.ts` (Agent 9) | un sleep REAL de laptop nu e reprodus automat; logica e identică cu cea testată |
| **Buff-ul în E2E** | activarea/expirarea nu au scenariu E2E dedicat | acoperit complet în unit (buff.ts prin click/tick/production tests) |
| Toast-urile: coada >3, hover-pause | doar prezența toastului corect e verificată | comportament de detaliu, cost/beneficiu slab pentru E2E |
| **Spawn-ul NATURAL al sparkului** (timer 150–330s, gate de vizibilitate) | E2E folosește doar `forceSpark` (timerul real ar face testul de minute) | intervalul e unit-testat (`sparkIntervalRange`); despawn-ul la reload E verificat E2E |
| **Relicele deblocate** (≥3 tomes) + dialogul de confirmare Atelier (≥10 🪶) | E2E ajunge doar la 2 tomes / cumpărături de 1 🪶 | logica în unit (atelier.test.ts, prestige.test.ts); ambele verificate vizual de smoke-ul agentului UI (05 §UI v2) |
| **Leaderboard multi-client real** (2 browsere concurente, rank live) | E2E simulează al 2-lea jucător printr-un POST direct | serverul are 19 teste HTTP reale (sortări, tie-break, best-keeping) |
| **Arcul de zile/săptămâni v3** (New Wing L2/L3, tiers 11–14, prestige segmentat pe orizontul real, ritm 28–56 zile) | E2E ajunge doar la New Wing L1 + tier 9 + un deep-buy la 200 (un singur publish sub genunchiul 1e9) | acoperit de unit (`prestige-v3`, `v3-systems`, `deep-shelves`, `unique-bonuses`) + simulatorul `tools/economy-sim-longevity.mjs` (RUN L0–L10, prin `docker run node:22-alpine`) |
| **Pragul unic la 200 prin joc REAL** (150→200 owned prin ticks ar dura ore) | E2E ajunge la 200 prin `buyGenerator qty:'max'` cu buget uriaș (aceeași cale de engine ca butonul „Max") | logica pragului 200/150 + cele 14 efecte în `unique-bonuses.test.ts` |
| **Dialogul de confirmare Atelier ≥10 🪶** (v2 ajungea doar la 1 🪶) | acum EXERCITAT în E2E: New Wing L1 (25 🪶) trece prin `atelier-confirm-dialog` + `atelier-confirm` | — |

Riscuri de flakiness cunoscute și cum au fost evitate: asserturile pe sold folosesc starea exactă din hook (nu textul cu floor); toasturile se verifică imediat după acțiune (auto-dismiss 4s); overlay-ul de prestige are timeout generos (10s); testul 08 acceptă atât cheia ștearsă cât și un autosave proaspăt (fereastra de 10s a autosave-ului).

Adăugiri v2 (aceeași filozofie): spec-urile care asertează toast-uri v2 GOLESC întâi coada (`toHaveCount(0)` pe `toast`, plus `test.slow()`) — `addInspiration` masiv împinge ~12 toast-uri înaintea celui verificat; sparkul se prinde cu `dispatchEvent('pointerdown')` (elementul zboară — `click()` ar aștepta stabilitate); „producția nu scade" din Atelier e `≥`, nu egalitate (prima cumpărătură aduce +1% prin achievement); procentul Bookshelf se calculează din titlurile UNICE citite din stare (un duplicat legitim „reprint" nu pică testul); 409-ul de leaderboard se provoacă rezervând numele printr-un POST direct ÎN ACELAȘI test.
