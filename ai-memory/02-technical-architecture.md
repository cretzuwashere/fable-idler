# 02 — Technical Architecture (Agent 3: Technical Architect)

> Aliniat la scheletul deja scris de orchestrator (package.json, Dockerfile, docker-compose.yml, vite.config.ts, playwright.config.ts, tsconfig.json — verificate pe disc la 2026-07-03). Nimic de aici nu contrazice scheletul; unde scheletul a decis deja (porturi, versiuni, profiluri compose), documentul îl preia ca atare.

---

## 1. Structura de foldere și fișiere

```
Fable Idler/
├── index.html                      # există (root div + /src/main.tsx)
├── package.json / package-lock.json  # există — NU adăugați dependințe runtime noi fără motiv
├── tsconfig.json                   # există (strict, include: src + tests/unit)
├── vite.config.ts                  # există (vitest include: tests/unit/**/*.test.ts, env node)
├── playwright.config.ts            # există (testDir: tests/e2e, baseURL din PW_BASE_URL)
├── Dockerfile / nginx.conf / docker-compose.yml / .dockerignore   # există
├── ai-memory/                      # documentele agenților
├── src/
│   ├── main.tsx                    # bootstrap: load save → offline calc → createGameStore → render <App/> → instalează test hook
│   ├── engine/                     # ★ TS PUR. Interzis: import react, import din src/ui, orice API DOM în afara save.ts (localStorage) — și acela injectabil pentru teste
│   │   ├── config.ts               # ★ TOATE constantele de balans (vezi §8) — singurul fișier pe care Agentul 2 (Economy) îl calibrează
│   │   ├── types.ts                # GameState, RunState, MetaState, Action, id-uri (union types literale)
│   │   ├── state.ts                # createInitialState(), createInitialRunState(), invarianti
│   │   ├── generators.ts           # costOf(id, count, state), buyGenerator, bulk buy (1/10/max)
│   │   ├── upgrades.ts             # definiții upgrade-uri (unlock condition + cost din config), buyUpgrade
│   │   ├── achievements.ts         # condiții + checkAchievements(state) → state nou cu unlock-uri
│   │   ├── milestones.ts           # praguri reveal #1–11 + praguri cantitate 25/50/100, checkMilestones(state)
│   │   ├── buff.ts                 # Moment of Inspiration: activate, isActive(state, now), durată/cooldown din config
│   │   ├── prestige.ts             # quillsForTotalEarned(), canPrestige(), publishTheTome(state) → state nou
│   │   ├── offline.ts              # computeOfflineReport(state, now) → { gained, elapsedMs, cappedMs, efficiency }
│   │   ├── selectors.ts            # TOATE valorile derivate: perSecond(state), clickPower(state), costul curent, globalMultiplier — un singur loc, fără duplicare de formule
│   │   ├── tick.ts                 # tick(state, now, dtMs) → state — funcție PURĂ, inima engine-ului
│   │   ├── save.ts                 # serialize/deserialize, versiune schemă, migrare, export/import base64, guard anti-corupere
│   │   ├── format-numbers.ts       # formatNumber(n) → "1.23K" … "1.23e35" (pur, zero dependințe)
│   │   ├── game-loop.ts            # createGameStore(): shell imperativ — setInterval, dispatch, subscribe, autosave
│   │   └── index.ts                # re-export API public al engine-ului (UI importă DOAR de aici)
│   └── ui/
│       ├── App.tsx                 # layout-ul (structura exactă o decide Agentul 4 în 04-ui-ux-decisions.md)
│       ├── hooks/
│       │   └── useGameStore.ts     # useSyncExternalStore peste store + hook useDispatch
│       ├── components/             # ClickArea, ResourceHeader, GeneratorList, GeneratorCard, UpgradeList,
│       │   └── …                   # AchievementsPanel, MilestoneToast, PrestigePanel, BuffButton,
│       │                           # OfflineModal, SettingsPanel (export/import/reset) — numele finale în 04
│       ├── test-hook.ts            # window.__FABLE_TEST__ (vezi §6.3) — instalat DOAR cu ?test=1
│       └── styles/                 # CSS (modules sau vanilla — decide Agentul 4)
└── tests/
    ├── unit/                       # Vitest — importă DOAR din src/engine (fără DOM, environment: node)
    │   ├── format-numbers.test.ts
    │   ├── generators.test.ts      # cost growth, buy, bulk, Patron's Favor
    │   ├── production.test.ts      # selectors: sinergii, milestones ×2, achievements, quills, buff
    │   ├── click.test.ts           # Sharpened Nib, Ink Echo, Quill Resonance, buff ×5
    │   ├── tick.test.ts            # determinism delta-time
    │   ├── achievements.test.ts    # + Bound Anthology
    │   ├── milestones.test.ts
    │   ├── prestige.test.ts        # formulă + listă reset/persistă
    │   ├── offline.test.ts         # 50%/75%, plafon, report
    │   └── save.test.ts            # round-trip, migrare, corupere, export/import
    └── e2e/                        # Playwright — cele 7 scenarii (§6.2)
        ├── fixtures.ts             # fixture comun: colectează console errors + pageerror, fail la final
        ├── 01-smoke-click.spec.ts
        ├── 02-generators.spec.ts
        ├── 03-upgrades.spec.ts
        ├── 04-unlocks.spec.ts
        ├── 05-persistence.spec.ts
        ├── 06-offline.spec.ts
        └── 07-prestige.spec.ts
```

