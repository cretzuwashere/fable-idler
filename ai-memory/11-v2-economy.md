# 11 — V2 Economy & Balance (Agent 2 v2: Economy & Balance, 2026-07-04)

> Cifrele de aici sunt **FINALE și gata de copiat în config** — relația cu `09-v2-game-design.md` e identică relației 01↔03 din v1: structura, numele și id-urile vin din 09 și NU se schimbă; cifrele calibrate aici **suprascriu** valorile inițiale din 09 acolo unde diferă, marcate cu **[DECIZIE DE CALIBRARE]** și justificate cu date din simulare (§8). Simulatorul: `tools/economy-sim-v2.mjs` (nou; `tools/economy-sim.mjs` v1 rămâne neatins), rulat prin `docker run --rm -v "C:\Projects\Games\Fable Idler\tools:/w" node:22-alpine node /w/economy-sim-v2.mjs` — host fără Node, ca în v1.

---

## 1. Regula de aur + migrarea save v1 → v2 (cifre exacte)

### 1.1 Reancorarea bonusului (09 §1.1 — confirmată numeric)

```ts
quillMult = 1 + 0.30 * meta.stats.lifetimeQuillsEarned   // QUILL_BONUS rămâne 0.30, NESCHIMBAT
// Quill Resonance (click) folosește ACELAȘI lifetimeQuillsEarned.
// meta.goldenQuills = portofelul; NU apare în NICIO formulă de producție/click.
```

**Invariantul de compatibilitate (b) — verificat prin simulare (RUN A + RUN B):** simulatorul v2 cu toate flag-urile v2 dezactivate reproduce **EXACT** cifrele v1 din 03 §9 (24m23s / 16m49s / 11m45s, prod finală 721.6/s, 7 achievements), iar rularea aceleiași runde cu bonusul citit din `lifetimeQuillsEarned` (portofel cheltuit sau nu) dă timpi identici țintă cu țintă. Structural: portofelul nu e input nicăieri → **cheltuirea nu poate scădea producția** (testul unit din criteriul 09 §6.2.2 e garantat prin construcție + verificat).

### 1.2 Migrarea v1 → v2 — DECIS

`CURRENT_SAVE_VERSION 1 → 2`, `MIGRATIONS[1]` (mecanismul existent din `save.ts`):

| Câmp | Valoare la migrare | Justificare |
|---|---|---|
| `meta.stats.lifetimeQuillsEarned` | **= `meta.goldenQuills` (v1)** | **Exactă, nu aproximare:** v1 nu avea NICIUN sink de quills ⇒ soldul ≡ totalul câștigat vreodată. Producția post-migrare e identică termen cu termen (invariantul (b)). Alternativa (reconstruire din istoric per-publish) e imposibilă — v1 nu stochează câștigul per publish. |
| `meta.goldenQuills` | neatins | devine portofel cheltuibil, integral disponibil în Atelier din prima secundă v2 |
| `meta.storyFragments` | 0 | contor nou; **persistă prin prestige** (meta) |
| `meta.stats.sparksCaught` | 0 | contor nou |
| `meta.stats.fastestPublishMs` | `null` | se populează de la primul Publish post-v2 (`run.startedAt` nou = `savedAt` la migrare) |
| `meta.atelier` | `{}` | nimic cumpărat |
| `meta.fables` | `tomesPublished` intrări faded (`runStats: null`) | titlurile faded **CONTEAZĂ** la bonusul Bookshelf (+2%/titlu unic, cap 25) — un veteran cu 10 tomuri pornește cu **+20% producție** |

**Invariant nou de sanitizare (pentru arhitect, în `sanitizeMeta`):** `goldenQuills ≤ lifetimeQuillsEarned` — repară payload-uri ostile ridicând `lifetimeQuillsEarned = max(lifetimeQuillsEarned, goldenQuills)` (portofelul nu poate depăși totalul câștigat; același stil de reparație ca `totalEarned = max(totalEarned, inspiration)` existent).

**Producția post-migrare ≥ producția v1 la stare identică** (criteriul 09 §6.2.3): egalitate pentru jucătorul cu 0 tomuri; strict mai mare pentru veterani (fabule faded + relics derivate din `tomesPublished` ≥ 3). Nimeni nu pierde nimic; unii primesc cadouri retroactive — direcția corectă pentru un update.

---

## 2. The Gilded Atelier — costuri și efecte FINALE

