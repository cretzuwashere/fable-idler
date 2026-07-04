# 13 — The Long Road: Longevity Game Design (Agent 1 v3, 2026-07-04)

> Convenție (identică 01/09): documentul e în română; **toate numele de entități sunt în engleză și FINALE**, cu id-uri `camelCase` folosite identic în cod, teste și UI. Acest document extinde v1 (`01`/`03`) și v2 (`09`/`11`) fără să le rescrie. Cifrele de aici sunt versiunea INIȚIALĂ de design — valorile FINALE le fixează economia longevității în **`14-longevity-economy.md`** (aceeași relație ca 01↔03 și 09↔11: structura și id-urile de aici NU se schimbă; cifrele se calibrează prin simulare și se marchează cu **[DECIZIE DE CALIBRARE]**).

> **Cerința clientului:** jocul trebuie să devină MULT mai lung — toate generatoarele extinse și progresia regândită pe termen lung: **zile → săptămâni de joc casual**, nu ore.

---

## 0. Invariante dure + vederea de ansamblu

### 0.1 Invariante (nenegociabile)

1. **Primele ~40 de minute (până la primul prestige) rămân IDENTICE.** Criteriile validate v1 (primul generator <30s, primul publish 20–40 min — 01 §10, 03 §9) nu se ating. Alungirea e exclusiv pe mid/late game.
2. **Compatibilitate:** save v2 migrează aditiv (generatori noi = 0, upgrade-uri noi necumpărate, nimic pierdut, producție post-migrare identică termen cu termen).
3. **Plafon numeric:** `double` nativ (~1e308) e plafonul tehnic; `format-numbers.ts` are sufixe până la 1e33 (K…No) apoi științific. Ținta de endgame: **totalEarned maxim pe tot orizontul < ~1e24** — confortabil sub 1e50 și chiar sub pragul științific (toate numerele rămân în sufixe).
4. Nimic din v1/v2 nu se redenumește; toate id-urile noi sunt verificate fără coliziuni (§Validări).

### 0.2 De ce primele 40 de minute rămân identice — prin construcție

Tot conținutul nou e structural inaccesibil în fereastra primei runde:
- Tier-urile 9–14 sunt în spatele **The New Wing** (Atelier, ≥25 🪶 — cere multe tomuri) ȘI a unor praguri `revealAt ≥ 3e9` (runda 1 atinge ~4e5).
- Pragurile de cantitate noi încep la **150 unități** (runda 1 se termină cu ~50 din tier 1).
- Cele 7 upgrade-uri noi de rundă se deblochează la **owned ≥ 150** din generatorul respectiv.
- Îmblânzirea curbei de cost („Deep Shelves", §2.2) începe abia de la **unitatea 101**.
- Genunchiul noii formule de prestige e la **totalEarned = 1e9** — primele ~10+ tomuri (RUN G din 11 §8.1 ajunge la tomul 12 cu te ≈ 1.7e7) sunt matematic identice.

### 0.3 Cele trei axe ale alungirii

| Axă | Ce adaugă | Secțiune |
|---|---|---|
| **Lățime** | 6 tier-uri noi de generatori (9–14), gate-uite prin Atelier | §1 |
| **Adâncime** | Praguri de cantitate 150–500 cu 14 bonusuri UNICE + 7 upgrade-uri de re-scalare a tier-urilor vechi + îmblânzirea curbei de cost peste 100 unități | §2 |
| **Meta** | Curbă de prestige frânată peste 1e9 (anti-inflație de quills) + Atelier extins (sink 25–500 🪶) + 4 Relics la praguri mari de tomuri + 12 achievements + 6 milestones | §3–§5 |

---

## 1. Roster-ul extins: de la 8 la 14 generatori

### 1.1 Tabelul complet (1–8 NESCHIMBAȚI; 9–14 noi)

Cifrele 9–14 sunt **ordine de mărime** (economia calibrează): cost ~×20–25 per tier (crescător — v1 folosea ×9–15; distanțele mai mari SUNT alungirea), payback de bază ~×2 per tier (mai blând decât ×2.6 v1 — tier-urile târzii trebuie să rămână cumpărabile în runde de ore, nu de zile).

| # | Generator | id | baseCost | baseProd /sec | growth | revealAt (totalEarned) | Gate |
|---|---|---|---:|---:|---:|---:|---|
| 1 | Wandering Muse | `wanderingMuse` | 15 | 0.1 | 1.15 | 10 | — |
| 2 | Ink Sprite | `inkSprite` | 100 | 1 | 1.15 | 60 | — |
| 3 | Talking Raven | `talkingRaven` | 1.100 | 8 | 1.14 | 600 | — |
| 4 | Enchanted Quill | `enchantedQuill` | 12.000 | 47 | 1.13 | 6.000 | — |
| 5 | Story Loom | `storyLoom` | 130.000 | 260 | 1.13 | 65.000 | — |
| 6 | Dream Library | `dreamLibrary` | 1.4e6 | 1.400 | 1.12 | 7e5 | — |
| 7 | Fable Forge | `fableForge` | 2e7 | 7.800 | 1.12 | 1e7 | — |
| 8 | Myth Engine | `mythEngine` | 3e8 | 45.000 | 1.12 | 1.5e8 | `blueprintOfMyths` (12 🪶) |
| **9** | **Saga Citadel** | `sagaCitadel` | **6e9** | **450.000** | 1.11 | 3e9 | **The New Wing L1** |
| **10** | **The Narrators' Guild** | `narratorsGuild` | **1.3e11** | **5e6** | 1.11 | 6.5e10 | The New Wing L1 |
| **11** | **Pantheon Press** | `pantheonPress` | **3e12** | **6e7** | 1.11 | 1.5e12 | **The New Wing L2** |
| **12** | **World-Tree Archive** | `worldTreeArchive` | **7e13** | **7e8** | 1.10 | 3.5e13 | The New Wing L2 |
| **13** | **The Sleeping City** | `sleepingCity` | **1.7e15** | **8.5e9** | 1.10 | 8.5e14 | **The New Wing L3** |
| **14** | **Once Upon a Time** | `onceUponATime` | **4.2e16** | **1e11** | 1.10 | 2.1e16 | The New Wing L3 |

- Rapoarte de cost 9→14: ×20 / ×21.7 / ×23 / ×23.3 / ×24.3 / ×24.7 — în banda cerută ×15–25, crescător spre final. Endgame-ul final (4.2e16) e în zona cerută 1e15–1e20.
- `revealAt` = ~50% din baseCost (regula v1, 01 §4). Ca la Myth Engine: rândul NU se randează deloc fără nivelul de New Wing corespunzător — fiecare nivel al aripii noi e o surpriză, nu un teaser.
- Toate regulile existente se aplică automat: praguri de cantitate (`qty:<gen>:<n>`), formula de cost/bulk 03 §1, Patron's Favor, formatul milestone-urilor.
- Sanity numeric: Once Upon a Time #100 ≈ 4.2e16 × 1.10⁹⁹ ≈ **5.3e20**; costul cumulat al 100 de unități ≈ 5.8e21 — sub plafonul 1e24 din §0.1, cu marjă.

### 1.2 Fantezia progresiei (atelier → mit → cosmologia poveștilor) + flavor (1 frază, ton bibliotecar excentric)

| # | Generator | Icon sugerat | Flavor |
|---|---|---|---|
| 9 | **Saga Citadel** | 🏰 | "A fortress-city where every rampart is a chapter and the garrison drills in iambic pentameter." |
| 10 | **The Narrators' Guild** | 🎭 | "A thousand narrators, each assigned to somebody else's life; union rules strictly forbid narrating their own." |
| 11 | **Pantheon Press** | ⚜️ | "The pantheons the Myth Engine dreamed up have founded their own printing press — they mostly publish memoirs about you." |
| 12 | **World-Tree Archive** | 🌳 | "An archive grafted onto the World-Tree: every leaf a story, and autumn is the annual backup." |
| 13 | **The Sleeping City** | 💤 | "A city asleep for a thousand years, dreaming its citizens into being — and lately, it has begun dreaming you." |
| 14 | **Once Upon a Time** | 📜 | "The oldest sentence in the world; every story ever told still lives inside it." |

**Igiena numelor (deliberată, ca „Stray Spark" în 09):**
- Am EVITAT „Choir of Narrators" (coliziune verbală cu milestone-ul v1 `choirOfMuses` — „Choir of Muses") → **The Narrators' Guild**.
- Am EVITAT „The First Word" (coliziune verbală cu achievement-ul #1 `firstWords` — „First Words" și cu milestone-ul `theFirstSpark`) → **Once Upon a Time** (`onceUponATime`) — capstone-ul tematic perfect: propoziția primordială din care ies toate poveștile.
- Am EVITAT „The Dreaming City" („dream" era deja în `dreamLibrary` + `lucidDreaming`) → **The Sleeping City**.

