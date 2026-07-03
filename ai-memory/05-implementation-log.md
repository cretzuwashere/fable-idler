# 05 — Implementation Log

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