Reguli de dependință (de sus în jos, fără cicluri):
`config.ts` → `types.ts` → (`state`, `generators`, `upgrades`, `achievements`, `milestones`, `buff`, `prestige`, `offline`, `format-numbers`) → `selectors.ts` → `tick.ts` → `game-loop.ts`. `save.ts` depinde doar de `types` + `state` (pentru default-uri la migrare). UI importă exclusiv din `src/engine/index.ts`. **Nimic din engine nu importă din ui și nu importă React.**

---

## 2. Modelul de stare + cine deține tick-ul

### 2.1 GameState (schiță TS — contractul; Agentul 5 o detaliază fără să schimbe împărțirea)

Împărțirea cerută explicit de Agent 1 (§ „Ce trebuie să știe următorul agent”): **run** (resetabil la prestige) vs **meta** (permanent).

```ts
// types.ts — schiță de contract
export type GeneratorId =
  | 'wanderingMuse' | 'inkSprite' | 'talkingRaven' | 'enchantedQuill'
  | 'storyLoom' | 'dreamLibrary' | 'fableForge';

export type UpgradeId =
  | 'sharpenedNib' | 'musesChorus' | 'goldenInkwell' | 'ravensGossip'
  | 'weaversRhythm' | 'lucidDreaming' | 'burstOfGenius' | 'inkEcho'
  | 'patronsFavor' | 'boundAnthology' | 'quillResonance';

export interface RunState {                 // ← se resetează la Publish the Tome
  inspiration: number;                      // sold curent (se cheltuie)
  totalEarned: number;                      // cumulat pe rundă — baza pt milestones + prestige
  generators: Record<GeneratorId, number>;  // count per generator
  upgrades: Partial<Record<UpgradeId, true>>;      // 1–10 cumpărate (quillResonance NU stă aici — e meta)
  milestones: string[];                     // id-uri deblocate: 'theFirstSpark' … + 'qty:inkSprite:25'
  buff: {
    activeUntil: number;                    // epoch ms; 0 = inactiv
    cooldownUntil: number;                  // epoch ms; 0 = disponibil
  };
}

export interface MetaState {                // ← persistă peste prestige
  goldenQuills: number;
  tomesPublished: number;
  achievements: string[];                   // id-uri achievements deblocate (permanente)
  quillResonance: boolean;                  // upgrade-ul 11, o dată cumpărat rămâne
  stats: {
    totalClicks: number;                    // lifetime
    lifetimeInspiration: number;            // all-time earned (peste toate rundele)
    buffActivations: number;                // lifetime (condiție Moment Seizer / Burst of Genius)
    offlineSessionsOver30Min: number;       // condiție unlock Lucid Dreaming
    bestSingleOfflineGain: number;          // condiție Night Shift
  };
  settings: { numberNotation?: 'suffix' | 'scientific' };  // extensibil
}

export interface GameState {
  run: RunState;
  meta: MetaState;
  lastTickAt: number;                       // epoch ms — folosit de delta time; salvat ca savedAt
}

export type Action =
  | { type: 'click' }
  | { type: 'buyGenerator'; id: GeneratorId; qty: 1 | 10 | 'max' }
  | { type: 'buyUpgrade'; id: UpgradeId }
  | { type: 'activateBuff' }
  | { type: 'prestige' }                    // Publish the Tome (UI face confirmarea, engine doar validează canPrestige)
  | { type: 'importSave'; data: string }
  | { type: 'hardReset' };
```

Reguli:
- **Nicio valoare derivată nu se stochează.** `inspirationPerSecond`, `clickPower`, costuri curente, multiplicatorul global — toate se calculează în `selectors.ts` din stare + `config.ts`. Un singur loc ⇒ unit-testabil și imposibil de desincronizat.
- Timpii (buff, save) sunt **epoch ms absolut**, nu countdown-uri relative — astfel buff-ul expiră corect după sleep/tab hidden fără logică specială.
- Starea este **imutabilă**: fiecare tick/acțiune întoarce un obiect nou (spread + structural sharing). La 10 ticks/sec costul e neglijabil și e ce are nevoie `useSyncExternalStore` (comparare prin referință).