Cost total la nivel maxim: **92 🪶** (nota: 09 §1.2 afirmă „96" dar suma corectă a propriului tabel e 92 — corectat aici, tabelul rămâne sursa). Toate permanente (metaState), cheltuiesc DOAR portofelul.

| # | Upgrade | ID | Cost 🪶 per nivel | Efect exact (numeric) |
|---|---|---|---|---|
| 1 | Apprentice Muse | `apprenticeMuse` | **1 / 3 / 8** | Începi fiecare rundă cu **5 / 15 / 30** Wandering Muses (gratuite, nu intră în `totalEarned`) |
| 2 | Self-Writing Contract | `selfWritingContract` | **4** | Auto-buy 1 Wandering Muse / sec când `cost ≤ 1% × inspiration` (QoL; impact de viteză ~0 în simulare — cumpărătorul greedy o făcea oricum manual) |
| 3 | Stroke of Genius | `strokeOfGenius` | **2 / 6** | **5% / 10%** șansă crit **×10** pe **ÎNTREGUL click, inclusiv partea Ink Echo** — decizie tranșată în RUN F (§8): diferența whole-click vs base-only = 0.0% pe timpul rundei, click share 3.2% vs 2.5%; fallback-ul din 09 nu e necesar |
| 4 | Blueprint of Myths | `blueprintOfMyths` | **12** | Deblochează generatorul 8 **Myth Engine** (§3) |
| 5 | Restless Heart | `restlessHeart` | **3 / 7** | Cooldown Moment of Inspiration **90s → 75s → 60s** (uptime bază 16.7% → 20% → 25%; cu Burst of Genius 22.5/60 = 37.5%) |
| 6 | Thunderous Applause | `thunderousApplause` | **4** | La activarea buffului: instant **20 × effectiveProd** (producția **FĂRĂ** buff-ul abia pornit — snapshot pre-activare, fără dublă numărare). **[DECIZIE DE CALIBRARE] 60s → 20s:** 60s/activare la cooldown 90s = +55–67% venit susținut pentru jucătorul activ — mai puternic decât buff-ul însuși (+17%); 20s ≈ dublează valoarea unei activări, exact „applause", nu „jackpot". NU se declanșează la buff-ul gratuit din Time Slip (nu e o activare) |
| 7 | Night Owl Pact | `nightOwlPact` | **5** | Plafon offline **+12h**: 8h → **20h** (cu Lucid Dreaming 12h → **24h**); eficiența neschimbată |
| 8 | Sparkcatcher's Net | `sparkcatchersNet` | **2 / 5** | L1: intervalul de spawn **/2** ([150,330]s → [75,165]s, medie 2 min); L2: recompensele **×2** exact ca în 09 §2.2 (sume ×2, durate buff ×2, fragmente ×2, quills ×2, timeSlip neschimbat) |
| 9 | Second Bookmark | `secondBookmark` | **6 / 14** | La Publish, cele mai ieftine **2 / 4** upgrade-uri de rundă deținute supraviețuiesc (după costul din config: tipic `sharpenedNib`(100) + `musesChorus`(500), apoi + `goldenInkwell`(15k) + `ravensGossip`(25k)) |
| 10 | Editor's Due | `editorsDue` | **10** | Fiecare Publish: **+1 Golden Quill** (portofel ȘI lifetime ⇒ și +30% producție permanent) — breakeven nominal 10 publish-uri, dar plătește dublu prin lifetime; cumpărat în lanțul simulat la tomul 9 |

**De ce ordinea de cumpărare e o decizie reală (nu evidentă):** după primul Publish (1–2 🪶) există TREI opțiuni ≤ 2 🪶 cu profiluri diferite — head-start idle (`apprenticeMuse` 1), click activ (`strokeOfGenius` 2), farm de evenimente (`sparkcatchersNet` 2); la 3–4 🪶 concurează `restlessHeart`/`thunderousApplause`/`selfWritingContract` cu economisirea pentru L2-uri; `blueprintOfMyths` (12) e o capcană dacă e cumpărat devreme (nu atingi 300M în rundă → quills morți) și o țintă corectă mid-game; `editorsDue` (10) e pariul pe termen lung contra beneficiului imediat. Lanțul greedy din RUN G alege alt upgrade aproape la fiecare tom — nu există un singur „build corect".

---

## 3. Myth Engine (generatorul 8) — NESCHIMBAT față de 09

| baseCost | baseProd | growth | revealAt | Condiție |
|---:|---:|---:|---:|---|
| **300.000.000** | **45.000 /sec** | **1.12** | **150.000.000** (50% din baseCost, regula v1) | rândul există DOAR cu `blueprintOfMyths` |

Payback de bază **6.667s** — continuă exact curba v1 (dreamLibrary 1.000s, fableForge 2.564s; raport ~×2.6 per tier). Intră în toate regulile v1: praguri 25/50/100 → ×2 (`qty:mythEngine:<n>`), formula de cost/bulk 03 §1, discount Patron's Favor. Relevant când rundele ating 300M+ (push-uri de leaderboard / 50+ quills per publish) — corect pentru poziția lui de endgame.

---

## 4. Relics — praguri și efecte FINALE (neschimbate față de 09, validate)

| Prag `tomesPublished` | Relic | ID | Efect exact |
|---:|---|---|---|
| **3** | Dog-Eared Page | `dogEaredPage` | Începi runda cu **300 Inspiration**; intră și în `inspiration` ȘI în `totalEarned` (păstrează invariantul engine `balance ≤ totalEarned`; consecință acceptată: reveal-urile sub 300 sar instant — oricum se re-ating în secunde post-prestige) |
| **7** | Standing Ovation | `standingOvation` | Prima activare **MANUALĂ** a buffului din rundă: durată **×2** (30s; 45s cu Burst of Genius). Buff-ul gratuit din Time Slip NU consumă „prima activare" |
| **15** | Ink That Remembers | `inkThatRemembers` | Producție globală **× (1 + 0.01 × tomesPublished)**, fără plafon, activ doar de la 15 tomuri în sus |
| **30** | The Reader's Letter | `readersLetter` | Eficiență offline **+10pp**: 0.5→**0.6**; cu Lucid Dreaming 0.75→**0.85** (cu Night Owl Pact: 24h × 0.85 — plafonul rămâne singura frână, intenționat: e capstone-ul QoL) |

Derivate din `tomesPublished`, nu stocate în save (09 §1.4). Pragurile 3/7/15/30 pică natural: 3 = prima sesiune lungă, 7 = prima săptămână casual, 15/30 = orizontul lung.

---

## 5. Stray Spark — tabelul FINAL de recompense

Interval spawn **uniform [150s, 330s]** (medie 4 min; Net L1: [75s,165s]), zbor 10s, deblocat la **1.000 totalEarned** (`aLightAtTheWindow`), max 1 pe ecran, toate regulile anti-abuz din 09 §2.3 rămân contract.

| Pondere /100 | Recompensă | ID | Formula exactă (Net L2 = ×2 unde e marcat) |
|---:|---|---|---|
| **45** | Ink Burst | `inkBurst` | Inspiration instant = **45 × effectiveProd** (snapshot la click, INCLUSIV buff-urile active — combo-ul „prind spark în buff" e joc de skill legitim, plafonat natural la ×2), cu podea **50 × clickValue curent**; sumă ×2ᴺᵉᵗᴸ² |
| **20** | Frenzy of the Quill | `quillFrenzy` | Buff **30s** (60sᴺᵉᵗᴸ²): click power **×7 doar pe partea de bază** (NU pe Ink Echo — aceeași regulă ca buff-ul v1 din 03 §3) |
| **15** | Gossip Bonanza | `gossipBonanza` | Buff **60s** (120sᴺᵉᵗᴸ²): generatorii tier 1–3 (muse/sprite/raven) **×5** |
| **10** | Time Slip | `timeSlip` | Cooldown-ul buffului resetat la 0 + buff pornit gratuit (durata normală 15/22.5s; NU declanșează Thunderous Applause, NU consumă Standing Ovation, NU se dublează cu Net L2) |
| **8** | Story Fragment | `storyFragment` | +1 fragment (+2ᴺᵉᵗᴸ²); la **5 fragmente** → +1 Golden Quill (portofel + lifetime); fragmentele persistă prin prestige (meta) |
| **2** | Golden Quill | `goldenQuillDrop` | **+1 Golden Quill** direct (+2ᴺᵉᵗᴸ²); portofel + lifetime |

**[DECIZIE DE CALIBRARE] Ink Burst: 15 minute (900s) → 45 de secunde de producție.** Cea mai importantă corecție numerică a v2. La cadență medie de 4 min și pondere 45%, un burst de 900s adaugă ≈ +170% venit susținut — simularea (RUN D) o confirmă brutal: rundă −38%, iar **71.2% din tot totalEarned** ar fi venit din bursts (jocul ar fi devenit „vânează scânteia", idle-ul decor). Sweep-ul rulat:

| inkBurst | t(100k) runda 2, catch 100% | vs. fără sparks (16m49s) | share bursts în totalEarned |
|---:|---:|---:|---:|
| 900s (09 inițial) | 10m26s | −38.0% | **71.2%** — OP, respins |
| 120s | 14m16s | −15.2% | 13.4% |
| 60s | 15m06s | −10.2% | 6.0% |
| **45s (ALES)** | **15m11s** | **−9.7%** | **4.3%** |
| 30s | 15m40s | −6.8% | 3.1% — sub pragul „vizibil" |

45s aleargă exact în banda țintă „vizibil, niciodată dominant" (~10% viteză de rundă la colectare perfectă); cu Net L2 complet (7 🪶 investite + catch 100%): share 19.2%, t(100k) 12m05s — recompensă reală pentru build-ul activ, tot sub buff-ul principal ca importanță. Per-catch tot se simte: 45s de producție = un „cadou" de ordinul unei achiziții de generator mid.

**Anti-exploit producție 0 (verificat):** podeaua 50 × clickValue la producție 0 = 50 Inspiration per spark (~12.5/min la cadența de 4 min) — sub ce produc 2 click/s manual; nefarmabil. La meta mare (click 20+ prin resonance), podeaua ≈ 25 de click-uri per 4 min — tot irelevant. Quills din sparks: EV = 0.08×(1/5) + 0.02 = **0.036 🪶/spark** → **0.54 🪶/h** bază (≈9% din venitul de quills al unui jucător early, sub pragul de 20% din 09); Net L2 + catch perfect: **~2.1 🪶/h**, tot minor față de publish-urile mid-game (10+ 🪶 la 3–4 min în lanțul greedy).

---

## 6. The Bookshelf — bonus FINAL

**+2% producție globală per fabulă cu titlu unic, plafon 25 numărate (max +50%)** — neschimbat față de 09, validat în stack: la tomul 10 (+20%) contribuția e mică față de quills (+900%), deci plafonul 25 nu e frâna dominantă; există ca asigurare împotriva fermelor de publish-uri de 1 quill. Fabulele faded din migrare contează (§1.2). Titlurile: determinism și tabele exact ca 09 §3.1 (append-only).

---

## 7. Pozițiile noilor multiplicatori în lanțul 03 §2 (contract pentru engine)

```ts
// PER GENERATOR (după pas 3 sinergii):
// pas 3½: gossipBonanza activ → tiers 1–3 (wanderingMuse, inkSprite, talkingRaven) ×5

// GLOBAL (ordinea pașilor 5–8 devine):
globalMult = (hasGoldenInkwell ? 1.5 : 1)                                  // pas 5
           * (1 + achievementBonus * achievementsUnlocked)                 // pas 6 (24 achievements acum)
           * (1 + 0.02 * min(uniqueFables, 25))                            // pas 6½a: Bookshelf
           * (tomesPublished >= 15 ? (1 + 0.01 * tomesPublished) : 1)      // pas 6½b: Ink That Remembers
           * (1 + 0.30 * lifetimeQuillsEarned)                             // pas 7 (REANCORAT)
           * (isBuffActive ? 2 : 1)                                        // pas 8

// CLICK:
// quillFrenzy ×7 DOAR pe partea de bază (ca buff-ul v1; nu pe Ink Echo)
// strokeOfGenius: crit ×10 pe ÎNTREGUL click final (bază + echo) — decizie RUN F
// clickValue final = (bazăCuMultiplicatori + echo) * (crit ? 10 : 1)
```

Regula v1 „aditiv în categorie, multiplicativ între categorii" păstrată: Bookshelf și Ink That Remembers sunt categorii separate (surse diferite), fiecare aditivă intern per-bucată.

---

## 8. Simulare — metodologie și rezultate (toate prin `docker run --rm node:22-alpine`)

**Script:** `tools/economy-sim-v2.mjs` — portul exact al modelului v1 (2 click/s, buff cu +20s întârziere, greedy pe payback, save-for-upgrade <45s) + straturile v2 în spatele flag-urilor; fiecare inserție v2 e no-op numeric exact cu flag-urile off. Sparks: Monte-Carlo pe 15 seed-uri (mulberry32), raportăm mediana; restul determinist.

| RUN | Ce verifică | Rezultat | Verdict |
|---|---|---|---|
| **A** | v1-compat: flags off ⇒ cifrele din 03 §9 | 24m23s / 16m49s / 11m45s, prod 721.6/s, 7 ach — **identice** | **PASS** |
| **B** | **Invariantul (b)**: bonus pe lifetime, portofel irelevant | timpi identici țintă cu țintă cu v1; portofelul nu e input în nicio formulă | **PASS** |
| **C** | **Criteriul (a)**: runda 3 cu Atelier lacom (5 🪶: apprentice L1 + genius L1 + net L1; 2 fabule) vs runda 2 fără | catch 100%: t(100k)=**8m41s** = **51.6%** din runda 2 fără (16m49s); catch 50%: 9m10s = 54.5%; catch 0%: 10m06s = 60.1% (efectul pur-Atelier = −14% vs runda 3 fără). Pragul ≥40% ținut cu marjă în TOATE variantele | **PASS** |
| **D** | Calibrarea inkBurst | tabelul din §5 — 900s respins (71% din venit), 45s ales (4.3%) | decis |
| **E** | Mid-game tomul 10 (lifetime 30, relics 3+7, 10 fabule, Atelier gros, catch 50%) | t(100k)=33s, t(2.5M)=2m10s, **t(10M)=3m32s** — ținta reală a rundei (~+10 🪶) ia minute, nu secunde | OK, vezi riscul „treadmill" |
| **F** | Crit pe tot click-ul vs doar pe bază (genius L2, scenariu click-sensibil) | t(100k)/t(900k) **identice** (9m25s/15m51s); click share 3.2% vs 2.5% | **whole click, decis** |
| **G** | Lanțul meta 12 tomuri (catch 50%, cheltuire greedy) | tabel mai jos | vezi §8.1 |
| **H** | Runda 1 v2 (sparks pornite, tome 0) | t(1000) **identic** v1 (3m00s — sparks pornesc DUPĂ 1000); t(100k): 20m45s @100% catch, 22m41s @50% — **fereastra 20–40 min a primului prestige ținută** | **PASS** |

### 8.1 Lanțul meta (RUN G) — curba de acumulare + affordability

| Tom | Durata rundei | t(100k) | +🪶 publish | lifetime | Cumpărat (cost) |
|---:|---:|---:|---:|---:|---|
| 1 | 32m24s | 23m23s | +2 | 2 | apprenticeMuse L1 (1) |
| 2 | 26m17s | 16m07s | +3 | 5 | strokeOfGenius L1 (2), sparkcatchersNet L1 (2) |
| 3 | 16m14s | 9m17s | +4 | 9 | restlessHeart L1 (3) |
| 4 | 11m28s | 5m45s | +5 | 14 | thunderousApplause (4) |
| 5 | 8m36s | 3m50s | +6 | 20 | selfWritingContract (4), apprenticeMuse L2 (3) |
| 6 | 6m52s | 3m03s | +7 | 27 | sparkcatchersNet L2 (5) |
| 7 | 3m49s | 2m04s | +8 | 35 | strokeOfGenius L2 (6), nightOwlPact (5) |
| 8 | 3m24s | 1m23s | +9 | 44 | restlessHeart L2 (7) |
| 9 | 3m35s | 0m59s | +10 | 54 | editorsDue (10) |
| 10 | 3m32s | 0m45s | +12 | 66 | secondBookmark L1 (6), apprenticeMuse L3 (8) |
| 11 | 2m28s | 0m26s | +13 | 79 | blueprintOfMyths (12) |
| 12 | 2m08s | 0m23s | +13 | 92 | secondBookmark L2 (14) → **Full Patronage** |

- **Primul upgrade de Atelier cumpărabil imediat după primul prestige** — confirmat în lanț (tomul 1: +2 🪶 → apprenticeMuse L1 pe loc); garantat și structural (orice Publish ≥ 1 🪶 = costul exact al lui apprenticeMuse L1).
- **Speed Reader (<10 min)** pică natural la tomurile 3–4 (t(100k) 9m17s / 5m45s) — achievement-ul are momentul lui, nu e nici instant nici imposibil.
- **Full Patronage (92 🪶): la tomul 12** în regim greedy perfect (~2h de joc activ concentrat, catch 50%). Pentru jucătorul casual real (offline, publish-uri suboptimale, sparks pierdute) orizontul rămâne 20–30 de tomuri pe parcursul câtorva săptămâni — cifra greedy e limita inferioară, nu ținta. Sink-ul NU se mărește preventiv: pasul real de îmbătrânire e cadența de check-in, nu costul (dublarea costurilor târzii ar adăuga doar ~4–6 tomuri greedy; buton disponibil dacă feedback-ul o cere: costuri late ×2 → total ~150).
- Quills din sparks în lanț: 0–1 per rundă (fragmentele acumulează lent, EV 0.036/spark) — garnitură, exact ca proiectat, niciodată motor.

### 8.2 Riscul „treadmill" (rundele 8–12 la 2–4 min) — analizat, acceptat

Compresia vine din **designul v1** (sqrt pe câștig + 30%/quill aditiv), nu din v2: creșterea lifetime (+13/rundă târzie) și ținta următorului quill (+16% TE) se echilibrează, deci durata publish-ului se stabilizează la ~2–4 min pentru jucătorul care publică la primul breakpoint. Contribuția v2 e moderată (RUN C: −14% pur-Atelier) și cumpărată cu monedă câștigată. Nu se corectează în v2: (1) e comportament moștenit, în afara mandatului „extindere fără să strice v1"; (2) țintele reale post-tom-12 cresc singure (Myth Engine 300M, relics 15/30, push-uri de leaderboard 1G→100 🪶); (3) frâna, dacă va fi cerută: plafonul de fabule (25) și `INK_REMEMBERS_RATE` — NU `QUILL_BONUS`, care e ancora v1.

---

## 9. Constante FINALE gata de copiat în config (`src/engine/config.ts`, secțiune v2)

```ts
// ——— v2: regula de aur ———
// QUILL_BONUS rămâne 0.30 dar se aplică pe meta.stats.lifetimeQuillsEarned (nu pe portofel).

// ——— v2: The Gilded Atelier (cost total 92) ———
export const ATELIER_UPGRADES = [
  { id: 'apprenticeMuse',      costs: [1, 3, 8],  startMuses: [5, 15, 30] },
  { id: 'selfWritingContract', costs: [4],        autoBuyMaxCostFraction: 0.01, autoBuyIntervalMs: 1_000 },
  { id: 'strokeOfGenius',      costs: [2, 6],     critChance: [0.05, 0.10], critMult: 10 }, // pe ÎNTREGUL click
  { id: 'blueprintOfMyths',    costs: [12] },
  { id: 'restlessHeart',       costs: [3, 7],     cooldownMs: [75_000, 60_000] },           // bază: 90_000
  { id: 'thunderousApplause',  costs: [4],        prodSeconds: 20 },  // [CALIBRARE] 60 → 20; prod FĂRĂ buff
  { id: 'nightOwlPact',        costs: [5],        extraOfflineCapMs: 12 * 3_600_000 },      // 8h→20h; 12h→24h
  { id: 'sparkcatchersNet',    costs: [2, 5] },   // L1: interval /2; L2: recompense ×2
  { id: 'secondBookmark',      costs: [6, 14],    keptUpgrades: [2, 4] },                   // cele mai ieftine după cost config
  { id: 'editorsDue',          costs: [10],       bonusQuillsPerPublish: 1 },
] as const;

// ——— v2: generatorul 8 (doar cu blueprintOfMyths) ———
export const MYTH_ENGINE = {
  id: 'mythEngine', baseCost: 300_000_000, baseProd: 45_000, growth: 1.12, revealAt: 150_000_000,
} as const;

// ——— v2: Relics (derivate din tomesPublished, nu se salvează) ———
export const RELICS = [
  { id: 'dogEaredPage',     tomes: 3,  startInspiration: 300 },       // intră și în totalEarned
  { id: 'standingOvation',  tomes: 7,  firstBuffDurationMult: 2 },    // doar prima activare MANUALĂ
  { id: 'inkThatRemembers', tomes: 15, prodPerTome: 0.01 },           // fără plafon
  { id: 'readersLetter',    tomes: 30, offlineEffBonus: 0.10 },       // 0.5→0.6; 0.75→0.85
] as const;

// ——— v2: Stray Spark ———
export const SPARK = {
  unlockTotalEarned: 1_000,
  intervalMinMs: 150_000, intervalMaxMs: 330_000, flightMs: 10_000,
  netIntervalDiv: 2,   // Sparkcatcher's Net L1
  netRewardMult: 2,    // Sparkcatcher's Net L2 (sume/durate/fragmente/quills; NU timeSlip)
  weights: { inkBurst: 45, quillFrenzy: 20, gossipBonanza: 15, timeSlip: 10, storyFragment: 8, goldenQuillDrop: 2 },
  inkBurstSeconds: 45,        // [CALIBRARE] 900 → 45 × effectiveProd (snapshot la click, cu buff-uri)
  inkBurstFloorClicks: 50,    // podea: 50 × clickValue curent
  frenzy: { durationMs: 30_000, clickMult: 7 },   // doar partea de bază a clickului
  gossip: { durationMs: 60_000, prodMult: 5, tiers: ['wanderingMuse', 'inkSprite', 'talkingRaven'] },
  fragmentsPerQuill: 5,
} as const;

// ——— v2: The Bookshelf ———
export const BOOKSHELF = { bonusPerUniqueFable: 0.02, countedCap: 25 } as const;  // max +50%
```

---

## Ce s-a decis
- **Migrare:** `lifetimeQuillsEarned = meta.goldenQuills(v1)` — exactă (v1 nu cheltuia), producție identică post-migrare; portofelul rămâne neatins și integral cheltuibil; invariant nou de sanitizare `goldenQuills ≤ lifetimeQuillsEarned`; fabulele faded contează la bonusul Bookshelf.
- **Costuri Atelier FINALE = cele din 09** (1/3/8, 4, 2/6, 12, 3/7, 4, 5, 2/5, 6/14, 10), total corectat **92 🪶** (nu 96 — eroare de adunare în 09); validate în lanțul meta: Full Patronage la tomul 12 greedy / 20–30 casual.
- **[DECIZIE DE CALIBRARE] Ink Burst 900s → 45s de producție** (sweep în §5: 900s = 71% din venit, respins) și **Thunderous Applause 60s → 20s** (60s = +55–67% venit susținut, peste buff-ul însuși).
- **Crit Stroke of Genius pe ÎNTREGUL click (inclusiv Ink Echo)** — RUN F: diferență 0.0% pe timpi, click share 3.2%; fallback-ul din 09 §1.2 nu e necesar.
- Ponderile Spark (45/20/15/10/8/2), pragurile Relics (3/7/15/30), Bookshelf (+2%, cap 25), Myth Engine (300M / 45K / 1.12 / 150M) — **confirmate neschimbate**.
- Pozițiile noilor multiplicatori în lanțul 03 §2: pas 3½ (gossip per-gen), pas 6½a/b (Bookshelf, Ink That Remembers), pas 7 reancorat pe lifetime.
- Clarificări de interacțiune: Time Slip nu declanșează Applause și nu consumă Standing Ovation; Standing Ovation doar pe activări manuale; Dog-Eared Page intră și în totalEarned; fragmentele persistă prin prestige.

## De ce
- Cele două calibrări mari sunt susținute de sweep-uri numerice (§5, §2 #6): valorile inițiale din 09 ar fi făcut evenimentul random mai important decât idle-ul (71% din venit) și o achiziție de 4 🪶 mai puternică decât buff-ul central. Valorile alese țin ambele în banda „vizibil, nu dominant" (~10% viteză de rundă la colectare perfectă; ~2× valoarea unei activări de buff).
- Costurile 09 păstrate: simularea arată că ordinea de cumpărare rămâne o decizie reală și că sink-ul se întinde exact pe orizontul dorit; scumpirea preventivă ar fi pedepsit jucătorul casual fără să lungească semnificativ regimul greedy.
- Reancorarea pe lifetime + migrarea egalitate = singura combinație în care NICIUN jucător v1 nu pierde nimic și cheltuirea e strict pozitivă — verificată, nu doar declarată (RUN A/B).

## Fișiere create sau modificate
- **Creat:** `C:/Projects/Games/Fable Idler/ai-memory/11-v2-economy.md` (acest document).
- **Creat:** `C:/Projects/Games/Fable Idler/tools/economy-sim-v2.mjs` (simulatorul v2; comanda de rulare în preambul; `tools/economy-sim.mjs` v1 neatins).
- **Modificat (doar notă de trimitere, permisă):** `C:/Projects/Games/Fable Idler/ai-memory/03-economy-balance.md` — o linie care trimite la acest document pentru v2.

## Riscuri
- **Treadmill-ul rundelor târzii** (§8.2): publish-uri de 2–4 min de la tomul ~8 în regim greedy — moștenit din v1 (sqrt + 0.30 aditiv), amplificat doar moderat de v2; acceptat; frâne documentate (cap fabule, `INK_REMEMBERS_RATE`), NU `QUILL_BONUS`.
- **Net L2 + catch 100%** = 19.2% din venit din bursts + ~2.1 🪶/h — puternic pentru jucătorul hiper-activ; acceptat ca vârf al build-ului activ (7 🪶 investite); dacă feedback-ul arată abuz, primul buton e `netRewardMult` 2 → 1.5 pe sume (nu pe durate).
- **Simulatorul modelează EV pentru crit** (nu variance) și **catch-rate constant** — cifrele reale au ±15% marjă ca în v1; RNG-ul recompenselor NU e seedat în joc (anti save-scumming, 09 §2.3), seed-urile există doar în simulator.
- **Cifre duplicate în două documente:** 09 conține valorile inițiale (900s, 60s, „96 🪶"); sursa de adevăr pentru cifre e ACEST document — identic cu relația 01↔03 din v1. Cine implementează după 09 fără 11 va livra un joc dezechilibrat.
- Lanțul meta presupune publish la primul breakpoint rezonabil; jucătorii care „împing" mult peste breakpoint acumulează quills mai repede decât tabelul din §8.1 (sqrt-ul frânează, dar nu elimină) — inofensiv: tot ce cumpără e strict pozitiv.

## Ce trebuie să știe următorul agent
- **Arhitect (schema v2):** invariantul de sanitizare `goldenQuills ≤ lifetimeQuillsEarned` (§1.2) intră în `sanitizeMeta`; `MIGRATIONS[1]` exact ca tabelul §1.2; `meta.storyFragments` persistă prin prestige; relics NU se stochează; RNG-ul spark trăiește în shell (acțiune `collectSpark` cu rezultatul extras în afara `tick`-ului), niciun timestamp de spawn în save.
- **Engine:** copiați blocul din §9 literal; ordinea multiplicatorilor din §7 e contract; crit pe întregul click / frenzy doar pe bază / echo fără ×5 — trei reguli de click distincte, fiecare cu test unit; Applause folosește producția FĂRĂ buff-ul abia activat; Dog-Eared Page adaugă 300 la AMBELE (`inspiration`, `totalEarned`); Editor's Due incrementează AMBELE contoare de quills.
- **Teste:** criteriile numerice re-verificabile: t(1000) runda 1 identic v1 (sparks gate); producția strict ne-descrescătoare la orice `buyAtelierUpgrade`; migrare v1→v2 câmp cu câmp pe tabelul §1.2; EV quills/spark 0.036; podeaua inkBurst la prod 0.
- **UI:** textul „+30% production per Golden Quill earned" (accent pe *earned*); portofelul și lifetime-ul sunt DOUĂ numere afișate distinct în Atelier („Spendable: 3 🪶 · Earned all-time: 12 🪶").
- **Re-rulare simulare:** `docker run --rm -v "C:\Projects\Games\Fable Idler\tools:/w" node:22-alpine node /w/economy-sim-v2.mjs` — RUN A trebuie să rămână PASS după ORICE schimbare de cifre v1; criteriile (a)/(b) au PASS/FAIL explicit în output.

## Validări făcute
- **V1-compat exact (RUN A):** simulatorul v2 cu flag-urile off reproduce cifrele 03 §9 la secundă (24m23s / 16m49s / 11m45s; prod 721.6/s; 7 ach) — inserțiile v2 sunt no-op-uri numerice dovedite, nu „probabil inofensive".
- **Invariantul (b) (RUN B):** jucătorul care nu cheltuie are timpi identici țintă cu țintă; portofelul nu e input în nicio formulă.
- **Criteriul (a) (RUN C):** runda 3 cu Atelier lacom = 51.6–60.1% din timpul rundei 2 fără (prag ≥40%), în toate scenariile de catch (0/50/100%), mediană pe 15 seed-uri.
- **Sweep-uri de calibrare:** inkBurst pe 5 valori (900→30s) cu share-ul în totalEarned măsurat; crit whole-vs-base cu click share; toate în output-ul scriptului.
- **Fereastra primului prestige (RUN H):** 20m45s–22m41s cu sparks (vs 24m23s fără) — rămâne în 20–40 min; t(1000) neatins de v2.
- **Lanț meta 12 tomuri (RUN G):** curba de acumulare, affordability (primul upgrade la primul publish), Full Patronage la tomul 12 greedy, Speed Reader la tomurile 3–4.
- **Aritmetică:** total Atelier 92 (eroarea „96" din 09 semnalată); EV 0.036 🪶/spark → 0.54/h bază, 2.07/h Net L2; Myth Engine payback 6.667s pe curba v1; podea inkBurst nefarmabilă la producție 0.
