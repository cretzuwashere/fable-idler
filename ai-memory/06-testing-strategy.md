# 06 — Testing Strategy (Agent 8: Testing & QA)

> Starea la 2026-07-04 (după quality gate-ul Agent 9): **156 teste unitare (Vitest)** + **11 teste E2E în 8 spec-uri (Playwright)**. Totul rulează exclusiv prin Docker — pe host nu există Node.
> (Corecție Agent 9: versiunea anterioară a acestui fișier spunea „10 teste E2E" — numărul real, confirmat de propriul tabel §1.2 și de rulări, a fost mereu 11.)

---

## 1. Piramida de teste

```
        ┌────────────────────────┐
        │  E2E (Playwright)      │  11 teste / 8 spec-uri
        │  build PROD + nginx    │  fluxuri reale de utilizator, contract UI↔engine
        ├────────────────────────┤
        │  Unit (Vitest)         │  156 teste / 13 fișiere
        │  doar src/engine       │  matematica jocului, determinism, save, acțiuni
        └────────────────────────┘
```

Fără nivel intermediar de teste de componente React (decizie 02 §6): engine-ul pur acoperă toată logica, iar E2E acoperă integrarea UI — un strat de teste de componente ar dubla costul de întreținere fără să prindă clase noi de bug-uri la dimensiunea acestui proiect.

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

**`fixtures.ts`** — obligatoriu în toate spec-urile: suprascrie fixture-ul `page` ca să colecteze `page.on('pageerror')` + mesajele console de tip `error` și **pică testul la teardown** dacă a apărut vreunul. Așa, criteriul „fără erori critice în consolă" e verificat în FIECARE scenariu. Tot aici: helperii `waitForHook/hookState/addInspiration/fastForward/saveNow` peste `window.__FABLE_TEST__` (contractul 02 §6.3, activ doar cu `?test=1`).

---

## 2. Cum se rulează (host = Windows fără Node; totul prin Docker)

```bash
docker compose run --rm test-unit            # Vitest (156 teste)
docker compose run --rm --build test-e2e     # rebuild web + healthcheck + Playwright (11 teste)
docker compose down                          # curățenie la final (FĂRĂ -v: păstrează node_modules)
```

Note operaționale:
- Prima rulare face `npm install` în named volume (~1–2 min); rulările următoare refolosesc volumul.
- `--build` la test-e2e e important: reconstruiește imaginea `web` ca Playwright să testeze ULTIMUL cod, nu un build vechi.
- `test-e2e` pornește singur serviciul `web` (depends_on + healthcheck) — nu trebuie pornit manual. Portul 8080 pe host trebuie să fie liber (alt proiect pe 8080 = `web` nu pornește).
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

Riscuri de flakiness cunoscute și cum au fost evitate: asserturile pe sold folosesc starea exactă din hook (nu textul cu floor); toasturile se verifică imediat după acțiune (auto-dismiss 4s); overlay-ul de prestige are timeout generos (10s); testul 08 acceptă atât cheia ștearsă cât și un autosave proaspăt (fereastra de 10s a autosave-ului).