### 2.2 Game loop — DECIZIE: `setInterval` 100ms cu delta time; randare = notificare pe tick (~10fps)

**Ales: un singur `setInterval` la 100ms în `game-loop.ts` (shell-ul store-ului), care apelează funcția pură `tick(state, now, dtMs)`.** Fără requestAnimationFrame pentru logică.

De ce nu rAF: rAF e oprit/throttled agresiv în tab-uri de fundal (0–1fps) — exact scenariul principal al unui idle game; logica ar îngheța. `setInterval` e throttled la ~1/sec în fundal, dar pentru că `tick` primește `dtMs = now − lastTickAt` real (nu presupune 100ms), producția rămâne **exactă matematic** indiferent de frecvența reală a timer-ului: 1 tick de 1000ms produce identic cu 10 ticks de 100ms (asta e un unit test obligatoriu, `tick.test.ts`).

De ce nu rAF separat pentru randare: la 10 actualizări de stare/sec, un layer de randare la 60fps nu are ce desena în plus (nu avem animații de canvas dependente de stare). React re-randează la fiecare notificare a store-ului = max 10fps, suficient de „viu” pentru contoare și ieftin. Animațiile pur vizuale (toast-uri, pulse pe click) sunt CSS — nu trec prin stare.

Detalii de comportament:
- `dtMs` se plafonează la **60.000ms** per tick în foreground. Dacă `dt > 60s` (laptop în sleep cu tab-ul deschis), diferența se tratează prin ramura de **offline** (`offline.ts`) și, peste pragul de 5 minute, se arată modalul „While you were away” — un singur cod-path pentru „timp pierdut”, nu două.
- Autosave: contor de ticks în `game-loop.ts` — la fiecare 100 ticks (~10s) → `save()`. Plus `visibilitychange → hidden` și `beforeunload` (§5).
- Cine pornește loop-ul: `main.tsx`, o singură dată, DUPĂ load + calcul offline. Store-ul expune `start()`/`stop()` (stop necesar în teste și la hard reset).

---

## 3. Comunicarea UI ↔ engine — DECIZIE: core funcțional + shell subscribe + `useSyncExternalStore`

**Ales: engine funcțional pur (`(state, action) => state` și `tick(state, now, dt) => state`), împachetat într-un store minimal creat de `createGameStore()` (factory cu closure, NU clasă), integrat în React prin `useSyncExternalStore` nativ din React 18.** Zero librării de state management.

```ts
// game-loop.ts — API-ul store-ului (contract pentru Agent UI)
export interface GameStore {
  getState(): GameState;                    // snapshot stabil referențial între notificări
  dispatch(action: Action): void;           // aplică reducer-ul + check achievements/milestones + notify IMEDIAT
  subscribe(listener: () => void): () => void;
  start(): void;                            // pornește setInterval(100ms)
  stop(): void;
  save(): void;                             // forțează persist (folosit și de test hook)
}
export function createGameStore(initial: GameState, deps?: { now?: () => number; storage?: StorageLike }): GameStore;
```

- `deps.now` și `deps.storage` sunt injectabile ⇒ store-ul întreg e testabil în Vitest fără DOM și fără timere reale.
- **Fluxul:** UI → `dispatch(action)` → reducer pur → `checkMilestones` + `checkAchievements` pe starea rezultată → swap referință → notify. Tick-ul face același lucru pe axa timpului. UI nu citește nimic în afară de `getState()` și selectori.
- **Integrare React:** un singur hook, `useGameStore()`, care face `useSyncExternalStore(store.subscribe, store.getState)` și întoarce `GameState`-ul întreg. La ~10 notificări/sec și un arbore de componente de mărimea asta, re-render global e ieftin; listele mari (generatori, upgrade-uri) se împachetează în `React.memo` cu props primitive (count, cost, affordable). NU introducem selector-subscriptions per-componentă (`use-sync-external-store/with-selector`) în v1 — complexitate fără câștig măsurabil aici.
- Store-ul e **modul-singleton creat în `main.tsx`** și pasat prin context (`<StoreProvider>`) ca să rămână injectabil în teste de componente; `useGameStore` îl ia din context.
- De ce nu clasă `GameEngine`: toată logica de joc rămâne în funcții pure exportate individual — direct unit-testabile, fără mock-uri, fără `this`. Shell-ul imperativ (interval + listeners) are <100 de linii și e singurul loc cu efecte secundare de timp.

---

## 4. Numere mari — DECIZIE: `number` nativ (double), FĂRĂ break_infinity

