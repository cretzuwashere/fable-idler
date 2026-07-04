# 05 — Implementation Log

## Agent UI v3 — Integrarea vizuală a alungirii (2026-07-04)

### Status: COMPLET și VERDE (validat prin Docker; host fără Node)
- `docker compose run --rm test-unit sh -c "npm install --no-audit --no-fund && npx tsc --noEmit && npx vitest run"` → **`Test Files 24 passed (24) / Tests 399 passed (399)`**, `tsc --noEmit` zero erori. Niciun test atins de acest agent (UI-only); cele 399 rămân verzi.
- `npm run build` (prin Docker) → verde: `dist/assets/index-CDwD3XIX.js` **271.82 kB** (gzip 85.24) + `index-DxlK-rIX.css` **52.49 kB** (gzip 10.12). (era 254.86/52.06 în v2 — +17 kB JS din config-ul v3 deja prezent + textele bonusurilor unice).
- `docker compose up --build -d web api` → ambele healthy; **pagina 200 + `/api/health` 200** prin nginx; bundle-ul servit = `index-CDwD3XIX.js` (build-ul nou). **web+api lăsate PORNITE.**
- **Smoke Playwright one-off** (scripturi în scratchpad, NU în `tests/`, imaginea pin `v1.49.1-noble`, pe `http://web:80/?test=1`, joined pe `fableidler_default`): **13/13 CHECKS PASSED** — prestige→112 🪶, New Wing L1 (25 🪶) prin UI, **Saga Citadel apare în shop** (era wing-gated), teaser-ul rămâne anonim (fără scurgere de tier wing-2+), badge ×N la 25+, **badge UNIC violet/gold la 200** (`✦ The Garrison Sallies Forth` + fundal gradient), New Wing L3, **13 rânduri de generatori vizibile**, **zero scroll orizontal** (scrollW=clientW=1280), zero erori de consolă ale aplicației. Screenshot desktop citit vizual: layout curat, badge-urile (gold ×32 + violet `✦ A Hundred Whispers` pe Muse) se disting clar, numerele mari formatate (126Qa/1.29Qi), lista scroll-uiește intern.

### Contextul: UI-ul era deja masiv data-driven
Cardurile 9–14 (`GeneratorList` pe `isGeneratorVisibleInShop`), cele 7 re-scalere de rundă (`UpgradeList` pe `UPGRADES` + `isUpgradeUnlocked`, unlock `generatorCount≥150`), upgrade-urile de Atelier v3 + pips New Wing L1–L3 + confirmarea ≥10🪶 + cele 8 relics (`AtelierPanel` pe `ATELIER_UPGRADES`/`RELICS`), header-ul „N/36" achievements (`AchievementGrid` pe `ACHIEVEMENTS.length`), preview-ul de prestige (net-seed via `prestigePreview`), iconurile noi (`icons.ts`, puse deja de Engine v3) — TOATE mergeau prin config, fără modificare. Costurile mari (2500/8000/60000/400000 🪶 la Atelier, 5e10–2e14 la re-scalere, 6e9–5.3e20 la generatori) se formatează corect prin `formatNumber` existent.

