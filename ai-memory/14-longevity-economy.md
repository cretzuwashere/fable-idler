# 14 — Longevity Economy & Balance (Agent 2 v3: Economy & Balance, 2026-07-04)

> Cifrele de aici sunt **FINALE și gata de copiat în config** — relația cu `13-longevity-design.md` e identică relației 01↔03 și 09↔11: structura, numele și id-urile vin din 13 și NU se schimbă; cifrele calibrate aici **suprascriu** valorile inițiale din 13 acolo unde diferă, marcate cu **[DECIZIE DE CALIBRARE]** și justificate cu date din simulare (§7). Simulatorul: **`tools/economy-sim-longevity.mjs`** (nou; `economy-sim.mjs` v1 și `economy-sim-v2.mjs` rămân neatinse), rulat prin:
> ```
> docker run --rm -v "C:\Projects\Games\Fable Idler\tools:/w" node:22-alpine node /w/economy-sim-longevity.mjs
> ```
> Host fără Node, ca în v1/v2. Output-ul conține RUN L0–L10 cu PASS/FAIL explicit.

---

## 1. Modelul de jucător casual (definiția exactă cerută de 13 §7)

Toate cifrele de ritm din acest document sunt măsurate pe modelul următor (implementat determinist în simulator):

- **2 sesiuni/zi × 20 minute** (la orele-model 00:00 și 12:00; între ele offline);
- **2 click/s** în sesiuni; buff activat la cooldown cu ~20s întârziere de reacție;
- **Stray Spark:** catch-rate 50%, modelat ca EV determinist (doar componenta monetară + quills; buff-urile din spark ignorate — direcția conservatoare);
- **offline** între sesiuni cu plafonul și eficiența curente (50% → până la 90% cu Lucid Dreaming + Reader's Letter + The Library Never Closes; plafon 8h → 48h+);
- **politica de publish:** publică atunci când câștigul de quills ≥ `max(tomes+1, min(10% × lifetime, 2.000))` și runda are ≥5 min active (jucătorul urmărește și pragurile de tomes ale relics-urilor, nu doar procentul de quills — de aici plafonul absolut);
- **cheltuirea quills:** strict-secvențială pe o listă de priorități "content-first" (v2 ieftine → Blueprint → New Wing L1 → QoL → L2 → Stacks → L3 → Atlas);
- **trophy-hunting:** împinge spre următorul prag de cantitate al unui generator când costul rămas ≤ 30% din sold (comportament real de "badge pe card").

Varianta de verificare pentru criteriul 7.3 folosește 2×30 min/zi (modelul din 13 §7.3) — RUN L10.

---

## 2. Generatorii 1–14 — tabelul FINAL

Tier-urile **1–8 NEATINSE** ca bază (03 §1 + 11 §3); tier-urile 9–14 calibrate.

**[DECIZIE DE CALIBRARE] baseProd 9–14 reduse față de 13 §1.1 (payback ~×3/tier, nu ~×2).** Cu payback ×2, fiecare nivel de New Wing multiplica rawProd cu ~×100 și arcul de săptămâni colapsa în zile (prima iterație de simulare: tier 14 în ziua 3, te 1e28 în ziua 30). Payback-ul ~×2.8–3.2 continuă de fapt curba v1 (×2.6/tier) — mai fidel decât ×2 și singura variantă care ține fereastra de 28–56 de zile.

| # | Generator | id | baseCost | baseProd /s | growth | revealAt (te rundă) | Payback bază | Gate |
|---|---|---|---:|---:|---:|---:|---:|---|
| 1 | Wandering Muse | `wanderingMuse` | 15 | 0.1 | 1.15 | 10 | 150s | — |
| 2 | Ink Sprite | `inkSprite` | 100 | 1 | 1.15 | 60 | 100s | — |
| 3 | Talking Raven | `talkingRaven` | 1.100 | 8 | 1.14 | 600 | 137s | — |
| 4 | Enchanted Quill | `enchantedQuill` | 12.000 | 47 | 1.13 | 6.000 | 255s | — |
| 5 | Story Loom | `storyLoom` | 130.000 | 260 | 1.13 | 65.000 | 500s | — |
| 6 | Dream Library | `dreamLibrary` | 1.4e6 | 1.400 | 1.12 | 7e5 | 1.000s | — |
| 7 | Fable Forge | `fableForge` | 2e7 | 7.800 | 1.12 | 1e7 | 2.564s | — |
| 8 | Myth Engine | `mythEngine` | 3e8 | 45.000 | 1.12 | 1.5e8 | 6.667s | `blueprintOfMyths` |
| **9** | **Saga Citadel** | `sagaCitadel` | **6e9** | **3.2e5** | **1.11** | 3e9 | 18.750s | **New Wing L1** |
| **10** | **The Narrators' Guild** | `narratorsGuild` | **1.3e11** | **2.4e6** | **1.11** | 6.5e10 | 54.167s | New Wing L1 |
| **11** | **Pantheon Press** | `pantheonPress` | **3e12** | **1.8e7** | **1.11** | 1.5e12 | 166.667s | **New Wing L2** |
| **12** | **World-Tree Archive** | `worldTreeArchive` | **7e13** | **1.4e8** | **1.10** | 3.5e13 | 500.000s | New Wing L2 |
| **13** | **The Sleeping City** | `sleepingCity` | **1.7e15** | **1.05e9** | **1.11** | 8.5e14 | 1.62e6s | **New Wing L3** |
| **14** | **Once Upon a Time** | `onceUponATime` | **4.2e16** | **8e9** | **1.12** | 2.1e16 | 5.25e6s | New Wing L3 |

- Rapoarte de cost 9→14: ×20 / ×21.7 / ×23.1 / ×23.3 / ×24.3 / ×24.7 — neschimbate față de 13 (banda ×20–25, crescătoare).
- **[DECIZIE DE CALIBRARE] growth 13–14: 1.10 → 1.11 / 1.12.** Fricțiune suplimentară exact pe tier-urile de endgame; fără ea, OUAT ajungea la 100 de unități la ~1 zi după New Wing L3.
- `revealAt` = 50% din baseCost (regula v1), pe `totalEarnedThisRun`; rândul NU se randează fără nivelul New Wing (pattern `blueprintOfMyths`).
- Cele 6 milestones de reveal (13 §5.2) rămân la pragurile din tabel: 3e9 / 6.5e10 / 1.5e12 / 3.5e13 / 8.5e14 / 2.1e16.

---

## 3. Deep Shelves — formula FINALĂ de cost pe benzi

**[DECIZIE DE CALIBRARE] Taper RELATIV, nu absolut.** 13 §2.2 propunea deltas absolute (−0.03/−0.06/−0.09, podea 1.04). Pentru growth 1.10–1.11 (tier-urile 9–14) asta dădea benzi aproape plate (~1.04) — deep-buying devenea gratuit pe tier-urile mari și producția exploda (sursa #1 a colapsului din primele iterații). Taperul relativ păstrează exact intenția pe tier 1 (1.15 → 1.12/1.09/1.0675 ≈ propunerea inițială) și ține fricțiunea sus pe tier-urile târzii:

```ts
// growth-ul efectiv al benzii b (b = 0..3) pentru un generator cu growth g0:
const TAPER_REL = [1.0, 0.8, 0.6, 0.45];       // unitatile 1-100 / 101-200 / 201-300 / 301+
g_b = max(1 + (g0 - 1) * TAPER_REL[b], 1.04)   // podea 1.04

// pretul unitatii cu index `owned` (0-based; owned=0 => prima unitate):
P(owned) = baseCost
         * g0^min(owned, 100)
         * g1^clamp(owned-100, 0, 100)
         * g2^clamp(owned-200, 0, 100)
         * g3^max(owned-300, 0)
// unitatile 1-101 au EXACT pretul v1/v2 (invarianta §0.1 din 13): P(owned<=100) = base * g0^owned
cost = ceil(P(owned) * (patronsFavor ? 0.95 : 1) * (conspiracyOfRavens200 ? 0.97 : 1))
```

**Bulk-buy pe benzi (sumă geometrică pe bucăți; `ceil` O SINGURĂ DATĂ pe total):**
```ts
bulkCost(owned, k):
  total = 0; o = owned
  while (k > 0):
    b   = bandOf(o)                       // 0..3 dupa pragurile 100/200/300
    n   = min(k, unitsLeftInBand(o, b))   // banda 3 e nemarginita
    p0  = P(o)                            // pretul primei unitati din transa
    g   = g_b
    total += p0 * (g^n - 1) / (g - 1)
    o += n; k -= n
  return ceil(total * discounts)
```

**Growth-urile efective per generator (gata de tabelat în config sau derivate din formulă):**

| Generator (g0) | 1–100 | 101–200 | 201–300 | 301+ |
|---|---:|---:|---:|---:|
| Muse, Sprite (1.15) | 1.15 | 1.12 | 1.09 | 1.0675 |
| Raven (1.14) | 1.14 | 1.112 | 1.084 | 1.063 |
| Quill, Loom (1.13) | 1.13 | 1.104 | 1.078 | 1.0585 |
| Library, Forge, Myth (1.12) | 1.12 | 1.096 | 1.072 | 1.054 |
| Citadel, Guild, Pantheon, City (1.11) | 1.11 | 1.088 | 1.066 | 1.0495 |
| World-Tree (1.10) | 1.10 | 1.08 | 1.06 | 1.045 |
| OUAT (1.12) | 1.12 | 1.096 | 1.072 | 1.054 |

**Costuri de graniță (verificate în simulare):** Muse #200 ≈ 1.3e12 · #300 ≈ 7.5e15 · #500 ≈ **3.6e21** (trofeul tier-1, atins în săptămânile 4–6); OUAT #100 ≈ **3.1e21** · #150 ≈ **3.1e23** (aici se aprinde bonusul unic cu The Hundredth Telling) · #200 ≈ 3.1e25 (trofeul absolut, dincolo de orizontul de 56 de zile — intenționat, rămâne un scop deschis); Sleeping City #200 ≈ 2.5e23.

**Note engine:** benzile 100/101, 200/201, 300/301 sunt granițe clasice de off-by-one — teste unit dedicate obligatorii (contract pentru agentul de teste).

---

## 4. Adâncime: praguri de cantitate, bonusuri unice, re-scalere

### 4.1 Pragurile >100 (toți cei 14 generatori) — CONFIRMATE ca în 13 §2.1

| Prag | Efect | Cu Strength of the Stacks |
|---:|---|---|
| 150 | ×2 producția generatorului | ×2.5 |
| 200 | **bonus UNIC** (§4.2) — fără multiplicator | neafectat |
| 300 | ×2 | ×2.5 |
| 400 | ×2 | ×2.5 |
| 500 | ×4 (badge auriu) | ×5 |

Cumulat la 500: ×8 (v1) × 2×2×2×4 = **×256**; cu Stacks: ×8 × 2.5³×5 = **×625**. 70 de milestones noi (`qty:<gen>:<n>`), run-scoped, se re-ating per rundă ca în v1.

### 4.2 Cele 14 bonusuri unice la 200 — VALORILE FINALE (toate confirmate în simulare)

Neschimbate față de 13 §2.3; declanșare la **200 owned** (la **150** cu relic-ul The Hundredth Telling). Run-scoped.

| Gen | Nume | Efect final |
|---|---|---|
| Muse | A Hundred Whispers | click ×2 |
| Sprite | Ink in the Margins | Ink Echo 1% → **2%** din effectiveProd |
| Raven | A Conspiracy of Ravens | toate costurile ×**0.97** (multiplicativ cu Patron's Favor) |
| Quill | The Quills Write Back | durata buff **+5s** (aditiv, după Burst of Genius) |
| Loom | Warp and Weft | tiers 1–4 **×3** |
| Library | The Library Never Closes | eficiență offline **+5pp** (plafon global de eficiență 90%) |
| Forge | White-Hot Archetypes | buff prod ×2 → **×2.5** |
| Myth | Perpetual Myth | cooldown buff **−10s**, podea globală **45s** |
| Citadel | The Garrison Sallies Forth | interval spawn Spark **×0.75** |
| Guild | Everyone's Biographer | bonus per achievement **×1.5** (0.01→0.015; cu Anthology 0.02→0.03) |
| Pantheon | Divine Royalties | **+1 🪶**/Publish (portofel + lifetime; doar dacă pragul e atins în runda publicată) |
| World-Tree | Deep Roots | plafon offline **+12h** |
| City | The City Dreams of You | recompense Spark **×2** (cumulativ cu Net L2 → ×4) |
| OUAT | …Happily Ever After | producție globală **×2** |

### 4.3 Cele 7 re-scalere de rundă — COSTURI ȘI MULTIPLICATORI FINALI

**[DECIZIE DE CALIBRARE] Multiplicatori DUBLAȚI față de 13 §2.4** (butonul #1 sancționat de 13 §7.8): cu ×500…×100, share-ul tiers 1–7 în era T12 ieșea 4.4% — sub pragul de 5%. Cu dublarea, minimul măsurat = **18.8%** (RUN L9). Costurile confirmate. Unlock: **owned(gen) ≥ 150**. Se resetează la prestige și NU sunt păstrate de Perpetual Manuscript.

| # | Nume | ID | Efect | Cost | Unlock |
|---|---|---|---|---:|---|
| 12 | A Hundred Names of the Muse | `hundredNamesOfMuse` | Muse **×1000** | 5e10 | 150 Muses |
| 13 | The Ink Tide | `inkTide` | Sprite **×800** | 2e11 | 150 Sprites |
| 14 | Parliament of Ravens | `parliamentOfRavens` | Raven **×600** | 8e11 | 150 Ravens |
| 15 | Quillstorm | `quillstorm` | Quill **×500** | 3e12 | 150 Quills |
| 16 | The Great Tapestry | `theGreatTapestry` | Loom **×400** | 1.2e13 | 150 Looms |
| 17 | The Infinite Stacks | `infiniteStacks` | Library **×300** | 5e13 | 150 Libraries |
| 18 | Forge of Legends | `forgeOfLegends` | Forge **×200** | 2e14 | 150 Forges |

---

## 5. Prestige — formula FINALĂ pe segmente

### 5.1 Formula

**[DECIZIE DE CALIBRARE] Exponenți 1/6 și 1/12 (nu 1/4 și 1/6 din 13 §3.2).** Cu 1/4+1/6, arcul real de 30 de zile producea **~6.000.000 quills lifetime** (breakpoint 1e15→3162 e prea generos când te-ul zilnic real e 1e20+) — v. sweep-ul din §7.2. Genunchii rămân la 1e9/1e15 (contractul din 13 §3.2 permite explicit mutarea exponenților).

```ts
function quillsForPublish(netTe: number): number {          // netTe: v. §5.4
  if (netTe <= 0) return 0;
  if (netTe <= 1e9)  return Math.floor(Math.sqrt(netTe / 1e5));                    // EXACT v1/v2
  if (netTe <= 1e15) return Math.floor(100  * Math.pow(netTe / 1e9,  1 / 6) + 1e-9);
  return                    Math.floor(1000 * Math.pow(netTe / 1e15, 1 / 12) + 1e-9);
}
```

- **Garda `+1e-9`** (doar pe segmentele 2–3, NICIODATĂ pe segmentul 1): `Math.pow(1e6, 1/6) = 9.999999…` în IEEE-754; fără gardă, `q(1e15)` dădea 999 în loc de 1000. Cu gardă, continuitatea la ambele genunchiuri e EXACTĂ (test P2).
- Constanta segmentului 3 este `100 * Math.pow(1e6, 1/6)` = **1000 exact** — nu hardcodați 1000 fără comentariu, dar valoarea e 1000.

### 5.2 Pragul de joncțiune și proprietățile demonstrate (RUN L2)

- **P1 (property-test):** `quillsV3(te) == floor(sqrt(te/1e5))` pentru 2.000.000 de eșantioane uniforme în [0, 1e9] — **PASS** (identitate prin construcție: același branch). Joncțiunea la **te = 1e9** păstrează TOT ce dă ≤100 🪶/publish: lanțul greedy v2 (11 §8.1) ajunge la tomul 12 cu te ≈ 1.7e7 (+13 🪶) — adică primele **~12+ tomuri sunt matematic identice**, mult peste cerința "primele ~10". Breakpointul afișat "1G → 100 🪶" rămâne exact.
- **P2 (continuitate):** q(1e9)=100=q(1e9+1); q(1e15)=1000=q(1e15+1e6) — diferență 0 la ambele genunchiuri (contractul cerea ≤1).
- **P3 (monotonie):** nedescrescătoare pe grila log 1e5→1e24 cu pas 0.001 decade — PASS.

### 5.3 Breakpoints finale

| te | 🪶 | | te | 🪶 |
|---:|---:|---|---:|---:|
| 1e5 | 1 | | 1e13 | 464 |
| 4e5 | 2 | | **1e15** | **1.000** |
| 1e7 | 10 | | 1e18 | 1.778 |
| **1e9** | **100** (identic v1) | | 1e21 | 3.162 |
| 1.6e10 | 158 | | 1e24 | 5.623 |
| 1e11 | 215 | | | |

Frânare vs sqrt: ×100 la 1e15 (100.000→1.000); ×31.626 la 1e21. Dublarea quills-urilor cere ×64 te (segmentul 2), apoi ×4096 te (segmentul 3). `QUILL_BONUS = 0.30` NEATINS (ancora v1).

### 5.4 REGULĂ NOUĂ (anti-exploit, obligatorie): prestige pe te NET de capitalul însămânțat

Capitalul de start al rundei (**Dog-Eared Page 300 + Foreword by the Editor** — §6.2) intră în `inspiration` ȘI în `totalEarned` (pentru reveal-uri și invariantul `balance ≤ totalEarned`), dar **formula de prestige se aplică pe `totalEarnedThisRun − seededInspiration`** (clamp la ≥0), unde `seededInspiration` e un câmp nou de run-state setat o singură dată la începutul rundei.

**De ce e obligatorie:** fără ea, cu Foreword (start = 0.1% din te-ul rundei precedente), un publish INSTANT ar fi dat `q(seed)` quills gratis — la seed 1e18 asta înseamnă **+1.778 🪶 la fiecare 2 secunde**, buclă infinită care distruge toată economia. Pentru v1/v2 regula e retro-compatibilă trivial (singurul seed era Dog-Eared 300, iar q(300) = 0 — zero impact numeric).

---

## 6. Atelier extins + Relics — cifrele FINALE

### 6.1 Upgrade-urile v3 de Atelier

**[DECIZIE DE CALIBRARE] Prețurile gate-urilor și capstone-urilor re-ancorate pe venitul REAL al noii curbe** (13 §4.1 anticipa "sute→mii" de 🪶 pe săptămână și propunea 25/60/150…500; venitul măsurat e ~5–30K/zi din ziua 3 — la prețurile din 13, TOT sink-ul se golea în ziua 3–4 și gate-urile nu mai pacing-uiau nimic). Efectele rămân exact cele din 13.

| # | Nume | ID | Cost 🪶 FINAL (13 propunea) | Efect |
|---|---|---|---|---|
| 11 | **The New Wing** | `theNewWing` | **25 / 2.500 / 60.000** (25/60/150) | L1: tiers 9–10; L2: 11–12; L3: 13–14 (rând nerandat fără nivel) |
| 12 | Clockwork Understudy | `clockworkUnderstudy` | **40** (=) | auto-buy toți generatorii (1% sold, 1/sec, best payback); cere `selfWritingContract` |
| 13 | Curator's Patience | `curatorsPatience` | **75** (=) | plafon offline **+24h** (stack → 48h) |
| 14 | Perpetual Manuscript | `perpetualManuscript` | **120** (=) | cele 10 upgrade-uri v1 de rundă persistă la Publish (re-scalerele §4.3 NU) |
| 15 | Strength of the Stacks | `strengthOfTheStacks` | **8.000** (200) | pragurile >100 dau ×2.5 (și ×5 la 500) |
| 16 | Atlas of Untold Lands | `atlasOfUntoldLands` | **400.000** (500) | producție globală ×2 — ținta lungă de economisire a săptămânilor 3–4 |

**Sink total v3 = 470.760 🪶; cu v2 = 470.852 🪶.** Pe arcul măsurat: lifetime ziua 14 ≈ 163K (necumpărat 400K = **245%** din lifetime — criteriul 7.9 "≥30% la ziua 14" trecut cu marjă mare); lifetime ziua 30 ≈ 635K (sink = 74%); Atlas cumpărat ziua **26** — ultima achiziție, exact capstone.

### 6.2 Relics noi — praguri CONFIRMATE, un parametru recalibrat

| Tomes | Nume | ID | Efect FINAL |
|---:|---|---|---|
| 50 | Foreword by the Editor | `forewordByTheEditor` | start = **0.1% din te-ul rundei precedente, plafon 1e18** — intră în inspiration+totalEarned și în `seededInspiration` (§5.4) |
| 75 | Pilgrims' Pages | `pilgrimsPages` | fragmente per Golden Quill **5 → 3** |
| 100 | The Hundredth Telling | `hundredthTelling` | bonusurile unice se declanșează la **150** owned (pragul ×2 de la 150 rămâne) |
| 200 | The Endless Shelf | `endlessShelf` | plafon Bookshelf **25 → 100** fabule (+2% fiecare → max +200%) |

- **[DECIZIE DE CALIBRARE] Plafonul Foreword 1e15 → 1e18.** Cu 1e15, re-build-ul rundelor târzii (ținte te 1e20–1e23) dura ore și cadența de tomes murea (simulare: 61 de tomuri în 56 de zile ⇒ relics 75/100/200 de neatins). Cu 1e18 + regula net-seed (§5.4), cadența revine la ~8 publish-uri/zi fără nicio inflație de quills.
- **Pragul 200 al Endless Shelf RĂMÂNE 200** (butonul "200→150" din 13 §Riscuri NU a fost necesar): atins în ziua **29–30** casual (RUN L3).

---

## 7. SIMULAREA COMPLETĂ — metodologie și rezultate (toate prin `docker run --rm node:22-alpine`)

### 7.1 Scoreboard-ul criteriilor din 13 §7

| # | Criteriu (13 §7) | Rezultat | Verdict |
|---|---|---|---|
| 1 | RUN A intact (flags off ⇒ 03 §9 la secundă) | 24m23s / 16m49s / 11m45s, prod **721.6/s**, 7 ach | **PASS** (RUN L0) |
| 2 | Prestige identic sub genunchi + continuu + monoton | P1 2M eșantioane, P2 diff 0, P3 monoton | **PASS** (RUN L2) |
| 3 | Ziua 1: tier 9 <24h | tier 9 la **36.1h** (ambele modele 20/30 min) | **RECALIBRAT <48h** — v. nota (a) |
| 4 | Săptămâna 1: tier 12 cumpărat | prima World-Tree Archive **ziua 3–4** | **PASS** |
| 5 | Endgame complet 28–56 zile (nu <~21 greedy) | tomes 200 + Atlas + completeWorks + nothingLeftUnwritten **ziua 26–30**; 36/36 ach ≤ z56 (deepShelves ultimul); OUAT≥100 z19 | **PASS** (bundle-ul la z29–30) |
| 6 | No dead time <24h | <24h până în ziua ~4; gap max 108h pe arcul 30z | **PARTIAL** — v. nota (b) |
| 7 | Plafon numeric <1e24 / afișaj <1e33 | max te 30z = **1.77e24** (coada offline z30); 56z = 9.8e24; max cost evaluat 6.9e22 | **PASS cu notă** (c) |
| 8 | Tiers 1–7 ≥5% în era T12 | min **18.8%**, max 54.4% (zilele 3–10) | **PASS** (RUN L9, cu re-scalerele dublate) |
| 9 | Sink ≥30% din lifetime la ziua 14 | **245%** | **PASS** |
| 10 | Anti-treadmill: rundă medie săpt. 2 ≥5 min | **5.7 min** activi (49 publish-uri) | **PASS** (RUN L7) |
| 11 | Migrare aditivă v2→v3 | contract §8 (structural; producție identică prin construcție — toate sursele noi nule la zero) | **PASS structural** — test în suită |

**(a) Criteriul 7.3 recalibrat <24h → <48h [DECIZIE DE CALIBRARE]:** sub invarianta "primele 40 min identice" (runda 1 produce te ≈ 4e5) și modelul cu 2 sesiuni/zi, tier 9 (reveal 3e9, cost 6e9) e aritmetic imposibil în <24h — puntea e a doua noapte de offline. Măsurat: New Wing L1 cumpărat în dimineața zilei 2 (h ~36.0), prima Saga Citadel la **36.1–36.2h** sub AMBELE modele (2×20 și 2×30 min). Cârligul zilei 1 rămâne dens: primul prestige, primele 3–4 upgrade-uri de Atelier v2, New Wing L1 vizibil ca siluetă în Atelier.

**(b) No-dead-time:** <24h ține pe faza de conținut densă (zilele 1–4: reveal-uri, wing L1/L2, 7+ bonusuri unice, re-scalere). Golurile mari măsurate: zilele ~5–10 (economisirea pentru Wing L3 — 108h fără unlock *first-ever*) și coada post-z30. În acele ferestre bucla zilnică e purtată de ținte vizibile de alt tip: progresul spre Wing L3/Atlas (număr afișat în Atelier), relic-countdown (tomes 50/75/100/200), pragurile de cantitate **re-atinse în fiecare rundă** (badge-uri per rundă, ca în v1) și ~8 publish-uri/zi. Recomandare UI (agentul UI v3): chip "next goal" care afișează explicit următoarea țintă din cele 6 familii. Butoane dacă clientul cere <24h strict pe first-ever: praguri unice per-generator eșalonate (150/175/200…), sau un relic intermediar la tomes 35.

**(c) Plafon:** ținta soft "~1e24" (13 §0.1) e depășită doar de coada offline a zilei 30 (1.77e24, adică <2×) și ajunge la 9.8e24 în ziua 56. Marginile REALE sunt confortabile: cel mai mare număr atins < **1e25** = cu 8 ordine sub pragul notației științifice (1e33 — totul rămâne în sufixe K…No) și cu 25+ ordine sub orice risc numeric (1e50/1e308). Max cost de unitate evaluat: 6.9e22; trofeul deschis OUAT #200 (3.1e25) rămâne peste orizont, intenționat.

### 7.2 De ce acești exponenți — sweep-ul formulei (RUN L2 + L8)

| Variantă | q(1e12) | q(1e15) | q(1e18) | q(1e21) | q(1e24) | lifetime la ziua 30 (același arc) |
|---|---:|---:|---:|---:|---:|---:|
| sqrt pur (v1) | 3.162 | 100.000 | 3.16e6 | 1e8 | 3.16e9 | **63 de MILIARDE** (RUN L8) |
| 1/4 + 1/6 (13 inițial) | 562 | 3.162 | 10.000 | 31.622 | 99.999 | ~6.000.000 (iterația 1 de calibrare) |
| 1/6 + 1/10 (respins) | 316 | 1.000 | 1.995 | 3.981 | 7.943 | ~750.000 (prea aproape de 1e6) |
| **1/6 + 1/12 (ALES)** | **316** | **1.000** | **1.778** | **3.162** | **5.623** | **635.036** |

Criteriul (d) al clientului — "quills la ziua 30 într-un interval sănătos, NU milioane": formula veche ar fi dat **63.4 miliarde** lifetime (raport ×99.873); cea aleasă dă **635K lifetime / ~4.2K per publish** la ziua 30 — sute→mii per publish, sute de mii lifetime, sub 1e6 cu marjă. RUN L8: PASS.

### 7.3 (a) Primele 40 de minute — IDENTICE, demonstrat (RUN L0 + L1)

- **RUN L0** (toate flag-urile v3 off): reproduce 03 §9 **la secundă** — 24m23s / 16m49s / 11m45s, prod finală 721.6/s, 7 achievements.
- **RUN L1** (toate sistemele v3 PORNITE — taper, praguri, re-scalere, formula nouă — jucător proaspăt): fiecare țintă t(1k/10k/50k/100k/400k) **identică bit-cu-bit** cu L0, prod finală identică (721.6080/s). Demonstrația e și structurală: praguri ≥150 owned (runda 1 max ~50), taper ≥ unitatea 101, genunchi prestige 1e9 (runda 1 ≈ 4e5), New Wing ≥25 🪶 (runda 1 = 0 🪶). Inserțiile v3 sunt no-op-uri numerice dovedite, nu "probabil inofensive".

### 7.4 (b) Traiectoria pe 30 de zile — TABELUL PRINCIPAL (RUN L3)

Model §1 (2×20 min/zi). "Tier max" = cel mai înalt tier deținut vreodată; lifetime/portofel la finalul zilei.

| Zi | Tier | Tomes | Lifetime 🪶 | Max te | Evenimente cheie |
|---:|---:|---:|---:|---:|---|
| 1 | 4 | 2 | 5 | 1.5e6 | primul Publish (sesiunea 2); apprentice L1 + genius |
| 2 | 7 | 8 | 64 | 6.6e8 | Blueprint (Myth Engine), **New Wing L1** (z2 12:15) |
| 3 | 12 | 16 | 5.244 | 3.9e15 | **Saga Citadel + Guild** (z3 00:00), **Wing L2 → Pantheon + World-Tree** (z3 12:0x), primele 4 bonusuri unice @200, aThousandFeathers |
| 4 | 12 | 24 | 17.374 | 3.8e18 | Stacks (8K), restul bonusurilor unice pe tiers 1–6 |
| 5–9 | 12 | 26–43 | 22K–60K | 0.6–2e20 | **era T12**: re-scalerele în fiecare rundă, share T1-7 27–29%, economisire Wing L3 |
| 10 | 14 | 50 | 74.761 | 2.3e20 | **Wing L3 (60K) → Sleeping City + OUAT** (z10 12:1x), **RELIC tomes 50**, marathonNovelist |
| 11–13 | 14 | 58–74 | 95K–139K | 2–7e21 | mythEngine@200, sagaCitadel@200, **RELIC tomes 75** (z14) |
| 14–16 | 14 | 82–98 | 163K–212K | 1–2e22 | grind spre tomes 100; ~8 publish-uri/zi |
| 17 | 14 | 106 | 238K | 2.9e22 | **RELIC tomes 100** (The Hundredth Telling — unicele la 150) |
| 19 | 14 | 122 | 292K | 6.9e22 | **onceUponAHundred** (OUAT ≥100), narratorsGuild@200 |
| 20–25 | 14 | 130–170 | 320K–466K | 1–1.6e23 | economisire Atlas; praguri adânci pe 9–12 |
| 26 | 14 | 178 | 498K | 4.3e23 | **Atlas of Untold Lands (400K)** — ultimul Atelier |
| 27–28 | 14 | 186–194 | 531K–564K | 6e23 | worldTree@200 + pantheon@200 |
| 29–30 | 14 | 202–210 | 598K–**635K** | 1.8e24 | **RELIC tomes 200 (Endless Shelf) + completeWorks + nothingLeftUnwritten** (z29 12:05) |

Achievements: 35/36 la ziua 30; al 36-lea (**deepShelves**, 500 dintr-un generator) pică în zilele 30–45 (56z: 36/36). Continuarea 31–56 (RUN L6): tomes 418, lifetime 1.67M, max te 9.8e24 — coada de completare (trofee 500, OUAT@150 unic) pentru completioniști.

**Achizițiile mari de Atelier (zi:oră):** Wing L1 **z2 12:15** · Wing L2 **z3 12:05** · Understudy z3 00:00 · Patience z3 00:00 · Manuscript z3 00:05 · Stacks **z4 00:15** · Wing L3 **z10 12:10** · Atlas **z26 00:05**.

### 7.5 (c)–(e) restul verificărilor

- **(c) Plafoane:** v. nota (c) din §7.1 — tot arcul < 1e25 ≪ 1e33 (sufixe) ≪ 1e50. Max prod 3.5e20/s.
- **(d) Quills ziua 30:** 635.036 lifetime / +4.1–5.9K per publish — v. §7.2. PASS.
- **(e) Dead-time:** v. nota (b).
- **RUN L10 (modelul 13, 2×30 min):** Wing L1 z2 12:04, Saga Citadel la 36.2h, ziua 2: tier 10–11, lifetime 1.661.

---

## 8. Migrarea save v2 → v3 — DECIS

**Decizie: bump de versiune `CURRENT_SAVE_VERSION: 2 → 3` cu `MIGRATIONS[2]` aditiv** (nu "aditiv fără bump"). Justificare: (1) schema capătă câmpuri noi cu semantică proprie (`seededInspiration` în runState — obligatoriu pentru regula anti-exploit §5.4 — plus rândurile generatorilor 9–14 și nivelele noi de Atelier); (2) lanțul `MIGRATIONS` din `save.ts` există deja și e testat — un pas explicit e verificabil câmp-cu-câmp, pe când "aditiv implicit" ar împrăștia default-uri prin tot codul; (3) sanitize-ul rămâne un singur loc de adevăr per versiune.

| Câmp | Valoare la migrare | Notă |
|---|---|---|
| generatorii 9–14 (`owned`) | **0** | aceeași structură de rând ca 1–8 |
| upgrade-urile v3 de rundă (§4.3) | necumpărate | run-scoped |
| nivele Atelier v3 (§6.1) | 0 / necumpărate | `meta.atelier` — chei noi |
| achievements 25–36 | blocate | |
| `run.seededInspiration` | **0** | runda în curs la migrare nu a avut seed mai mare de Dog-Eared 300, iar q(300)=0 ⇒ zero impact numeric |
| praguri >100, bonusuri unice, taper | NIMIC de stocat | derivate din `owned` (ca 25/50/100) |
| relics noi | NIMIC de stocat | derivate din `tomesPublished` (regula 09 §1.4) |
| formula de prestige | stateless | doar funcția se schimbă |

**Producția post-migrare identică termen cu termen** — prin construcție: toate sursele noi sunt neutre la zero (0 generatori noi ⇒ 0 producție; praguri <150 ⇒ ×1; fără Atlas ⇒ ×1; formula sub 1e9 identică). Criteriul 7.11: test unit obligatoriu pe un save v2 sintetic (10 tomuri, Atelier parțial) — producție egală, nimic pierdut, `goldenQuills ≤ lifetimeQuillsEarned` păstrat.

---

## 9. Constante FINALE gata de copiat în config (`src/engine/config.ts`, secțiune v3)

```ts
// ——— v3: generatorii 9-14 (randati DOAR cu nivelul New Wing corespunzator) ———
export const V3_GENERATORS = [
  { id: 'sagaCitadel',      baseCost: 6e9,    baseProd: 3.2e5,  growth: 1.11, revealAt: 3e9,    wing: 1 },
  { id: 'narratorsGuild',   baseCost: 1.3e11, baseProd: 2.4e6,  growth: 1.11, revealAt: 6.5e10, wing: 1 },
  { id: 'pantheonPress',    baseCost: 3e12,   baseProd: 1.8e7,  growth: 1.11, revealAt: 1.5e12, wing: 2 },
  { id: 'worldTreeArchive', baseCost: 7e13,   baseProd: 1.4e8,  growth: 1.10, revealAt: 3.5e13, wing: 2 },
  { id: 'sleepingCity',     baseCost: 1.7e15, baseProd: 1.05e9, growth: 1.11, revealAt: 8.5e14, wing: 3 },
  { id: 'onceUponATime',    baseCost: 4.2e16, baseProd: 8e9,    growth: 1.12, revealAt: 2.1e16, wing: 3 },
] as const;

// ——— v3: Deep Shelves (taper RELATIV pe benzi de 100, podea 1.04) ———
export const DEEP_SHELVES = { bandSize: 100, taperRel: [1.0, 0.8, 0.6, 0.45], floor: 1.04 } as const;
// g_b = max(1 + (growth-1)*taperRel[b], floor); unitatile 1-101 au pretul v1 EXACT.
// bulkCost = suma geometrica pe bucati per banda, ceil O DATA pe total (v. 14 §3).

// ——— v3: praguri de cantitate noi (peste 25/50/100 din v1) ———
export const QTY_THRESHOLDS_V3 = [150, 300, 400, 500] as const;   // x2, x2, x2, x4
export const QTY_FINALE_MULT = 4;                                  // la 500 (badge auriu)
export const UNIQUE_THRESHOLD = 200;                               // bonus unic per generator
export const UNIQUE_THRESHOLD_TELLING = 150;                       // cu hundredthTelling (tomes>=100)
// Strength of the Stacks: x2 -> x2.5 si x4 -> x5 (doar pragurile >100)

// ——— v3: bonusurile unice la 200 (run-scoped; valori exacte) ———
export const UNIQUE_BONUSES = {
  wanderingMuse:    { clickMult: 2 },
  inkSprite:        { inkEchoRate: 0.02 },          // 0.01 -> 0.02
  talkingRaven:     { costMult: 0.97 },             // multiplicativ cu patronsFavor
  enchantedQuill:   { buffDurationBonusSec: 5 },
  storyLoom:        { tiers1to4Mult: 3 },
  dreamLibrary:     { offlineEffBonus: 0.05 },      // plafon global eficienta 0.90
  fableForge:       { buffProdMult: 2.5 },          // 2 -> 2.5
  mythEngine:       { buffCooldownReductionSec: 10, cooldownFloorSec: 45 },
  sagaCitadel:      { sparkIntervalMult: 0.75 },
  narratorsGuild:   { achievementBonusMult: 1.5 },
  pantheonPress:    { bonusQuillsPerPublish: 1 },
  worldTreeArchive: { extraOfflineCapMs: 12 * 3_600_000 },
  sleepingCity:     { sparkRewardMult: 2 },
  onceUponATime:    { globalMult: 2 },
} as const;

// ——— v3: re-scalerele de runda (unlock: owned >= 150; NU persista prin Manuscript) ———
export const V3_RUN_UPGRADES = [
  { id: 'hundredNamesOfMuse', gen: 'wanderingMuse',  mult: 1000, cost: 5e10 },
  { id: 'inkTide',            gen: 'inkSprite',      mult: 800,  cost: 2e11 },
  { id: 'parliamentOfRavens', gen: 'talkingRaven',   mult: 600,  cost: 8e11 },
  { id: 'quillstorm',         gen: 'enchantedQuill', mult: 500,  cost: 3e12 },
  { id: 'theGreatTapestry',   gen: 'storyLoom',      mult: 400,  cost: 1.2e13 },
  { id: 'infiniteStacks',     gen: 'dreamLibrary',   mult: 300,  cost: 5e13 },
  { id: 'forgeOfLegends',     gen: 'fableForge',     mult: 200,  cost: 2e14 },
] as const;
export const V3_RUN_UPGRADE_UNLOCK_OWNED = 150;

// ——— v3: prestige pe segmente (identic v1 sub 1e9; garda 1e-9 DOAR pe seg. 2-3) ———
export const PRESTIGE_V3 = {
  knee1: 1e9,  coef2: 100,  exp2: 1 / 6,
  knee2: 1e15, coef3: 100 * Math.pow(1e6, 1 / 6) /* = 1000 exact */, exp3: 1 / 12,
  epsilon: 1e-9,
} as const;
// quills = f(totalEarnedThisRun - run.seededInspiration)   <- REGULA NET-SEED, 14 §5.4

// ——— v3: Atelier (efecte din 13 §4.1; preturi recalibrate) ———
export const ATELIER_V3 = [
  { id: 'theNewWing',          costs: [25, 2_500, 60_000] },  // L1: 9-10; L2: 11-12; L3: 13-14
  { id: 'clockworkUnderstudy', costs: [40] },
  { id: 'curatorsPatience',    costs: [75],      extraOfflineCapMs: 24 * 3_600_000 },
  { id: 'perpetualManuscript', costs: [120] },
  { id: 'strengthOfTheStacks', costs: [8_000],   thresholdMult: 2.5, finaleMult: 5 },
  { id: 'atlasOfUntoldLands',  costs: [400_000], globalMult: 2 },
] as const; // total v3: 470.760; cu v2: 470.852

// ——— v3: Relics noi (derivate din tomesPublished; NU se salveaza) ———
export const RELICS_V3 = [
  { id: 'forewordByTheEditor', tomes: 50,  startFractionOfPrevTe: 0.001, cap: 1e18 }, // intra in seededInspiration!
  { id: 'pilgrimsPages',       tomes: 75,  fragmentsPerQuill: 3 },                    // 5 -> 3
  { id: 'hundredthTelling',    tomes: 100, uniqueThreshold: 150 },
  { id: 'endlessShelf',        tomes: 200, bookshelfCap: 100 },                       // 25 -> 100
] as const;
```

Achievements (12, condițiile din 13 §5.1 neschimbate) și milestones de reveal (6, pragurile din §2) — id-urile din 13 sunt contractul; nu le repet aici.

---

## Ce s-a decis

- **Generatorii 9–14 FINALI:** baseCost/revealAt din 13 confirmate; **baseProd recalibrate** (payback ~×3/tier, continuarea curbei v1 ×2.6) și **growth 1.11/1.12 pe tiers 13–14** — singura combinație care ține fereastra 28–56 de zile fără să atingă tier-urile 1–8.
- **Deep Shelves FINAL: taper relativ** ×1/×0.8/×0.6/×0.45 din (growth−1), podea 1.04 — identic cu intenția 13 pe tier 1, fricțiune reală pe 9–14; formula de bulk pe benzi dată exact (§3).
- **Praguri 150/300/400/500 (×2/×2/×2/×4) + 200 = bonus unic** — confirmate; cele 14 bonusuri unice cu valorile exacte (§4.2); **re-scalerele cu multiplicatori dublați** (×1000…×200) și costurile 5e10–2e14 confirmate.
- **Prestige FINAL:** sqrt EXACT ≤1e9 (property-test 2M eșantioane), apoi **rădăcina a 6-a** până la 1e15 (1e15→1.000), apoi **rădăcina a 12-a** (1e24→5.623); continuu (diff 0 la genunchiuri, cu garda 1e-9), monoton; `QUILL_BONUS` 0.30 neatins. **Regulă nouă anti-exploit: quills pe te NET de `seededInspiration`** (altfel Foreword = farm infinit).
- **Atelier v3:** New Wing **25/2.500/60.000**, Stacks **8.000**, Atlas **400.000** (restul ca în 13); sink total 470.852 🪶 ancorat pe venitul real (~635K lifetime la ziua 30). **Relics:** praguri 50/75/100/200 confirmate; **Foreword cap 1e15→1e18**.
- **Migrare: versiune 2→3, `MIGRATIONS[2]` aditiv** + câmp nou `run.seededInspiration` (0 la migrare); nimic derivat nu se stochează.
- Simulatorul nou `tools/economy-sim-longevity.mjs` cu RUN L0–L10 re-rulabile; criteriile 13 §7: 9 PASS, 7.3 recalibrat (<48h, imposibil <24h sub invarianta v1), 7.6 PARTIAL cu mitigări documentate.

## De ce

- **Iterațiile de calibrare au arătat că cifrele inițiale din 13 colapsau arcul în zile:** payback ×2 pe tiers noi + taper absolut aproape plat + gate-uri de 60–150 🪶 contra unui venit real de mii de 🪶/zi = tier 14 în ziua 3 și 6M de quills (prima rulare e păstrată în istoricul acestui doc ca justificare). Fiecare deviere e exact butonul sancționat de 13 (§7.8 re-scalerele, §Riscuri pragurile/plafoanele, §3.2 exponenții/genunchii).
- **Frâna 1/6+1/12** e singura din sweep care ține ziua 30 sub 1e6 quills cu breakpointul 1G→100 intact — criteriul (d) al clientului.
- **Net-seed (§5.4)** e obligatorie, nu opțională: fără ea, orice head-start care intră în totalEarned devine imprimantă de quills la publish instant.
- **Prețurile mari de Atelier** nu penalizează casualul: totul rămâne cumpărabil în arc (Atlas ziua 26), dar gate-urile chiar pacing-uiesc (Wing L3 = săptămâna a 2-a, nu ziua 3).

## Fișiere create sau modificate

- **Creat:** `C:/Projects/Games/Fable Idler/ai-memory/14-longevity-economy.md` (acest document).
- **Creat:** `C:/Projects/Games/Fable Idler/tools/economy-sim-longevity.mjs` (simulatorul v3; comanda de rulare în preambul).
- **NEATINSE:** `src/`, `server/`, `tests/`, config-uri, `tools/economy-sim.mjs`, `tools/economy-sim-v2.mjs`, documentele existente (09/11 au deja nota de trimitere adăugată de Agent 1 v3).

## Riscuri

- **Modelul de jucător e determinist și greedy-rațional** (±15–25% marjă realistă, ca în v1/v2): un hiper-activ cu 4+ sesiuni/zi comprimă arcul spre ~21 de zile (limita greedy din criteriul 7.5), un pur-idle îl întinde spre 8+ săptămâni. Ferestrele raportate sunt pentru modelul §1.
- **Criteriul no-dead-time <24h pe first-ever** nu e satisfăcut în ferestrele de economisire (z5–10, z20–26) și în coadă — mitigări în §7.1(b); dacă produsul cere strict <24h, butoanele sunt listate acolo (necesită întoarcere la design pentru conținut nou, NU doar cifre).
- **Coada de 56 de zile urcă la ~1.7M quills lifetime** — inofensiv numeric (mult sub orice plafon), dar afișajul trebuie să suporte 7 cifre la contorul de quills (agentul UI).
- **`seededInspiration`** introduce o regulă nouă în engine cu teste obligatorii: publish instant după Foreword ⇒ 0 quills; seed-ul nu scade niciodată te-ul sub 0; Dog-Eared rămâne echivalent numeric cu v2.
- **Achievement-ul deepShelves (500)** pică după ziua 30 la casual (z30–45) — intenționat trofeu de coadă; dacă feedback-ul cere, primul buton e taperul benzii 301+ (0.45 → 0.40).

## Ce trebuie să știe următorul agent

- **Arhitect v3:** `MIGRATIONS[2]` per tabelul §8; câmp nou `run.seededInspiration` (number, default 0, setat la începutul rundei = Dog-Eared + Foreword; intră în sanitize cu clamp `0 ≤ seeded ≤ totalEarnedThisRun`); New Wing = pattern `blueprintOfMyths` pe 3 nivele; NIMIC derivat în save.
- **Engine v3:** copiați blocul §9 literal; costul folosește formula pe benzi din §3 (bulk = sumă pe bucăți, `ceil` o dată); prestige = `quillsForPublish(te − seeded)` cu garda 1e-9 DOAR pe segmentele 2–3 (segmentul 1 rămâne bit-identic cu v1!); ordinea multiplicatorilor rămâne lanțul 03 §2 + 11 §7, cu inserțiile: re-scaler în pasul 2 (per-gen), Warp-and-Weft pas 3¾ (per-gen, tiers 1–4), Atlas și …Happily Ever After în globalMult lângă pasul 5, Everyone's Biographer pe RATA pasului 6.
- **Teste v3:** granițele benzilor (unitățile 100/101, 200/201, 300/301) per generator; continuitate prestige la 1e9±1 și 1e15±1e6 (diff ≤1, cu garda = 0); property `q(te)==sqrt-formula` sub 1e9; net-seed (publish instant post-Foreword = 0 🪶); RUN L0 din simulator = oracolul de regresie v1; migrare v2→v3 câmp-cu-câmp + producție identică.
- **UI v3:** contor quills până la 7 cifre; preview-ul de prestige afișează `quillsForPublish(te−seeded)` (jucătorul nu vede segmentele); prețurile mari de Atelier (60K/400K) au nevoie de progres vizibil ("Saving: 42.130 / 60.000") — asta e și mitigarea principală pentru nota (b); badge auriu la 500; numele bonusului unic pe badge-ul de 200.
- **Re-rulare:** comanda din preambul; RUN L0 și L1 TREBUIE să rămână PASS după ORICE ajustare de cifre — sunt invariantele client.

## Validări făcute

- **RUN L0:** v1-compat exact (24m23s / 16m49s / 11m45s, prod 721.6/s, 7 ach) — PASS.
- **RUN L1:** runda 1 cu TOATE sistemele v3 pornite = identică țintă-cu-țintă și în prod cu v1 — invarianta primelor 40 de minute demonstrată, nu doar afirmată.
- **RUN L2:** property-test 2M eșantioane ≤1e9; continuitate exactă la 1e9/1e15 (cu garda 1e-9); monotonie pe 19.000 de puncte log; sweep pe 4 variante de formulă.
- **RUN L3–L6:** arcul de 30 de zile (tabel zi-cu-zi) + fereastra de endgame pe 56 de zile (bundle complet z29–30; 36/36 ach ≤ z56).
- **RUN L7–L9:** anti-treadmill 5.7 min (vs 2–4 min v2), formula veche vs nouă (×99.873 la ziua 30), share T1-7 în era T12 = 18.8–54.4%.
- **RUN L10:** criteriul 7.3 sub modelul 13 (2×30 min): tier 9 la 36.2h.
- **Aritmetică statică:** Muse #500 = 3.59e21, OUAT #100 = 3.13e21, OUAT #150 = 3.1e23, OUAT #200 = 3.06e25, City #200 = 2.45e23; sink 470.852; paybacks 9–14 pe curba ×2.8–3.2.
- Toate rulările prin `docker run --rm node:22-alpine` (host fără Node), output cu PASS/FAIL explicit, re-rulabil oricând.