Justificare numerică, pe economia reală a jocului:
- Cel mai scump conținut v1: Fable Forge, cost bază 2×10⁷, growth ~1.15. La 100 de unități costul unitar e ~2×10⁷ × 1.15¹⁰⁰ ≈ 2.3×10¹³. Endgame-ul v1 (toate achievements + Forge la 25–100) trăiește în zona **10¹²–10¹⁵** — la 293 de ordine de mărime sub limita double (≈1.8×10³⁰⁸).
- Precizia: double are ~15–16 cifre semnificative. Pentru un idle game valorile sunt cantități continue, nu contabilitate exactă — o eroare relativă de 10⁻¹⁵ e invizibilă și inofensivă (pattern standard: Cookie Clicker folosește tot double). Singurele integer-uri exacte care contează (count generatori, quills, click-uri) rămân mici (<10⁶), deci exacte în double.
- break_infinity/decimal.js ar aduce: dependință în engine-ul „zero deps”, API greoi (`a.add(b)`), cost de performanță pe tick și pe serializare — totul pentru un headroom pe care jocul nu-l atinge nici cu 10 prestige-uri. **Dacă** un v2 introduce scalare super-exponențială, decizia se revizuiește; formatul de save versioned (§5) permite migrarea.

`format-numbers.ts` (pur, testat exhaustiv):
- `n < 1000` → întreg (`847`); pentru rate/sec sub 100 → 1 zecimală (`0.1`, `12.5`).
- `1000 ≤ n < 10³³` → mantisă cu până la 2 zecimale + sufix din lista `['K','M','B','T','Qa','Qi','Sx','Sp','Oc','No']` → `1.23K`, `45.6M`, `7.89B`.
- `n ≥ 10³³` → notație științifică `1.23e35`.
- Niciodată `toFixed`/rotunjiri în logică de joc — formatarea e strict de afișare.

---

## 5. Strategia de save

| Aspect | Decizie |
|---|---|
| Cheie localStorage | `fableIdler:save` (o singură cheie; versiunea stă ÎN payload, nu în numele cheii) |
| Cheie backup corupere | `fableIdler:save:corrupt` (păstrăm string-ul brut la eșec de parse — recuperabil manual) |
| Schemă | `interface SaveDataV1 { version: 1; savedAt: number; run: RunState; meta: MetaState }` — JSON simplu, ~2–5KB, fără griji de quota |
| Autosave | la fiecare **10s** (100 ticks, contor în game-loop) + `visibilitychange → 'hidden'` (singurul eveniment fiabil pe mobil) + `beforeunload` + **imediat** după tranzițiile critice: prestige, import, buy upgrade, hard reset |
| Load | la bootstrap în `main.tsx`, ÎNAINTE de `createGameStore`; `savedAt` alimentează `offline.ts` |
| Export | `btoa` peste JSON trecut prin `TextEncoder` (safe pentru orice Unicode viitor) → string base64 afișat în textarea + buton copy |
| Import | decode → `JSON.parse` în try/catch → `migrate()` → `isValidSave()` → dialog de confirmare „va suprascrie progresul curent” → `dispatch({type:'importSave'})` → save imediat |
| Migrare | `save.ts`: `const CURRENT_SAVE_VERSION = 1` + `const MIGRATIONS: Record<number, (old: unknown) => unknown>` — lanț v→v+1 aplicat în buclă până la curent. v1 e prima schemă; mecanismul există din ziua 1 ca să nu fie retrofit. |
| Anti-corupere | `loadSave()`: (1) cheie absentă → stare inițială; (2) `JSON.parse` aruncă → mută string-ul brut în cheia `:corrupt`, `console.warn`, stare inițială + notice ne-blocant în UI; (3) parse OK dar `isValidSave()` pică (validator manual de shape: tipuri + câmpuri obligatorii, fără zod — zero deps) → același fallback. Jocul **nu crapă niciodată la load**. |
| Reset controlat | „Hard Reset” în Settings: confirmare dublă (checkbox + buton), cu oferta de export înainte — cerință explicită din brief. Șterge cheia + starea din memorie + repornește loop-ul. |
| Multi-tab | Last-writer-wins, documentat ca limitare v1 (vezi Riscuri). |

---

## 6. Strategia de testare

### 6.1 Vitest (`tests/unit`, environment `node`, importă doar `src/engine`)