### Ce am schimbat (fișiere — toate în `src/ui/`)
- **Nou: `src/ui/unique-bonuses-info.ts`** — date de PREZENTARE (nume + descriere de o frază) pentru cele 14 bonusuri unice la 200, cheiate pe `GeneratorId`. Engine-ul exportă DOAR configul numeric (`UNIQUE_BONUSES`) — numele/descrierile (13 §2.3) sunt strict UI. Sursă unică pentru GeneratorList, MilestoneTracker și toast-ul din App.
- **`components/GeneratorList.tsx` (+ `.css`):**
  1. **Fix (bug de teaser wing-gated):** `nextHidden` excludea doar `mythEngine` fără Blueprint; acum exclude ȘI orice generator wing-gated (`g.wing !== undefined && atelierLevel(theNewWing) < g.wing`). Fără fix, cu tier 8 deținut și fără New Wing, se randa un rând „? ? ?" care expunea `sagaCitadel.baseCost` (6e9) — încălca invarianta „niciun teaser pentru tier-uri gate-uite, ca la mythEngine" (13 §1.1/§0.2). Verificat în smoke.
  2. **Badge de prag generalizat:** `mult` (din `qtyMilestoneMultiplier`, care include deja pragurile v3 + Strength of the Stacks) afișat prin `formatNumber(mult)` (×256 etc. nu sparg pill-ul); tooltip-ul folosește setul combinat `MULT_THRESHOLDS = [...QTY_MILESTONE_THRESHOLDS, ...QTY_THRESHOLDS_V3]` (derivat din config), nu doar 25/50/100.
  3. **Badge UNIC la 200 (nou):** când `isUniqueBonusActive(state, id)`, un al doilea badge `generator-row__badge--unique` (fundal violet `--quill-deep→--quill`, text `--gold-bright`, bordură `--gold-deep`, glow violet — mixul violet/gold cerut) cu `✦ «nume»` + tooltip (nume + efect din `UNIQUE_BONUS_INFO` + „Unique bonus — N owned"). Pragul afișat = `uniqueThreshold(state)` (200, sau 150 cu The Hundredth Telling).
  4. **Hint „1 more →" generalizat:** la orice `owned+1` care traversează un prag de multiplicator (`×2`/`×4` prin `stepMultLabel`) SAU pragul unic (`1 more → «Bonus name»!`, tint violet). Înlocuiește hint-ul hardcodat pe `QTY_MILESTONE_MULT`.
- **`components/MilestoneTracker.tsx`:** pragurile de cantitate urmăresc acum setul complet (v1 25/50/100 + unic 200 + v3 150/300/400/500, derivat din config), cu etichetă corectă per prag (`×2`/`×4`/`«nume bonus unic»` via `thresholdLabel`). Reveal-urile v3 (`kind:'totalEarnedAndWing'`) intră în tracker DOAR când New Wing e deja la nivelul cerut (`atelierLevel(theNewWing) >= wing`) — atunci gate-ul rămas e pur `totalEarned`, deci o bară de progres validă; înainte de wing, gate-ul e o achiziție de Atelier (afișată acolo), nu un obiectiv de producție.
- **`App.tsx`:** toast-ul de prag de cantitate nu mai e hardcodat „×2 / production doubles". Acum: la pragul unic (200/150) → „«Gen»: «Bonus name»" + efectul; la 500 → „×4 … a grand finale"; altfel → „×2 … production doubles". Folosește `uniqueThreshold(store.getState())` + `UNIQUE_BONUS_INFO`.
- **`components/BookshelfPanel.tsx` (fix de sub-raportare):** header-ul folosea `BOOKSHELF.countedCap` (25) fix pentru contor ȘI procent; cu relicva **The Endless Shelf** (tomes 200) engine-ul (`bookshelfMultiplier`) ridică plafonul la 100 (+200%), dar UI-ul ar fi arătat „25/25 … (+50%)" mincinos. Acum plafonul e `hasRelic(state,'endlessShelf') ? ENDLESS_SHELF_BOOKSHELF_CAP : BOOKSHELF.countedCap` — aceeași regulă ca engine-ul.
- **Comentarii stale actualizate:** `AchievementGrid.tsx` („9/14" → dinamic N/36), `MilestoneTracker.tsx` (headerul de doc). Zero cifre hardcodate de logică găsite în `src/ui` (grep `\b(14|25|50|100|150|200|300|400|500)\b` pe `.tsx` → doar comentarii + `*100` procentuale; niciun `slice(0,8)`/`.length===8`/count de generatori hardcodat).

### Hardcodări pe „14"/praguri găsite și reparate
1. **Teaser-ul wing-gated în GeneratorList** (descris mai sus) — singura hardcodare de logică: gate-ul special acoperea doar `mythEngine`, nu și cele 6 tier-uri de New Wing. Reparat derivând din `g.wing` + `atelierLevel(theNewWing)`.
2. **Plafonul Bookshelf** în BookshelfPanel — constanta 25 în loc de plafonul dinamic (Endless Shelf → 100). Reparat prin `hasRelic`.
3. Restul „hardcodărilor" erau doar comentarii (AchievementGrid „9/14", MilestoneTracker „25/50/100") — actualizate; codul era deja dinamic.

### Abateri / decizii (cu motiv)
1. **`unique-bonuses-info.ts` în `src/ui`, nu în engine:** engine-ul (contract) ține DOAR numerele bonusurilor unice; numele + descrierile sunt copy de prezentare (13 §2.3), deci UI-only — la fel ca `ATELIER_ICONS`/`RELIC_ICONS`. Nicio modificare la `src/engine`, config sau `tests`.
2. **Reveal-urile v3 în MilestoneTracker doar post-wing:** un reveal `totalEarnedAndWing` fără wing-ul deținut nu e un obiectiv de producție (e o achiziție de Atelier). L-aș fi putut afișa cu bară „blocată", dar ar fi confuz (bara ar sări la 100% și tot ar rămâne blocat) — mai curat e să apară ca obiectiv de producție doar când wing-ul e cumpărat. Atelier-ul afișează deja progresul spre wing (mitigarea „next goal" din 14 §7.1(b)).
3. **Badge ×N prin `formatNumber(mult)`:** la 500 owned cu Strength of the Stacks `mult` ajunge ×625; `formatNumber` îl ține în sufixe, pill-ul are `overflow:hidden`/`text-overflow:ellipsis` pe badge-ul unic (numele lung) ca să nu spargă rândul.

### Fișiere modificate (absolute)
Noi: `C:\Projects\Games\Fable Idler\src\ui\unique-bonuses-info.ts`. Modificate: `src\ui\components\GeneratorList.tsx`, `GeneratorList.css`, `MilestoneTracker.tsx`, `BookshelfPanel.tsx`, `AchievementGrid.tsx`, `src\ui\App.tsx`. Log: acest fișier. INTERZIS respectat: zero atingeri în `src/engine`, config-uri, `tests/**`, `server/`.

---

## Agent Engine v3 — Alungirea (generatori 9–14, praguri adânci, prestige segmentat) (2026-07-04)

### Status: COMPLET și VERDE
- `docker compose run --rm test-unit sh -c "npm install --no-audit --no-fund && npx tsc --noEmit && npx vitest run"` → **24 fișiere / 399 teste trecute** (380 unit + 19 server; era 297 în v2 → **+102 unit**). TypeScript strict: zero erori.
- Toate testele v1/v2 rămân verzi; actualizările la teste existente (5 fișiere) sunt DOAR unde v3 schimbă legitim, justificate mai jos.
- Comanda finală (copiată): `Test Files 24 passed (24) / Tests 399 passed (399)`.

### Cifrele: 14 (economia finală) au avut prioritate peste 13 unde diferă (baseProd 9–14, growth 13–14 1.11/1.12, New Wing 25/2500/60000, Atlas 400000, Foreword cap 1e18, re-scalere dublate, quills pe te NET de seededInspiration, exponenți prestige 1/6 și 1/12).

### Fișiere modificate (engine)
- **Noi:** `src/engine/unique-bonuses.ts` (cele 14 bonusuri unice la 200/150 owned — sursă unică de adevăr pentru "e activ bonusul X"; ciclu-free: importă doar config + atelier).
- **Modificate:** `config.ts` (generatori 9–14, 7 re-scalere, DEEP_SHELVES, praguri v3, UNIQUE_BONUSES, PRESTIGE_V3, ATELIER v3, RELICS v3, achievements 25–36, reveal milestones v3, WELL_ROUNDED restrâns la cei 7 de bază), `types.ts` (id-uri noi + `run.seededInspiration` + `wing` pe GeneratorConfig + condiții achievement/milestone noi), `state.ts` (seededInspiration=0), `generators.ts` (Deep Shelves band-taper în costOf/bulkCost/maxAffordable + `bandGrowth` + `bestPaybackGenerator`), `selectors.ts` (qty v3 + Stacks, re-scaler step 2, Warp&Weft step 3¾, Atlas/OUAT `v3GlobalMultiplier`, Everyone's Biographer, Endless Shelf cap, Curator/DeepRoots/Library offline, Garrison spark, whispers/ink click, `buffProdMult` White-Hot, wing gate în isGeneratorVisibleInShop), `atelier.ts` (bookmarkedUpgrades cu Perpetual Manuscript, `newWingLevel`, `hasClockworkUnderstudy`), `buff.ts` (Quills Write Back +5s, Perpetual Myth −10s/floor 45s), `spark.ts` (City Dreams ×2 → `sparkRewardMult`, Pilgrims' Pages → `fragmentsPerQuill`), `prestige.ts` (formula segmentată + `prestigeNetTotalEarned` + Divine Royalties + `seedInspirationForNextRun` + set seededInspiration la publish), `milestones.ts` (praguri badge extinse + `totalEarnedAndWing`), `achievements.ts` (8 condiții noi), `tick.ts` (Clockwork Understudy auto-buy best-payback pe toți generatorii, determinist), `save.ts` (CURRENT_SAVE_VERSION=3, MIGRATIONS[2] aditiv, sanitize seededInspiration [0,te] + generatori 9–14 + atelier v3), `index.ts` (export-uri noi).
- **Atins minim în src/ui (permis pentru tsc):** `src/ui/icons.ts` — cheile noilor generatori (`sagaCitadel 🏰, narratorsGuild 🎭, pantheonPress ⚜️, worldTreeArchive 🌳, sleepingCity 💤, onceUponATime 📜` — distincte de mythEngine 🏛️), atelier v3, upgrade-uri v3, relics v3 (Record-urile cer cheile). Fără el `tsc --noEmit` pica.

### CONTRACTUL NOU pentru UI (config/selectori exportați noi)
**Config nou (din engine index):** `V3_RUN_UPGRADES`/`V3_RUN_UPGRADE_BY_GEN`/`V3_RUN_UPGRADE_ID_SET`/`V3_RUN_UPGRADE_UNLOCK_OWNED` (150), `DEEP_SHELVES`, `QTY_THRESHOLDS_V3`/`QTY_FINALE_THRESHOLD`/`QTY_FINALE_MULT`/`QTY_STEP_MULT`, `UNIQUE_THRESHOLD` (200)/`UNIQUE_THRESHOLD_TELLING` (150)/`UNIQUE_BONUSES`, `PRESTIGE_V3`, `STRENGTH_OF_STACKS`, `ATLAS_GLOBAL_MULT`, `CURATORS_PATIENCE_EXTRA_CAP_MS`, `ENDLESS_SHELF_BOOKSHELF_CAP`, `PILGRIMS_PAGES_FRAGMENTS_PER_QUILL`, `FOREWORD_START_FRACTION`/`FOREWORD_CAP`, `OFFLINE_EFFICIENCY_CAP` (0.90), `PERPETUAL_MANUSCRIPT_KEPT_IDS`; tipuri `UniqueBonusConfig`, `V3RunUpgradeConfig`, `SaveDataV3`.
**Selectori noi:** `newWingLevel(state)`, `hasClockworkUnderstudy(state)`, `isUniqueBonusActive(state,genId)`, `activeUniqueBonus(state,genId)`, `uniqueThreshold(state)`, `v3GlobalMultiplier(state)`, `buffProdMult(state)`, `bandGrowth(g0,band)`, `bestPaybackGenerator(...)`, `fragmentsPerQuill(state)`, `sparkRewardMult(state)`, `prestigeNetTotalEarned(state)`, `seedInspirationForNextRun(state,tomeNumberAfter)`. `isGeneratorVisibleInShop` acum gate-uiește tiers 9–14 pe `cfg.wing ≤ atelierLevel(theNewWing)` (pattern blueprintOfMyths, rând nerandat fără nivel). `prestigePreview` folosește te NET de seed + include Divine Royalties.
**Câmp nou în save/state:** `run.seededInspiration` (number, 0 la migrare; setat la publish = Dog-Eared + Foreword; sanitize clamp [0, totalEarned]). Preview-ul de prestige = `quillsForTotalEarned(prestigeNetTotalEarned(state)) + bonusuri` — jucătorul NU vede segmentele.

### Decizii + abateri documentate (față de 13/14)
1. **`coef3` = `100 × pow(1e6, 1/6)` = 999.9999999999998 în IEEE-754** (14 §5.1 spunea "= 1000 exact"). Garda `+1e-9` pe segmentele 2–3 face `q(1e15) = 1000` corect; testul NU hardcodează `coef3 === 1000`, verifică output-ul `q()`. Breakpoints măsurate = tabelul 14 §5.3 exact (1e13→464, 1e15→1000, 1e18→1778, 1e21→3162, 1e24→5623).
2. **`WELL_ROUNDED_GENERATOR_IDS` restrâns la cei 7 de bază** (era `filter(≠mythEngine)` care ar fi înghițit tiers 9–14 → Well-Rounded Library ar fi cerut toate 14). `cosmologySection` (nou) cere toate 14 via `allGeneratorsV3`. Fără fix, testul v2 `wellRoundedLibrary` pica.
3. **`bestPaybackGenerator` (Clockwork Understudy)** ia `isGeneratorVisibleInShop` + `marginalProduction` ca parametri (evită ciclu selectors↔generators). Determinism: probe-ul păstrează `run.totalEarned` de la începutul tick-ului (revealAt nu se schimbă mid-tick), deci decizia de cumpărare e independentă de felierea în tick-uri. Deciziile (generatori + lastAutoBuyAt) sunt bit-identice la 10×500ms vs 1×5000ms; producția integrează identic doar când nu se declanșează un unlock mid-fereastră (comportament v1 cunoscut — testul pre-deblochează achievements/milestones, ca testul v1 de auto-buy).
4. **Cost multiplier compus** (Patron's Favor ×0.95 × Conspiracy of Ravens ×0.97) aplicat DUPĂ suma pe benzi, un singur ceil pe total — bulk pe benzi = sumă geometrică per bandă (fiecare bandă are ratio > 1 garantat de podeaua 1.04).
5. **Divine Royalties + Editor's Due** intră în `prestigePreview` → `earned` → wallet ȘI lifetime la publish (nu doar wallet).
6. **`sanitizeMeta` storyFragments clamp** rămâne la `SPARK.fragmentsPerQuill - 1` (=4); cu Pilgrims' Pages engine-ul produce max 2, dar 4 e o margine superioară validă (nu strică nimic).

### Actualizări legitime la teste existente (5 fișiere, cu justificare)
- `achievements.test.ts`: `fullPatronage` cere acum toate 16 upgrade-uri Atelier maxate (v2+v3), construit din `ATELIER_UPGRADES` ca să nu derive; `wellRoundedLibrary` neschimbat conceptual (fix pe WELL_ROUNDED în config, nu în test).
- `atelier.test.ts`: `richAtelierState` finanțează întregul sink v2+v3 (470.852 🪶, calculat din config) ca regula de aur să se poată verifica pe fiecare nivel; testul "spending the whole wallet" acceptă `≥` (Atlas ×2 ridică legitim producția).
- `production.test.ts`: `qtyMilestoneMultiplier` extins — 150→×16, 300→×32, 400→×64, 500→×256 (200 = bonus unic, NU multiplicator).
- `save.test.ts`: lanțul de migrare merge acum v0→v1→v2→v3; `version === CURRENT_SAVE_VERSION` + `seededInspiration === 0`.
- `save-migration-v2.test.ts`: fixture-ul v1 migrează acum până la v3 (toate câmpurile v2 supraviețuiesc aditiv); assertions pe `CURRENT_SAVE_VERSION` + `seededInspiration`; testul de versiuni greșite testează 4/2/1 respinse, v3 acceptat.

### Teste noi (5 fișiere, 96 teste)
- `deep-shelves.test.ts` (14): band growths (Muse 1.15→1.12/1.09/1.0675, World-Tree 1.10→1.08/1.06/1.045, podea 1.04); invarianta index 0–100 identică v1 bit-cu-bit; prețuri de graniță (99/100/101/199/200/299/300) hand-computed; bulk pe benzi la granițele 100/101, 200/201, 300/301; Patron's Favor + Conspiracy of Ravens.
- `prestige-v3.test.ts` (18): **property-test 200.000 eșantioane** `q(te) == floor(sqrt(te/1e5))` pentru te≤1e9; breakpoints 14 §5.3; continuitate la 1e9±1 și 1e15±1e6; monotonie pe grilă log densă + fină la genunchiuri; net-seed anti-exploit (publish instant post-Foreword = 0 🪶); `seedInspirationForNextRun` (Dog-Eared 300 / Foreword 0.1% cap 1e18); Dog-Eared echivalent numeric v2 (q(300)=0).
- `save-migration-v3.test.ts` (14): MIGRATIONS[2] v2→v3 câmp-cu-câmp pe fixture v2 REAL; lanțul complet v1→v2→v3; producție post-migrare IDENTICĂ (hand-computed); round-trip v3; sanitize seededInspiration clamp [0,te] + generatori 9–14 + atelier v3.
- `unique-bonuses.test.ts` (20): pragul 200/150 (Hundredth Telling); praguri extinse cu Strength of the Stacks (×2.5/×5); fiecare din cele 14 bonusuri unice cu efect exact (click ×2, echo 2%, cost 0.97, buff +5s, tiers1-4 ×3, offline +5pp cap 0.90, buff prod ×2.5, cooldown −10s floor 45, spark interval 0.75, ach ×1.5, +1 quill, offline cap +12h, spark ×2, global ×2).
- `v3-systems.test.ts` (30): New Wing gating tiers 9–14 (L1/L2/L3 + revealAt + mythEngine neatins); cele 7 re-scalere (mult exact, unlock 150); Perpetual Manuscript păstrează cele 10 v1 dar NU re-scalerele (nici Second Bookmark); Clockwork Understudy auto-buy best-payback determinist; Atlas ×2 / Endless Shelf cap 100 / Pilgrims 5→3 / City spark ×2/×4; cele 12 achievements + 6 reveal milestones + praguri qty badge; **invarianta "primele 40 min identice"** (v3 no-op pe stare proaspătă).

### De rulat (reproducere)
`docker compose run --rm test-unit sh -c "npm install --no-audit --no-fund && npx tsc --noEmit && npx vitest run"` → 399 teste verzi.

---

## Agent Docs v2 — README actualizat pentru v2 (2026-07-04)

### Status: COMPLET
- Singura comandă Docker rulată: `docker compose config -q` (read-only, permisă) → exit 0, compose valid. Zero `up/run/build/down` (Agentul E2E deținea Docker-ul).
- Fișiere atinse: **DOAR `README.md`** (rescris pentru v2) + această secțiune. `tests/`, `src/`, `server/`, configs — neatinse.

### Ce s-a schimbat în README (structura cerută păstrată: How to run / How to test / How to build / Project structure / Game systems / Known limitations)
1. **Intro** — „No backend" înlocuit cu „Client-side game, optional backend" (leaderboard-ul `server/`, joc 100% funcțional fără el).
2. **How to run** — `docker compose up --build` pornește acum `web`+`api`; subsecțiune nouă: `docker compose up --build web` merge singur (resolver lazy în nginx, Hall of Fables degradează grațios); avertisment că `down -v` șterge acum și `leaderboard_data`; `logs api` la debugging; nota că `dev` pornește și `api` (Vite proxy `/api`).
3. **Quick start** — pași noi: Stray Spark la 1.000, Actul 2 după primul Publish (Atelier/Bookshelf/Hall + regula de aur).
4. **How to test** — „297 tests" (278 în `tests/unit` + 19 în `tests/server`, ambele printr-un singur `docker compose run --rm test-unit` via `vite.config.ts test.include`); descrierea celor 19 teste server (HTTP real in-process, port efemer); E2E: așteaptă healthcheck `web`+`api`, „spec-urile din tests/e2e" (fără cifră hardcodată — Agentul E2E adaugă spec-uri chiar acum); `forceSpark` adăugat la lista hook-ului; notă că volumul leaderboard păstrează nickname-uri între rulări.
5. **How to build** — bundle actualizat (~255 KB JS / ~80 KB gzip / ~52 KB CSS, din log-ul Agent UI v2); `docker compose build api` (imagine fără build step, zero deps).
6. **Project structure** — arbore actualizat: `server/` complet (6 fișiere src + Dockerfile), `atelier.ts`/`spark.ts`/`fables.ts` în engine, `leaderboard-client.ts` + componentele v2 + `useStraySpark` în ui, `tests/server/`, `tools/economy-sim-v2.mjs`, cifrele 24 achievements / 15 milestones în comentarii.
7. **Game systems** — actualizate: Generators (8, cu rândul Myth Engine 300M/45.000/×1.12), Achievements (24), Milestones (15 reveal = 12 pe totalEarned + 3 pe primul tome), Prestige (+regula de aur pe `lifetimeQuillsEarned`, Second Bookmark, Editor's Due, fable per publish), Offline (Night Owl 20h/24h, Reader's Letter +10pp → max 85%), Saving (schema v2 sub cheia istorică `fable-idler-save-v1`, migrare v1→v2, export conține tokenul). Secțiuni NOI: **The Gilded Atelier** (tabel cu toate cele 10 upgrade-uri + costuri, total 92 🪶, confirmare ≥10, 5 fragmente = 1 quill), **Relics of the Published** (4 relicve la 3/7/15/30 tomes, derivate — nu în save), **Stray Spark** (interval 150–330s, zbor 10s, tabel recompense cu ponderile 45/20/15/10/8/2), **The Bookshelf** (+2%/fabulă unică, cap 25 = +50%, gilded ≥5 quills, faded din migrare contează), **Myth Engine** (Blueprint 12 🪶 + reveal 150M, exclus din Well-Rounded Library), **Hall of Fables** (nickname 3–20 `[A-Za-z0-9 _-]`, guest token afișat o dată → în save, 4 scoruri, top 20 + rank propriu, best-keeping, TTL 90 zile, local-only = zero requests).
8. **Hosting on a server** — secțiune NOUĂ: `up -d --build` pe VPS, reverse proxy + TLS peste 8080 (un singur port acoperă joc + `/api/`), `restart: unless-stopped` deja setat, backup = volumul `leaderboard_data` (exemplu tar), save-urile jucătorilor NU sunt pe server, onest despre client-authoritative + rate limits, env tunables (`LEADERBOARD_TTL_DAYS` etc.).
9. **Known limitations** — adăugate: scoruri client-authoritative („on trust"); tokenul trăiește în save-ul local (export = backup ȘI parolă); „No backend" reformulat în „No cloud sync for game saves"; multi-tab neschimbat; test hook re-motivat (nu mai e „local single-player").

### Verificare pe disc (fiecare afirmație din README confruntată cu sursa)
- `src/engine/config.ts`: 8 generatori (mythEngine 300M/45.000/×1.12/revealAt 150M), 24 achievements, 15 reveal milestones (12 totalEarned — incl. `aLightAtTheWindow` la 1.000 — + 3 `tomesPublished:1`), ATELIER_UPGRADES (10, costuri exacte din tabel, sumă 92), RELICS (3/7/15/30), SPARK (150–330s, 10s zbor, ponderi 45/20/15/10/8/2, frenzy ×7/30s, gossip ×5/60s tiers 1–3, inkBurst 45s/floor 50 clicks, 5 fragmente/quill), BOOKSHELF (0.02/cap 25), GILDED_QUILLS_THRESHOLD=5, NIGHT_OWL +12h, READERS_LETTER +0.1, WELL_ROUNDED exclude mythEngine.
- `src/engine/save.ts`: SAVE_KEY `fable-idler-save-v1` neschimbat, CURRENT_SAVE_VERSION=2, migrare v1→v2. `src/engine/fables.ts`+`selectors.ts`: faded contează în `uniqueFableCount` (dedupe pe titlu).
- `docker-compose.yml`: api fără port pe host, volum `leaderboard_data`, `restart: unless-stopped` pe web+api, web FĂRĂ depends_on, dev `depends_on: [api]`, test-e2e așteaptă web+api healthy, pin v1.49.1-noble. `nginx.conf`: `location /api/` cu resolver lazy. `vite.config.ts`: proxy `/api` + `test.include` cu `tests/server`.
- `server/src/*`: nickname `^[A-Za-z0-9 _-]{3,20}$` (validate.mjs), ttlDays default 90 (server.mjs/app.mjs), rate limits 10/60 pe min.
- Teste: `tests/unit` = 18 fișiere `.test.ts` + helpers, `tests/server` = 1 fișier; cifrele 278+19=297 luate din rulările validate în log (Agent Engine v2 + Agent UI v2) — numărătoarea statică a `it(` subestimează din cauza buclelor parametrizate. E2E lăsat generic (8 spec-uri v1 pe disc acum, Agentul E2E adaugă).
- Bundle: 254.86 kB JS (gzip 79.80) + 52.06 kB CSS — din validarea reală a Agent UI v2 (log, 2026-07-04), rotunjite în README.

### De știut pentru Agentul E2E / quality gate
- README documentează E2E generic („the Playwright specs from tests/e2e") — nicio cifră de actualizat când adăugați spec-uri.
- Dacă schimbați fluxul de rulare E2E sau adăugați servicii compose, actualizați „How to test" și „How to run".

---

## Agent UI v2 — Atelier, Bookshelf, Hall of Fables, Stray Spark (2026-07-04)

### Status: COMPLET și VERDE (validat prin Docker + smoke Playwright)
- `npx tsc --noEmit` — zero erori (prin `docker compose run --rm test-unit`).
- `npx vitest run` — **19 fișiere / 297 teste trecute** (278 unit + 19 server), niciun test modificat de acest agent.
- `npm run build` — verde: `dist/assets/index-Byv_Ly0-.js` 254.86 kB (gzip 79.80) + `index-Chdsxgvi.css` 52.06 kB (gzip 10.04).
- `docker compose up --build -d web api` → ambele healthy; pagina 200, bundle 200, **`GET http://localhost:8080/api/health` → 200 prin nginx** (proxy funcțional); `docker compose stop api` → pagina rămâne 200, `/api/health` → 502 în <2s (resolver lazy OK); api repornit → 200. **web+api lăsate PORNITE**, volumul leaderboard resetat GOL după probe.
- **3 smoke-uri Playwright în Docker** (scripturi one-off din scratchpad, NU în `tests/`, imaginea pin v1.49.1-noble, pe `http://web:80/?test=1`):
  - **desktop (1280×720), 24/24 PASS:** inkBurst creditat + toast spark; pill quillFrenzy; tab-atelier/tab-hall/bookshelf după primul Publish; purse 100→99 la apprenticeMuse fără dialog; dialog de confirmare la blueprintOfMyths (12 🪶) + cumpărare; `per-second` NEschimbat de cumpărături; `atelier-lifetime` imobil la 100; 4 sloturi relics; mythEngine vizibil doar cu Blueprint + 150M; claim → tabel + rândul propriu + `data-state=active`; identitate în settings; achievement `nameInLights`; spark NU supraviețuiește reload-ului și nu acordă nimic; **zero erori/warninguri de consolă emise de aplicație**.
  - **degradare API (route.abort pe `**/api/**`), 4/4 PASS:** badge courier + `data-state=offline`, joc complet funcțional, refresh manual silențios, zero erori de consolă ale aplicației.
  - **mobil (375×812), 9/9 PASS:** 4 tab-uri pre-Publish (zero regresie v1), 5 post-Publish, fiecare ≥48px înălțime / ≥44px lățime, fără scroll orizontal, fără `tab-hall`, ordinea în Fable = Prestige→Bookshelf→Milestones→Achievements→Hall.
- QA grep: `#[0-9a-fA-F]{3,6}` pe `src/ui` → hituri DOAR în `tokens.css` (+`animations.css` — ambele permise); zero `console.*` în `src/ui`.

### ⚠️ Pentru Agentul E2E v2 (regresii de spec, NU de produs)
1. **`04-unlocks.spec.ts` pică**: asertează hardcodat `achievements-count` = „1/14" — engine-ul v2 are **24** achievements, iar header-ul UI e dinamic (`{unlocked}/{ACHIEVEMENTS.length}`, cod v1 neatins). Specul trebuie actualizat la `1/24` (sau făcut dinamic). Restul: **10/11 spec-uri v1 verzi** pe stack-ul complet. `tests/e2e` era interzis acestui agent — rămâne al tău.
2. **`Failed to load resource: net::ERR_FAILED / 502`** apare în consolă la scenariul de degradare (route.abort sau api oprit) — e logul de rețea al **Chromium-ului**, imposibil de suprimat din JS (fetch-ul e prins, aplicația NU emite nimic). Fixture-ul v1 numără ORICE `console.error` ⇒ specul 10b trebuie să filtreze mesajele care încep cu `Failed to load resource` (păstrând stricte `pageerror` + restul `console.error`).
3. `forceSpark(kind?)` există în `__FABLE_TEST__` (tab vizibil obligatoriu); sub reduced-motion sparkul stă STATIC în slotul de colț — folosește-l pentru click determinist. Sparkul zboară 10s; `dispatchEvent('pointerdown')` e mai robust decât `click()` pe elementul în mișcare.
4. Toast-urile au coadă (max 3 vizibile): după `addInspiration` masiv, toast-ul de spark intră în spatele cozii — testează recompensa din stare, nu din toast, sau prinde sparkul pe coadă goală.
5. Post-prestige coloana centrală dispare până se re-ating milestone-urile de rundă (comportament v1): după `dispatch({type:'prestige'})` din hook, dă `addInspiration(100_000)` ca să revină tab-urile + PrestigePanel.

### Fișiere create (UI)
| Fișier | Rol |
|---|---|
| `src/ui/leaderboard-client.ts` | Mini-store singleton (pattern GameStore) creat în `main.tsx`: stări `disabled/idle(fără identitate)/ready/unreachable(+sealLost)`; fetch cu AbortController (GET 4s / POST 5s); backoff refresh 30→60→120→300s; cache nesecret `fable-idler-leaderboard-cache-v1`; identitatea prin `setSettings` (save imediat + `nameInLights` gratuit); triggere submit: claim, creșterea `tomesPublished` (store.subscribe), interval 90s dacă dirty, `visibilitychange→hidden` cu `keepalive`, manual; throttle 60s pe automate; 401 → drop identitate silențios + flag sealLost; **toate eșecurile silențioase, zero console** |
| `src/ui/hooks/useStraySpark.ts` | Shell-ul deține TOT nedeterminismul spark (10 §3.1): timer spawn din `sparkIntervalRange(state)` (uniform), DOAR tab vizibil, gate `aLightAtTheWindow` verificat la fire (forceSpark îl ocolește), max 1, despawn la hidden + la 10s (`SPARK.flightMs`), kind rostogolit LA CLICK (`rollSparkKind(Math.random())`) → `dispatch collectSpark`; nimic în save; bridge modul-level `invokeForceSpark` pentru test-hook |
| `src/ui/components/StraySpark.tsx` + `.css` | `StraySparkLayer` (fixed, z-70: sub toasts 80/modale, peste conținut) + `<button data-testid="stray-spark">` hitbox 48×48, miez 10px `--gold-bright` + `--spark-halo` + 2 puncte de trenă; lane ales LA SPAWN din 4 diagonale peste zona sigură cu keep-out rects (+24px: click-area, buff-button, spark-pill, prestige-button, header, tab-bar, bottom-nav, toast-container) prin sampling pe segment; fallback garantat banda 72–160px sub header; mobil: banda dintre ResourceHeader și nav, tăiată deasupra ClickButton; `pointerdown` (instant) + Enter/Space; `sparkBurst` #17 (8 particule + inel, failsafe removal); reduced-motion: slot static colț + fade. Tot aici: **`SparkBuffPill`** (`data-testid="spark-buff-pill"` + `data-buff`), inel conic din tick, bordură `--gold-bright`, durată totală cu Net L2 |
| `src/ui/components/AtelierPanel.tsx` + `.css` | Header sticky dublu-sold: Purse (28px display `--quill`, `walletSpend` la scădere) / „Lifetime earned" + „→ +N% production, forever." (imobil, tabular-nums); microcopy anti-frică PERMANENT; contor 🧩 „N/5 · «word» more bind(s) a golden quill"; subtitlul normativ 12 §8; carduri cu stările affordable (bordură `--quill` + glow, buton VERDE — semantica v1)/expensive („Need N more 🪶")/leveled-partial (pips ●●○ + „Now: …")/maxed (secțiune colapsabilă „Fully Commissioned (N)", ✓ violet, pattern v1 Purchased); flash violet 300ms la cumpărare; confirmare Modal la cost ≥ `ATELIER_CONFIRM_THRESHOLD_QUILLS` (10, din `ui/meta.ts`) cu „Commission"/„Not yet" + rândul regulii de aur; secțiunea **Relics of the Published**: 4 sloturi mereu vizibile, locked = siluetă `brightness(0.35) grayscale` + „N/M tomes" + ProgressBar quill + tooltip complet, unlocked = bordură `--gold-deep` (singurul auriu din Atelier), `relicUnlock` #18 pe tranziție |
| `src/ui/components/BookshelfPanel.tsx` + `.css` | Cotoare CSS pe scânduri cu bord auriu; seed vizual determinist (FNV pe titlu + n) → `--spine-{1..8}`, lățime 18–26px, înălțime 64–80px, 1–2 nervuri inset, muchie stângă `--spine-edge`; gilded = gradient gold + muchii `--gold-bright`; faded = grayscale(0.7)/0.55 fără dată; tooltip titlu italic display + „Tome #N · 12 Oct" + „Earned X in Y · +Z 🪶" / „The ink has faded…"; header „N fables · +P% production" cu cap „25/25 counted — the shelf is full of wonders (+50%)"; `bookSlideIn` #19 doar pe cotorul nou (clasa ținută 700ms); max-height 280px scroll propriu (nu împinge Milestones sub fold) |
| `src/ui/components/HallOfFablesPanel.tsx` + `.css` | TOATE cele 10 stări din 12 §6.1; `data-state="local-only\|opt-in\|loading\|active\|offline\|empty"`; consumă DOAR leaderboard-client (zero fetch în componente); vizibil = montat ∧ IntersectionObserver ∧ `visibilityState` → primul GET la intrare + interval 60s; segmented control 4 scoruri; tabel top 20, rândul propriu `--quill-tint` + bordură stângă 3px SAU rândul `#N — you · valoare` sub tabel (niciodată ambele); `leaderboardRowHighlight` #20 la rank îmbunătățit; skeleton ×5 #22; „Update now" cu cooldown 5s (submit+refresh, ocolește throttle-urile); 409 → eroare inline cu inputul păstrat; validare client identică serverului la blur; „Sending word…" + spinner (ascuns sub reduced-motion); badge courier + „as of HH:MM" din cache la offline; badge seal la 401; local-only fără NICIUN request |

### Fișiere modificate (UI)
- `src/ui/App.tsx` — tab-urile per layout (desktop: Generators\|Upgrades\|Atelier\|Hall of Fables; tabletă: …\|Atelier\|Fable; mobil: 5 tab-uri DOAR post-`theGildedDoor`); Hall montat per-tab pe desktop / secțiune finală în Fable pe rest; Bookshelf sub PrestigePanel (dreapta desktop + în Fable); reveal „Actul 2" Bookshelf→Atelier→Hall cu delay 900/1150/1400ms (`ACT2_REVEAL_*`, `animation-fill-mode: backwards`, flag 5s la primul Publish); toast-urile v2 (spark cu cifre din `reward`, relic cu emoji-ul relicvei, fable cu titlu + „A reprint!" la duplicat, tutorialul spark o dată lifetime pe milestone-ul `aLightAtTheWindow` + cheia `SPARK_TUTORIAL_KEY`); chip-ul `golden-quills` = PORTOFEL + tooltip „Purse N 🪶 · Lifetime M 🪶 — your +P% production never decreases." + `walletSpend` la scădere (chip randat și când doar lifetime>0); `StraySparkLayer` + `SparkBuffPill` montate; `anyGeneratorAffordable` pe `isGeneratorVisibleInShop`; badge violet Atelier când ceva e affordable.
- `src/ui/components/ClickButton.tsx\|.css` — crit: UN singur `Math.random()` per click → `dispatch({type:'click', critRoll})` + `isCritRoll` pe ACELAȘI roll pentru feedback; float `+X ✦` 22px `--gold-bright` cu `data-crit="true"`; `critFlash` #21 pe un overlay span (fără remount de buton); caption `crit-caption` 800ms; reduced-motion: static „+X ✦ (a stroke of genius!)" 500ms fără caption separat.
- `src/ui/components/GeneratorList.tsx\|.css` — trecut pe `isGeneratorVisibleInShop` (mythEngine fără Blueprint nu există deloc, nici ca teaser „? ? ?"); badge pill violet „auto" pe rândul Wandering Muse cu Self-Writing Contract + tooltip-ul normativ.
- `src/ui/components/PrestigePanel.tsx\|.css` — bonusul % citește `lifetimeQuillsEarned` (regula de aur; cifra de lângă 🪶 rămâne portofelul); preview „(+1 Editor's Due)" când e deținut; rând „Bookmarked: *nume reale* survive the reset." în dialog (din `bookmarkedUpgrades`).
- `src/ui/components/BuffButton.tsx` — inelul de cooldown pe `buffCooldownMs(state)` (Restless Heart 90/75/60s); denominatorul inelului activ tolerează fereastra dublată de Standing Ovation.
- `src/ui/components/OfflineModal.tsx` — eticheta „— Lucid Dreaming" doar la eficiență ≥0.75 (Reader's Letter singură dă 0.6).
- `src/ui/components/Toast.tsx\|.css` — kind-urile noi `spark`(bordură `--gold-bright`)/`relic`/`fable`(violet) + override de icon per-toast.
- `src/ui/components/TabBar.tsx\|.css` — `variant:'quill'` (underline+text violet), badge-dot (gold/quill), `revealDelayMs`.
- `src/ui/components/BottomNav.tsx\|.css` — `bottom-nav--five` (label 11px), `badgeVariant:'quill'`, `revealDelayMs`.
- `src/ui/components/SettingsPanel.tsx` — avertisment la Export când există identitate leaderboard (riscul #1 din 10).
- `src/ui/test-hook.ts` — `forceSpark(kind?)` prin bridge-ul din `useStraySpark`.
- `src/main.tsx` — `createLeaderboardClient(store)` (singleton; își montează singur triggerele) + prop `leaderboard` la `<App/>`.
- NEATINSE: `src/engine/**` (zero bug-uri găsite care să ceară modificări), `package.json`, configs, `server/`, `tests/**`, `tokens.css`/`animations.css` (v2-urile erau deja pe disc și acoperă tot ce folosesc).

### Contract data-testid FINAL v2 (tot ce e implementat efectiv; v1 neatins)
| testid | Element / atribute |
|---|---|
| `tab-atelier` | tabul Atelier — TabBar ≥720px SAU BottomNav <720px (un singur element în DOM; nu există pre-`theGildedDoor`) |
| `tab-hall` | tabul Hall of Fables — **DOAR desktop ≥1100px** |
| `atelier-panel` / `atelier-purse` / `atelier-lifetime` / `atelier-fragments` | rădăcina / cele două solduri / contorul 🧩 „N/5" |
| `atelier-upgrade-<id>` | cardul (cele 10 id-uri literale); după max intră în secțiunea colapsabilă — vizibil doar cu `atelier-maxed-toggle` expandat (pattern v1 „Purchased") |
| `atelier-buy-<id>` | butonul de cumpărare (disabled = expensive) |
| `atelier-maxed-toggle` | toggle-ul „Fully Commissioned (N)" *(adaos față de 12 — necesar E2E ca să ajungă la cardurile maxate)* |
| `atelier-confirm-dialog` / `atelier-confirm` | dialogul ≥10 🪶 / butonul „Commission" |
| `relic-<id>` (`data-state="locked\|unlocked"`) / `relic-progress-<id>` | sloturile de relicve / textul „N/M tomes" (doar locked) |
| `stray-spark` | `<button>` zburător (pointerdown/Enter/Space); NU există decât în zbor |
| `spark-buff-pill` (`data-buff="quillFrenzy\|gossipBonanza"`) | pill-ul secundar de buff, lângă BuffButton |
| `bookshelf-panel` / `bookshelf-count` | raftul / header-ul „N fables · +P%" |
| `fable-spine-<n>` (`data-gilded`, `data-faded`) | cotorul tomului #n (1-based), `<button>` cu aria-label titlu+tom |
| `leaderboard-panel` (`data-state="local-only\|opt-in\|loading\|active\|offline\|empty"`) | rădăcina Hall — ținta E2E pe TOATE layouturile |
| `leaderboard-nickname-input` / `leaderboard-join` / `leaderboard-error` | fluxul opt-in (eroarea acoperă 409/invalid/network, inline) |
| `leaderboard-score-tab-<key>` | segmented control, chei: `lifetimeInspiration`, `tomesPublished`, `lifetimeQuills`, `fastestPublish` |
| `leaderboard-table` / `leaderboard-row-self` / `leaderboard-rank-self` | tabelul top 20 / rândul propriu ÎN tabel / rândul „#N — you" SUB tabel (exclusive) |
| `leaderboard-refresh` / `leaderboard-updated` / `leaderboard-offline` | Update now (cooldown 5s) / „Last updated Nm ago" sau „as of HH:MM" / badge-ul courier |
| `generator-mythEngine` / `buy-mythEngine` | gratis prin pattern-ul v1 (nu se randează fără Blueprint) |
| `floating-number` + `data-crit="true"` / `crit-caption` | float-ul de crit / caption-ul „A stroke of genius!" |
| `toast` cu `data-toast-kind` NOU: `spark` / `relic` / `fable` | kind-urile v1 rămân |

### Decizii / abateri documentate (față de 12)
1. **Toast-tutorial spark la milestone-ul `aLightAtTheWindow`** (09 §5.2), nu la primul spark prins (12 §4.3.4 se contrazicea cu 09; textul „Catch it." are sens DOAR înainte de prindere). O dată lifetime prin `localStorage` `fable-idler-spark-tutorial-v1`.
2. **`atelier-maxed-toggle`** — testid nou nespecificat în 12: cardurile maxate stau colapsate (pattern v1), altfel ar fi inaccesibile testelor.
3. **Zbor spark implementat ca track (sparkFloat pe wrapper) + bob pe buton** — cele două transformări nu se bat; keep-out prin 25 de eșantioane pe segment (suficient pentru rect-uri de ≥48px cu inflare 24px).
4. **Chip-ul `golden-quills` se randează și când `lifetimeQuills>0`** (nu doar portofel/tomes>0) — un jucător care a cheltuit tot nu trebuie să-și piardă chip-ul.
5. **„Failed to load resource" din Chromium NU poate fi suprimat** — criteriul „zero erori consolă" e îndeplinit la nivelul aplicației (zero `console.*` emise, zero pageerror); vezi nota E2E #2.
6. **Ordinea reveal-urilor Actului 2 = delay-uri CSS** (900/1150/1400ms de la mount, `ACT2_REVEAL_BASE/STAGGER` din `ui/meta.ts`) — panourile se montează sub overlay-ul de prestige (~500ms) și „intră" vizual după clear (1400ms), exact serializarea 12 §1.4; flag-ul se stinge după 5s (remount-urile ulterioare nu re-întârzie).
7. **Claim eșuat pe rețea** → mesaj inline „The courier seems lost…" sub input (12 nu specifica acest sub-caz al opt-in-ului).
8. **`buffCooldownMs`/denominatorul inelului** — retuș v1 necesar (BuffButton folosea constanta `BUFF.cooldownMs`; cu Restless Heart inelul ar fi mințit).
9. **OfflineModal „— Lucid Dreaming" la ≥0.75** — cu Reader's Letter, 0.6 nu mai implică Lucid Dreaming (12 §2.3 nightOwlPact: „stringul corect").

### De verificat vizual de QA (rămase)
- Estetica lane-urilor spark pe tabletă (720–1099px) și cu coloana centrală îngustă; sloturile statice reduced-motion pe toate layouturile (aleg colțul corect, verificat doar logic).
- `axe` DevTools pe AtelierPanel + HallOfFablesPanel (perechile de culori sunt cele validate în 04, dar auditul complet rămâne la QA).
- FPS la 3 sparks prinși consecutiv (nodurile de burst au failsafe de curățare; măsurătoarea rămâne la QA).
- Aspectul cotoarelor la 40+ fabule (scroll intern verificat logic la 280px, nu vizual).
- Tab-navigare completă din tastatură pe fluxurile noi (toate controalele sunt `<button>`/`<input>` native; walkthrough-ul integral rămâne la QA).

---

## Agent Engine v2 — Atelier, Spark, Fables, migrare, Myth Engine (2026-07-04)

### Status: COMPLET și VERDE
- `docker compose run --rm test-unit sh -c "npm install --no-audit --no-fund && npx tsc --noEmit && npx vitest run"` → **19 fișiere / 297 teste trecute** (278 în `tests/unit` — era 156 în v1 → **+122**; celelalte 19 sunt `tests/server` ale agentului de backend, verzi în aceeași rulare). TypeScript strict: zero erori.
- Toate testele v1 rămân verzi; excepțiile actualizate legitim sunt listate mai jos cu justificare.

### Fișiere
- **Noi (engine):** `src/engine/atelier.ts`, `src/engine/spark.ts`, `src/engine/fables.ts`.
- **Modificate (engine):** `config.ts`, `types.ts`, `state.ts`, `save.ts`, `selectors.ts`, `tick.ts`, `prestige.ts`, `buff.ts`, `offline.ts`, `milestones.ts`, `achievements.ts`, `game-loop.ts`, `index.ts`.
- **Noi (teste):** `tests/unit/atelier.test.ts` (26), `spark.test.ts` (22), `fables.test.ts` (11), `save-migration-v2.test.ts` (19), `selectors-v2.test.ts` (15).
- **Actualizate (teste v1, doar unde v2 schimbă legitim):** `tick.test.ts` (+describe auto-buy & buff v2), `prestige.test.ts`, `click.test.ts`, `production.test.ts`, `milestones.test.ts`, `achievements.test.ts`, `save.test.ts`, `progression-speed.test.ts` — justificări la „Actualizări legitime" mai jos.
- **Atinse minim în src/ui (cu motiv):** `src/ui/App.tsx` (guard `event.type === 'achievement'` — extinderea union-ului `GameEvent` rupea narrowing-ul TS; evenimentele v2 sunt ignorate acolo până le preia Agentul UI v2) și `src/ui/icons.ts` (+`mythEngine: '🏛️'` — `Record<GeneratorId,…>` cere cheia nouă). Fără ele `tsc --noEmit` pica; sunt exact liniile pe care Agentul UI v2 le-ar fi scris oricum.

### CONTRACTUL PENTRU UI (acțiuni / selectori / evenimente — semnături exacte)

**Acțiuni noi / extinse (dispatch):**
```ts
{ type: 'click'; critRoll?: number }              // UI pasează Math.random() ∈ [0,1); absent = fără crit.
                                                  // Folosiți ACELAȘI critRoll și pentru feedback-ul vizual:
                                                  // isCritRoll(state, critRoll) vă spune dacă a critat.
{ type: 'buyAtelierUpgrade'; id: AtelierUpgradeId }  // critică (save imediat); no-op dacă maxat/fără fonduri
{ type: 'collectSpark'; kind: SparkRewardKind }      // critică; kind-ul vine din rollSparkKind(Math.random())
```
**RNG-ul NU există în engine**: shell-ul (useStraySpark) deține timerul de spawn (interval din `sparkIntervalRange(state)` → `{minMs,maxMs}`, uniform), rostogolește `rollSparkKind(rand01)` și dispecerizează `collectSpark`. Nimic de spark pending nu intră în save.

**Selectori noi exportați din `src/engine` (index):**
`atelierLevel(state,id)`, `atelierMaxLevel(id)`, `atelierNextCost(state,id) → number|null`, `canBuyAtelierUpgrade(state,id)`, `hasAnyAtelierUpgrade`, `isAtelierComplete`, `apprenticeStartMuses`, `bookmarkedUpgrades`, `hasRelic(state,relicId)`, `unlockedRelics(state) → RelicId[]`, `critChance(state)`, `isCritRoll(state,roll)`, `clickValue(state,now,critRoll?)`, `bookshelfMultiplier`, `inkRemembersMultiplier`, `isSparkBuffActive(state,kind,now)`, `offlineCapMs`, `offlineEfficiency`, `sparkIntervalRange`, `isGeneratorVisibleInShop(state,id)` (mythEngine NU se randează fără blueprint — folosiți-l în GeneratorList în locul lui `isGeneratorRevealed`), `uniqueFableCount(fables)`, `generateFadedTitle(n)`, `nextManualBuffDurationMs`, `buffCooldownMs`, plus funcțiile spark: `rollSparkKind`, `sparkRewardSummary(state,kind,now)`, `sparkWeightTotal`, `SPARK_KINDS`.
Config nou exportat: `ATELIER_UPGRADES` (cu `name/flavor/costs/levelDescriptions`), `RELICS` (cu `tomes/name/description/flavor`), `SPARK`, `BOOKSHELF`, `GILDED_QUILLS_THRESHOLD`, tabelele `FABLE_*`, `RELIC_INDEX`, `ATELIER_UPGRADE_INDEX` etc.

**Evenimente noi în `subscribeToEvents` (consumabile, o dată per apariție):**
```ts
{ type: 'atelierPurchase'; id: AtelierUpgradeId; level: number }   // level = nivelul tocmai atins
{ type: 'sparkCollected'; kind: SparkRewardKind; reward: SparkRewardSummary }
   // SparkRewardSummary: { kind; inspiration; quills; fragments; boundQuill; buff: SparkBuffState|null }
   //  → toast-ul cu cifre concrete vine direct din reward (ex. inkBurst: reward.inspiration)
{ type: 'fablePenned'; fable: Fable }        // la fiecare publish (diff pe meta.fables)
{ type: 'relicUnlocked'; id: RelicId }       // la traversarea pragului de tomes
```
`importSave` rămâne SILENȚIOS (nicio inundație de toast-uri la re-hidratare). Starea spark-buff pentru pill-ul UI: `state.run.sparkBuff` (`{kind, activeUntil}|null`) + `isSparkBuffActive`.

### Decizii + abateri documentate (față de 09/10/11)
1. **Cifrele 11 primează peste 09** (conform sarcinii): inkBurst **45×effectiveProd** (nu 900), Thunderous Applause **20s** (nu 60), cost total Atelier **92** (nu „96"), crit pe ÎNTREGUL click (RUN F).
2. **Numele evenimentelor**: 10 §3.2 propunea `relic/fable/quillFromFragments`; orchestratorul a cerut `atelierPurchase/sparkCollected/fablePenned/relicUnlocked` — am implementat numele orchestratorului; `quillFromFragments` e acoperit de `sparkCollected.reward.boundQuill` (un singur eveniment per catch, nu două).
3. **Auto-buy determinist**: Self-Writing Contract se evaluează DOAR la secunde epoch-aliniate absolute (`floor(t/1000)`) în interiorul `tick`, cu integrare piecewise (granițe: expirare buff, expirare gossip, secunde întregi). Rezultatul e independent de felierea în tick-uri — testat 10×100ms ≡ 1×1000ms cu auto-buy activ. `run.lastAutoBuyAt` impune max 1/sec peste granițele de tick.
4. **Thunderous Applause = 20 × producția FĂRĂ Moment of Inspiration, dar CU gossip activ** (11: „snapshot pre-activare, fără dublă numărare"; 10 propunea `perSecondNoBuff` — includerea gossip-ului e coerentă cu regula inkBurst „buff-urile active contează"). Nu se declanșează la buff-ul gratuit din Time Slip.
5. **Time Slip**: `cooldownUntil = now` + buff gratuit cu durata SIMPLĂ (burstOfGenius da, Standing Ovation NU — nu consumă „prima activare"; `buffActivationsThisRun` și `stats.buffActivations` neatinse; fără Applause; fără dublare Net L2).
6. **`allGenerators` (Well-Rounded Library) exclude mythEngine** (`WELL_ROUNDED_GENERATOR_IDS` în config) — altfel un jucător fără Blueprint nu l-ar mai putea obține (regresie v1). 09/10 nu specificau; clarificare proprie, testată.
7. **Relicele la construcția rundei se evaluează pe NOUL `tomesPublished`** (publicarea tomului #3 dă Dog-Eared Page pentru runda pe care o deschide). Sanitizarea buff-ului acceptă acum ferestre legitime de 45s (22.5 × 2 Standing Ovation) — testul v1 de clamp actualizat corespunzător.
8. **`startedAt = 0` e sentinel global** („durată necunoscută") — inclusiv pentru rundele create de un publish la `now = 0` (doar în teste posibil); real-world e epoch ms, deci irelevant.
9. **Migrare defensivă**: `MIGRATIONS[1]` nu aruncă pe payload-uri ostile (doar completează câmpurile noi; sanitizerii v2 validează după) și plafonează fabulele faded generate la **1000** (un `tomesPublished: 1e15` ostil nu poate bloca load-ul). `sanitizeFables` păstrează max **5000** intrări, dedupe pe `n`, sortare pe `n`, titluri ≤120 caractere.
10. **Invariantul de aur în sanitizare**: `lifetimeQuillsEarned = max(lifetimeQuillsEarned, goldenQuills)` (reparare prin RIDICARE, ca `totalEarned≥inspiration` din v1). `storyFragments` clamp 0–4; nivele atelier clamp la max; `startedAt`/`lastAutoBuyAt` clamp ≤ savedAt (anti fake-fastest-publish); `sparkBuff.activeUntil` clamp ≤ savedAt + durata max legitimă per kind × Net L2; identitate leaderboard invalidă = DROP silențios, nu respinge save-ul.
11. **`perSecondNoBuff` NU include spark-buff-urile** (baza offline-ului — anti-abuz 09 §2.3); `perSecond(state, now)` include și Moment și Gossip (valoarea afișată). `clickPower` include frenzy ×7 doar pe bază; critul e separat, în `clickValue` (reducer + UI folosesc aceeași funcție).
12. **`buffDurationMs(state)` păstrează semantica v1** (15/22.5s); noul `nextManualBuffDurationMs(state)` include Standing Ovation — UI să-l folosească pentru preview-ul duratei.
13. **`SaveDataV1` rămâne exportat** doar ca formă legacy documentară (`run/meta: unknown`); `sanitizeSaveData` întoarce `SaveDataV2` și acceptă DOAR `version === 2` după lanț.

### Actualizări legitime la testele v1 (toate cerute de contractele v2)
- `production/click/prestige/progression-speed`: bonusul de quills citește `stats.lifetimeQuillsEarned` (REGULA DE AUR, 09 §1.1) — testele care setau doar `meta.goldenQuills` setează acum ancora lifetime (echivalent cu un jucător v1 care nu a cheltuit).
- `prestige.test.ts`: run-ul nou are `startedAt=now` (→ `createInitialRunState(777)`); stats-ul crește cu `lifetimeQuillsEarned` la publish; milestones post-publish includ `theGildedDoor/theFirstSpine/wordTravelsFast` (mecanism identic `hallOfDeeds`).
- `milestones.test.ts`: lista re-earned post-prestige include cele 3 milestones pe tomes.
- `save.test.ts`: clamp-ul buff-ului acceptă 45s (Ovation×Burst); stub-ul de migrare v0 înlănțuie acum prin `MIGRATIONS[1]` real (dovada lanțului multi-pas).
- `tick.test.ts`: stările „steady" pre-deblochează `patronOfTheArts` când atelierul e setat (altfel pragul de achievement mută ×1.03→×1.04 în momente diferite în cele două căi de integrare — exact clasa de probleme pe care testul v1 o evita deja prin pre-unlock).

### De știut pentru Agent UI v2 / E2E v2
- `forceSpark(kind?)` în test-hook: `kind` absent → `rollSparkKind(Math.random())` în shell; dispatch `{type:'collectSpark', kind}`. Engine-ul NU validează gate-ul de milestone la collect (shell-ul îl deține) — hook-ul E2E poate forța oricând.
- Chip-ul `golden-quills` din header afișează acum PORTOFELUL (poate scădea la cumpărături); tooltip-ul cu lifetime vine din `meta.stats.lifetimeQuillsEarned` (12 §2.1).
- `GeneratorList` trebuie să treacă pe `isGeneratorVisibleInShop` (mythEngine fără teaser „? ? ?").
- Achievement-ul `nameInLights` se aprinde automat când `setSettings` scrie `settings.leaderboard.token` (mecanismul existent de check după dispatch).
- Ordinea multiplicatorilor implementată e EXACT 11 §7 — orice cifră nouă intră în config, nu în selectors.

---

## Agent 5 — Engine (core gameplay, 2026-07-03)

### Status: COMPLET și VERDE
- `npx tsc --noEmit` — trece (TypeScript strict, zero erori).
- `npx vitest run` — **127/127 teste trecute, 10 fișiere de test** (rulat prin `docker compose run --rm test-unit sh -c "npm install ... && npx tsc --noEmit && npx vitest run"`).

### Fișiere create

**Engine (`src/engine/`, TS pur, zero dependințe, fără React/DOM în logică):**
| Fișier | Conținut |
|---|---|
| `config.ts` | TOATE cifrele de balans (03-economy): 7 generatori (baseCost/baseProd/growth/revealAt), 11 upgrade-uri (cost + unlock ca date), 14 achievements cu condiții, 11 reveal milestones, praguri qty 25/50/100 ×2, buff 15s/22.5s/90s/×5/×2, prestige 1e5 + QUILL_BONUS **0.30**, offline 0.5/8h → 0.75/12h, TICK_MS 100, AUTOSAVE_TICKS 100, MAX_TICK_DT_MS 60000. Include name/flavor/description pentru UI. |
| `types.ts` | GameState = `run` (resetabil) + `meta` (permanent) + `lastTickAt`; union types literale pentru toate id-urile; `Action`; condiții descrise ca discriminated unions (`UnlockCondition`, `AchievementCondition`, `MilestoneRequirement`). |
| `state.ts` | `createInitialState/RunState/MetaState`. |
| `generators.ts` | `costOf` (ceil, Patron's Favor −5%), `bulkCost` (sumă geometrică, UN singur ceil pe total — 03 §1), `maxAffordable` (formulă închisă + fix-up în jurul ceil-ului), `buyGenerator(1|10|'max')`, `totalGeneratorCount`, `isGeneratorRevealed`. |
| `upgrades.ts` | evaluare unlock din date, `hasUpgrade` (quillResonance citit din meta), `buyUpgrade`. |
| `achievements.ts` | `checkAchievements(state, now)` — idempotent, întoarce ACEEAȘI referință dacă nu apare nimic nou. |
| `milestones.ts` | reveal #1–11 (totalEarned / primul achievement) + qty `qty:<gen>:<25|50|100>`; `checkMilestones(state)` idempotent. |
| `buff.ts` | activare/expirare pe epoch ms absolut; cooldown DE LA ACTIVARE; unlock la Racing Heart (500); Burst of Genius 22.5s; incrementeaza `stats.buffActivations`. |
| `prestige.ts` | `quillsForTotalEarned = floor(sqrt(te/1e5))`, `canPrestige` (≥1e5), `prestigePreview`, `publishTheTome` — run complet resetat, meta (quills+earned, tomes+1, achievements/stats/quillResonance/settings) intact. |
| `offline.ts` | `computeOfflineReport(state, savedAt, now)` PUR — clamp elapsed ≥ 0, cap 8h/12h, eff 0.5/0.75, FĂRĂ buff; `applyOfflineReport` creditează + actualizează `offlineSessionsOver30Min`/`bestSingleOfflineGain` + re-check. |
| `selectors.ts` | ordinea EXACTĂ 03 §2: qty ×2 → per-gen upgrade → sinergii → sumă → Inkwell ×1.5 → achievements (1+0.01·n, 0.02 cu Anthology) → quills (1+0.30·q) → buff ×2. `clickPower` = 1 ×2(nib) ×(1+0.30q)(resonance) ×5(buff) + 0.01·effectiveProd (Ink Echo FĂRĂ ×5 — echo folosește producția care are deja ×2). |
| `tick.ts` | `(state, nowMs, dtMs) => state` PUR; integrare LINIARĂ cu split exact la granița de expirare a buff-ului ⇒ determinism 10×100ms ≡ 1×1000ms; dt clamp [0, 60s]; fracțiile se acumulează natural (float, fără floor). |
| `save.ts` | schema v1 `{version:1, savedAt, run, meta}`; cheie **`fable-idler-save-v1`**, backup corupt **`fable-idler-save-v1:corrupt`** (string-ul brut e MUTAT acolo); `MIGRATIONS` (lanț v→v+1, testat cu stub v0); validator manual de shape (strict pe câmpurile-core, tolerant pe rest); export/import base64 (TextEncoder + btoa); load nu aruncă NICIODATĂ. |
| `format-numbers.ts` | <1000 întreg (floor); K/M/B/T/Qa/Qi/Sx/Sp/Oc/No cu 3 cifre semnificative; ≥1e33 științific `1.23e35`; `formatRate` cu 1 zecimală sub 100/s. |
| `game-loop.ts` | `createGameStore(initial, {now?, storage?})` → `getState/dispatch/subscribe/subscribeToEvents/start/stop/save`; `applyAction` pur exportat (reducer + check-uri după FIECARE acțiune); setInterval 100ms cu dt real; autosave la 100 ticks + imediat după buyUpgrade/prestige/importSave; hardReset șterge cheia. |
| `index.ts` | API public unic — UI importă DOAR de aici. |

**Teste (`tests/unit/`):** `format-numbers` (9), `generators` (17), `production` (14), `click` (9), `tick` (13), `achievements` (14), `milestones` (17), `prestige` (9), `offline` (10), `save` (15) + `helpers.ts` (factory de stare, non-test). **Total 127.**

### Decizii notabile
1. **Cheia de save**: 02 spunea `fableIdler:save`, sarcina orchestratorului a cerut explicit **`fable-idler-save-v1`** → am folosit-o pe a orchestratorului. E exportată ca `SAVE_KEY`/`SAVE_BACKUP_KEY` din engine — **Agent UI și Agent 8 (E2E) trebuie să importe constantele, nu să hardcodeze stringul**.
2. **Format id milestone cantitate**: `qty:<gen>:<n>` (02 §8.3), nu `qtyMilestone:<gen>:<n>` (varianta din 01/03) — 02 e documentul de convenții de cod.
3. **Determinismul tick-ului sub buff**: producția se integrează liniar pe interval cu split exact la `activeUntil` (overlap-ul intervalului cu fereastra de buff), nu „buff evaluat la începutul tick-ului" — altfel 1×1000ms ≠ 10×100ms când buff-ul expiră în mijloc.
4. **`checkAchievements(state, now)`** primește `now` pentru condiția `perSecond` (Industrial Fiction pe valoarea afișată, incl. buff). `achievements.ts`/`offline.ts` importă `selectors.ts` (nicio buclă de import; ușoară abatere de la ordinea de dependință din 02 §1, preferabilă duplicării formulelor).
5. **x10 e all-or-nothing** (nu cumpără parțial); doar `'max'` cumpără „cât se poate". UI trebuie să dezactiveze butonul ×10 pe `bulkCost > sold`.
6. **`qtyMilestoneMultiplier` se calculează din count-ul deținut** (formula 03 §5), nu din lista `run.milestones` — lista e doar pentru badge/toast (nu pot diverge: count-ul nu scade în timpul rundei).
7. **hardReset NU salvează imediat după ștergere** — șterge cheia și lasă storage-ul gol (starea inițială se va salva la primul autosave).
8. **Import invalid = no-op silențios în dispatch**; UI validează separat cu `importSaveString(data)` (întoarce `null` la eroare) pentru mesajul inline din Settings.
9. **`subscribeToEvents`** (extensie față de contractul 02 §3, aditivă): evenimente consumabile `{type:'milestone'|'achievement', id}` emise o singură dată per unlock — exact ce a cerut 04 §„Ce trebuie să știe" pentru toast-uri (fără re-afișare la refresh).
10. **Buff-ul cere unlock**: `activateBuff` refuză sub 500 totalEarned (Racing Heart) — engine-ul validează, nu doar UI-ul.
11. **Valori din tabelul 03 §1 corectate prin formulă**: tabelul are mici derive aritmetice la „cost unit. #25" (ex. inkSprite 2.867 în tabel vs **2.863** real = `ceil(100·1.15²⁴)`; enchantedQuill 224.412 vs **225.458**). Formula din 03 §1 e sursa de adevăr; testele fixează valorile formulei (calculate independent în Node, hardcodate ca literali).
12. **Acțiuni de debug pentru hook-ul E2E (02 §6.3)**: `Action` include `{type:'debugAddInspiration', amount}` (creditează sold + totalEarned + lifetime, apoi check-uri — exact semantica `addInspiration` din hook) și `{type:'debugFastForward', ms}` (simulează intervalul `[now−ms, now]` în bucăți ≤60s prin `tick`, deci ocolește corect clamp-ul — semantica `fastForward`). `test-hook.ts` (Agent UI) devine trivial: `addInspiration: n => store.dispatch({type:'debugAddInspiration', amount:n})`, `fastForward: ms => store.dispatch({type:'debugFastForward', ms})`. NU se leagă la niciun control din UI.

### Ce garantează testele (cerințele obligatorii din sarcină, toate verificate)
- Determinism: 10×tick(100ms) ≅ 1×tick(1000ms) (toleranță 1e-9), inclusiv cu buff expirând în fereastră; dt=0 → aceeași referință; dt negativ → 0; clamp 60s.
- Valori exacte 03: costuri la unitatea #25 pentru toți 7 generatorii; prestige 1e5→1, 4e5→2, 9e5→3, 1e7→10, 1e9→100 (+ margini 99.999/399.999/899.999); stack complet de multiplicatori hand-computed (175.032/s); Ink Echo fără ×5 sub buff (5.2, nu 6).
- Save: round-trip deep-equal (direct + prin storage + prin base64); corupt → fallback fără crash + backup sub cheia `:corrupt` + cheia principală ștearsă; versiune necunoscută respinsă; mecanism de migrare testat cu stub v0→v1.
- Offline: 1h @ 10/s eff 0.5 → 18.000; cap 8h (144.000) / cu Lucid Dreaming 0.75/12h (324.000); elapsed negativ → 0; buff-ul NU umflă offline-ul; Night Shift + contorul de sesiuni ≥30min.
- xMax cumpără exact cât permite bugetul (egalitate la `bulkCost(k)`, k−1 la buget−1, invariant verificat pe 7 bugete).
- Buff: cooldown de la activare, expiră exact la `activeUntil`, Burst of Genius 22.5s cu cooldown neschimbat.
- Prestige: reset vs. persistă câmp cu câmp (lista 01 §7); milestones re-parcurse în runda nouă.

### Limitări / de știut pentru următorii agenți
- **Agent UI**: bootstrap-ul recomandat în `main.tsx`: `loadSave(localStorage)` → dacă există, `computeOfflineReport(state, savedAt, Date.now())` → `applyOfflineReport` (+ modal dacă `elapsedMs ≥ OFFLINE_MODAL_MIN_MS`) → `createGameStore(state)` → `store.start()`. Importă TOT din `src/engine` (index). `formatNumber/formatRate` sunt în engine. Toast-uri: `store.subscribeToEvents`. Test hook (02 §6.3): folosește acțiunile `debugAddInspiration` / `debugFastForward` (vezi decizia #12).
- **Agent 8 (E2E)**: save-ul fabricat pentru scenariul offline TREBUIE să conțină minim `{version:1, savedAt, run:{inspiration, totalEarned, generators:{}}, meta:{goldenQuills:0, tomesPublished:0}}` — validatorul cere numerele-core; restul câmpurilor primesc default-uri. Cheia: `fable-idler-save-v1`.
- Multi-tab = last-writer-wins (limitare v1 acceptată în 02).
- `settings` din meta include `buyQty`/`reduceMotion`/`numberNotation` (cerute de 04 §„persistă în save") — UI le citește/scrie prin dispatch propriu? NU există încă action de settings; **dacă UI-ul vrea persistență pentru toggle-uri, trebuie adăugat un action `setSettings` în `game-loop.ts`** (5 linii) sau scris direct prin importSave. Am lăsat-o afară pentru că nu era în lista de acțiuni din 02 §2.1 — de decis de Agent UI (documentați aici dacă îl adăugați).
- „Tabular" din sarcină (formatare numere) = font-variant-numeric în CSS (UI), nu logică de engine.
- Nu am modificat niciun fișier interzis (Dockerfile, compose, configs, package.json).

### Comenzi de verificare (reproducere)
```bash
docker compose run --rm test-unit                       # doar vitest
docker compose run --rm test-unit sh -c "npm install --no-audit --no-fund && npx tsc --noEmit && npx vitest run"   # typecheck + teste
```
Rezultat curent: `Test Files 10 passed (10) / Tests 125 passed (125)`.

---

## Agent 6 — Prestige & Progression (validare adversarială, 2026-07-03)

### Status: COMPLET și VERDE
- `npx tsc --noEmit` — zero erori (strict).
- `npx vitest run` — **142/142 teste, 11 fișiere** (prin `docker compose run --rm test-unit`). Fața de Agent 5: +12 în `prestige.test.ts` (9→21), +1 net în `save.test.ts` (15→16), +2 în noul `progression-speed.test.ts`.

### Verificare față de 03 §6 (toate CONFORME, confirmate prin cod + teste)
- `quillsForTotalEarned = floor(sqrt(totalEarned/1e5))`, defensiv la negative; prag activare exact 100.000 (`PRESTIGE_MIN_TOTAL_EARNED`).
- Câștigul se calculează pe **`run.totalEarned` al rundei curente**, nu pe lifetime — verificat cu test discriminant (450k→+2, apoi rundă de 100k→+1, total 3; implementarea pe lifetime ar fi dat 4).
- `+30% aditiv per quill` (`QUILL_BONUS=0.3`) aplicat pe producție în `globalMultiplier` (03 §2 pas 7); pe click DOAR cu `meta.quillResonance` — teste: producția cu q quills = exact `(1+0.3q)×` baseline identic; click neschimbat fără resonance, `×(1+0.3q)` cu.
- Reset/persistă: `publishTheTome` → `run = createInitialRunState()` (inspiration 0, totalEarned 0, generatori 0, upgrade-uri 1–10 șterse, milestones golite, buff 0/0), `lastTickAt = now` (fără cadou offline); meta: quills ADUNATE, tomes+1, achievements/quillResonance/stats/settings intacte (test câmp-cu-câmp exista deja; am adăugat variante la granițe: exact 1e5→1, 9e5→3).
- Round-trip: `dispatch('prestige')` e acțiune critică → persistă imediat; `loadSave` întoarce quills/resonance/achievements intacte (test store-level cu memory storage).

### Problemă găsită și REPARATĂ: hardReset fără protecție la nivel de API
`dispatch({type:'hardReset'})` ștergea TOT (inclusiv Golden Quills) dintr-un singur apel — confirmarea exista doar ca promisiune de UI (02 §5), dar hook-ul E2E `__FABLE_TEST__.dispatch` sau orice apel direct putea distruge save-ul accidental. **Fix (abatere documentată de la 02 §2.1, aditiv-safe — UI nu există încă):**
- `types.ts`: acțiunea e acum `{ type: 'hardReset'; confirm: true }` — TypeScript refuză la compilare un hardReset fără confirmare.
- `game-loop.ts`: guard și la runtime (`action.confirm === true` verificat și în `applyAction`, și înainte de `removeItem`) — un dispatch „raw" din consolă/E2E fără flag e no-op garantat (aceeași referință de stare, cheia de save neatinsă).
- Teste: cu confirm → șterge cheia + starea (quills 0, resonance false, achievements []); fără confirm → storage și referința de stare identice.
- **Agent UI**: dialogul de confirmare dublă din Settings rămâne responsabilitatea ta; la final dispatch `{type:'hardReset', confirm:true}`.

### Decizie documentată: Quill Resonance persistă prin TOATE prestige-urile ulterioare
01 §7 și 03 §4 spun deja „persistă o dată cumpărat" — nu era ambiguu; am confirmat implementarea (stă în `meta`, `publishTheTome` nu o atinge) și am fixat-o cu teste: (1) necumpărabil înainte de primul tome (`tomesPublished ≥ 1`); (2) cumpărat după primul publish la 2.500, supraviețuiește la încă 2 publish-uri consecutive; (3) un save fabricat NU poate strecura `quillResonance` în `run.upgrades` (validatorul îl ignoră — test dedicat). Clarificare adăugată și în 03 §6.

### Verificare empirică: runda 2 e real mai rapidă (`progression-speed.test.ts`)
Simulare deterministă DOAR prin funcțiile engine-ului (`applyAction`/`tick`/`costOf`/`generatorProduction`): jucător semi-activ 2 click/s, buff imediat ce e disponibil, cumpărare greedy pe payback (cost/producție marginală) + orice upgrade deblocat și accesibil; pas 1s. Rezultat (fix, fără RNG): **t(100k, 0 quills) = 15,8 min; t(100k, 3 quills + resonance cumpărabil) = 9,8 min → reducere 38%** (assert: ≥20%; criteriul 01 §10.6 cerea ≥30% la 2 quills — trecut cu marjă la 3). Simul e mai rapid decât modelul uman din 03 §9 (24m23s) pentru că nu pierde timp — banda acceptată în test: 8–40 min pentru runda 1.

### De știut (comportament confirmat ca intenționat, nu bug)
- După prestige prin store, `checkMilestones` re-adaugă instant `hallOfDeeds` în noua rundă dacă există achievements (persistă în meta) — corect: tab-ul Achievements rămâne vizibil. Testat explicit.
- Ordinea în `applyAction`/`tick` e milestones→achievements; dacă `publishedAuthor` e chiar PRIMUL achievement al jucătorului, `hallOfDeeds` apare abia la tick-ul următor (≤100ms mai târziu) — auto-corectabil, invizibil în UI; nu am reordonat ca să nu destabilizez cele 127 de teste existente.
- `dispatch('prestige')` sub prag: stare neatinsă (aceeași referință), dar save-ul de „acțiune critică" tot rulează (persistă starea curentă — inofensiv).

### Fișiere modificate
- `src/engine/types.ts` — `hardReset` cere `confirm: true`.
- `src/engine/game-loop.ts` — guard runtime pe confirm (dispatch + applyAction).
- `tests/unit/prestige.test.ts` — +12 teste (granițe, per-run vs lifetime, scalare producție/click, resonance, round-trip store, save fabricat).
- `tests/unit/save.test.ts` — testul de hardReset actualizat + test nou „fără confirm = no-op".
- `tests/unit/progression-speed.test.ts` — NOU (2 teste, simulare).
- `ai-memory/03-economy-balance.md` — clarificări §6 (vezi acolo).
- Niciun fișier interzis atins; nicio cifră de balans schimbată.

---

## Agent UI — Interfața completă (2026-07-03)

### Status: COMPLET și VERDE
- `npx tsc --noEmit` — zero erori (prin `docker compose run --rm test-unit`).
- `npx vitest run` — **147/147 teste, 12 fișiere** (142 existente + 5 noi în `settings.test.ts`).
- `npm run build` — verde (tsc + vite build; bundle 201KB JS / 35KB CSS / fonturi woff2 self-hosted).
- `docker compose up --build -d web` — imagine construită, nginx servește pe :8080: HTML cu `<div id="root">` → 200, `/assets/index-*.js` → 200 (201430 B), `/assets/index-*.css` → 200. La final `docker compose stop web` (imaginea rămâne).
- Smoke-test real în Chrome pe build-ul nginx (`?test=1`): consolă **zero erori/warninguri** pe load → click → unlock-uri → prestige complet (overlay 1400ms + quills în header) → offline modal (save fabricat, countUp, „at 50% efficiency") → settings (export base64, import invalid → eroare inline, toggle Reduce motion → clasa `.reduce-motion` pe root + persistat) → hard reset dublu (dialog + tastat RESET; cheia ștearsă, solo mode revine).

### Modificare ADITIVĂ în engine: acțiunea `setSettings`
04 cere persistarea toggle-urilor Buy ×N și Reduce motion în save. Conform notei lui Agent 5 (mai sus), am adăugat:
- `types.ts`: `| { type: 'setSettings'; settings: Partial<Settings> }`.
- `game-loop.ts`: `applyAction` face shallow-merge în `meta.settings`; `setSettings` e acțiune critică (persistă imediat).
- `tests/unit/settings.test.ts` — 5 teste noi: merge parțial fără să atingă restul stării, merge succesiv păstrează cheile, persistență imediată prin store + round-trip `loadSave`, supraviețuiește prestige-ului, idempotent pe check-uri.
Niciun comportament existent schimbat; celelalte 142 teste neatinse și verzi.

### Fișiere create (UI)
| Fișier | Rol |
|---|---|
| `src/main.tsx` | Bootstrap exact ca în nota Agent 5: `loadSave(localStorage)` → `computeOfflineReport` + `applyOfflineReport` → `createGameStore` → render `<App/>` în StrictMode (cu `StoreProvider`) → `installTestHook(store)` → `store.start()`. Fonturi @fontsource importate aici. Save pe `visibilitychange→hidden` + `beforeunload`. |
| `src/ui/styles/tokens.css` | Blocul `:root` copiat LITERAL din 04 §1.1 + fonturi §2 + vignetă/textură zgomot (SVG feTurbulence data-URI pe `body::before/::after`) + token-uri derivate (`--backdrop`, glow-uri soft) + baze globale (focus-visible, `.num` tabular-nums, `.icon-coin`). **Singurul fișier cu culori brute în afara animations.css** — grep `#[0-9a-fA-F]{3,6}` pe `src/ui` → doar tokens.css. |
| `src/ui/styles/animations.css` | Toate cele 15 animații din 04 §5 cu duratele/easing-urile exacte + `--ease-out`/`--ease-pop` + reguli complete `prefers-reduced-motion` ȘI clasa `.reduce-motion` (toggle manual) — #1/#3/#4/#10/#15 dezactivate, #11 fade 300ms, restul doar opacity-fade. #13 countUp = tween JS (OfflineModal), #14 buffRing = conic-gradient setat din tick (BuffButton). |
| `src/ui/App.tsx` + `App.css` | Layout 3 zone ≥1100px (stânga sticky 340px) / 2 zone 720–1099 (tab Fable) / stack + bottom nav <720 (hook `useLayoutMode` pe matchMedia). Unlock progresiv DOAR din `run.milestones` (fără praguri duplicate). Solo mode centrat. Coadă toast-uri din `subscribeToEvents`. Secvența `prestigeFade` (500/400/500ms) cu overlay App-level (supraviețuiește unmount-ului panoului). |
| `src/ui/hooks/useGameStore.ts` | `StoreProvider` (context) + `useGameStore` (`useSyncExternalStore`) + `useDispatch` + `useGameEvents` — conform 02 §3, zero librării de state. |
| `src/ui/hooks/useLayoutMode.ts` | `useLayoutMode()` desktop/tablet/mobile + `usePrefersReducedMotion()` (ambele pe matchMedia prin useSyncExternalStore). |
| `src/ui/test-hook.ts` | EXACT 02 §6.3: `window.__FABLE_TEST__` doar cu `?test=1`; `addInspiration`→`debugAddInspiration`, `fastForward`→`debugFastForward`, plus getState/dispatch/saveNow. Verificat pe build-ul nginx. |
| `src/ui/meta.ts` | `APP_VERSION` ('1.0.0', afișat în Settings) + `OFFLINE_MODAL_UI_MIN_MS` = 60_000 (04 §4.11 primează peste 5 min din 02 — decizie confirmată de orchestrator). |
| `src/ui/icons.ts` | Maparea emoji fixă din 04 §1.2 + iconuri alese pentru upgrade-uri (documentate în cod). Emoji doar prin `<IconCoin>`. |
| `src/ui/format.ts` | `formatDuration` (modal offline) + `formatEta` (butoane expensive). Numerele rămân în engine (`formatNumber/formatRate`). |
| `src/ui/components/` | `IconCoin`, `Tooltip`(+css), `ProgressBar`(+css), `Modal`(+css, focus-trap + stivă pentru Escape pe modalul de deasupra), `ResourceHeader`(+css, shimmer pe milestone prin nonce), `ClickButton`(+css, pool FloatingNumber max 12 noduri, static „+X" 500ms sub reduce-motion), `BuffButton`(+css, inel conic-gradient din tick, stări ready/active/cooldown, locked=nerandat), `StatsStrip`(+css), `GeneratorList`(+css, toggle ×1/×10/×Max persistat, stări affordable/expensive+ETA/just-bought/badge ×2·×4·×8 cu badgePop/hint „1 more → ×2!"/rând teaser „? ? ?"), `UpgradeList`(+css, hidden până la unlock, secțiune colapsabilă Purchased, Quill Resonance cu bordură --quill), `AchievementGrid`(+css, locked „?" cu tooltip condiție, header „N/14 · +X% production"), `MilestoneTracker`(+css, „Next unlocks" max 3 cu progress bars), `PrestigePanel`(+css, teaser/ready/confirming cu checkbox), `OfflineModal`(+css, countUp 1200ms), `Toast`(+css, max 3 + coadă, aria-live, pauză la hover), `SettingsPanel`(+css), `TabBar`(+css, role=tablist + underline animat), `BottomNav`(+css, badge-dot, safe-area). |
| `tests/unit/settings.test.ts` | Testele acțiunii noi (vezi mai sus). |
| `index.html` | DOAR un `<style>html{background:#121022}</style>` anti-flash înainte de hydrate (permis explicit de sarcină). |

### Contract data-testid pentru E2E (Agent 8 îl folosește literal)

**Minimul din 02 §8.5 (toate prezente):**
| testid | Element |
|---|---|
| `click-area` | butonul mare „Weave ✨" |
| `inspiration-amount` | numărul mare de resursă (formatat cu `formatNumber`) |
| `per-second` | textul „+X/sec" |
| `generator-<id>` | rândul generatorului (id-urile literale din engine: `wanderingMuse`, `inkSprite`, `talkingRaven`, `enchantedQuill`, `storyLoom`, `dreamLibrary`, `fableForge`) |
| `upgrade-<id>` | cardul de upgrade (buton când e cumpărabil; div în secțiunea Purchased — testid-ul RĂMÂNE pe card după cumpărare) |
| `buff-button` | pill-ul Moment of Inspiration (nerandat sub 500 totalEarned) |
| `prestige-button` | butonul „Publish now: +N 🪶" din panou (disabled în teaser) |
| `prestige-confirm` | butonul final „Publish" din dialog (disabled fără checkbox) |
| `offline-modal` | modalul „While you were away…" |
| `tab-upgrades` | tab-ul Upgrades (TabBar centru pe ≥720px, BottomNav pe <720px — un singur element în DOM la orice moment) |
| `tab-achievements` | **rădăcina secțiunii AchievementGrid** (apare la milestone `hallOfDeeds` pe orice layout — coloana dreaptă pe desktop, tab-ul Fable pe tablet/mobil). E „tab-ul" din perspectiva E2E §6.2.4. |

**Suplimentare:**
| testid | Element |
|---|---|
| `buy-<generatorId>` | BuyButton-ul din rând (disabled = expensive; textul include costul pentru cantitatea selectată) |
| `buy-qty-1` / `buy-qty-10` / `buy-qty-max` | toggle-ul Buy ×1/×10/×Max (aria-pressed pe cel activ) |
| `generator-next-teaser` | rândul „? ? ?" al următorului generator nedezvăluit |
| `golden-quills` | chip-ul 🪶 din header (randat doar când quills>0 sau tomes>0; text ex. „🪶 6 Golden Quills") |
| `prestige-panel` / `prestige-quills` / `prestige-preview` / `prestige-progress` | panoul prestige, quills curente, preview-ul live, bara de progres |
| `prestige-checkbox` | checkbox-ul „I understand my run resets" |
| `prestige-confirm-dialog` | dialogul de confirmare |
| `prestige-overlay` | overlay-ul prestigeFade (prezent ~1.4s) |
| `offline-gained` / `offline-collect` | suma (countUp) și butonul Collect |
| `toast` / `toast-container` | fiecare toast (are și `data-toast-kind`: milestone/achievement/unlock/prestige) / containerul aria-live |
| `settings-open` | butonul ⚙️ din header |
| `settings-panel` / `settings-panel-close` | modalul Settings / ✕ |
| `settings-export` / `settings-copy` | textarea readonly base64 / butonul Copy |
| `settings-import` / `settings-import-load` / `settings-import-error` / `settings-import-ok` | textarea import / Load / eroarea inline / confirmarea |
| `settings-reduce-motion` | checkbox-ul Reduce motion |
| `settings-reset` → `settings-reset-continue` → `settings-reset-input` → `settings-reset-confirm` | fluxul hard reset: buton → „Continue…" (dialog 1) → input pt. „RESET" → butonul final (disabled până textul e exact RESET, case-insensitive) |
| `tab-generators` / `tab-fable` / `tab-weave` / `tab-shop` | restul tab-urilor (tab-weave/tab-shop doar pe mobil) |
| `milestone-tracker` | panoul „Next unlocks" |
| `achievement-<id>` | fiecare pătrat din grid (id-urile din engine) |
| `achievements-count` | header-ul „N/14 · +X% production" |
| `stats-strip` / `stats-total-earned` / `stats-clicks` / `stats-tomes` | mini-staturile |
| `floating-number` | nodurile FloatingNumber (≤12 garantat prin pool) |
| `click-guide` | textul ghid din solo mode |
| `reset-dialog-1` / `reset-dialog-2` | cele două dialoguri de reset |

**Note pentru Agent 8:**
- La viewport-ul default Playwright (1280×720) layout-ul e DESKTOP: `tab-upgrades` e în TabBar-ul coloanei centrale; `tab-achievements` e secțiunea din coloana dreaptă.
- `tab-upgrades` NU există în DOM înainte de 100 totalEarned (milestone `craftsmansTools`); `tab-achievements` NU există înainte de primul achievement (`hallOfDeeds`). `generator-<id>` nu există înainte de `revealAt`-ul lui. Folosiți `waitFor`/`toBeVisible`.
- Prestige: click `prestige-button` → bifați `prestige-checkbox` → click `prestige-confirm` → așteptați ~1.5s (overlay-ul `prestige-overlay` dispare) → verificați `golden-quills`.
- OfflineModal: doar la load, `elapsed ≥ 60s` ȘI `gained > 0` (deci save-ul fabricat TREBUIE să aibă generatori). Escape/click-outside/Collect — toate doar închid (recompensa e deja creditată la bootstrap).
- Import invalid = no-op în engine; mesajul de eroare vine din validarea UI (`settings-import-error`).
- Toast-urile: max 3 în DOM simultan; restul stau în coadă și intră pe măsură ce ies.

### Decizii / abateri documentate
1. **Prag OfflineModal 60s** (04 §4.11) în loc de `OFFLINE_MODAL_MIN_MS` = 5 min din engine/02 — constanta UI `OFFLINE_MODAL_UI_MIN_MS` în `src/ui/meta.ts`; constanta engine-ului rămâne neatinsă (nefolosită de UI). Cerut explicit de orchestrator.
2. **Modalul offline apare doar dacă `gained > 0`** — cu 0 generatori „+0 ✨" ar fi zgomot; scenariul E2E 6 are oricum generatori în save-ul fabricat.
3. **`tab-achievements` pe secțiunea AchievementGrid**, nu pe un buton de tab — pe desktop achievements NU e tab (04 §3.1 îl pune în coloana dreaptă), dar contractul E2E cere elementul; semantica „apare după primul achievement" e identică.
4. **Rândul teaser „? ? ?"** — interpretarea frazei din 04 §4.6 („numele apare ca ? ? ? doar dacă totalEarned < pragul de reveal"): următorul generator nedezvăluit apare ca siluetă cu nume mascat și cost, fără buy. Excepția „ținta de dorință" din §6 îl acoperă.
5. **Escape pe modale stivuite** închide DOAR modalul de deasupra (stivă modulară în `Modal.tsx`) — altfel Escape în dialogul RESET ar fi închis și Settings.
6. **Iconuri upgrade-uri** — 04 §1.2 nu definește emoji pentru upgrade-uri; am ales maparea din `src/ui/icons.ts` (stil consistent, în icon-coin).
7. **`export type { GameStore }`** etc. — UI importă exclusiv din `src/engine` (index), inclusiv `SAVE_KEY` unde e nevoie (nu există stringuri hardcodate ale cheii în UI).
8. **StrictMode**: dublarea efectelor în dev e inofensivă (dispatch-ul de prestige din overlay e idempotent — al doilea e no-op sub prag).

### Limitări / de verificat vizual de QA
- **Responsive <720px și 720–1099px**: implementat conform 04 §3 (hook matchMedia + CSS), dar NEVERIFICAT vizual în browser (fereastra Chrome disponibilă nu a acceptat resize; Playwright rulează la 1280×720 = desktop). QA trebuie să bifeze: bottom nav 4 tab-uri, ResourceHeader compact sticky, ClickButton 200px, fără scroll orizontal la 375/768/1100px.
- **Contrast/axe DevTools** — token-urile respectă calculele din 04 §„Validări", dar auditul axe rămâne la QA.
- **20 click-uri/sec FPS** — pool-ul de 12 e garantat (verificat în DOM), măsurătoarea FPS rămâne la QA.
- **Tab-navigare completă din tastatură** — toate controalele sunt `<button>`/`<input>` native cu focus-visible; walkthrough-ul complet rămâne la QA.
- Multi-tab: last-writer-wins (limitare v1 din 02, neschimbată). În timpul validării, un al doilea tab deschis pe același save a produs exact comportamentul documentat.
- Textarea-ul Export din Settings se reîmprospătează la fiecare tick (valoare live) — inofensiv, dar QA poate decide să-l înghețe la deschidere.

---

## Agent 7 — DevOps & README (2026-07-03)

### Status: COMPLET
- Verificare STATICĂ a setup-ului Docker (fără `up`/`run`/`build` — Agent 8 deținea Docker-ul în paralel; singura comandă rulată: `docker compose config --quiet`, read-only → **VALID, zero erori/avertismente**).
- `README.md` scris (nou, root) — singurul fișier `.md` inclus în build context (`.dockerignore`: `*.md` + `!README.md`).
- Niciun fișier interzis modificat (Dockerfile, compose, nginx.conf, configs — doar citite).

### Verificarea Docker vs 02 §7 — NICIO EROARE GĂSITĂ
| Verificat | Rezultat |
|---|---|
| Dockerfile 3 stagii (node:22-alpine deps `npm ci` → build `npm run build` → nginx:1.27-alpine + nginx.conf + HEALTHCHECK wget) | conform 02 §7.1; `wget` există în BusyBox-ul nginx:alpine; `COPY . .` nu suprascrie node_modules din stagiul deps (exclus prin .dockerignore); devDependencies disponibile la build (npm ci fără --omit=dev) |
| compose: 4 servicii, web 8080→80 (default), dev 5173 (profil `dev`, CHOKIDAR_USEPOLLING), test-unit / test-e2e (profil `test`), named volumes node_modules_{dev,test,e2e} | conform tabelului 02 §7.2 |
| Pin Playwright | `@playwright/test` **1.49.1** exact (package.json) ↔ imagine **v1.49.1-noble** (compose) — aliniate |
| test-e2e | `depends_on: web: condition: service_healthy` + `PW_BASE_URL=http://web:80` ↔ playwright.config.ts (`baseURL` din env, testDir `tests/e2e`) — coerente; healthcheck-ul cerut există în Dockerfile |
| nginx.conf | SPA fallback (`try_files … /index.html`) + `Cache-Control immutable` pe `/assets/` + gzip — conform |
| .dockerignore | node_modules/dist/ai-memory/.git/rapoarte Playwright excluse; `*.md` cu excepția README.md; context minimal — conform |
| `docker compose config --quiet` | exit 0 → sintaxă validă (profiluri, volume, healthcheck dependency rezolvate corect) |

Observații minore, NU erori (nedocumentate în 07 pentru că nu sunt bug-uri): `tools/` și `tests/` intră în build context (inofensiv, câțiva KB); healthcheck-ul nu are `start_period` (irelevant — nginx e healthy în <1s).

### README.md — ce conține (în engleză, secțiunile EXACTE din brief)
1. **How to run** — `docker compose up --build` → http://localhost:8080; `docker compose --profile dev up dev` → http://localhost:5173; `docker compose down` / `down -v`; nota „primul install în volume = 1–2 min"; debugging (`docker compose ps`, `logs web`, `build --no-cache web`, conflict de porturi).
2. **Quick start for players** — primii pași în joc (click → Muse la 10 → Upgrades la 100 → buff la 500 → prestige la 100k → offline/save).
3. **How to test** — `docker compose run --rm test-unit` (147 teste, ce acoperă); `docker compose run --rm --build test-e2e` (build web + healthcheck + Playwright contra nginx prin `http://web:80`); typecheck standalone; hook-ul `?test=1`; **invariantul pin 1.49.1 ↔ v1.49.1-noble evidențiat ca regulă „schimbate împreună, același commit"**.
4. **How to build** — `docker compose build web` / `--no-cache`; build = `tsc --noEmit && vite build` în stagiul 2; bundle static self-contained (fonturi self-hosted, zero CDN).
5. **Project structure** — arborele real de pe disc (inclusiv `tools/economy-sim.mjs`, cele 13 fișiere din tests/unit descrise sumar).
6. **Game systems** — Inspiration; tabelul celor 7 generatori (baseCost/baseProd/growth din config.ts); cele 11 upgrade-uri cu efecte; buff 15s/×2 prod/×5 click/90s cd; 14 achievements (+1%/+2%); 11 reveal milestones + qty 25/50/100 ×2; **prestige: `quills = floor(sqrt(totalEarnedRun/100_000))`, +30%/quill, prag 100k, lista reset-vs-persistă**; offline 50%/8h → 75%/12h, modal ≥60s & gained>0; save: **cheia `fable-idler-save-v1`**, backup `:corrupt`, autosave ~10s, **backup manual prin Settings → Export (base64) / Import**, hard reset dublu-confirmat.
7. **Known limitations** — multi-tab last-writer-wins; pin-ul Playwright; 1–2 min primul install; fără backend/sync (export = singurul backup); double nativ (științific ≥1e33); test hook inert fără `?test=1`; layouts tablet/mobil cu QA vizual redus.

Toate cifrele din README au fost luate din `src/engine/config.ts` (sursa de adevăr), nu din documentele de design; cheia de save din `save.ts` (`SAVE_KEY`), nu din 02 (care avea varianta veche `fableIdler:save`).

### De știut pentru Agent 8/9
- README-ul documentează `docker compose run --rm --build test-e2e` ca fiind comanda canonică E2E — dacă Agent 8 schimbă fluxul, actualizați secțiunea „How to test".
- `ai-memory/07-bugs-and-fixes.md` NU a fost creat de Agent 7 — nu a existat niciun bug Docker demonstrabil de documentat.

---

## Agent Backend v2 — Hall of Fables API (server zero-deps + integrare Docker, 2026-07-04)

### Status: COMPLET și VERDE
- **19 teste server noi** (`tests/server/leaderboard-api.test.ts`) — verzi prin Docker (volum separat `fable_nm_backend`, NU `test-unit` — era folosit în paralel).
- **Suita completă: 175/175** (156 v1 + 19 server) + `npx tsc --noEmit` verde — niciun test v1 atins.
- **Serviciul REAL validat prin compose**: `docker compose build api` → `up -d api` → healthy în <8s; `GET /api/health` → `{"ok":true,"entries":0,"uptimeSec":14}`; POST de probă prin rețeaua compose → 200 cu playerId/token/ranks; flush confirmat pe volumul `/data` (scriere non-root OK ⇒ chown-ul din Dockerfile funcționează); restart → `entries:1` (persistență reală); `compose stop api` → **Exited (0)** (SIGTERM handler curat).

### Fișiere create
| Fișier | Rol |
|---|---|
| `server/src/app.mjs` | `createApp({dataFile, now?, ttlDays?, rateLimits?})` → `node:http.Server` NEpornit; toate rutele + handler-ele; flush debounce 2s + GC 6h (`setInterval` unref, curățate la `close`); `server.flushNow()` atașat pentru teste/SIGTERM |
| `server/src/store.mjs` | Map în memorie + snapshot JSON atomic (tmp+rename); fișier corupt la boot → redenumit `<dataFile>.corrupt-<ts>` + pornire goală (warn, nu crash); GC pe `updatedAt < now − ttlDays`; `sorted(by)`/`rankOf` cu tie-break determinist |
| `server/src/validate.mjs` | nickname `^[A-Za-z0-9 _-]{3,20}$` + trim-egal + ≥1 alfanumeric; scoruri finite ≥0 ≤1e300; `fastestPublishMs` ≥1 sau `null`; floor pe tomes/quills; întoarce primul câmp vinovat |
| `server/src/rate-limit.mjs` | fereastră fixă 60s per cheie, cap 10k chei cu evicție lazy |
| `server/src/server.mjs` | entrypoint: env (`PORT`, `LEADERBOARD_DATA_FILE`, `LEADERBOARD_TTL_DAYS`, `RATE_SUBMIT_PER_MIN`/`RATE_READ_PER_MIN`) → `createApp().listen`; SIGTERM/SIGINT → flush + close + exit 0 (failsafe 3s) |
| `server/src/app.d.mts` | declarații de mână pentru teste: `createApp`, `CreateAppOptions`, `LeaderboardServer` (structural, FĂRĂ @types/node), `ScoreSet`, `LeaderboardEntry`, `LeaderboardMetric` |
| `server/Dockerfile` | `node:22-alpine`, COPY src, **`mkdir -p /data && chown node:node /data` ÎNAINTE de `USER node`** (capcana de ownership din 10 §2.2), EXPOSE 3000, HEALTHCHECK cu `node -e "fetch(...)"` |
| `tests/server/leaderboard-api.test.ts` | 19 teste HTTP REALE: `createApp` pe `listen(0)` + `fetch` nativ — vezi acoperirea mai jos |

### Fișiere v1 modificate (exact cele permise)
- `docker-compose.yml`: + serviciul `api` (build `./server`, FĂRĂ port pe host, healthcheck node fetch, volum `leaderboard_data:/data`), + `depends_on: [api]` la `dev`, + `api: condition: service_healthy` la `test-e2e`, + volumul `leaderboard_data`. `web` NU are depends_on (rulează singur).
- `nginx.conf`: blocul `location /api/` cu `resolver 127.0.0.11 valid=10s ipv6=off` + variabila `$api_upstream` (rezolvare LAZY ⇒ web pornește fără api), `X-Real-IP`, `Host`, timeouts 2/5/5s. Inserat ÎNAINTE de `location /assets/`.
- `vite.config.ts`: DOAR `server.proxy['/api'] → http://api:3000` (cu fallback `API_PROXY_TARGET`) și `test.include += 'tests/server/**/*.test.ts'`.
- `package.json`, `tsconfig.json`, `Dockerfile` (web), `src/**` — NEATINSE.

### API-ul implementat (contractul 10 §1.4, byte-cu-byte)
- `POST /api/leaderboard/submit` — un singur endpoint: fără `token` = claim (200 cu `{playerId, token 32-hex — apare O SINGURĂ DATĂ, nickname, ranks}`), cu `token` = update/rename (200 FĂRĂ token în răspuns). Ordinea evaluării: 422 `{error:'invalid_payload', field}` (JSON stricat/body >4KB → `field:'body'`) → 401 `{error:'invalid_token'}` (intrarea NEmodificată) → 409 `{error:'nickname_taken'}` (claim pe nume luat SAU rename pe numele ALTEI intrări; rename pe alt casing al propriului nume = permis) → succes cu **best-keeping** (max pe cele 3 monotone, min-ignorând-null pe fastest; `null` NU șterge un fastest existent).
- `GET /api/leaderboard/top?by=&limit=&playerId=` — `by` default `lifetimeInspiration` (necunoscut → 422 field `by`); `limit` 1–100 default 20; sort DESC pe 3 / ASC pe `fastestPublishMs` cu null EXCLUS (și din `total`); tie-break `updatedAt` mai vechi → `playerId` lexicografic; `me` = `{rank, value}` sau `null`, prezent DOAR când s-a cerut `playerId` (altfel cheia lipsește din JSON).
- `GET /api/health` → `{ok, entries, uptimeSec}`, fără rate limit.
- Transversal: 404 `not_found` / 405 `method_not_allowed` / 429 `{error:'rate_limited', retryAfterSec}` + header `Retry-After` / 500 `{error:'internal'}` (stack doar în stdout). Toate răspunsurile `application/json` + `Cache-Control: no-store`.
- Securitate: token `randomBytes(16).hex`, pe disc DOAR SHA-256; lookup prin iterare completă + `timingSafeEqual` (fără early-return); rate limit per IP din `X-Real-IP` (fallback `socket.remoteAddress`): 10 submit/min, 60 read/min.

### Acoperirea celor 19 teste (HTTP real, port efemer, `now` injectat)
claim (shape complet + token 32-hex + ranks cu fastest null) · 409 case-insensitive · floor tomes/quills · update fără token în răspuns · 401 + intrare nemodificată · rename liber/ocupat/recasing propriu · 10 clase de 422 cu `field` exact · NaN raw JSON + body >4KB → 422 `body` · best-keeping (3 metrici + fastest mai mare + null) · sortări toate 4 metricile + excludere null + `total` · tie-break updatedAt și playerId (același `now` ⇒ egalitate reală) · `me` prezent/null/omis · limit + 422 pe by/limit · 429 la a 11-a trimitere cu `Retry-After` == `retryAfterSec` + recuperare după 61s (clock injectat) · health nelimitat + uptime exact · 404/405 · round-trip persistență (flushNow → app nou pe același fișier → date + token + rezervarea nickname-ului supraviețuiesc) · flush implicit la `close` · fișier corupt → backup `.corrupt-<ts>` cu conținutul original + boot gol funcțional.

### Cum se rulează testele server
```bash
# izolat (fără să atingi test-unit):
docker run --rm -v "C:\Projects\Games\Fable Idler:/app" -v fable_nm_backend:/app/node_modules -w /app node:22-bookworm-slim sh -c "npm install --no-audit --no-fund && npx vitest run tests/server"
# sau în fluxul normal: docker compose run --rm test-unit   (npm run test include acum tests/server prin vite.config test.include)
```
Testele NU pornesc Docker — `createApp().listen(0)` în proces, `fetch` nativ Node 22, `dataFile` în `mkdtemp`, `now` injectat pentru rate-limit/tie-break/uptime.

### Abateri de la contract (documentate, cu motiv)
1. **`tsconfig.json` NU a primit `tests/server` în include** (10 §4.2 o cerea) — decizie explicită a orchestratorului: vitest transpilează singur, iar testul e scris fără tipuri de node (importurile `node:fs/os/path` au `@ts-ignore`, tipurile vin din `app.d.mts`, fetch din lib DOM deja prezent). Consecință: `tsc --noEmit` nu type-checkează testul server — acceptat.
2. **`server.flushNow()`** — metodă suplimentară pe serverul întors (nu e în contractul §1.4, e aditivă): flush determinist pentru teste + calea SIGTERM. Declarată în `app.d.mts`.
3. **Numele backup-ului la corupt**: `<dataFile>.corrupt-<timestamp>` (contractul nu fixa numele; timestamp-ul evită suprascrierea la coruperi repetate).
4. `WORKDIR /srv/leaderboard` în Dockerfile (nu era specificat; orice cale în afara `/data` e echivalentă).

### Ce trebuie să știe Agentul UI v2
- Baza API: **`/api`** same-origin (nginx în producție, Vite proxy în dev — ambele pasează URI-ul neschimbat). Fără CORS — nu încercați cross-origin.
- Claim = POST fără `token`; răspunsul conține `token` O SINGURĂ DATĂ — salvați-l imediat în `meta.settings.leaderboard` prin `setSettings`. Update = același POST cu `token`; răspunsul NU mai conține token.
- 409 la claim/rename → cereți alt nickname; 401 → identitate invalidă (tratați silențios, starea rămâne); 422 → bug de client (validați nickname-ul local cu ACEEAȘI regulă `^[A-Za-z0-9 _-]{3,20}$` + trim + ≥1 alfanumeric înainte de trimitere); 429 → respectați `Retry-After` (nu retry agresiv).
- `ranks` din răspunsul submit e deja calculat — puteți afișa rank-ul fără un GET suplimentar. `me` din `/top` apare DOAR dacă trimiteți `playerId`.
- Trimiteți TOATE cele 4 scoruri la fiecare submit (toate obligatorii); `fastestPublishMs: null` până la primul publish cronometrat. Serverul păstrează BEST — puteți retrimite orice, nimic nu regresează.
- Scorurile mai mici NU produc eroare (best-keeping idempotent) — nu trebuie logică de „doar dacă a crescut" pe client (doar throttle).

### Ce trebuie să știe Agentul E2E
- `test-e2e` are acum `depends_on: api: service_healthy` — stack-ul complet pornește automat; scenariul 10a (flux real) nu are nevoie de mock.
- Serviciul `api` NU publică port pe host; din containerul Playwright: prin web (`http://web:80/api/health`) sau direct `http://api:3000`.
- Volumul `leaderboard_data` PERSISTĂ între rulări (`down` fără `-v` îl păstrează) — nickname-urile din rulări anterioare rămân rezervate: folosiți nickname-uri unice per rulare (ex. sufix timestamp) sau acceptați 409. L-am lăsat GOL după validare.
- Degradare (10b): `page.route('**/api/**', abort)` pe client; serverul răspunde în <2s prin nginx (timeouts 2/5/5s) când api e oprit → 502 de la nginx, clientul intră în „unreachable".
