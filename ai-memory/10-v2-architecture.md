# 10 — V2 Technical Architecture (Agent 3: Technical Architect, 2026-07-04)

> Extinde `02-technical-architecture.md` (v1) FĂRĂ să-l rescrie — toate deciziile v1 (tick 100ms + delta time, store funcțional + `useSyncExternalStore`, double nativ, save versionat, hook `?test=1`) rămân în vigoare. Design-ul de referință e `09-v2-game-design.md`; id-urile de acolo sunt literă de lege. Documentul de față definește: backend-ul de leaderboard, integrarea Docker/nginx/Vite, schema SaveDataV2 + migrarea, extensiile de engine și strategia de testare v2. **NU s-a scris cod** — doar contracte.

> **Notă de numerotare:** 09 propunea `10-v2-economy-balance.md` pentru economie. Orchestratorul a alocat 10 arhitecturii (acest document). **Economia v2 = `11-v2-economy-balance.md`, UI v2 = `12-v2-ui-decisions.md`** — următorii agenți să folosească aceste nume, nu propunerea din 09.

---

## 0. Abateri conștiente față de 09 (decizii de arhitect, finale)

| # | 09 spunea | Decizia finală (acest doc) | De ce |
|---|---|---|---|
| A1 | Token + entryId în cheia localStorage separată `fable-idler-leaderboard-v1` | **Identitatea (`playerId`, `token`, `nickname`) stă în `meta.settings.leaderboard`** → intră în save → **trece prin export/import** | Decizia orchestratorului: un jucător care își mută save-ul în alt browser își păstrează locul în clasament fără pași suplimentari. Un singur mecanism de persistență (save-ul), nu două. `sanitizeSettings` îl validează la load ca orice alt setting. Consecința (export = conține secretul) e tratată în Riscuri + UI. |
| A2 | `POST /api/leaderboard` + `PUT /api/leaderboard/{entryId}` | **Un singur endpoint `POST /api/leaderboard/submit`** (claim și update, diferențiate de prezența tokenului în body); `entryId` → **`playerId`** | Un singur cod-path client (fetch identic mereu), un singur handler server; redenumirea reflectă semantica (identifică jucătorul, nu rândul). |
| A3 | Trimitere: la Publish + manual, throttle 60s | **Triggere: claim nickname, fiecare Publish, interval 90s (doar dacă e „dirty"), `visibilitychange→hidden` (dirty, fire-and-forget), buton manual.** Throttle 60s pe trimiterile automate; claim + manual îl ocolesc | Publish-urile pot fi la ore distanță — intervalul de 90s ține clasamentul viu pentru lifetimeInspiration fără spam (max 40 req/h/jucător). |
| A4 | Server: respinge scoruri sub cele anterioare la câmpurile monotone | **Serverul păstrează BEST per metrică** (max pe cele 3 monotone, min pe fastestPublishMs) — update-ul nu poate decât îmbunătăți; nu există eroare de „regresie" | Un hard reset local ar face altfel toate trimiterile viitoare invalide → identitate blocată permanent. Best-keeping e idempotent și elimină un întreg code-path de eroare. |
| A5 | `run.startedAt = savedAt` la migrare | **`run.startedAt = 0` (sentinel „necunoscut") la migrare**; prestige înregistrează `fastestPublishMs`/`durationMs` doar când `startedAt > 0` | `savedAt` ar fi făcut prima publicare post-migrare artificial „rapidă" (durata reală a rundei e pierdută). 09 însuși cerea „Fastest Publish ignoră runda în curs la migrare" — sentinela e mecanismul exact. |

Restul contractelor din 09 (regula de aur, tabele Spark, fabule, relics, milestones) sunt preluate ca atare.

---

## 1. Backend-ul Hall of Fables — serviciul `api`

### 1.1 Stack: **Node 22, ZERO dependențe externe** (decizie)

`node:http` nativ + `node:crypto` + `node:fs` — fără Express/Fastify, fără DB, fără npm install.

Justificare:
- **Scara reală**: zeci–sute de intrări, câteva cereri/min. Un `Map` în memorie + snapshot JSON pe disc acoperă 1000× nevoia. SQLite/Postgres = complexitate operațională pentru zero beneficiu.
- **Host-ul nu are Node** (invariant v1): orice dependință nouă înseamnă regenerare de lockfile prin container. Zero deps = **zero lockfile pentru server**, imagine finală ~55MB, zero supply-chain.
- **Fără build step**: server-ul e ESM JavaScript modern (`.mjs`) cu JSDoc + un fișier de declarații `.d.mts` scris de mână, ca testele Vitest din proiectul principal să fie type-checked. (TS cu `--experimental-strip-types` respins: flag experimental pe Node 22 = risc gratuit.)
- Alternativa minimă luată în calcul (Fastify + better-sqlite3): respinsă — ar aduce ~40 pachete tranzitive și compilare nativă în imagine, pentru un serviciu cu 3 rute.

### 1.2 Structura `server/` (folder NOU în rădăcina proiectului)

```
server/
├── Dockerfile              # FROM node:22-alpine; COPY src; mkdir/chown /data; USER node; CMD node src/server.mjs
└── src/
    ├── server.mjs          # entrypoint: citește env, createApp().listen(PORT), SIGTERM/SIGINT → flush + close
    ├── app.mjs             # createApp(deps) → node:http.Server NEpornit (routing + handlers) — testabil pe port efemer
    ├── app.d.mts           # declarații de tip pentru teste (createApp, LeaderboardEntry, ScoreSet)
    ├── store.mjs           # Map în memorie + load/flush JSON atomic + GC 90 zile
    ├── validate.mjs        # nickname (whitelist regex), scores (finite, ≥0, ≤1e300), shape body
    └── rate-limit.mjs      # fixed window per IP, în memorie
```

`createApp({ dataFile, now?, rateLimits? })` — `now` injectabil (teste de rate-limit/GC fără timere reale), `dataFile` injectabil (teste pe director temporar). **Serverul NU importă nimic din `src/` al jocului și invers** — singurul contract comun e forma JSON a API-ului (documentată aici; duplicarea a 4 nume de câmp e acceptată deliberat, decuplare > DRY).

### 1.3 Modelul de date + persistență

```jsonc
// /data/leaderboard.json  (named volume `leaderboard_data`)
{
  "version": 1,
  "entries": [
    {
      "playerId": "b2f1…-uuid",
      "nickname": "Ink Wizard",          // forma afișată (exact cum a trimis-o)
      "nicknameLower": "ink wizard",     // cheia de unicitate case-insensitive
      "tokenHash": "sha256-hex",         // tokenul NU se stochează în clar
      "scores": {
        "lifetimeInspiration": 1.23e9,
        "tomesPublished": 14,
        "lifetimeQuillsEarned": 41,
        "fastestPublishMs": 843000       // sau null (niciun publish cronometrat încă)
      },
      "createdAt": 1780000000000,
      "updatedAt": 1780000600000
    }
  ]
}
```

- **Sursa de adevăr la runtime = Map-ul în memorie** (proces unic, fără concurență). Fișierul e snapshot.
- **Scriere atomică**: `writeFileSync('/data/leaderboard.json.tmp')` → `renameSync` peste fișierul final (rename în același director = atomic pe ext4/overlayfs). Flush: debounce — flag dirty + interval 2s; plus flush la SIGTERM/SIGINT. Pierdere maximă acceptată la kill -9: ultimele ~2s de update-uri (clienții retrimit oricum, A3/A4 fac operația idempotentă).
- **Tokenul**: 128-bit `crypto.randomBytes(16).toString('hex')` (32 hex), returnat O SINGURĂ DATĂ la claim; pe disc doar SHA-256; comparare cu `crypto.timingSafeEqual` pe hash-uri.
- **GC**: la pornire + la fiecare 6h, șterge intrările cu `updatedAt < now − LEADERBOARD_TTL_DAYS` (default 90; `0` = dezactivat) → eliberează nickname-urile orfane (09 §4.2.5).

### 1.4 Contractul API (EXACT — acesta e contractul comun client/server/E2E)

Toate rutele sunt servite CU prefixul `/api` (nginx și Vite pasează URI-ul neschimbat — fără rewrite). Toate răspunsurile: `Content-Type: application/json`, `Cache-Control: no-store`. Body-uri de request: `Content-Type: application/json`, max **4096 bytes** (peste → 422).

#### `POST /api/leaderboard/submit`

```jsonc
// Request body
{
  "nickname": "Ink Wizard",        // obligatoriu, 3–20 caractere, ^[A-Za-z0-9 _-]{3,20}$
  "token": "ab12…",                // opțional: absent = claim; prezent = update/rename
  "scores": {                      // obligatoriu, toate cele 4 chei
    "lifetimeInspiration": 1.2e9,  // number finit, ≥0, ≤1e300
    "tomesPublished": 14,          // idem + floor server-side la întreg
    "lifetimeQuillsEarned": 41,    // idem + floor
    "fastestPublishMs": 843000     // number finit ≥1 SAU null
  }
}
```

Semantica (în ordinea evaluării):
1. Payload invalid (JSON stricat, câmpuri lipsă/tipuri greșite, nickname în afara whitelist-ului, scoruri non-finite/negative/>1e300, body >4KB) → **422** `{ "error": "invalid_payload", "field": "nickname" }` (`field` = primul câmp vinovat, best-effort).
2. `token` prezent dar nu corespunde niciunei intrări → **401** `{ "error": "invalid_token" }`. Intrarea NU se modifică.
3. `token` absent și `nicknameLower` deja există → **409** `{ "error": "nickname_taken" }`.
4. `token` valid și `nickname` diferă de cel stocat → rename: dacă noul `nicknameLower` e luat de ALTĂ intrare → **409**; altfel se redenumește.
5. Succes → scorurile stocate devin **best(stocat, primit)** per metrică (max pe cele 3 descrescătoare, min-ignorând-null pe `fastestPublishMs`), `updatedAt = now`:

```jsonc
// 200 la CLAIM (prima revendicare)
{ "playerId": "uuid", "token": "32-hex — SINGURA dată când apare", "nickname": "Ink Wizard",
  "ranks": { "lifetimeInspiration": 3, "tomesPublished": 5, "lifetimeQuillsEarned": 4, "fastestPublishMs": null } }

// 200 la UPDATE (token valid) — identic, dar FĂRĂ câmpul token
{ "playerId": "uuid", "nickname": "Ink Wizard", "ranks": { …la fel… } }
```
`ranks` = poziția 1-based per clasament; `null` unde jucătorul nu are scor (fastestPublishMs null).

#### `GET /api/leaderboard/top?by=<metric>&limit=20&playerId=<uuid>`

- `by` ∈ `lifetimeInspiration | tomesPublished | lifetimeQuillsEarned | fastestPublishMs`; default `lifetimeInspiration`; valoare necunoscută → **422**.
- `limit` întreg 1–100, default 20; invalid → **422**.
- `playerId` opțional → câmpul `me`.
- Sortare: descrescător pe cele 3; **crescător** pe `fastestPublishMs` (intrările cu `null` sunt EXCLUSE din acel clasament). Tie-break determinist: `updatedAt` mai vechi primul, apoi `playerId` lexicografic.

```jsonc
// 200
{ "by": "tomesPublished", "total": 128, "generatedAt": 1780000700000,
  "entries": [ { "rank": 1, "playerId": "uuid", "nickname": "Ink Wizard", "value": 41 }, … ],
  "me": { "rank": 57, "value": 6 }    // doar dacă s-a cerut playerId; null dacă absent din clasament
}
```

#### `GET /api/health`

**200** `{ "ok": true, "entries": 128, "uptimeSec": 3600 }` — folosit de healthcheck-ul compose și de teste.

#### Transversal

- Orice altă rută/metodă → **404** `{ "error": "not_found" }` / **405** `{ "error": "method_not_allowed" }`.
- **429** `{ "error": "rate_limited", "retryAfterSec": 42 }` + header `Retry-After` când limita per IP e depășită.
- Erori interne → **500** `{ "error": "internal" }` (fără stack în răspuns; stack doar în stdout).

### 1.5 Validare, rate limiting, securitate

- **Nickname = whitelist, nu escaping**: regex `^[A-Za-z0-9 _-]{3,20}$` + `trim()` obligatoriu egal cu inputul (fără spații la capete) + minim un caracter alfanumeric. Nimic din afara whitelist-ului nu ajunge vreodată pe disc ⇒ XSS imposibil prin construcție (clientul React oricum randează ca text). Unicitate pe `toLowerCase()`.
- **Rate limiting în memorie** (`rate-limit.mjs`): fereastră fixă 60s per IP — `POST submit`: **10/min**; `GET top`: **60/min**; `GET health`: nelimitat. IP-ul = `X-Real-IP` setat de nginx (în producție DOAR nginx atinge api — portul nu e publicat), fallback `socket.remoteAddress` (dev/teste). Map-ul se curăță lazy (la fiecare cerere se aruncă ferestrele expirate; hard cap 10k chei).
- **CORS: inexistent deliberat.** Toate căile suportate sunt same-origin (nginx proxy în producție, Vite proxy în dev) ⇒ serverul NU emite niciun header CORS și browserul blochează orice alt origin. Deploy static + API pe alt domeniu = în afara scope-ului v2 (documentat în Riscuri).
- **Anti-cheat: nu există** (limitare acceptată în 09 §4.3). Plafoanele (1e300, best-keeping, rate limit) opresc doar gunoiul care ar strica randarea sau ar umple discul, nu trișarea.

### 1.6 Env vars server

| Var | Default | Rol |
|---|---|---|
| `PORT` | `3000` | portul intern (nu se publică pe host) |
| `LEADERBOARD_DATA_FILE` | `/data/leaderboard.json` | fișierul de persistență (named volume) |
| `LEADERBOARD_TTL_DAYS` | `90` | GC intrări inactive; `0` = off |
| `RATE_SUBMIT_PER_MIN` / `RATE_READ_PER_MIN` | `10` / `60` | limitele per IP |

---

## 2. Integrare: nginx, compose, dev, client

### 2.1 `nginx.conf` — MODIFICARE (un singur bloc nou)

```nginx
# În server {} , ÎNAINTE de "location /":
location /api/ {
    resolver 127.0.0.11 valid=10s ipv6=off;     # DNS-ul intern Docker, rezolvat LAZY
    set $api_upstream http://api:3000;          # variabilă => nginx pornește și FĂRĂ serviciul api
    proxy_pass $api_upstream;                   # URI-ul original se pasează neschimbat (fără rewrite)
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Host $host;
    proxy_connect_timeout 2s;
    proxy_read_timeout 5s;
    proxy_send_timeout 5s;
}
```

**De ce pattern-ul cu variabilă + resolver:** cu `proxy_pass http://api:3000;` literal, nginx rezolvă hostname-ul LA PORNIRE și moare în crash-loop dacă `api` nu există — ar rupe „jocul rămâne 100% funcțional fără API" chiar în stack-ul nostru (`docker compose up web` singur). Cu variabila, rezolvarea e la cerere: api absent → 502 în <2s → clientul intră curat în starea „unreachable". Acesta e un detaliu OBLIGATORIU, nu o preferință.

### 2.2 `docker-compose.yml` — lista FINALĂ de servicii

| Serviciu | Imagine | Port host | Profil | Schimbare v2 |
|---|---|---|---|---|
| `web` | build `.` (nginx) | 8080→80 | default | doar nginx.conf nou în imagine; FĂRĂ depends_on api (poate rula singur) |
| **`api`** | **build `./server`** | **NICIUNUL** (doar rețeaua compose) | **default** (pornește la `docker compose up` alături de web) | NOU |
| `dev` | node:22-bookworm-slim | 5173→5173 | dev | + `depends_on: [api]` (compose pornește api automat; api e în profilul default deci e eligibil) |
| `test-unit` | node:22-bookworm-slim | — | test | neschimbat (rulează și testele de server — §4.2) |
| `test-e2e` | playwright v1.49.1-noble | — | test | + `depends_on: api: condition: service_healthy` (pe lângă web healthy existent) |

Serviciul `api` (definiție de referință):

```yaml
  api:
    build: ./server
    restart: unless-stopped
    volumes:
      - leaderboard_data:/data
    environment:
      - LEADERBOARD_DATA_FILE=/data/leaderboard.json
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 5s
```

Volumes finale: `node_modules_dev`, `node_modules_test`, `node_modules_e2e` (v1, neschimbate) + **`leaderboard_data`** (NOU).

**Capcană de ownership (obligatoriu în server/Dockerfile):** named volume-ul montat la `/data` moștenește ownership-ul căii din imagine la PRIMA montare — deci Dockerfile-ul trebuie să facă `RUN mkdir -p /data && chown node:node /data` ÎNAINTE de `USER node`, altfel serverul (non-root) nu poate scrie și fiecare flush eșuează.

### 2.3 Dev: Vite proxy

`vite.config.ts` — adaugă:

```ts
server: {
  …existente…,
  proxy: { '/api': { target: process.env.API_PROXY_TARGET ?? 'http://api:3000', changeOrigin: false } },
},
```

În containerul `dev`, DNS-ul compose rezolvă `api` (pornit prin depends_on). Dacă api e totuși oprit, Vite loghează un proxy error în terminalul serverului (nu în consola browserului) și clientul primește 500 → starea „unreachable" — acceptat în dev.

### 2.4 Comenzile Docker actualizate (README v2)

```bash
docker compose up --build              # producție: web + api → http://localhost:8080 (leaderboard funcțional)
docker compose up --build web          # DOAR jocul static — API absent, panoul Hall of Fables în starea local-only/unreachable
docker compose --profile dev up dev    # dev cu hot reload (pornește și api) → http://localhost:5173
docker compose run --rm test-unit      # Vitest: unit engine + teste server (fără Docker pentru server — port efemer în proces)
docker compose run --rm --build test-e2e   # E2E pe stack-ul complet web+api (ambele healthy înainte de Playwright)
docker compose down                    # -v șterge și node_modules + leaderboard_data (ATENȚIE: -v = pierzi clasamentul)
```

### 2.5 Clientul: `src/ui/leaderboard-client.ts` (modul NOU, în ui — NU în engine)

Engine-ul rămâne 100% fără rețea. Modulul e un singleton creat în `main.tsx` cu `createLeaderboardClient(store, { apiBase, fetchFn?, now? })` (injectabil pentru teste).

- **Config build:** `VITE_API_URL` — absent/`''` → `'/api'` (same-origin, cazul compose); `'off'` → clientul e `disabled` permanent (build static pur, panoul afișează local-only); alt string → folosit ca bază (cross-origin NEsuportat fără CORS — documentat).
- **Stări expuse UI-ului** (mini-store cu `subscribe`, același pattern ca GameStore): `disabled | idle (fără identitate) | ready | unreachable`, plus `lastTop` (cache), `lastSyncAt`, `pendingClaim`.
- **Fetch:** `AbortController` cu timeout **4s** (GET) / **5s** (POST). Retry blând: un singur retry după 2s DOAR pe eșec de rețea (nu pe 4xx); refresh-ul de fundal în `unreachable` face backoff 30s→60s→120s→cap 300s. Trimiterile eșuate NU se retrimit agresiv: flag-ul dirty rămâne setat, următorul trigger reîncearcă. **Toate eșecurile sunt silențioase** — zero `console.error` (criteriul 6.2.6 din 09; fixture-ul E2E pică la orice eroare de consolă).
- **Identitatea** (abaterea A1): la claim reușit clientul face `store.dispatch({ type: 'setSettings', settings: { leaderboard: { playerId, token, nickname, lastSubmittedAt } } })` → `setSettings` e deja acțiune critică în v1 ⇒ save imediat, gratuit. Achievement-ul `nameInLights` se evaluează din prezența `meta.settings.leaderboard.token` (achievements rulează după fiecare dispatch — mecanism existent).
- **Triggere de submit** (abaterea A3): claim; creșterea `meta.tomesPublished` observată prin `store.subscribe` (decuplat — clientul nu atinge reducerul); interval 90s dacă dirty; `visibilitychange→hidden` dacă dirty cu `fetch(…, { keepalive: true })`; buton „Update now". Throttle: min 60s între trimiteri automate.
- **Cache-ul de clasament** (nesecret): cheia localStorage separată **`fable-idler-leaderboard-cache-v1`** `{ by, entries, generatedAt }` — pentru starea „unreachable + ultimul clasament văzut" (09 §4.3c). Identitatea NU mai stă aici (A1) — doar cache-ul.
- **Scorurile trimise** se citesc din `store.getState()`: `meta.stats.lifetimeInspiration`, `meta.tomesPublished`, `meta.stats.lifetimeQuillsEarned`, `meta.stats.fastestPublishMs`.

---

## 3. Engine v2

### 3.1 Extensii GameState — ce intră în save și unde

```ts
// types.ts — DELTA v2 (schiță de contract; nimic din v1 nu se redenumește)

export type GeneratorId = /* cele 7 v1 */ | 'mythEngine';

export type AtelierUpgradeId =
  | 'apprenticeMuse' | 'selfWritingContract' | 'strokeOfGenius' | 'blueprintOfMyths'
  | 'restlessHeart' | 'thunderousApplause' | 'nightOwlPact' | 'sparkcatchersNet'
  | 'secondBookmark' | 'editorsDue';

export type RelicId = 'dogEaredPage' | 'standingOvation' | 'inkThatRemembers' | 'readersLetter';

export type SparkRewardKind =
  | 'inkBurst' | 'quillFrenzy' | 'gossipBonanza' | 'timeSlip' | 'storyFragment' | 'goldenQuillDrop';

export interface Fable {                    // exact 09 §3.1
  n: number;
  title: string;
  publishedAt: number;
  runStats: { totalEarned: number; durationMs: number | null; quillsEarned: number } | null;
  gilded: boolean;
}

export interface RunState {                 // câmpuri NOI (restul v1 neschimbat)
  // …v1…
  startedAt: number;                        // epoch ms; 0 = necunoscut (rundă migrată din v1 — A5)
  sparkBuff: { kind: 'quillFrenzy' | 'gossipBonanza'; activeUntil: number } | null;
  buffActivationsThisRun: number;           // pt. Standing Ovation (prima activare/rundă)
  lastAutoBuyAt: number;                    // pt. Self-Writing Contract (max 1 muse/sec), epoch ms
}

export interface MetaState {                // câmpuri NOI
  // …v1… (goldenQuills devine SEMANTIC portofelul cheltuibil; numele nu se schimbă)
  atelier: Partial<Record<AtelierUpgradeId, number>>;  // id → nivel curent (1-based; absent = 0)
  storyFragments: number;                   // 0–4 (la 5 se leagă automat un quill și scade cu 5)
  fables: Fable[];                          // append-only
}

export interface MetaStats {                // câmpuri NOI
  // …v1…
  lifetimeQuillsEarned: number;             // MONOTON — baza bonusului +30% (regula de aur)
  sparksCaught: number;
  quillsFromFragments: number;              // pt. achievement pieceByPiece (adăugat de arhitect — testabil)
  fastestPublishMs: number | null;
}

export interface Settings {                 // câmp NOU (abaterea A1)
  // …v1…
  leaderboard?: { playerId: string; token: string; nickname: string; lastSubmittedAt: number };
}
```

**Relics NU se stochează** — `unlockedRelics(state)` se derivă din `meta.tomesPublished` (09 §1.4, imposibil de desincronizat).

**Starea EFEMERĂ a Spark-ului NU intră nici în save, nici în GameState** (decizie exactă): momentul următorului spawn, poziția/traiectoria sparkului în zbor și faptul că e pe ecran trăiesc EXCLUSIV în shell-ul UI — `src/ui/hooks/useStraySpark.ts` (timer `setTimeout` activ doar cu `document.visibilityState === 'visible'`, despawn la hidden, re-extragere interval la load). Motive: (1) anti-abuz 09 §2.3 — „nimic pending în save" prin construcție; (2) `tick()` rămâne pur și determinist (fără RNG); (3) refresh = spark pierdut, exact comportamentul cerut. Ce SUPRAVIEȚUIEȘTE în save e doar efectul deja acordat: `run.sparkBuff` (epoch ms absolut, expiră natural — același pattern ca buff-ul v1).

### 3.2 Acțiuni noi + canalul RNG shell→engine

```ts
export type Action =
  // …v1 neschimbate…
  | { type: 'click'; critRoll?: number }                    // EXTINS: UI pasează Math.random() ∈ [0,1)
  | { type: 'buyAtelierUpgrade'; id: AtelierUpgradeId }     // cheltuie portofelul, +1 nivel
  | { type: 'collectSpark'; kind: SparkRewardKind };        // kind ales în shell; magnitudinea în reducer
```

**Regula RNG (contract):** reducerul NU cheamă `Math.random()` niciodată. Tot nedeterminismul se extrage în shell și intră ca parametru:
- **Crit (Stroke of Genius):** UI face `r = Math.random()` și dispatch `{ type:'click', critRoll: r }`; reducerul aplică ×10 dacă `r < critChance(state)` (selector exportat — UI îl folosește pe ACELAȘI `r` pentru feedback-ul vizual, deci UI și engine sunt garantat de acord). `critRoll` absent = fără crit (dispatch-urile vechi/testele v1 rămân valide). Test: `critRoll: 0` → mereu crit; `0.999` → niciodată.
- **Spark:** shell-ul cheamă selectorul pur `rollSparkKind(rand01: number): SparkRewardKind` (praguri cumulative din config, unit-testabil pe granițe) și dispatch `{ type:'collectSpark', kind }`. Reducerul calculează DETERMINIST magnitudinea din starea CURENTĂ (inkBurst = `900 × perSecondNoBuff`, podea `50 × clickPower`; dublările Sparkcatcher's Net L2 — în reducer, nu în shell) + `stats.sparksCaught++` + fragmente→quill (portofel ȘI lifetime) la 5.
- **Auto-buy (Self-Writing Contract):** rulează ÎN `tick()` (pur — nu are RNG): dacă nivel ≥1, `now − run.lastAutoBuyAt ≥ 1000` și `costOf(wanderingMuse) ≤ 1% × inspiration` → cumpără 1 și setează `lastAutoBuyAt = now`.
- `buyAtelierUpgrade` și `collectSpark` intră în `isCriticalAction` (save imediat — quills/fragmente nu se pierd la close).
- `GameEvent` (game-loop) se extinde cu: `{ type:'relic'; id: RelicId }` (diff pe `unlockedRelics(prev)` vs `next`), `{ type:'fable'; fable: Fable }` (diff pe `meta.fables.length`), `{ type:'quillFromFragments' }` — pentru toast-uri; mecanismul `diffEvents` existent se extinde, nu se înlocuiește.

### 3.3 SaveDataV2 + migrarea v1→v2 (folosind `MIGRATIONS` existent din save.ts)

```ts
export const CURRENT_SAVE_VERSION = 2;               // era 1

export interface SaveDataV2 {
  version: 2;
  savedAt: number;
  run: RunState;    // forma v2
  meta: MetaState;  // forma v2
}

MIGRATIONS[1] = (old) => {/* v1 payload → v2 payload; câmp cu câmp mai jos */};
```

`MIGRATIONS[1]` — defaulturile EXACTE (aplicate pe payload-ul v1 deja parsat; `sanitizeSaveData` v2 validează după):

| Câmp nou | Valoare la migrare | Motiv |
|---|---|---|
| `meta.stats.lifetimeQuillsEarned` | `floor(max(0, meta.goldenQuills))` | **Regula de aur** — v1 nu cheltuia quills ⇒ sold ≡ total câștigat; nimeni nu pierde producție |
| `meta.stats.sparksCaught` | `0` | contor nou |
| `meta.stats.quillsFromFragments` | `0` | contor nou |
| `meta.stats.fastestPublishMs` | `null` | se populează de la primul publish v2 cronometrat |
| `meta.storyFragments` | `0` | — |
| `meta.atelier` | `{}` | niciun upgrade cumpărat |
| `meta.fables` | `tomesPublished` intrări **faded**: `{ n: i+1, title: generateFadedTitle(i+1), publishedAt: savedAt, runStats: null, gilded: false }` cu seed = DOAR indexul tomului (determinist, regenerabil identic) | veteranul v1 nu pornește raftul (nici bonusul +2%/fabulă) de la zero |
| `run.startedAt` | **`0`** (sentinel — abaterea A5) | prima publicare post-migrare NU intră în fastestPublish/durationMs |
| `run.sparkBuff` | `null` | — |
| `run.buffActivationsThisRun` | `0` | cel mult o Standing Ovation „bonus" pe runda migrată — inofensiv, o singură dată |
| `run.lastAutoBuyAt` | `0` | — |
| `run.generators.mythEngine` | `0` | generator nou |
| `meta.settings.leaderboard` | absent | opt-in, nu există identitate |

Reguli conexe:
- `sanitizeSaveData` acceptă DOAR `version === 2` după lanțul de migrări; `sanitizeRun`/`sanitizeMeta`/`sanitizeSettings` se extind cu câmpurile noi (fables validate element cu element: `n` întreg ≥1, `title` string nevid ≤120 caractere, dedup pe `n`; `atelier` clamp la nivelul maxim din config; `leaderboard` acceptat doar cu toate cele 4 câmpuri de tip corect, altfel se aruncă — identitatea invalidă nu blochează load-ul).
- Cheia rămâne `fable-idler-save-v1` (numele e istoric; versiunea stă ÎN payload — decizie v1, confirmată).
- Un save v2 citit de codul v1 → versiune necunoscută → fallback la stare inițială + backup în `:corrupt` (comportament deja testat în v1 — nu se atinge).
- Export/import: nicio schimbare de mecanism; payload-ul v2 (inclusiv `settings.leaderboard`) trece prin base64 round-trip existent.

### 3.4 `selectors.ts` — lanțul de multiplicatori EXTINS (ordinea finală; economia v2 confirmă cifrele, NU ordinea)

```
Per generator (03 §2 pașii 1–3, extins):
  1. bază × count
  2. × qty milestones (25/50/100 → ×2 fiecare)          [v1]
  3. × upgrade per-generator (Chorus / Gossip / Rhythm)  [v1]
  3½. × 5 dacă run.sparkBuff = gossipBonanza activ ȘI generatorul e tier 1–3
      (wanderingMuse / inkSprite / talkingRaven)         [NOU — v2]
  (mythEngine e generator normal la producție; gating-ul lui e doar de REVEAL: apare în shop
   numai dacă atelier.blueprintOfMyths ≥ 1 ȘI totalEarned ≥ revealAt — filtrare în selector de shop, nu în producție)

Global (pe sumă — 03 §2 pașii 5–8, extins):
  5. × Golden Inkwell (1.5)                              [v1]
  6. × (1 + achievementBonus × nAchievements)            [v1 — acum până la 24]
  6½a. × (1 + 0.02 × min(uniqueFableTitles, 25))         [NOU — Bookshelf]
  6½b. × (1 + 0.01 × tomesPublished)  DOAR dacă relicva inkThatRemembers e deblocată (tomes ≥ 15)   [NOU]
  7. × (1 + 0.30 × meta.stats.lifetimeQuillsEarned)      [SCHIMBAT — era meta.goldenQuills; REGULA DE AUR]
  8. × buff (Moment of Inspiration ×2)                   [v1]

Click (03 §3, extins):
  base = CLICK_BASE × nib × resonance(lifetimeQuillsEarned) × buff(×5) × quillFrenzy(×7 DOAR pe bază, ca buff-ul v1)
  echo = InkEcho 1% × effectiveProd (NEatins de frenzy/buff-click — regula v1)
  click = (base + echo) × critMult(×10 dacă critRoll < șansă — pe ÎNTREG, per 09 §1.2; fallback documentat: doar pe bază)
```

Alte selector-uri noi/modificate: `critChance(state)` (0/0.05/0.10), `offlineCapMs(state)` (= cap v1 + 12h dacă `nightOwlPact`), `offlineEfficiency(state)` (= v1 + 0.10 dacă relicva `readersLetter`), `buffDurationMs(state, run)` (×2 la prima activare/rundă cu `standingOvation`), `buffCooldownMs(state)` (90/75/60s după `restlessHeart`), `sparkIntervalRange(state)` ([150,330]s; [75,165]s cu Net L1), `unlockedRelics(state)`, `uniqueFableCount(meta)`, `atelierLevel(state, id)`, `canBuyAtelierUpgrade(state, id)`. **`quillMultiplier` citește `lifetimeQuillsEarned`** — acesta e singurul loc care implementează regula de aur; testul „producția nu scade la cheltuire" pică instant dacă cineva îl leagă înapoi de portofel.

### 3.5 Module engine NOI + responsabilități

| Fișier NOU | Conținut |
|---|---|
| `src/engine/atelier.ts` | `buyAtelierUpgrade(state, id)` (validare nivel/max/cost, scade DOAR `meta.goldenQuills`), `atelierLevel`, `unlockedRelics`, aplicarea Second Bookmark („cele mai ieftine K după costul din config" — determinist) și Apprentice Muse / Dog-Eared Page la construcția rundei noi |
| `src/engine/spark.ts` | tabelul cumulativ de ponderi, `rollSparkKind(rand01)`, `applySparkReward(state, kind, now)` (pur — chemat de reducer), dublările Net L2 |
| `src/engine/fables.ts` | `mulberry32(seed)`, `fableSeed(n, totalEarned, durationMs)` = hash întreg pe `(n, floor(totalEarned), floor(durationMs/1000))`, `generateFableTitle(seed)`, `generateFadedTitle(n)` (seed = doar n), `createFable(...)`, `uniqueFableCount` — tabelele de cuvinte stau în `config.ts` (append-only!) |

Prestige (`prestige.ts`) v2, în ordine: calculează quills (formula v1 + `editorsDue` +1) → incrementează portofel ȘI `lifetimeQuillsEarned` → `durationMs = startedAt > 0 ? now − startedAt : null` → actualizează `fastestPublishMs` (doar dacă `durationMs !== null`) → generează fabula (gilded la ≥5 quills) → construiește runda nouă: upgrade-uri păstrate de Second Bookmark, muzele Apprentice, `inspiration = totalEarned = 300` dacă `dogEaredPage` (ambele setate — invariantul `balance ≤ totalEarned` rămâne intact; milestones sub 300 se re-adaugă la primul `checkMilestones`, intenționat), `startedAt = now`, `sparkBuff = null`, `buffActivationsThisRun = 0`.

Milestones: `MilestoneRequirement` primește `{ kind: 'tomesPublished'; count: number }` pentru `theGildedDoor`/`theFirstSpine`/`wordTravelsFast` (se re-adaugă instant post-prestige — același mecanism ca `hallOfDeeds`); `aLightAtTheWindow` = `totalEarned 1000` (kind existent). Achievements: condiții noi pur-derivabile din stare — `sparksCaught`, `quillsFromFragments ≥ 1`, `fableCount`, `uniqueFableCount`, `generatorCount(mythEngine,1)` (kind existent), `atelierAny`, `atelierComplete`, `fastestPublishBelow(600000)`, `leaderboardJoined` (din `meta.settings.leaderboard?.token`).

---

## 4. Testare v2

### 4.1 Unit noi (Vitest, `tests/unit/`, doar `src/engine`)

| Fișier | Ce verifică (minimul obligatoriu) |
|---|---|
| `atelier.test.ts` | **REGULA DE AUR: pentru FIECARE upgrade de Atelier, `perSecondNoBuff` și `clickPower` după cumpărare ≥ înainte** (criteriul 6.2.2); costuri/nivele/refuz fără fonduri; portofelul scade, `lifetimeQuillsEarned` NU; Second Bookmark alege exact „cele mai ieftine K" pe cazuri cu egalitate; Apprentice Muse L3 → 30 muses la start (și milestone-ul qty:25 se acordă — comportament asumat, vezi Riscuri); editorsDue +1; relics derivate corect la praguri 3/7/15/30 |
| `spark.test.ts` | ponderile însumează 100; `rollSparkKind` pe granițele cumulative exacte; fiecare recompensă aplicată corect (inkBurst = 900×prod cu podea 50×clickPower; timeSlip resetează cooldown + pornește buff fără să consume activarea; fragmente 4+1 → quill în portofel ȘI lifetime + `quillsFromFragments`); dublările Net L2 per tip; `collectSpark` incrementă `sparksCaught`; recompensele de Inspiration intră în `totalEarned` |
| `fables.test.ts` | **determinism: seed fixat → titlu EXACT** (valori hardcodate în test — orice reordonare a tabelelor de cuvinte pică testul = garda append-only); `fableSeed` stabil la zecimale (floor); `generateFadedTitle(n)` stabil; `uniqueFableCount` cu duplicate; cap 25 în selector |
| `save-migration-v2.test.ts` | fixture JSON v1 REAL (copiat dintr-un save v1 de pe disc) → `MIGRATIONS[1]` → toate defaulturile din tabelul §3.3 câmp cu câmp; `lifetimeQuillsEarned == goldenQuills(v1)`; `fables.length == tomesPublished`; producția post-migrare ≥ producția v1 pe stare identică (criteriul 6.2.3); round-trip v2; v2 respins de validatorul cu țintă v1 |
| `selectors-v2.test.ts` | lanțul §3.4 cu valori calculate de mână (bookshelf cap 25, inkThatRemembers doar ≥15 tomuri, quillMult pe lifetime, gossipBonanza doar tiers 1–3, frenzy doar pe baza clickului, crit ×10 cu critRoll injectat); `offlineCapMs`/`offlineEfficiency` cu toate combinațiile (8/12/20/24h; 0.5/0.6/0.75/0.85) |
| extinderi în `tick.test.ts`, `prestige.test.ts`, `buff.test.ts`-echivalent | auto-buy: max 1/sec, prag 1%, nu golește punga; determinismul delta-time RĂMÂNE (10×100ms ≡ 1×1000ms cu auto-buy activ); prestige v2: fabulă generată, fastestPublish doar cu `startedAt>0`, Standing Ovation doar prima activare/rundă |

### 4.2 Testele serverului (NOU: `tests/server/leaderboard-api.test.ts` — Vitest, HTTP real)

Mecanism: `const { createApp } = await import('../../server/src/app.mjs')` (tipat prin `app.d.mts`); `app.listen(0)` → port efemer din `server.address().port` → hit-uri cu `fetch` real din Node 22; `dataFile` într-un director temporar per test; `now` injectat pentru rate-limit/GC. Config necesar: `vite.config.ts test.include` += `tests/server/**/*.test.ts`; `tsconfig.json include` += `tests/server`. Rulează în serviciul `test-unit` existent (Node pur, zero deps noi).

Acoperire obligatorie: claim → 200 cu token de 32 hex + rank; update cu token → 200 fără token în răspuns; token greșit → 401 și intrarea NEmodificată; nickname dublat (case-insensitive) → 409; rename cu token pe nickname liber → 200 / pe nickname luat → 409; 422 pe fiecare clasă de payload invalid (nickname ilegal, scor NaN/negativ/1e301, body >4KB); best-keeping (scor mai mic NU coboară intrarea; fastestPublish mai mare NU o înrăutățește); sortare + tie-break determinist pe toate cele 4 metrici; `fastestPublishMs=null` exclus din clasamentul lui; `me` cu playerId; rate limit → 429 cu `Retry-After` și reset după fereastră; persistență: flush → proces „nou" (`createApp` pe același dataFile) → datele identice; fișier corupt pe disc → server pornește gol fără crash (log warn).

### 4.3 E2E noi (Playwright, pe stack-ul compose complet) + păstrarea celor 11 verzi

Fixture-ul v1 (console errors → fail) se aplică NEMODIFICAT tuturor spec-urilor noi — el ESTE testul de „degradare fără erori de consolă".

| Spec NOU | Scenariu |
|---|---|
| `09-atelier.spec.ts` | `addInspiration(500k)` → prestige real prin UI → tab-ul Atelier apare (milestone `theGildedDoor`) → citește `per-second` → cumpără `apprenticeMuse` L1 (1 🪶, criteriul 6.2.1) → portofelul scade în UI, nivelul afișat, `per-second` NU a scăzut → prestige din nou → runda nouă pornește cu 5 muses |
| `10-leaderboard.spec.ts` | (a) flux real cu API-ul din compose: deschide Hall of Fables post-prestige → nickname → „Claim your place" → rândul propriu cu rank apare în <5s (criteriul 6.2.6); reload → identitatea persistă (e în save). (b) degradare: `page.route('**/api/**', route => route.abort())` → panoul arată starea „unreachable" + jocul complet funcțional + fixture-ul de consolă rămâne verde |
| `11-spark.spec.ts` | `forceSpark('inkBurst')` → elementul `data-testid="stray-spark"` apare → click → toast + Inspiration crescută cu suma așteptată; `forceSpark()` apoi `page.reload()` → sparkul NU reapare și nicio recompensă nu s-a acordat (criteriul 6.2.4, „refresh nu re-invocă") |
| `12-bookshelf.spec.ts` | prestige → tab Bookshelf (milestone `theFirstSpine`) cu EXACT 1 cotor, titlu nevid; al doilea prestige → 2 fabule + header „+4% production"; bonus vizibil în `per-second` |
| `13-migration.spec.ts` | `page.addInitScript` scrie sub `fable-idler-save-v1` un payload v1 REAL (fixture inline cu `goldenQuills: 3, tomesPublished: 3`) → load → fără erori, quills 3 în portofel, 3 fabule faded pe raft, producția include ×(1+0.30×3) |

Cele 11 E2E v1 rămân în suite și trebuie să treacă NEATINSE (modificările de UI v2 nu au voie să miște `data-testid`-urile v1 — listate în 02 §8.5). `test-e2e` capătă `depends_on` pe `api` healthy, deci scenariul (a) nu are nevoie de mock.

**Extensia `window.__FABLE_TEST__`** (contract pentru Agent UI + Agent E2E):

```ts
interface FableTestHook {
  // …v1 neschimbate: getState / dispatch / addInspiration / fastForward / saveNow…
  /** Spawnează IMEDIAT un Stray Spark (ocolește timerul și gate-ul de milestone; tab-ul tot
   *  trebuie să fie vizibil și sparkul tot se click-uiește). kind fixează recompensa
   *  determinist; absent = roll normal. */
  forceSpark(kind?: SparkRewardKind): void;
}
```

`fastForward` existent acoperă deja avansul de timp; NU se adaugă hook-uri pentru leaderboard (E2E-ul lui e prin UI real + `page.route`).

---

## 5. Structura de fișiere v2 — NOI vs MODIFICATE (harta de împărțire a muncii)

### Fișiere/foldere NOI

```
server/Dockerfile                     server/src/server.mjs        server/src/app.mjs
server/src/app.d.mts                  server/src/store.mjs         server/src/validate.mjs
server/src/rate-limit.mjs

src/engine/atelier.ts                 src/engine/spark.ts          src/engine/fables.ts

src/ui/leaderboard-client.ts          src/ui/hooks/useStraySpark.ts
src/ui/components/AtelierPanel.tsx|.css      (include Relics + contorul de fragmente)
src/ui/components/BookshelfPanel.tsx|.css
src/ui/components/HallOfFablesPanel.tsx|.css
src/ui/components/StraySpark.tsx|.css        (elementul zburător, data-testid="stray-spark")

tests/unit/atelier.test.ts            tests/unit/spark.test.ts     tests/unit/fables.test.ts
tests/unit/save-migration-v2.test.ts  tests/unit/selectors-v2.test.ts
tests/server/leaderboard-api.test.ts
tests/e2e/09-atelier.spec.ts … 13-migration.spec.ts

ai-memory/10-v2-architecture.md (acest doc); urmează 11-v2-economy-balance.md, 12-v2-ui-decisions.md
```

### Fișiere v1 MODIFICATE (lista EXACTĂ — nimic altceva)

| Fișier | Cine | Ce se schimbă |
|---|---|---|
| `docker-compose.yml` | DevOps | + serviciul `api`, volumul `leaderboard_data`, `depends_on` la `dev` și `test-e2e` (§2.2) |
| `nginx.conf` | DevOps | + blocul `location /api/` cu resolver+variabilă (§2.1) |
| `vite.config.ts` | DevOps | + `server.proxy['/api']`, `test.include` += `tests/server/**` (§2.3, §4.2) |
| `tsconfig.json` | DevOps | `include` += `tests/server` |
| `src/engine/config.ts` | Economie v2 (cifre) + Engine (structuri) | + mythEngine în `GENERATORS`, `ATELIER_UPGRADES`, `RELICS`, `SPARK` (ponderi/intervale/mărimi), tabelele de cuvinte fable (append-only), `BOOKSHELF_*`, milestones/achievements noi |
| `src/engine/types.ts` | Engine | delta din §3.1 + acțiunile §3.2 + condiții noi |
| `src/engine/state.ts` | Engine | factories cu câmpurile noi (`startedAt: now`, etc.) |
| `src/engine/save.ts` | Engine | `CURRENT_SAVE_VERSION = 2`, `SaveDataV2`, `MIGRATIONS[1]`, sanitizers extinși (§3.3) |
| `src/engine/selectors.ts` | Engine | lanțul §3.4 + selectorii noi |
| `src/engine/tick.ts` | Engine | auto-buy Self-Writing Contract (determinist) |
| `src/engine/prestige.ts` | Engine | fluxul v2 din §3.5 |
| `src/engine/buff.ts` | Engine | restlessHeart / standingOvation / thunderousApplause |
| `src/engine/offline.ts` | Engine | nightOwlPact (cap) + readersLetter (eficiență) prin selectorii noi |
| `src/engine/milestones.ts` | Engine | kind `tomesPublished` + cele 4 milestones |
| `src/engine/achievements.ts` | Engine | cele 10 condiții noi |
| `src/engine/game-loop.ts` | Engine | cazurile noi în `applyAction`, `isCriticalAction` extins, `GameEvent` extins |
| `src/engine/index.ts` | Engine | re-exporturi noi |
| `src/main.tsx` | UI | init `createLeaderboardClient(store, …)` + wiring visibilitychange submit |
| `src/ui/App.tsx` | UI | tab-urile/panourile noi + montarea StraySpark |
| `src/ui/test-hook.ts` | UI | `forceSpark` (§4.3) |
| `src/ui/meta.ts`, `src/ui/icons.ts`, `src/ui/components/TabBar.tsx`, `BottomNav.tsx` | UI | intrări pentru tab-urile noi (detaliile în 12-v2-ui-decisions) |
| `README.md` | DevOps | comenzile §2.4 + limitările (token pierdut, `down -v` șterge clasamentul) |

**NEmodificate (garanții):** `package.json`/`package-lock.json` (ZERO dependențe noi — nici client, nici server), `Dockerfile` (web), `playwright.config.ts`, `index.html`, toate spec-urile E2E v1, restul engine-ului (`generators.ts`, `format-numbers.ts` etc. rămân neatinse dacă nu apar în tabel; `generators.ts` NU se schimbă — mythEngine e doar date în config, gating-ul de reveal e în selectorul de shop).

---

## Ce s-a decis

- **Backend `api`: Node 22, zero dependențe** — `node:http` + persistență JSON cu scriere atomică (tmp + rename) într-un named volume `leaderboard_data`; token 128-bit stocat DOAR ca SHA-256; GC 90 zile; rate limit în memorie per IP (10 submit/min, 60 read/min); fără CORS (same-origin prin proxy, deliberat).
- **API în 3 rute**: `POST /api/leaderboard/submit` (claim/update/rename într-un singur endpoint; 200/401/409/422/429), `GET /api/leaderboard/top` (4 metrici, `me` cu playerId, tie-break determinist), `GET /api/health`. Serverul păstrează BEST per metrică (nu respinge regresii — A4).
- **Integrare**: nginx `location /api/` cu **resolver + variabilă** (web pornește și fără api); compose: `api` în profilul default, FĂRĂ port pe host; dev prin Vite proxy; `test-e2e` așteaptă api healthy.
- **Identitatea de leaderboard în `meta.settings.leaderboard`** (A1 — trece prin export/import); cache-ul de clasament (nesecret) în cheia separată `fable-idler-leaderboard-cache-v1`.
- **Engine**: atelier/fables/fragments/lifetimeQuills = meta; `startedAt`/`sparkBuff`/`buffActivationsThisRun`/`lastAutoBuyAt` = run; **starea efemeră a Spark-ului trăiește exclusiv în shell-ul UI** (nimic în save); tot RNG-ul intră în reducer ca parametru (`critRoll`, `kind`) — tick-ul rămâne pur.
- **SaveDataV2 + `MIGRATIONS[1]`** cu tabelul de defaulturi §3.3; `run.startedAt = 0` sentinel la migrare (A5); `CURRENT_SAVE_VERSION = 2`; cheia localStorage neschimbată.
- **Lanțul de multiplicatori v2** fixat (§3.4): gossipBonanza la pasul 3½ per-generator; Bookshelf + Ink That Remembers la 6½; pasul 7 pe `lifetimeQuillsEarned` (regula de aur în exact un selector).
- **Testare**: 6 fișiere unit noi + server testat cu HTTP real pe port efemer în Vitest (`tests/server/`, rulează în `test-unit` existent); 5 spec-uri E2E noi (atelier, leaderboard cu api real + degradare prin `page.route` abort, spark cu `forceSpark(kind?)`, bookshelf, migrare cu save v1 injectat); cele 11 E2E v1 rămân obligatoriu verzi.

## De ce

- Zero dependențe pe server: scara reală (sute de intrări) nu justifică nici DB, nici framework; host-ul fără Node face orice lockfile nou scump; imaginea rămâne minusculă și fără supply-chain. Testabilitatea nu suferă — `createApp` pe port efemer se testează cu `fetch` nativ.
- Resolver-ul lazy în nginx e diferența dintre „jocul se degradează grațios" și „nginx crash-loop când api lipsește" — cerința static-first a clientului se decide în acest detaliu.
- Identitatea în save (A1): un singur mecanism de persistență, migrare de browser gratuită prin export/import, `setSettings` era deja acțiune critică (save imediat) — costul e doar avertismentul la export (token în string), acceptat și documentat.
- Best-keeping pe server (A4) face submit-ul idempotent și elimină singurul mod în care o identitate se putea „bloca" (hard reset local).
- RNG extras în shell păstrează cel mai valoros invariant v1: reducer + tick determinist ⇒ toate mecanicile noi (crit, spark, auto-buy) sunt unit-testabile cu valori injectate, fără mock-uri de timp sau de random.
- Sentinela `startedAt = 0` (A5) e singura implementare care respectă simultan „migrare exactă" și „Fastest Publish corect".

## Fișiere

- **Creat:** `C:/Projects/Games/Fable Idler/ai-memory/10-v2-architecture.md` (acest document).
- **Modificat (doar notă de trimitere, permisă):** `C:/Projects/Games/Fable Idler/ai-memory/02-technical-architecture.md` — 2 rânduri care trimit la acest document pentru extensia v2.
- **Niciun fișier de cod creat/modificat** — conform sarcinii (arhitectură, nu implementare).

## Riscuri

1. **Tokenul în save-ul exportat** (consecința A1): cine își publică save-string-ul public își expune identitatea de leaderboard. Mitigare: textul de lângă Export („conține și cheia ta de leaderboard — nu-l posta public") + README; server-side nu există recuperare (fără email, prin design). Rest-risc acceptat.
2. **`docker compose down -v` șterge clasamentul** (named volume). De documentat în README cu litere mari; opțional post-v2: backup manual prin `docker cp`.
3. **Ownership-ul volumului `/data`**: fără `mkdir + chown node:node` în server/Dockerfile ÎNAINTE de `USER node`, serverul nu poate scrie și fiecare flush eșuează silențios-parțial. Primul test de persistență din §4.2 prinde asta doar local — testul E2E 10a pe stack-ul real e plasa de siguranță.
4. **Rate limit per IP în spatele proxy-ului**: serverul vede `X-Real-IP` doar dacă nginx îl setează (e în blocul §2.1); dacă cineva șterge header-ul, toate cererile par de la IP-ul containerului nginx → un singur bucket global. Simptom: 429 nejustificat la mai mulți jucători simultan.
5. **Apprentice Muse L3 acordă implicit milestone-ul `qty:wanderingMuse:25`** (30 > 25 la start de rundă) → ×2 pe muse din secunda 1. Comportament asumat aici; economia v2 (doc 11) trebuie să-l bage în simulare — dacă domină, butonul de ajustare e nivelul L3 (30→20), NU o excepție în engine.
6. **`uniqueFableCount` e O(n) per apel de selector** (~10 apeluri/sec prin perSecond). La sute de fabule e neglijabil; dacă profilarea arată altceva, memoizarea se face pe referința `meta.fables` (append-only ⇒ cache trivial) — NU schimbați structura de date.
7. **Cele 11 E2E v1 sunt fragile la schimbări de layout** (tab-uri noi, panouri noi la prestige). Regula: `data-testid`-urile v1 din 02 §8.5 nu se mută/redenumesc; spec-urile v1 nu se editează decât dacă pică din motive de layout demonstrate, cu aprobare de orchestrator.
8. **Deploy static + API pe alt origin NU merge** (fără CORS, prin decizie). Dacă clientul cere vreodată asta, se adaugă `ALLOWED_ORIGIN` pe server — schimbare izolată în `app.mjs`, dar e explicit în afara scope-ului v2.
9. **Coliziune de numerotare a documentelor**: 09 trimite la „10-v2-economy-balance.md" — acel document se va numi `11-v2-economy-balance.md` (nota din preambul). Orchestratorul să transmită corecția agenților următori.

## Ce trebuie să știe următorul agent

- **Agent economie v2 (`11-v2-economy-balance.md`):** cifrele tale intră EXCLUSIV în `src/engine/config.ts` (structurile din §5); ordinea multiplicatorilor din §3.4 e FIXĂ — calibrezi valorile, nu pozițiile; de tranșat prin simulare: critul pe întregul click vs doar pe bază (09 §1.2), Thunderous Applause pe `perSecondNoBuff` (propunerea mea — evită double-dip cu buff-ul abia activat), riscul #5 (Apprentice L3 + qty:25); invariante: Apprentice L1 = 1 🪶, runda 1 v1 neatinsă sub 1.000 totalEarned, venit spark ≤ ~20% din venitul de quills.
- **Agent engine v2:** contractele fixe = §3.1–§3.5 (tipuri, acțiuni, migrare câmp cu câmp, lanț selectors); NU chema `Math.random()` în reducer/tick — primești `critRoll`/`kind` ca parametri; `quillMultiplier` pe `lifetimeQuillsEarned` e regula de aur; `buyAtelierUpgrade`+`collectSpark` sunt acțiuni critice (save imediat); sanitizers extinși conform §3.3.
- **Agent server:** implementezi EXACT contractul §1.4 (formele JSON sunt verificate byte-cu-byte de testele §4.2); `createApp(deps)` cu `now`/`dataFile` injectabile e obligatoriu pentru teste; nu uita `chown /data` (riscul #3) și `timingSafeEqual` pe hash-uri.
- **Agent UI v2 (`12-v2-ui-decisions.md`):** `useStraySpark` deține timerul (vizibilitate!) și cheamă `rollSparkKind` + dispatch; folosește ACELAȘI `critRoll` pe care-l trimiți în dispatch pentru feedback-ul de crit; identitatea leaderboard vine/pleacă prin `setSettings`; panoul Hall of Fables consumă starea `leaderboard-client` (disabled/idle/ready/unreachable) — niciun fetch direct în componente; `data-testid`-uri noi minime: `stray-spark`, `tab-atelier`, `atelier-upgrade-<id>`, `relic-<id>`, `tab-bookshelf`, `fable-spine-<n>`, `tab-hall`, `leaderboard-nickname-input`, `leaderboard-claim`, `leaderboard-row-self`.
- **Agent teste v2:** §4.1–§4.3 e lista completă; fixture-ul de console errors se aplică și spec-urilor noi (el validează degradarea grațioasă); testul serverului NU pornește Docker — `app.listen(0)` în proces; fixture-ul de save v1 pentru migrare se ia dintr-un save REAL v1 (joacă 2 minute în build-ul v1 și exportă), nu construit de mână.
- **Agent DevOps/README:** §2.1–§2.4 sunt copy-paste-abile; invariantul Playwright pin (1.49.1 ↔ v1.49.1-noble) rămâne din v1; adaugă în README: token pierdut = intrare orfană 90 zile, `down -v` șterge clasamentul, avertismentul de export.

## Validări făcute

- Confruntat pe disc (branch `feature/v2-expansion`) TOATE contractele v1 invocate: `save.ts` (MIGRATIONS gol + `applyMigrations` în buclă v→v+1, cheia `fable-idler-save-v1`, sanitizers manuali, invariantul `balance ≤ totalEarned` — migrarea §3.3 se mulează exact pe mecanism), `types.ts` (Settings extensibil — `leaderboard` intră natural), `game-loop.ts` (`setSettings` E deja acțiune critică → decizia A1 primește save imediat gratuit; `diffEvents` extensibil), `selectors.ts` (lanțul v1 comentat explicit — pozițiile 3½/6½/7 din §3.4 sunt inserții, nu rescrieri), `state.ts`, `test-hook.ts` (API-ul v1 al hook-ului preluat neatins), `main.tsx` (punctul de init pentru leaderboard-client există), `config.ts` (GeneratorConfig acceptă mythEngine ca simplă intrare nouă).
- Verificat infrastructura reală: `docker-compose.yml` (4 servicii v1, named volumes — serviciul `api` respectă tiparul), `nginx.conf` (blocul `/api/` se inserează fără conflict cu `location /assets/` și SPA fallback), `vite.config.ts` (fără proxy azi — adăugarea e izolată), `package.json` (zero deps noi confirmat posibil: clientul folosește doar `fetch`/`AbortController`, serverul doar `node:*`).
- Verificat pattern-ul nginx resolver-variabilă: cu `proxy_pass` conținând variabilă, URI-ul original se pasează neschimbat (de aceea serverul servește rutele CU prefixul `/api`) și rezolvarea DNS e la cerere (web pornește fără api).
- Verificat că testele existente nu se invalidează: `tick.test.ts` (determinismul rămâne — auto-buy e funcție de `state` + `now`, fără RNG), `save.test.ts` (testul de „migrare stub" devine migrarea reală), cele 11 E2E (niciun `data-testid` v1 atins de plan).
- Aritmetică de sanity: 4 scoruri × 8 bytes × 10k jucători ≈ 2MB JSON — flush la 2s e ieftin; rate 10 submit/min/IP ≥ nevoia reală (max 1/60s per client prin throttle); token 128-bit = spațiu de căutare 2¹²⁸, hash-uit la rest.
- Niciun cod rulat/modificat — document de arhitectură; validarea executabilă începe cu agenții de implementare.