| Fișier | Ce verifică numeric |
|---|---|
| `format-numbers.test.ts` | praguri exacte: `999→"999"`, `1000→"1K"`, `1234→"1.23K"`, `1e6/1e9/1e12`, tranziția la `e`-notație la 1e33, zecimale la rate mici |
| `generators.test.ts` | cost = `bază × growth^count` (cifre din config), deducere sold la buy, refuz la sold insuficient, bulk 10/max corect la limită, Patron's Favor −5% aplicat pe cost |
| `production.test.ts` | `perSecond`: bazele per generator; Muse's Chorus ×2; Raven's Gossip (+5%/raven la sprites) și Weaver's Rhythm (+10%/loom la quills) cu valori calculate de mână; qty milestones 25/50/100 → ×2/×4/×8; achievements +1% aditiv (și +2% cu Bound Anthology); Golden Inkwell ×1.5; quills +2%/buc; buff ×2 — și ordinea de compunere (multiplicativ între categorii) identică cu 03-economy |
| `click.test.ts` | click bază 1; Sharpened Nib ×2; Ink Echo +1% din `perSecond`; Quill Resonance aplică bonusul quills pe click; buff ×5; `totalEarned` crește la click |
| `tick.test.ts` | **determinism delta-time: 10×tick(100ms) ≡ 1×tick(1000ms)** (egalitate cu toleranță 1e-9); dt=0 nu schimbă nimic; buff expiră corect după `activeUntil` |
| `achievements.test.ts` | fiecare condiție declanșează exact o dată; bonusul global reflectat în `perSecond`; persistă în meta |
| `milestones.test.ts` | pragurile #1–11 pe `totalEarned` (10/60/100/500/600/6k/50k/65k/700k/10M); formatul `qty:<gen>:<n>`; re-parcurgere după prestige (run.milestones golit, meta intactă) |
| `prestige.test.ts` | `quillsForTotalEarned`: 99.999→0, 100k→1, 400k→2, 900k→3, 10M→10; `canPrestige` sub prag = false; după `publishTheTome`: run == stare inițială de rundă, `meta.goldenQuills` incrementat, `tomesPublished`+1, achievements/stats/quillResonance NEATINSE — lista reset-vs-persistă din 01 §7 verificată câmp cu câmp |
| `offline.test.ts` | câștig = `perSecond × elapsed × 0.5` (0.75 cu Lucid Dreaming); plafon 8h/12h (config); report corect (elapsed, capped, gained); alimentează Night Shift și contorul pt unlock Lucid Dreaming |
| `save.test.ts` | round-trip `deserialize(serialize(s))` deep-equal; export→import base64 round-trip; string corupt → fallback stare inițială + backup scris; versiune necunoscută → fallback; migrare stub v1→v2 (test al mecanismului) |

### 6.2 Playwright (`tests/e2e`) — cele 7 scenarii obligatorii

Toate rulează pe **build-ul de producție servit de nginx** (serviciul `web`, `PW_BASE_URL=http://web:80`), cu `page.goto('/?test=1')`. Fixture comun (`fixtures.ts`) colectează `page.on('pageerror')` + `console` de nivel `error` și **pică testul** dacă apare vreo eroare — acoperă cerința „fără erori critice în consolă” în fiecare scenariu, nu doar într-unul.

1. **Smoke + click** — pagina se încarcă, titlul/branding vizibil, click pe zona „Weave” crește contorul de Inspiration cu click power afișat.
2. **Generatori** — cumpără Wandering Muse din click-uri reale (15 click-uri — validează și criteriul „<30s”), verifică `/sec > 0` și că soldul crește FĂRĂ click (așteptare 2–3s).
3. **Upgrade-uri** — via hook `addInspiration`, cumpără Sharpened Nib; verifică efect real (delta pe click dublă), butonul devine „purchased”.
4. **Unlocks** — milestone toast la „The First Spark”; tab-ul Upgrades apare la 100 totalEarned; tab-ul Achievements apare după primul achievement.
5. **Persistență** — joacă (click + cumpără), `page.reload()`, starea identică (sold ±producția din interval, count generatori, upgrade-uri). Acoperă „fără pierdere de date la refresh”.
6. **Offline** — `page.addInitScript` scrie în localStorage un save valid cu `savedAt = Date.now() − 3600_000` ÎNAINTE de load → la încărcare apare modalul „While you were away” cu sumă > 0 (testează chiar code-path-ul real de load+offline, fără cheat).
7. **Prestige** — hook `addInspiration(500_000)` (crește și `totalEarned`), deschide panoul Prestige, verifică preview „2 Golden Quills”, confirmă dialogul, apoi: quills afișate = 2, resursa/generatorii resetate, achievements încă prezente. Acoperă și confirmarea obligatorie din brief.

(Bonus, dacă rămâne timp — scenariul 8: export → hard reset cu confirmare → import → stare restaurată.)

### 6.3 Hook-ul de test — DECIZIE: `window.__FABLE_TEST__` activat de query param `?test=1`

**Mecanism exact:** în `src/ui/test-hook.ts`, apelat din `main.tsx` după crearea store-ului:

```ts
export function installTestHook(store: GameStore) {
  if (new URLSearchParams(window.location.search).get('test') !== '1') return;
  window.__FABLE_TEST__ = {
    getState: () => store.getState(),
    dispatch: (a: Action) => store.dispatch(a),
    addInspiration: (n: number) => { /* crește run.inspiration ȘI run.totalEarned cu n, apoi re-check milestones/achievements */ },
    fastForward: (ms: number) => { /* rulează tick-ul cu dt = ms (pt. teste de producție idle fără așteptare reală) */ },
    saveNow: () => store.save(),
  };
}
```

De ce query param și NU `import.meta.env.MODE === 'test'`: **E2E-ul rulează pe build-ul de producție** (nginx) — env-ul de build e `production`, deci un guard pe MODE ar face testul de prestige imposibil fără un build separat (care ar testa alt artefact decât cel livrat). Query param-ul e determinist, funcționează pe exact binarul livrat, iar codul e inert fără parametru. Suprafața de „cheat” e irelevantă: joc local, single-player, cu save-ul oricum editabil în localStorage. Hook-ul NU are UI și NU e menționat nicăieri în interfață.

Contract: **numele funcțiilor din hook sunt parte din API — Agent UI le implementează exact așa, Agent 8 (E2E) le folosește exact așa.** Testul de offline NU folosește hook-ul (folosește `addInitScript` + save fabricat — §6.2.6).

---

## 7. Docker (scheletul există — aici e contractul de utilizare)

### 7.1 Dockerfile (există, verificat) — 3 stagii
`node:22-alpine (deps: npm ci)` → `build (npm run build = tsc --noEmit && vite build)` → `nginx:1.27-alpine` servind `/app/dist` cu `nginx.conf` (SPA fallback + cache imutabil pe `/assets/`) + HEALTHCHECK pe `http://127.0.0.1/` (folosit de `depends_on: condition: service_healthy` al lui test-e2e).

### 7.2 docker-compose.yml (există, verificat) — 4 servicii

| Serviciu | Imagine | Port host | Profil | Rol |
|---|---|---|---|---|
| `web` | build din Dockerfile (nginx) | **8080→80** | (default) | producție |
| `dev` | node:22-bookworm-slim | **5173→5173** | `dev` | Vite dev server, hot reload, `CHOKIDAR_USEPOLLING=true` |
| `test-unit` | node:22-bookworm-slim | — | `test` | `npm run test` (Vitest) |
| `test-e2e` | mcr.microsoft.com/playwright:**v1.49.1**-noble | — | `test` | `npx playwright test` contra `web` prin rețeaua compose (`PW_BASE_URL=http://web:80`), pornește după healthcheck-ul lui `web` |

Named volumes `node_modules_dev/test/e2e` maschează `node_modules` peste bind mount-ul Windows (host fără Node, și performanță). **Invariant critic: versiunea `@playwright/test` din package.json (1.49.1) și tag-ul imaginii (v1.49.1-noble) trebuie schimbate ÎMPREUNĂ** — mismatch = browserele lipsesc din imagine și E2E pică criptic.

### 7.3 Comenzile exacte pentru utilizatorul final (host = Windows, doar Docker)

```bash
docker compose up --build              # producție → http://localhost:8080
docker compose --profile dev up dev    # dev cu hot reload → http://localhost:5173
docker compose run --rm test-unit      # unit tests (Vitest)
docker compose run --rm --build test-e2e   # E2E: (re)build web + healthcheck + Playwright
docker compose down                    # oprire; adaugă -v ca să ștergi și volumele node_modules
```

Note: `docker compose run <serviciu-cu-profil>` activează implicit profilul serviciului rulat — nu e nevoie de `--profile test` la `run`. Prima rulare a serviciilor node face `npm install` în volum (~1–2 min); rulările următoare refolosesc volumul.

---

## 8. Convenții de cod