---

## 2. Extinderea în adâncime a generatoarelor EXISTENTE (cerința „toate generatoarele extinse")

### 2.1 Praguri de cantitate noi, peste 100 — schema aleasă

Pragurile v1 (25/50/100 → ×2 fiecare) rămân neschimbate. Peste ele, pentru TOȚI cei 14 generatori:

| Prag | Efect | ID |
|---:|---|---|
| **150** | producția acelui generator **×2** | `qty:<gen>:150` |
| **200** | **BONUS UNIC per generator** (tabelul §2.3) — diferențiatorul de personalitate | `qty:<gen>:200` |
| **300** | producția **×2** | `qty:<gen>:300` |
| **400** | producția **×2** | `qty:<gen>:400` |
| **500** | producția **×4** — „grand finale", badge auriu pe card | `qty:<gen>:500` |

- Cumulat la 500 unități: ×8 (v1) × 2×2×2×4 = **×256** pe generatorul respectiv — recompensa pentru „deep-buying", strategia nouă a arcului lung.
- 5 praguri × 14 generatori = **70 de milestones de cantitate noi** (se re-ating per rundă, ca în v1).
- Bonusurile unice de la 200 sunt **run-scoped** ca orice milestone de cantitate (se resetează la prestige și se re-ating) — toate efectele din §2.3 sunt alese să fie sigure la re-atingere (fără efecte „la începutul rundei viitoare").

### 2.2 Regula „Deep Shelves" — îmblânzirea curbei de cost peste 100 de unități

**Problema:** cu growth 1.15, unitatea #500 din Wandering Muse ar costa ~3.5e31 — de neatins sub plafonul 1e24. Fără o corecție, pragurile 300+ ar fi conținut mort pe tier-urile timpurii.

**Soluția (intrinsecă, nu cumpărată):** growth-ul se aplatizează pe benzi de unități — tematic, „cuvântul se duce: cu cât ai mai mulți, cu atât vin mai ușor":

```
unități 1–100:    growth integral (NESCHIMBAT — invarianta §0.1)
unități 101–200:  growth − 0.03   (ex. 1.15 → 1.12)
unități 201–300:  growth − 0.06   (ex. 1.15 → 1.09)
unități 301+:     growth − 0.09, cu podea 1.04
```

- Verificare de reachability (Wandering Muse): #100 ≈ 1.5e7 (neschimbat), #200 ≈ 1.3e12, #300 ≈ 7e15, #400 ≈ 2.4e18, #500 ≈ **8e20** — atins în ultimele săptămâni de endgame, exact rolul de trofeu. Once Upon a Time #200 ≈ 4.6e23 — TROFEUL final absolut, la limita superioară a orizontului.
- Pur benefic (costuri doar mai mici peste #100) ⇒ compatibil aditiv cu orice save; nu atinge runda 1 (max ~50 unități).
- **Notă engine:** formula de cost devine geometrică pe bucăți — bulk-buy se calculează ca sumă pe benzi (economia dă formula exactă în 14).

### 2.3 Cele 14 BONUSURI UNICE la 200 de unități (toate finale, nume + efect)

Fiecare generator își arată personalitatea la 200 de unități. Efectele sunt run-scoped, distribuite pe mecanici diferite (click / echo / costuri / buff / tier-uri vechi / offline / spark / achievements / prestige / global):

| # | Generator | Nume bonus (final) | Efect exact |
|---|---|---|---|
| 1 | Wandering Muse | **A Hundred Whispers** | Click power **×2** (muzele îți șoptesc direct în mâna care scrie) |
| 2 | Ink Sprite | **Ink in the Margins** | Rata Ink Echo **1% → 2%** din effectiveProd per click (latent dacă `inkEcho` nu e cumpărat încă în rundă) |
| 3 | Talking Raven | **A Conspiracy of Ravens** | Toate costurile de generatori **−3%** (multiplicativ cu Patron's Favor: ×0.95×0.97) |
| 4 | Enchanted Quill | **The Quills Write Back** | Durata Moment of Inspiration **+5s** (aditiv, după Burst of Genius: 22.5 → 27.5s) |
| 5 | Story Loom | **Warp and Weft** | Producția tier-urilor 1–4 **×3** (firele vechi, re-țesute pe urzeală nouă) |
| 6 | Dream Library | **The Library Never Closes** | Eficiența offline **+5pp** (stack cu Lucid Dreaming / Reader's Letter) |
| 7 | Fable Forge | **White-Hot Archetypes** | Multiplicatorul de producție al buffului **×2 → ×2.5** |
| 8 | Myth Engine | **Perpetual Myth** | Cooldown-ul Moment of Inspiration **−10s** (stack cu Restless Heart; podea globală 45s) |
| 9 | Saga Citadel | **The Garrison Sallies Forth** | Intervalul de spawn Stray Spark **−25%** (stack cu Sparkcatcher's Net L1) |
| 10 | The Narrators' Guild | **Everyone's Biographer** | Bonusul per achievement **+50%**: 0.01 → 0.015 (cu Bound Anthology: 0.02 → 0.03) |
| 11 | Pantheon Press | **Divine Royalties** | **+1 Golden Quill** la Publish-ul acestei runde (stack cu Editor's Due; portofel + lifetime) |
| 12 | World-Tree Archive | **Deep Roots** | Plafonul offline **+12h** (rădăcinile lucrează și când dormi; stack cu Night Owl Pact / Curator's Patience) |
| 13 | The Sleeping City | **The City Dreams of You** | Recompensele Stray Spark **×2** (cumulativ cu Net L2 → ×4; buton de frână listat la Riscuri) |
| 14 | Once Upon a Time | **…Happily Ever After** | Producție globală **×2** (capstone-ul absolut al unei runde) |

### 2.4 Cele 7 upgrade-uri noi de rundă (re-scalarea tier-urilor vechi 1–7)

Upgrade-uri de rundă normale (Inspiration, se resetează la prestige — dau rundelor lungi propriul arc de cumpărături), târzii, care împiedică moartea tier-urilor vechi în late game. **Unlock uniform: owned(gen) ≥ 150** — apar exact când pragurile noi încep să conteze. Multiplicatorii sunt descrescători (tier-urile mai vechi au gap-ul de bază mai mare):

| # | Nume (final) | ID cod | Efect | Cost orientativ | 
|---|---|---|---|---:|
| 12 | **A Hundred Names of the Muse** | `hundredNamesOfMuse` | Wandering Muse **×500** | 5e10 |
| 13 | **The Ink Tide** | `inkTide` | Ink Sprite **×400** | 2e11 |
| 14 | **Parliament of Ravens** | `parliamentOfRavens` | Talking Raven **×300** | 8e11 |
| 15 | **Quillstorm** | `quillstorm` | Enchanted Quill **×250** | 3e12 |
| 16 | **The Great Tapestry** | `theGreatTapestry` | Story Loom **×200** | 1.2e13 |
| 17 | **The Infinite Stacks** | `infiniteStacks` | Dream Library **×150** | 5e13 |
| 18 | **Forge of Legends** | `forgeOfLegends` | Fable Forge **×100** | 2e14 |

- Numerotarea continuă lista v1 (1–11); intră în pasul 2 al lanțului de multiplicatori (per-gen upgrade, 03 §2).
- Myth Engine NU primește re-scaler: e generatorul de endgame v2, cu payback-ul cel mai bun al erei lui — primește în schimb bonusul unic la 200 și pragurile extinse.
- Aceste 7 upgrade-uri **NU** sunt păstrate de Second Bookmark / Perpetual Manuscript (§4.1 #4) — rămân decizii per rundă.

---

## 3. Cadența de prestige pe arcul lung — frânarea formulei de quills

### 3.1 Problema (cunoscută)

`quills = floor(sqrt(te/1e5))` explodează pe orizontul nou: la te = 1e15 dă **100.000 🪶 per publish**, la 1e19 dă 10M — inflație totală (sink-ul Atelier devine irelevant, bonusul pasiv +30%/quill aruncă producția în exponențial necontrolat, treadmill-ul din 11 §8.2 devine avalanșă).

### 3.2 Soluția conceptuală RECOMANDATĂ: rădăcini pe segmente, continue

```
quills(te) =
  te ≤ 1e9   : floor( sqrt(te / 1e5) )                 // EXACT v1/v2 — NEATINS
  1e9 < te ≤ 1e15 : floor( 100  × (te / 1e9)^(1/4) )   // rădăcina a 4-a
  te > 1e15  : floor( 3162 × (te / 1e15)^(1/6) )       // rădăcina a 6-a
```

**Breakpoints:** 1e5→1 | 4e5→2 | 1e7→10 | **1e9→100 (identic v1, genunchi continuu)** | 1e11→316 | 1e13→1.000 | 1e15→3.162 (genunchi continuu) | 1e18→10.000 | 1e21→31.623 | 1e24→100.000.

**Proprietăți (invariante pentru economie):**
1. **Identică pentru te ≤ 1e9** ⇒ primul prestige ȘI primele ~10 tomuri (de fapt tot ce dă ≤100 🪶/publish, mult peste tomul 12 din RUN G) sunt EXACT ca acum; breakpointul „1G → 100 🪶" citat în 03 §6 și în push-urile Hall of Fables rămâne valid.
2. **Continuă și monotonă** la ambele genunchiuri (100 la 1e9; 3.162 la 1e15) — niciun „zid" vizibil în preview-ul de prestige.
3. **Frâna reală:** dublarea quills-urilor cere ×16 te (segmentul 2), apoi ×64 te (segmentul 3) — în loc de ×4. La 1e15, formula veche ar fi dat 100.000, cea nouă dă 3.162 (**×31 frânare**), și quills-urile per publish la endgame rămân în zona 10–50K ⇒ `lifetimeQuillsEarned` la endgame ~1e5–3e5 ⇒ multiplicatorul pasiv (1 + 0.3×lifetime) rămâne ~1e4–1e5 — exact motorul care susține rundele de 1e21+, fără să scape de sub control.
4. **`QUILL_BONUS` = 0.30 NU se atinge** — e ancora v1 (11 §8.2 o interzice explicit ca buton); frânăm CÂȘTIGUL la scări noi, nu valoarea quill-ului.

**Alternative documentate (economia decide în 14, prin simulare):**
- **(B) Log-blend:** `100 + k×log10(te/1e9)^p` peste 1e9 — mai lină, dar mai greu de comunicat în UI („de ce am primit 217?") și greu de făcut să pară „corectă" lângă sqrt-ul de sub genunchi.
- **(C) Doar sink (fără frână pe formulă):** păstrezi sqrt și scalezi prețurile Atelier ×100–1000 — RESPINSĂ ca soluție unică: problema principală e bonusul pasiv +30%/quill (explozia de producție), nu portofelul; prețuri de milioane de 🪶 ar face și numerele UI absurde. Poate coexista ca reglaj fin (§4).
- Economia poate muta genunchiurile (1e9/1e15) și exponenții (1/4, 1/6) — invariantele 1–4 de mai sus sunt contractul.

### 3.3 Efect asupra treadmill-ului (11 §8.2)

Treadmill-ul v2 (publish-uri de 2–4 min de la tomul ~8) era alimentat de sqrt: +16% te → +8% quills. Cu rădăcina a 4-a/a 6-a, câștigul marginal al unui publish rapid scade puternic peste 1e9 ⇒ rundele optime se RE-LUNGESC natural spre minute→zeci de minute→ore (jucătorul împinge mai departe ca să „merite" publish-ul) — exact cadența dorită pentru arcul de săptămâni. Criteriul măsurabil în §7.

---

## 4. Atelier extins + Relics noi (sink-ul quills-urilor arcului lung)

### 4.1 Upgrade-uri noi de Atelier (6, permanente, 25–500 🪶)

Continuă tabelul din 09 §1.2 / 11 §2 (care totaliza 92 🪶). Context de balans nou: cu formula din §3.2, un jucător în săptămâna 1–2 câștigă sute→mii de 🪶 lifetime — prețurile de mai jos sunt gândite pe acest venit (economia calibrează).

| # | Nume (final) | ID cod | Nivele / Cost 🪶 | Mecanică | Efect exact | Flavor |
|---|---|---|---|---|---|---|
| 11 | **The New Wing** | `theNewWing` | **25 / 60 / 150** | Gate de conținut (ca Blueprint of Myths, în trepte) | L1: deblochează tier-urile **9–10**; L2: **11–12**; L3: **13–14** (rândurile nu se randează fără nivelul respectiv) | "The architect insists the library always had this corridor. The corridor politely disagrees." |
| 12 | **Clockwork Understudy** | `clockworkUnderstudy` | **40** | Automatizare totală | Auto-buy pe **TOȚI generatorii** (regula 1% din sold, max 1 achiziție/sec, cel mai bun payback primul); necesită `selfWritingContract` | "It watches. It learns. It buys ravens at three in the morning." |
| 13 | **Curator's Patience** | `curatorsPatience` | **75** | Plafon offline extins | Plafonul offline **+24h** (stack: 8h bază → Lucid 12h → Night Owl 24h → **48h**) — check-in-ul de weekend contează integral | "She has waited centuries for a returning reader. What is a weekend?" |
| 14 | **Perpetual Manuscript** | `perpetualManuscript` | **120** | Persistență totală la prestige | **Toate cele 10 upgrade-uri v1 de rundă** supraviețuiesc Publish-ului (supersetul lui Second Bookmark; îl necesită la L2). Cele **7 re-scalere noi (§2.4) NU persistă** — rămân arcul de cumpărături al rundelor lungi | "Some books refuse to end. This one refuses to start over." |
| 15 | **Strength of the Stacks** | `strengthOfTheStacks` | **200** | Boost pe pragurile noi | Pragurile de cantitate **>100** dau **×2.5** în loc de ×2 (și **×5** în loc de ×4 la 500); bonusurile unice de la 200 neafectate | "The shelves lean in. The books push back." |
| 16 | **Atlas of Untold Lands** | `atlasOfUntoldLands` | **500** | Capstone global | Producție globală **×2**, permanent | "Every blank spot on the map is a story you haven't gotten to yet." |

Cost total v3: **1.170 🪶** (25+60+150+40+75+120+200+500) — sink-ul de săptămâni cerut; împreună cu v2: 1.262 🪶.

### 4.2 Relics noi (4) — praguri mari de `tomesPublished` (gratuite, automate, derivate — NU în save, regula 09 §1.4)

Continuă seria 3/7/15/30 cu ținte pe arcul de săptămâni:

| Prag Tomes | Nume (final) | ID cod | Efect exact | Flavor |
|---:|---|---|---|---|
| **50** | **Foreword by the Editor** | `forewordByTheEditor` | Începi fiecare rundă cu **0.1% din totalEarned al rundei PRECEDENTE** (plafon 1e15; intră în `inspiration` ȘI `totalEarned`, ca Dog-Eared Page) — reveal-urile timpurii sar instant, rundele lungi repornesc din mers | "The next book opens where the last one left off. The editor saw to it." |
| **75** | **Pilgrims' Pages** | `pilgrimsPages` | Story Fragments per Golden Quill: **5 → 3** | "Readers walk a long way to bring back pieces of stories. Loose pages, mostly." |
| **100** | **The Hundredth Telling** | `hundredthTelling` | Bonusurile UNICE (§2.3) se declanșează la **150** în loc de 200 (pragul ×2 de la 150 rămâne și el — moment dublu de sărbătoare) | "Tell a story a hundred times and it starts telling itself early." |
| **200** | **The Endless Shelf** | `endlessShelf` | Plafonul Bookshelf **25 → 100 fabule numărate** (+2% fiecare → max **+200%**) | "You built a shelf. The shelf, quietly, built another shelf." |

---

## 5. Achievements + Milestones noi pentru arcul extins

### 5.1 Achievements (12 noi → total 36; fiecare +1% global, dublat de Bound Anthology — regulile v1 neschimbate)

| # | Nume (final) | ID cod | Condiție |
|---|---|---|---|
| 25 | **A Longer Road** | `aLongerRoad` | Cumperi primul generator de tier 9+ (prima Saga Citadel) |
| 26 | **Cosmology Section** | `cosmologySection` | Deții ≥1 din TOȚI cei 14 generatori |
| 27 | **Two Hundred Voices** | `twoHundredVoices` | 200 de unități dintr-un singur generator (primul bonus unic) |
| 28 | **The Deep Shelves** | `deepShelves` | 500 de unități dintr-un singur generator |
| 29 | **A Number Needs a Name** | `aNumberNeedsAName` | 1e15 totalEarned într-o singură rundă (primul „Qa" pe ecran) |
| 30 | **Beyond the Alphabet** | `beyondTheAlphabet` | 1e21 Inspiration lifetime |
| 31 | **Master of the Wing** | `masterOfTheWing` | The New Wing la L3 |
| 32 | **A Thousand Feathers** | `aThousandFeathers` | `lifetimeQuillsEarned` ≥ 1.000 |
| 33 | **Marathon Novelist** | `marathonNovelist` | 50 de tomuri publicate |
| 34 | **The Complete Works** | `completeWorks` | 200 de tomuri publicate |
| 35 | **Once Upon a Hundred** | `onceUponAHundred` | 100 × Once Upon a Time (capstone-ul de generatori) |
| 36 | **Nothing Left Unwritten** | `nothingLeftUnwritten` | Toate cele 8 relics + toate upgrade-urile de Atelier (v2+v3) la nivel maxim — 100% meta |

### 5.2 Milestones noi de dezvăluire (6 — câte unul per tier nou; toast + animație, ca în v1)

| Nume (final) | ID cod | Prag (totalEarned) | Dezvăluie |
|---|---|---:|---|
| **Banners on the Horizon** | `bannersOnTheHorizon` | 3e9 (+ New Wing L1) | Saga Citadel în shop |
| **A Distant Harmony** | `aDistantHarmony` | 6.5e10 (+ L1) | The Narrators' Guild |
| **Rumors of Divinity** | `rumorsOfDivinity` | 1.5e12 (+ L2) | Pantheon Press |
| **Roots Under the Floorboards** | `rootsUnderTheFloorboards` | 3.5e13 (+ L2) | World-Tree Archive |
| **Lights Beyond the Hills** | `lightsBeyondTheHills` | 8.5e14 (+ L3) | The Sleeping City |
| **The Oldest Sentence** | `theOldestSentence` | 2.1e16 (+ L3) | Once Upon a Time |

Plus, mecanic (fără nume noi): cele **70 de praguri de cantitate** `qty:<gen>:150|200|300|400|500` (§2.1) — fiecare cu badge pe card, cel de la 200 cu numele bonusului unic afișat, cel de la 500 cu badge auriu.

---

## 6. Ritmul țintă (model casual: 2 sesiuni × 20–30 min/zi + offline nopți/weekend)

| Fereastră | Tier atins | Tomes cumulate (≈) | Lifetime 🪶 (ordine de mărime) | te/rundă tipic | Evenimente cheie | Cârligul următor, mereu vizibil |
|---|---|---:|---:|---:|---|---|
| **Ziua 1** | **9–10** | 8–15 | 30–80 | 1e9–1e10 | New Wing L1 (25 🪶), prima Saga Citadel, primele 150-praguri pe tiers 1–2 | Narrators' Guild în shop; New Wing L2 la orizont |
| **Zilele 2–3** | 11 | 25–40 | 150–400 | 1e11–1e12 | New Wing L2, Pantheon Press, primele bonusuri UNICE (200 Muses/Sprites), Clockwork Understudy | Relic 50 (Foreword) + World-Tree Archive |
| **Săptămâna 1** | **12** | 50–70 | 500–1.500 | 1e13–1e14 | Marathon Novelist, Foreword by the Editor, Curator's Patience, re-scalerele 1–3 cumpărate în runde | New Wing L3; relic 75 |
| **Săptămâna 2** | 13 | 80–110 | 2K–6K | 1e15–1e16 | The Sleeping City, Perpetual Manuscript, relics 75+100, praguri 300 pe tiers mid | The Oldest Sentence (T14) — teaser-ul final |
| **Săptămânile 3–4** | **14** | 120–160 | 8K–30K | 1e17–1e19 | Prima Once Upon a Time, Strength of the Stacks, A Thousand Feathers demult luat | OUAT ×25/50; Atlas (500 🪶); tomes 200 |
| **Săptămânile 4–8** | 14 la 100+ | 200+ | 50K–300K | 1e20–1e22 | **Endgame complet:** Once Upon a Hundred, Atlas of Untold Lands, The Endless Shelf (tomes 200), trofeele 500, toate 36 achievements, Nothing Left Unwritten | — (completare 100%) |

**Garanția „no dead time > 1 zi":** scara de unlock-uri e împletită deliberat din 6 familii care alternează — (1) reveal de tier nou (6), (2) nivel New Wing (3), (3) prag de relic (4), (4) bonus unic la 200 (14), (5) achiziție Atelier (6), (6) achievement (12) — plus 70 praguri de cantitate și re-scalerele per rundă. În fiecare fereastră din tabel există ≥2 ținte din familii diferite la sub o zi distanță; economia verifică formal criteriul §7.6 în simulare.

---

## 7. Criterii de succes MĂSURABILE (contractul pentru `14-longevity-economy.md`)

1. **V1/v2-compat exact:** simulatorul v3 cu toate flag-urile v3 off reproduce RUN A din 11 §8 la secundă (24m23s / 16m49s / 11m45s, prod 721.6/s) — inserțiile v3 sunt no-op-uri numerice dovedite.
2. **Prestige neschimbat sub genunchi:** property-test — `quillsV3(te) == quillsV2(te)` pentru ORICE te ≤ 1e9; funcția e continuă (diferență ≤1 quill la traversarea genunchilor) și monoton nedescrescătoare pe tot domeniul.
3. **Ziua 1:** modelul casual (definit exact în 14: 2×30 min activ + 1 noapte offline) deține tier 9 în <24h de timp-calendar și vede tier 10 în shop.
4. **Săptămâna 1:** tier 12 deblocat și ≥1 unitate cumpărată în ≤7 zile-calendar casual.
5. **Endgame:** tier 14 la ≥100 unități + toate 8 relics + toate 36 achievements atinse în **28–56 zile-calendar** casual (și NU mai devreme de ~21 zile în regim greedy cu offline — altfel arcul e prea scurt și se scumpesc New Wing L3 / se mută genunchiul 2).
6. **No dead time:** în simularea casual, distanța maximă dintre două unlock-uri vizibile consecutive (orice familie din §6) < 24h pe TOT arcul.
7. **Plafon numeric:** max totalEarned pe orizontul complet < 1e24; nicio valoare afișată nu depășește 1e33 (rămânem în sufixe, fără notație științifică în joc normal).
8. **Tier-urile vechi trăiesc:** în era T12+, cu re-scalerele (§2.4) + pragurile extinse cumpărate, tiers 1–7 însumează **≥5%** din producția totală (altfel se măresc multiplicatorii re-scalerelor, primul buton).
9. **Sink-ul contează, dar nu blochează:** în ziua 14 casual, costul Atelier v3 încă necumpărat ≥ 30% din lifetimeQuillsEarned; la finalul arcului totul e cumpărabil cu marjă.
10. **Anti-treadmill:** durata medie a unei runde „publish la breakpoint rezonabil" în săptămâna 2 este **≥5 minute** (frâna §3.2 vizibilă vs. 2–4 min din 11 §8.2).
11. **Migrare aditivă:** pe un save v2 sintetic (10 tomuri, Atelier parțial), producția post-migrare v3 e identică termen cu termen; generatorii 9–14 = 0; nimic pierdut.

---

## 8. Migrarea save v2 → v3 (schiță pentru arhitect — contract detaliat în 14/doc de arhitectură v3)

- `CURRENT_SAVE_VERSION: 2 → 3`; `MIGRATIONS[2] = (v2) => v3` (lanțul existent din `save.ts`).
- **Aditiv pur:** generatorii 9–14 pornesc la 0 (aceeași structură de rând ca ceilalți); upgrade-urile noi de rundă (§2.4) și de Atelier (§4.1) pornesc necumpărate; achievements noi blocate.
- **Nimic de stocat pentru:** praguri extinse (derivate din `owned`, ca 25/50/100), bonusuri unice (idem), relics noi (derivate din `tomesPublished`, regula 09 §1.4), taper-ul Deep Shelves (pură formulă de cost).
- Formula de prestige e stateless — se schimbă doar funcția; niciun câmp de migrat.
- Producția post-migrare: identică (toate sursele noi sunt neutre la zero) — criteriul §7.11.

---

## Ce s-a decis

- **Roster 8 → 14:** șase tier-uri noi finale — **Saga Citadel** (6e9), **The Narrators' Guild** (1.3e11), **Pantheon Press** (3e12), **World-Tree Archive** (7e13), **The Sleeping City** (1.7e15), **Once Upon a Time** (4.2e16) — cost ×20–25 per tier, payback ~×2, gate-uite pe trei trepte de **The New Wing**; nume alese cu igienă anti-coliziune (fără „Choir/First Word/Dreaming").
- **Adâncime pe TOATE generatoarele:** praguri noi 150/300/400 (×2), **500 (×4)** și **200 = bonus UNIC per generator** — toate cele 14 definite (§2.3); regula **Deep Shelves** (taper de growth pe benzi peste 100 unități) care face pragurile 300–500 atingibile sub plafonul numeric; **7 upgrade-uri noi de rundă** (re-scalere ×100–×500 pentru tiers 1–7, unlock la 150 owned).
- **Prestige pe arcul lung:** formulă pe segmente — sqrt EXACT până la 1e9 (primele ~10+ tomuri identice, breakpoint 1G→100 păstrat), rădăcina a 4-a până la 1e15, rădăcina a 6-a peste; continuă, monotonă; `QUILL_BONUS` 0.30 neatins; alternativele (log-blend, sink-only) documentate — economia decide forma finală în 14.
- **Atelier extins:** 6 upgrade-uri noi (25–500 🪶, total 1.170) — New Wing (gate), Clockwork Understudy (auto-buy total), Curator's Patience (offline 48h), Perpetual Manuscript (persistența celor 10 upgrade-uri v1), Strength of the Stacks (praguri >100 ×2.5), Atlas of Untold Lands (global ×2); **4 Relics noi** la tomes 50/75/100/200.
- **Conținut de ritm:** 12 achievements noi (total 36), 6 milestones de reveal, 70 praguri de cantitate noi; tabelul de ritm țintă (ziua 1 → tier 9–10; săptămâna 1 → tier 12; endgame 4–8 săptămâni) + garanția no-dead-time <24h.

## De ce

- **Distanțe ×20–25 între tier-uri + praguri în adâncime** = alungirea vine din DOUĂ direcții simultan (următorul tier scump SAU aprofundarea celor deținute), deci nu există moment fără o țintă accesibilă — anti-dead-time structural, nu doar promis.
- **Bonusurile unice la 200** transformă „mai cumpără 100 din același lucru" într-o promisiune de personalitate per generator (cerința de conținut memorabil), și dau tier-urilor vechi un motiv de existență independent de producția lor brută.
- **Deep Shelves** e singura cale prin care pragurile adânci pe tier-urile timpurii încap sub plafonul numeric fără BigInt; e pur benefică ⇒ compatibilă aditiv prin construcție.
- **Frânarea prestige-ului pe segmente** păstrează litera invariantei („primele ~10 tomuri exact") cu cel mai simplu mecanism care rezolvă și inflația de portofel ȘI explozia bonusului pasiv; frânarea câștigului (nu a valorii quill-ului) respectă interdicția din 11 §8.2 pe `QUILL_BONUS`.
- **Sink-ul 25–500 🪶** e dimensionat pe venitul noii curbe (sute→mii de quills pe săptămână), cu capstone-ul la 500 ca țintă de final; relics la 50–200 tomuri fac publicatul relevant pe tot arcul (nu doar până la 30, ca în v2).

## Fișiere create sau modificate

- **Creat:** `C:/Projects/Games/Fable Idler/ai-memory/13-longevity-design.md` (acest document).
- **Modificat (doar notă de 1 rând la final, permisă):** `C:/Projects/Games/Fable Idler/ai-memory/09-v2-game-design.md`, `C:/Projects/Games/Fable Idler/ai-memory/11-v2-economy.md` — trimitere la acest document.
- **NEATINSE:** `src/`, `server/`, `tests/`, config-uri, restul documentelor (v2 e în curs de implementare de alți agenți).

## Riscuri

- **Toate cifrele sunt orientative** (costuri/producții 9–14, benzile taper-ului, genunchiurile prestige-ului, prețurile Atelier, multiplicatorii re-scalerelor) — economia (14) le calibrează prin simulare; structura și id-urile NU se schimbă. Riscul cel mai mare: calibrarea ferestrei „28–56 zile" e sensibilă la modelul de jucător casual — 14 trebuie să definească modelul explicit și să-l simuleze cu offline real.
- **Stack-ul de multiplicatori** (×256 praguri + re-scalere ×100–500 + Atlas ×2 + Endless Shelf +200% + quill mult ~1e4–1e5) poate depăși ținta 1e24 — de verificat cap-la-cap în simulare; butoane: multiplicatorii re-scalerelor, pragul ×4→×2 la 500, plafonul Endless Shelf.
- **The City Dreams of You ×2 + Net L2 ×2 = spark rewards ×4** — potențial OP pentru hiper-activi; buton: excluderea quill-drop-urilor din dublare (ca `timeSlip` la Net L2).
- **Bonusuri unice run-scoped care ating sisteme meta-adiacente** (offline cap/eff, +1 quill la publish): efectele se evaluează pe starea rundei CURENTE — semantica trebuie fixată în teste (ex. Divine Royalties contează doar dacă pragul 200 e atins în runda publicată).
- **Piecewise growth (Deep Shelves)** complică formula de bulk-buy — sursă clasică de bug-uri off-by-one la granițele benzilor (100/200/300); teste unit dedicate pe granițe obligatorii.
- **Perpetual Manuscript** slăbește decizia de „re-build" a rundei — mitigat: cele 7 re-scalere noi rămân per-rundă, deci rundele lungi păstrează un arc de cumpărături propriu.
- **Relic 200 tomes vs. anti-treadmill:** dacă frâna §3.2 lungește rundele prea mult, 200 de tomuri pot deveni de neatins în 8 săptămâni — economia validează perechea (cadență publish, prag 200) împreună; buton: pragul relicvei (200→150).

## Ce trebuie să știe următorul agent

- **Agent 2 v3 — Economie (`14-longevity-economy.md`):** calibrează TOATE cifrele din §1–§4 fără să redenumești nimic; contractul tău = criteriile §7 (în special: RUN A intact, property-testul prestige ≤1e9, fereastra 28–56 zile, no-dead-time <24h, plafon <1e24). Definește modelul de jucător casual cu offline (2×30 min/zi) și extinde simulatorul într-un script NOU în `tools/` (ex. `tools/economy-sim-v3.mjs` — NU modifica `economy-sim.mjs`/`economy-sim-v2.mjs`); dă formula exactă de bulk-buy pe benzi pentru Deep Shelves; tranșează genunchiurile/exponenții formulei de prestige și scrie tabelul final de breakpoints.
- **Agent arhitect v3:** `MIGRATIONS[2]` aditiv (§8); niciun câmp nou obligatoriu în save în afara `owned` pentru generatorii 9–14 și nivelele noi de Atelier; pragurile/bonusurile unice/relics/taper sunt toate DERIVATE, nu stocate. New Wing = același pattern de gating ca `blueprintOfMyths` (rând nerandat fără nivel).
- **Agent UI v3:** cardurile 9–14 în shop cu icon-urile sugerate (§1.2, UI decide final); badge auriu la pragul 500; numele bonusului unic pe badge-ul de 200; preview-ul de prestige folosește noua funcție (afișarea rămâne „vei primi X 🪶" — segmentele sunt invizibile pentru jucător); Atelier-ul primește secțiunea „The New Wing" cu cele 3 trepte vizibile ca silhouette (ca sloturile de Relics).
- **Agent teste v3:** §7 e lista de teste; suplimentar: granițele benzilor Deep Shelves (unitățile 100/101, 200/201, 300/301), continuitatea prestige la 1e9±1 și 1e15±1, semantica run-scoped a celor 14 bonusuri unice, excluderile Perpetual Manuscript (cele 7 re-scalere NU persistă).
- ID-urile din tabelele acestui document sunt contractul comun — folosiți-le literal (ca în v1/v2).

## Validări făcute

- **Coerență cu documentele-sursă:** 01 (roster/praguri/prestige v1), 03 (growth/formule/constante), 09 (Atelier/Relics/Spark/id-uri v2), 11 (cifre finale v2, RUN A–H, riscul treadmill §8.2) citite integral; `src/engine/format-numbers.ts` verificat pe disc (sufixe până la 1e33, apoi științific — baza invariantei §0.1.3).
- **Unicitatea id-urilor noi** verificată contra TUTUROR listelor v1+v2 (8 generatori, 11 upgrade-uri v1, 10 Atelier v2, 4 relics v2, 24 achievements, toate milestones, recompense Spark): zero coliziuni; trei redenumiri deliberate pentru igienă verbală (§1.2).
- **Aritmetică de plafon:** OUAT #100 ≈ 5.3e20, cost cumulat 100 unități ≈ 5.8e21; Muse #500 cu taper ≈ 8e20; trofeul absolut OUAT #200 ≈ 4.6e23 — toate sub 1e24, deci sub 1e33 (sufixe) și enorm sub 1e50/1e308.
- **Aritmetică de prestige:** continuitate la genunchiuri verificată (sqrt(1e9/1e5)=100 = 100×(1e9/1e9)^¼; 100×(1e15/1e9)^¼=3.162 = 3.162×(1e15/1e15)^⅙); frânare ×31 la 1e15 vs formula veche; breakpoint 1G→100 identic v1.
- **Invarianta primelor 40 min:** verificat că fiecare mecanism nou are gate-ul explicit peste orizontul rundei 1 (§0.2) — New Wing ≥25 🪶, praguri ≥150 owned, taper ≥101 owned, genunchi prestige 1e9, reveal-uri ≥3e9.
- **Rapoarte de cost 9–14** verificate în banda cerută ×15–25 (×20→×24.7); endgame base cost 4.2e16 ∈ [1e15, 1e20].
- Document static — validarea numerică fină (simulare cu model casual + offline) e sarcina economiei v3, ca în relațiile 01↔03 și 09↔11.
