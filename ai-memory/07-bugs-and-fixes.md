# 07 — Bugs & Fixes (Agent 8: Testing & QA, 2026-07-03)

## Verdict: ZERO bug-uri de aplicație găsite de E2E

Toate cele **11 teste E2E (8 spec-uri)** au trecut **din prima rulare** pe build-ul de producție servit de nginx, cu guard-ul de console errors activ în fiecare test. Nu a fost necesară nicio modificare în `src/`. Suita unitară a rămas neatinsă și verde (**147/147**).

Mai jos: (1) ce s-a verificat explicit, (2) capcane de infrastructură de test identificate și cum au fost evitate PRIN DESIGN în teste (nu bug-uri de aplicație, dar ar fi produs teste flaky/false-negative), (3) validarea guard-ului de fixture.

---

## 1. Ce s-a verificat (și a trecut)

- **Load curat**: zero `pageerror` / `console.error` în TOATE scenariile (guard automat în `tests/e2e/fixtures.ts` — pică testul la teardown dacă apare ceva). Inclusiv pe: load fresh, load cu save fabricat de 1h, reload, prestige complet, hard reset, import invalid.
- **Click economy exactă**: 1/click bază; ×2 după Sharpened Nib (delta măsurată exact prin hook, fără generatori ⇒ fără drift).
- **Producție idle reală**: soldul crește fără input în 2,5s după prima Wandering Muse; `+0.1/sec` afișat corect.
- **Unlock-uri progresive**: toast `milestone` la The First Spark; secțiunea Achievements (`tab-achievements`) apare după primul achievement; tab-ul Upgrades apare la exact 100 totalEarned; nimic vizibil prematur pe fresh save.
- **Persistență**: reload păstrează sold/generatori/upgrade-uri; fără modal offline sub 60s; fără pierdere de date.
- **Offline code-path REAL**: save scris în localStorage înainte de load (`addInitScript`, cheia importată din engine `SAVE_KEY`) → modal cu suma exactă prezisă de formula 03 §8 (6/s × 1h × 50% = 10.800 → „10.8K"), „at 50% efficiency", sold creditat la bootstrap („11.8K"), generatori restaurați.
- **Prestige complet**: preview +2 🪶 la 500k; checkbox-ul chiar blochează butonul final; overlay-ul prestigeFade apare și dispare; quills=2 (header + stare); run resetat câmp cu câmp (sold 0, totalEarned 0, generatori 0, upgrades {}); achievements păstrate + `publishedAuthor` nou; `tab-achievements` rămâne vizibil imediat după prestige (nota Agent 6 despre `hallOfDeeds` re-adăugat instant — confirmată în browser real).
- **Export/import/hard reset (bonus)**: export base64 valid; reset dublu cu tastat „RESET" (buton disabled la text greșit); cheia ștearsă; import invalid → eroare inline fără schimbare de stare; import valid → stare restaurată exact (1234 → „1.23K").

## 2. Capcane de infrastructură de test (evitate prin design, documentate pentru viitor)

| # | Capcană | Cum s-a evitat | Validare |
|---|---|---|---|
| 1 | **`formatNumber` face floor sub 1000** — după cumpărarea primei muse soldul e 0 și crește cu 0,1/s: display-ul rămâne „0" ~10s. Un assert pe textul din DOM ar fi fost fals-negativ sau ar fi cerut așteptări lungi. | Scenariul 02 face TOATE acțiunile pe UI-ul real (click-uri + buton buy), dar aserțiunea de creștere citește `run.inspiration` (float exact) prin `__FABLE_TEST__.getState()`. 02 §6.2 permite hook-ul; acțiunile rămân pure. | 02 trece în ~6s, delta măsurată 0,15–1,0 la 2,5s de idle |
| 2 | **Cardul de upgrade cumpărat DISPARE din DOM** până se deschide secțiunea colapsată „Purchased (N)" (design 04 §4.7) — un `toBeVisible` naiv pe `upgrade-sharpenedNib` după cumpărare ar fi picat degeaba. | Testul 03 assertează întâi `toHaveCount(0)`, apoi deschide `upgrades-purchased-toggle` și verifică cardul cu ✓. Comportament confirmat ca intenționat (raportul Agent UI: „testid-ul RĂMÂNE pe card" — adică pe cardul din secțiune, nu permanent în DOM). | 03 verde |
| 3 | **Cursa autosave-ului după hard reset**: `hardReset` șterge cheia și NU salvează imediat (decizia #7 Agent 5), dar autosave-ul de ~10s poate rescrie o stare proaspătă între click și citirea localStorage din test. | Testul 08 acceptă ambele stări legitime: cheie absentă SAU payload prezent dar pristin (`totalEarned=0`, `goldenQuills=0`). | 08 verde, fără flake la rulări repetate |
| 4 | **Toast-urile se auto-închid în 4s** și maxim 3 simultane — aserțiuni târzii sau pe al 4-lea toast ar fi flaky. | 04 assertează toastul „The First Spark" imediat după al 10-lea click (cele 3 toast-uri din acel moment încap simultan în limită). | 04 verde |
| 5 | **Cheia de save NU se hardcodează** (nota Agent 5). | `06`/`08` importă `SAVE_KEY` din `../../src/engine` — Playwright transpilează importul din `src` fără probleme (engine pur, fără DOM la import). | 06/08 verzi |
| 6 | **Favicon 404 ar fi otrăvit guard-ul de consolă** (browserele cer `/favicon.ico`; un 404 apare ca console error). | Verificat înainte de scris testele: nginx.conf are SPA fallback (`try_files … /index.html`) ⇒ răspuns 200, fără eroare de consolă. Nimic de făcut, doar confirmat. | toate spec-urile verzi cu guard activ |
| 7 | **Port 8080 ocupat de alt proiect** oprește serviciul `web` (raportat și de Agent UI la validarea lui). | Verificat `docker ps` înainte de rulare — 8080 era liber de data asta (proiectul vecin migrase pe 8081). Notat în 06-testing-strategy ca precondiție de rulare. | `web` healthy la ambele rulări |

## 3. Validarea guard-ului de consolă (test negativ, apoi șters)

Ca să nu livrez un guard care „trece" pentru că nu prinde nimic, am rulat un spec temporar (`99-fixture-guard-negative.spec.ts`) care emitea `console.error('fixture-guard-check: boom')` în pagină. Rezultat: testul a PICAT la teardown exact cu mesajul colectat (`Console/page errors were emitted during the test: console.error: fixture-guard-check: boom`) — guard-ul funcționează. Spec-ul a fost șters imediat după (nu face parte din suită; un test care pică intenționat ar bloca CI-ul).

## 4. Cum s-a validat totul la final

```
docker compose run --rm test-unit                → Test Files 12 passed (12) / Tests 147 passed (147)
docker compose run --rm --build test-e2e         → 11 passed (build web reconstruit, healthcheck, Playwright)
docker compose down                              → mediu curat (volumele node_modules păstrate, fără -v)
```

Nicio modificare în `src/`, nicio modificare în fișierele interzise (Dockerfile, compose, configs, package.json, tsconfig, playwright.config, vite.config, nginx.conf, index.html).

---

# Addendum Agent 9 — Quality Gate (2026-07-04)

Review adversarial pe findings-urile a 4 revieweri read-only (requirements / engine / UI / docs). Toate findings-urile au fost verificate pe cod înainte de orice fix; niciunul nu s-a dovedit fals. Mai jos: fiecare bug REPARAT, cu **cauză → fix → validare**.

## B1 (MAJOR, engine) — gap de timp >60s cu tab-ul deschis era aruncat, nu rutat prin offline

- **Cauză:** bucla din `game-loop.ts start()` trimitea dt-ul brut în `tick()`, iar `tick.ts` îl plafona la `MAX_TICK_DT_MS=60s` și PIERDEA restul. Contractul 02 §2.2 promitea rutarea prin ramura de offline. Efect: laptop în sleep 8h cu tab-ul deschis → 60s de producție în loc de 8h×50%, fără modal, iar autosave-ul suprascria save-ul bun cu starea trunchiată (pierdere ~×240 față de închiderea tabului).
- **Fix:** în callback-ul intervalului, `gap > MAX_TICK_DT_MS` → `computeOfflineReport(state, state.lastTickAt, t)` + `applyOfflineReport` (ACEEAȘI ramură ca la bootstrap: eficiență 50/75%, plafon 8/12h, statistici Night Shift/Lucid Dreaming), `save()` imediat și un nou eveniment `{ type:'offline', report }` în `GameEvent`. `App.tsx` ascultă evenimentul și arată modalul „While you were away" cu același prag UI (≥60s, gained>0, `OFFLINE_MODAL_UI_MIN_MS` din `ui/meta.ts`).
- **Validare:** 4 teste noi în `tests/unit/game-loop.test.ts` (fake timers + `now` injectat): gap 2h → creditare exactă 36.000 la 10/s (nu 600), event `offline` unic cu elapsedMs/efficiency corecte, persist imediat în storage, plafon 8h la gap 24h, dt normal ≤60s neafectat (integrare 100%, zero evenimente offline). Suite: 156/156 unit, 11/11 E2E.

## B2 (MAJOR, UI) — textarea Export se regenera ~10×/s; fallback-ul Copy raporta fals succes

- **Cauză:** `SettingsPanel.tsx` folosea `useMemo(() => exportSave(state, Date.now()), [state])`, iar `state` primește referință nouă la fiecare tick (~10×/s) → serialize+base64 continuu, valoarea textarea-ului se schimba sub selecție → copierea manuală imposibilă. În plus, fallback-ul `handleCopy` afișa „Copied ✓" fără să copieze nimic când `navigator.clipboard` lipsește (context nesecurizat, ex. http pe LAN).
- **Fix:** stringul de export e ÎNGHEȚAT la deschiderea panoului (`useState(() => exportSave(store.getState(), Date.now()))`); fallback-ul face select pe textarea + `document.execCommand('copy')` și afișează „Copied ✓" DOAR la succes real, altfel „Copy failed — select the text manually". Timeout-ul de 2s e ținut în ref și curățat la unmount/click repetat.
- **Validare:** E2E 08 (export→reset→import) verde pe build-ul de producție; verificare vizuală manuală a panoului. 11/11 E2E.

## B3 (minor, engine) — sanitizarea importului accepta stări pe care engine-ul nu le poate produce

- **Cauză:** `sanitizeMeta`/`sanitizeRun` din `save.ts` nu deduplic au `achievements`/`milestones` (duplicate → `achievementMultiplier` umflat permanent, „1000/14" în UI, chei React duplicate) și nu plafonau `buff.activeUntil/cooldownUntil` față de `savedAt` (activeUntil=9e15 → buff ×2/×5 PERMANENT). `inspiration > totalEarned` era acceptat (invariant imposibil în joc).
- **Fix:** dedupe prin `[...new Set(...)]` la ambele array-uri; clamp `activeUntil ≤ savedAt + BUFF.durationUpgradedMs` și `cooldownUntil ≤ savedAt + BUFF.cooldownMs`; invariantul balance≤totalEarned reparat prin RIDICAREA totalEarned (nu prin distrugerea soldului — o migrare legacy poate ști doar soldul; decizie luată după ce clamp-ul pe inspiration a picat testul mecanismului de migrare).
- **Validare:** 5 teste noi în `save.test.ts` (dedupe achievements, dedupe milestones, clamp buff ostil, buff legitim netouchat, reparare invariant). Round-trip-urile existente rămân bit-identice. 156/156.

## B4 (minor, UI) — potop de toast-uri la importul unui save avansat

- **Cauză:** `dispatch({type:'importSave'})` înlocuiește starea; `diffEvents` vedea toate milestone-urile/achievements-urile ca „noi" → ~40 evenimente → minute de toast-uri în coadă.
- **Fix:** `setState(next, silent)` în `game-loop.ts` — pentru `importSave` evenimentele de unlock sunt suprimate (re-hidratare, nu unlock).
- **Validare:** test unit nou (import save avansat → 0 evenimente, stare corect înlocuită). 156/156.

## B5 (minor, UI) — focus trap evadabil + modale fără nume accesibil

- **Cauză:** în `Modal.tsx`, Tab-ul înainte era interceptat doar când `active === last`; după închiderea unui dialog înlănțuit (Hard reset), focusul cădea pe `body` și Tab ieșea SUB modal. `role=dialog` fără `aria-labelledby` → screen readerele anunțau doar „dialog".
- **Fix:** Tab înainte e recapturat și când `!panel.contains(active)` (simetric cu shift+Tab); `useId()` pe `h2.modal-title` + `aria-labelledby` pe panou.
- **Validare:** typecheck + E2E (toate fluxurile cu modale: settings, reset dublu, offline, prestige) verzi.

## B6 (minor, UI) — pattern de tabs incomplet + aria-controls către id-uri inexistente

- **Cauză:** `TabBar.tsx` nu avea roving tabindex și nici navigare cu săgeți; `aria-controls` era pus pe TOATE taburile deși App randează un singur tabpanel (id-uri inexistente = eroare de validare ARIA).
- **Fix:** `tabIndex={activ ? 0 : -1}`, handler ArrowLeft/ArrowRight/Home/End (mută selecția + focusul), `aria-controls` doar pe tabul selectat.
- **Validare:** typecheck + E2E 03/04 (interacțiune pe taburi) verzi.

## B7 (minor, UI) — timere necurățate la unmount + side effect în state updater

- **Cauză:** `ClickButton` (staticTimer 500ms, reduced motion), `Tooltip` (show 150ms) și `SettingsPanel` (Copied 2s) nu curățau timeout-urile la unmount → setState după unmount; `App.finishPrestige` apela `pushToast` ÎN updater-ul `setPrestigeFx` → toast dublat în dev (StrictMode invocă updater-ele de 2×).
- **Fix:** cleanup `useEffect(() => () => clearTimeout(...), [])` în toate 3; quills-ul de prestige mutat într-un ref, `pushToast` scos din updater.
- **Validare:** typecheck + 11/11 E2E (inclusiv 07-prestige cu overlay + toast).

## B8 (cosmetic, UI) — „Earned this run" rupt pe 2 rânduri pe tabletă (observația orchestratorului — CONFIRMATĂ)

- **Cauză:** coloana stângă de tabletă are 300px; după padding-uri și gap-uri rămân ~70px/item în `StatsStrip`, iar eticheta de ~85-90px se rupea și strica alinierea verticală a celor 3 statistici.
- **Fix:** eticheta scurtată la „This run" + `white-space: nowrap` pe `dt` (garanție că nicio etichetă nu se mai rupe).
- **Validare:** screenshot regenerat `test-results/shot-tablet-progressed.png` — cele 3 etichete+valori pe un singur rând, aliniate.

## B9 (cosmetic, UI) — floatUp pierdea centrarea translateX(-50%)

- **Cauză:** proprietatea `transform` din keyframes ÎNLOCUIEȘTE transform-ul de bază, deci `+X`-urile pluteau decalate la dreapta cu jumătate din lățimea textului pe toată durata animației.
- **Fix:** `translate(-50%, …)` inclus în ambele keyframe-uri din `animations.css`.
- **Validare:** vizual + E2E 01/02 (floating numbers) verzi.

## B10 (cosmetic, engine/docs) — constanta moartă `OFFLINE_MODAL_MIN_MS` ștearsă

- **Cauză:** exportată din `config.ts` cu un comentariu care contrazicea comportamentul real (modalul apare la 60s prin `OFFLINE_MODAL_UI_MIN_MS` din `ui/meta.ts`, decizie 04 §4.11); zero consumatori.
- **Fix:** constanta + re-exportul din `index.ts` șterse; comentariul de la `MAX_TICK_DT_MS` trimite acum explicit la `ui/meta.ts`.
- **Validare:** `tsc --noEmit` curat (ar fi prins orice consumator uitat).

## B11 (docs) — corecturi de documentație

- `06-testing-strategy.md`: „10 teste E2E" → **11** (3 locuri; contrazicea propriul tabel §1.2 și 07); numerele unit actualizate 147→156 după testele noi.
- `01-game-design.md`: notă de calibrare în antet (cifrele finale sunt în 03/config.ts: +30%/quill, Quill Resonance 2.500) — cerință a lui 03 §13 rămasă neexecutată.
- `README.md`: `tools/screenshots.mjs` adăugat în Project structure; numerele de teste actualizate; secțiunea Offline progress menționează acum și gap-ul cu tab-ul deschis.
- `.dockerignore`: `tools/` exclus din build context (nu afecta imaginea finală, doar cache-ul de build).
- `dist/` rezidual șters de pe host (README afirmă corect „no build output on the host").
- Capturile de QA vizual regenerate: `test-results/shot-{desktop,tablet,mobile}-{fresh,progressed}.png`.

## Findings REALE dar NEREPARATE (limitări acceptate, cu motivare)

| Finding | Severitate | De ce nu s-a reparat |
|---|---|---|
| Tick-ul care conține activarea buffului creditează ×2 și porțiunea de dinaintea activării | cosmetic | supra-creditare ≤1 tick (~100ms) per activare, ≤0,2% dintr-o fereastră de buff; fix-ul ar complica invariantul de determinism din `tick.ts` pentru un câștig nemăsurabil |
| Dead code: `ToastKind 'unlock'` + CSS-ul lui, `.anim-pressable.is-pressed`, `memo` inutil pe `GeneratorRow` | cosmetic | zero efect funcțional; curățare recomandată la următorul refactor, riscul de a atinge cod stabil chiar înainte de predare nu se justifică |
| Fereastra tranzitorie pe tabletă: achievements deblocate la primul click, dar tabul Fable apare abia la 10 totalEarned | cosmetic | durează <10s de click-uri, se auto-rezolvă; fix-ul (schimbarea condiției `showCenter`/`solo`) riscă regresii de layout pe toate cele 3 breakpoint-uri |
| Restaurarea focusului în lanțul de dialoguri Hard reset poate ateriza pe `body` | minor (parțial reparat) | evadarea din trap e REPARATĂ (B5) — focusul e recapturat la primul Tab; restaurarea „perfectă" pe butonul inițiator ar cere un mecanism de restore per lanț de dialoguri, cost/beneficiu slab |
| Secțiunile standard de memorie nu apar cu titluri literale în 00/05/06/07 | cosmetic | conținutul există integral sub headinguri echivalente; maparea e documentată în 08 §7 |

## Validarea finală (după toate fix-urile)

```
docker compose run --rm test-unit  (cu tsc --noEmit)  → Test Files 13 passed (13) / Tests 156 passed (156)
docker compose up --build -d web                      → web healthy; HTTP 200 pe / și pe /assets/index-*.js
docker compose run --rm test-e2e                      → 11 passed (10.4s) — pe imaginea RECONSTRUITĂ
tools/screenshots.mjs (în containerul test-e2e)       → 6 capturi noi în test-results/
```

---

# Addendum Agent 8 v2 — E2E pentru Atelier / Hall / Spark / Bookshelf / migrare (2026-07-04)

## Verdict: ZERO bug-uri de aplicație găsite de E2E v2

Toate cele **17 teste E2E (13 spec-uri: 11 teste v1 + 6 noi)** trec pe stack-ul compose COMPLET (web reconstruit cu `--build` + api healthy), cu guard-ul de console errors activ în fiecare test. **Nicio modificare în `src/`**. Suita unit+server neatinsă și verde (**297/297**).

## 1. Reparații LEGITIME la spec-urile v1 (regresii de spec, nu de produs — anunțate de Agentul UI v2 în 05)

| # | Spec | Problema | Fix |
|---|---|---|---|
| 1 | `04-unlocks.spec.ts` | asertul hardcodat „1/14" — engine-ul v2 are **24** achievements (verificat în `config.ts`: 24 intrări în `ACHIEVEMENTS`), iar header-ul UI e dinamic (`{unlocked}/{ACHIEVEMENTS.length}`) | asert DINAMIC: importă `ACHIEVEMENTS` din `../../src/engine` și verifică `1/${ACHIEVEMENTS.length}` — nu se mai rupe la următoarea extindere |
| 2 | `fixtures.ts` | la scenariile care taie API-ul (route.abort / api oprit / răspuns 409), **Chromium însuși** loghează `Failed to load resource: …` ca console error — nesuprimabil din JS; aplicația emite zero `console.*` (verificat de Agentul UI). Guard-ul v1 număra ORICE console.error ⇒ fals-pozitiv | filtrul `isBrowserApiResourceFailure(text, url)`: ignoră DOAR mesajele care încep cu `Failed to load resource` ȘI a căror `msg.location().url` conține `/api/`. Orice alt console.error (inclusiv failed-resource pe non-API) pică testul în continuare |

## 2. Ce au verificat spec-urile noi (toate verzi)

- **09-atelier**: flux 100% prin UI — publish real la 500k (+2 🪶) → tab-atelier apare → Apprentice Muse cumpărată cu 1 🪶 fără dialog (< pragul 10) → **purse 2→1, lifetime imobil la 2** (regula de aur vizibilă și în stare: `goldenQuills=1`, `lifetimeQuillsEarned=2`), producția NU scade (assert `perSecond(after) ≥ perSecond(before)` cu selectorul real al engine-ului + textul `per-second` egal cu `+formatRate(rate)/sec`); 4 sloturi relics locked cu progres „1/3 tomes"; al 2-lea publish → runda nouă pornește cu **5 Wandering Muses**, atelier-ul supraviețuiește resetului.
- **10-leaderboard**: (a) pe API-ul REAL din compose: nickname rezervat în prealabil printr-un POST direct (alt „jucător") → claim-ul UI pe același nume → **eroare inline 409** („already inked"), input păstrat, panel rămâne `opt-in`; claim pe nume liber → `data-state=active`, rândul propriu în tabel, identitatea în `meta.settings.leaderboard` + achievement `nameInLights`; **reload → direct active** (identitatea e în save). (b) degradare: `page.route('**/api/**', abort)` + identitate injectată → `data-state=offline` + badge-ul courier, jocul complet funcțional (click-urile cresc starea), consola curată prin filtrul de la §1.2.
- **11-spark**: `forceSpark('inkBurst')` după milestone-ul `aLightAtTheWindow` → `stray-spark` vizibil → **`dispatchEvent('pointerdown')`** (nu click — elementul zboară) → toast `data-toast-kind=spark` cu „+50 Inspiration" (floor-ul 50×click value la producție 0 — cifră EXACTĂ: 1000→1050) + `sparksCaught=1`; un al 2-lea spark NEprins + reload → **nu re-apare, nu acordă nimic** (1050 neschimbat).
- **12-bookshelf**: publish prin UI → toast `fable` + `bookshelf-panel` cu EXACT `fable-spine-1` (nefaded, runStats reale) + tooltip (titlu + „Tome #1" + „Earned"); al 2-lea publish → 2 cotoare + header `2 fables · +{unique×2}% production` (procentul calculat din titlurile UNICE din stare — un „reprint" legitim contează o dată).
- **13-migration**: save v1 REAL (schema exactă v1: version:1 + run/meta complete) injectat cu `addInitScript` sub `SAVE_KEY`, `goldenQuills:3, tomesPublished:3` → load fără erori: **portofel 3 ȘI lifetime 3** (regula de aur), 3 fabule FADED cu titluri = `generateFadedTitle(n)` (regenerabile, deterministe), achievements păstrate, `fastestPublishMs:null`; producția include EXACT ×1.9 (raport `perSecond(state)/perSecond(state cu lifetime=0)` = 1+0.30×3, calculat cu selectorul real); UI: chip 3 🪶, raft cu 3 cotoare `data-faded`, Atelier purse/lifetime 3/3; fără modal offline sub 60s.

## 3. Capcane de infrastructură de test v2 (evitate prin design; nu sunt bug-uri de aplicație)

| # | Capcană | Cum s-a evitat |
|---|---|---|
| 1 | **Prima cumpărătură din Atelier urcă producția** (+1% prin achievement-ul `patronOfTheArts`) — un assert de egalitate exactă pe `perSecond` înainte/după pica legitim | invariantul corect e „NU scade": `expect(rateAfter).toBeGreaterThanOrEqual(rateBefore)` + textul afișat egal cu valoarea engine-ului de DUPĂ |
| 2 | **Coada de toast-uri** (max 3 vizibile, 4s fiecare): `addInspiration(500k)` împinge ~12 toast-uri de milestones/achievements; toastul `fable` al publish-ului ar fi apărut abia la ~25s — dincolo de orice timeout rezonabil | spec-urile 11/12 GOLESC coada întâi (`toHaveCount(0)`, timeout generos) și abia apoi declanșează evenimentul de verificat; `test.slow()` pe ambele (nota din 05 §E2E #4 confirmată în practică) |
| 3 | **Post-prestige coloanele dispar** până se re-ating milestone-urile rundei (comportament v1 intenționat) | `addInspiration(100k)` imediat după publish (nota 05 §E2E #5); milestone-urile pe tomes (Gilded Door / First Spine / Word Travels Fast) se re-adaugă singure la primul check |
| 4 | **Volumul `leaderboard_data` PERSISTĂ între rulări** — nickname-urile vechi rămân rezervate | nickname-uri unice per încercare (`taken-`/`e2e-` + timestamp base36); 409-ul se testează REZERVÂND întâi numele printr-un POST direct în același test (nu între teste — retry-urile ar fi rupt orice partajare) |
| 5 | **`data-state=offline` cere identitate** (fără identitate panoul stă în `opt-in` și nu face niciun GET) | scenariul de degradare injectează prin hook exact forma pe care ar fi salvat-o un claim reușit (`setSettings.leaderboard`), apoi taie rețeaua |
| 6 | **Sparkul e în zbor 10s** — `click()` pe element instabil e flaky | `dispatchEvent('pointerdown')` (handlerul real al componentei; nota 05 §E2E #3) |

## 4. Validarea finală v2

```
docker compose run --rm --build test-e2e   → 17 passed (40.3s) — web RECONSTRUIT + api healthy
docker compose run --rm test-unit          → Test Files 19 passed (19) / Tests 297 passed (297)
docker compose down && docker compose up -d web api   → ambele healthy la final (stack lăsat pornit)
```