1. **`src/engine/config.ts` este SINGURUL loc cu cifre de balans.** Structură orientativă: `GENERATORS` (id, baseCost, baseProdPerSec, growth, revealAtTotalEarned), `UPGRADES` (id, cost, unlock — descrise ca date, efectele în `upgrades.ts`/`selectors.ts`), `ACHIEVEMENT_BONUS = 0.01`, `QUILL_BONUS = 0.02`, `PRESTIGE_MIN_TOTAL_EARNED = 100_000`, `PRESTIGE_DIVISOR = 100_000`, `BUFF = { durationMs, cooldownMs, clickMult, prodMult }`, `OFFLINE = { baseEfficiency: 0.5, upgradedEfficiency: 0.75, capMsBase, capMsUpgraded }`, `QTY_MILESTONE_THRESHOLDS = [25, 50, 100]`, `QTY_MILESTONE_MULT = 2`, `TICK_MS = 100`, `AUTOSAVE_TICKS = 100`. Agentul 2 (Economy) editează DOAR acest fișier + testele numerice aferente; nicio cifră hardcodată în alt modul sau în UI.
2. **Engine funcțional, fără clase.** Doar funcții pure exportate; singura închidere cu stare e `createGameStore` (factory). Fără `this`, fără side effects în afara `game-loop.ts` și `save.ts`.
3. **ID-urile din 01-game-design sunt literale** — union types în `types.ts`, folosite identic în cod, teste, `data-testid`-uri UI. Format milestone de cantitate: `qty:<generatorId>:<threshold>` (ex. `qty:inkSprite:25`).
4. Naming: fișiere engine `kebab-case.ts` (deja fixat de sarcină: `format-numbers.ts`, `game-loop.ts`); componente React `PascalCase.tsx`; funcții `camelCase`; constante config `SCREAMING_SNAKE`.
5. `data-testid` obligatoriu pe elementele atinse de E2E (`click-area`, `inspiration-amount`, `per-second`, `generator-<id>`, `upgrade-<id>`, `buff-button`, `prestige-button`, `prestige-confirm`, `offline-modal`, `tab-upgrades`, `tab-achievements`) — contractul dintre Agent UI și Agent 8; lista finală o fixează Agentul 4 în 04, dar acestea sunt minimul.
6. Fără dependințe noi: engine = zero deps; UI = react + react-dom, atât. Orice adăugare de pachet trece prin orchestrator (lockfile-ul se regenerează doar prin container).
7. TS `strict` e deja activ în tsconfig — fără `any` în engine; `unknown` + narrowing la marginile de I/O (parse save, import).
8. `tests/e2e` NU intră în tsconfig-ul aplicației (include-ul e doar `src` + `tests/unit`) — Playwright își transpileaza singur spec-urile; nu „reparați” asta adăugând e2e în include (ar cere types-uri conflictuale).

---

## Ce s-a decis
- Game loop: **`setInterval` 100ms + `tick(state, now, dtMs)` pur cu delta time**; fără rAF; randare = re-render React la notificarea store-ului (~10fps); `dt > 60s` rutat prin code-path-ul de offline.
- Integrare UI↔engine: **core funcțional pur + `createGameStore()` (getState/dispatch/subscribe/start/stop/save) + `useSyncExternalStore`**, store în context, zero librării de state.
- Numere: **double nativ, fără break_infinity** (endgame ~10¹⁵ vs limită 1.8×10³⁰⁸); formatare sufixe K→No apoi `1.23e35`.
- Save: cheia `fableIdler:save`, schemă versionată v1 cu `MIGRATIONS`, autosave 10s + visibilitychange + beforeunload + tranziții critice, export/import base64, fallback anti-corupere cu backup în `fableIdler:save:corrupt`.
- Test hook E2E: **`window.__FABLE_TEST__` activat exclusiv de `?test=1`** (funcționează pe build-ul de producție — motivul deciziei), cu API fix: `getState/dispatch/addInspiration/fastForward/saveNow`.
- Stare împărțită `run` (reset la prestige) / `meta` (permanent), valori derivate DOAR în `selectors.ts`, toate cifrele economiei DOAR în `config.ts`.
- Docker: preluat scheletul existent ca atare (4 servicii, porturi 8080/5173, profiluri dev/test, Playwright pin 1.49.1 ↔ v1.49.1-noble).

## De ce
- Idle game = tab în fundal ca stare normală: rAF moare acolo, `setInterval` throttled + delta time rămâne matematic exact — și `tick` pur cu `dt` parametru e direct unit-testabil fără timere.
- `useSyncExternalStore` e exact primitive-ul React 18 pentru un store extern; orice Redux/Zustand ar fi dependință în plus pentru același rezultat.
- Double e suficient cu 293 de ordine de mărime headroom; big-number libs ar fi cost fără beneficiu.
- Query param în loc de build mode pentru hook: E2E trebuie să testeze **artefactul livrat** (build-ul nginx), nu un build special de test.
- O singură sursă pentru formule (selectors) + una pentru cifre (config) = Agentul 2 poate rebalansa fără să atingă logica, iar testele numerice pică imediat la desincronizare.

## Fișiere create sau modificate
- **Creat:** `C:/Projects/Games/Fable Idler/ai-memory/02-technical-architecture.md` (acest document).
- **Niciun fișier de cod creat/modificat** — conform sarcinii (arhitectură, nu implementare). Scheletul existent (package.json, Dockerfile, compose, configs) a fost citit și preluat ca fundație, nemodificat.

## Riscuri
1. **Pin Playwright dublu** (package.json 1.49.1 ↔ imagine v1.49.1-noble): oricine face bump la unul fără celălalt sparge E2E. Regulă: se schimbă împreună, într-un singur commit.
2. **Multi-tab**: două tab-uri deschise = last-writer-wins pe localStorage, posibilă pierdere de secunde de progres. Acceptat pentru v1; mitigare ieftină dacă rămâne timp: listener pe `storage` care arată „save modificat în alt tab — reload”. NU implementați lock-uri.
3. **`beforeunload` nefiabil pe mobil** — de aceea `visibilitychange → hidden` e canalul principal de save la ieșire, nu backup-ul.
4. **Ordinea de compunere a multiplicatorilor** (aditiv în interiorul categoriilor, multiplicativ între ele) trebuie fixată IDENTIC în `selectors.ts` și în 03-economy-balance; altfel testele numerice și balansul diverg. Agentul 5 implementează ordinea pe care o publică Agentul 2; dacă 03 nu o specifică explicit, defaultul e cel din `production.test.ts` de mai sus.
5. **Ink Echo sub buff** (semnalat în 01): dacă 03 decide plafonare, singura atingere e în `selectors.ts` (clickPower) + config — arhitectura nu se schimbă.
6. **Bind mount Windows lent la primul `npm install`** în volume (1–2 min) — de comunicat în README ca așteptare normală, nu bug.
7. Test hook prezent în build-ul de producție — inert fără `?test=1`, suprafață de risc zero pentru un joc local fără backend; menționat aici ca să nu fie „descoperit” și eliminat de Agent 9 la quality gate, rupând E2E-ul.

## Ce trebuie să știe următorul agent
- **Agent 2 (Economy):** toate cifrele tale intră în `src/engine/config.ts` cu structura din §8.1; publică EXPLICIT ordinea de compunere a multiplicatorilor și tratamentul Ink Echo sub buff; pragurile de reveal per generator sunt câmp în `GENERATORS` (`revealAtTotalEarned`).
- **Agent 4 (UI/UX):** primești starea prin `useGameStore()` (tot GameState-ul) și trimiți `Action`-uri prin dispatch; nu calcula nimic în componente — cere selectori din engine; lista minimă de `data-testid` e în §8.5; modal offline, dialog prestige cu preview și toast-uri milestone sunt cerute de E2E §6.2.
- **Agent 5/6 (Engine):** contractele fixe = interfețele din §2.1, API-ul store din §3, semantica tick din §2.2, schema save din §5, hook-ul din §6.3. Testul de determinism delta-time (`tick.test.ts`) e obligatoriu. `quillResonance` stă în `meta`, nu în `run.upgrades`. Achievements se verifică și pe evenimente (click, buy, buff, offline, prestige), nu doar pe tick — treceți check-urile după fiecare dispatch.
- **Agent 8 (E2E):** folosește DOAR API-ul `__FABLE_TEST__` din §6.3 și `data-testid`-urile din §8.5; scenariul offline se face cu `addInitScript` + save fabricat, nu cu hook; fixture-ul de console errors e obligatoriu în toate cele 7 spec-uri.
- **Agent 7 (DevOps/README):** comenzile finale pentru utilizator sunt cele din §7.3, deja funcționale cu scheletul; documentează invariantul pin-ului Playwright și durata primului install.

## Validări făcute
- Citit și confruntat scheletul real de pe disc: package.json (scripts, versiuni), Dockerfile (3 stagii + healthcheck), docker-compose.yml (4 servicii, porturi 8080/5173, profiluri, named volumes, `PW_BASE_URL=http://web:80`), vite.config.ts (vitest include `tests/unit/**/*.test.ts`, environment node — structura de teste propusă se potrivește exact), playwright.config.ts (testDir `tests/e2e`, baseURL din env), tsconfig (include `src` + `tests/unit` — consistent cu §8.8), nginx.conf (SPA fallback prezent — necesar pentru reload în E2E).
- Verificat potrivirea pin Playwright: `@playwright/test 1.49.1` (exact, fără caret) ↔ `mcr.microsoft.com/playwright:v1.49.1-noble` — aliniat.
- Verificat numeric headroom-ul double: cost Fable Forge la unitatea 100 ≈ 2.3×10¹³ ≪ 1.8×10³⁰⁸; count-urile exacte rămân sub 2⁵³.
- Verificat că cerințele din 01 §„Ce trebuie să știe următorul agent” (split run/meta, `totalEarned` distinct de sold) sunt onorate în schema GameState.
- Verificat coerența formulei de prestige cu testele propuse (100k→1, 400k→2, 900k→3, 10M→10 = floor(sqrt(te/1e5))).
- Niciun cod rulat — document de arhitectură; validarea executabilă începe cu Agentul 5.
