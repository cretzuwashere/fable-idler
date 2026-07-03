# 03 — Economy & Balance (Agent 2: Economy & Balance Designer)

> **Notă v2 (2026-07-04):** extensia economiei v2 (Atelier, Stray Spark, Bookshelf, Relics, reancorarea bonusului de quills pe `lifetimeQuillsEarned`) e în `11-v2-economy.md` — cifrele v1 de aici rămân neschimbate și valide.

> Toate formulele de mai jos sunt FINALE și gata de implementat în TypeScript. ID-urile sunt cele din `01-game-design.md`. Orice abatere de la design e marcată explicit cu **[DECIZIE DE CALIBRARE]** și justificată cu date din simulare (§9).

---

## 1. Generatori: cost scaling + tabel complet

**Formula de cost (unitatea următoare):**
```ts
cost(gen) = Math.ceil(baseCost * Math.pow(growth, owned) * (hasPatronsFavor ? 0.95 : 1))
```
`owned` = câte unități din acel generator deții acum (prima unitate: `owned = 0` → cost = baseCost).

**Formula de cost pentru bulk-buy (k unități deodată):**
```ts
bulkCost(gen, k) = Math.ceil(baseCost * Math.pow(growth, owned) * (Math.pow(growth, k) - 1) / (growth - 1) * (hasPatronsFavor ? 0.95 : 1))
```
(sumă geometrică; `ceil` o singură dată, pe total.)

**Tabel final (baseCost și baseProd preluate din design, growth calibrat de mine):**

| # | Generator | id | baseCost | baseProd (/sec) | growth | Vizibil la totalEarned | Cost unit. #25 |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Wandering Muse | `wanderingMuse` | 15 | 0.1 | **1.15** | 10 | 430 |
| 2 | Ink Sprite | `inkSprite` | 100 | 1 | **1.15** | 60 | 2.867 |
| 3 | Talking Raven | `talkingRaven` | 1.100 | 8 | **1.14** | 600 | 25.534 |
| 4 | Enchanted Quill | `enchantedQuill` | 12.000 | 47 | **1.13** | 6.000 | 224.412 |
| 5 | Story Loom | `storyLoom` | 130.000 | 260 | **1.13** | 65.000 | 2.431.130 |
| 6 | Dream Library | `dreamLibrary` | 1.400.000 | 1.400 | **1.12** | 700.000 | 21.253.905 |
| 7 | Fable Forge | `fableForge` | 20.000.000 | 7.800 | **1.12** | 10.000.000 | 303.627.213 |

De ce growth descrescător (1.15 → 1.12): generatorii timpurii se cumpără în volum mare (50+ în prima rundă) și au nevoie de frână; cei târzii au deja frâna în baseCost enorm — un growth mai mic îi ține cumpărabili în rundele post-prestige fără să domine prima rundă. Growth-urile sunt în banda standard 1.12–1.15 (Cookie Clicker folosește 1.15 uniform; noi relaxăm spre late-game pentru că avem doar 7 tier-uri).

Notă numerică: costul Fable Forge la unitatea #100 ≈ 1,5e12 — încape lejer în `number` (double). **Nu e nevoie de BigInt în v1**; UI-ul are nevoie de formatare cu sufixe (K/M/B/T) de la ~1e6 în sus.

---

## 2. Producție: formulă + ordinea EXACTĂ a multiplicatorilor

**Per generator:**
```ts
prodGen(g) = owned(g) * baseProd(g)
           * qtyMilestoneMult(g)      // pas 1: 2^(praguri 25/50/100 atinse) → 1, 2, 4 sau 8
           * perGenUpgradeMult(g)     // pas 2: Muse's Chorus → ×2 doar pt wanderingMuse
           * synergyMult(g)           // pas 3: Raven's Gossip → inkSprite ×(1 + 0.05*owned(talkingRaven))
                                      //         Weaver's Rhythm → enchantedQuill ×(1 + 0.10*owned(storyLoom))
```

**Global (aplicat pe suma tuturor generatorilor):**
```ts
rawProd        = Σ prodGen(g)                                  // pas 4
globalMult     = (hasGoldenInkwell ? 1.5 : 1)                  // pas 5
               * (1 + achievementBonus * achievementsUnlocked) // pas 6: 0.01, sau 0.02 cu Bound Anthology
               * (1 + 0.30 * goldenQuills)                     // pas 7: quills — ADITIV per quill, vezi §6
               * (isBuffActive ? 2 : 1)                        // pas 8: Moment of Inspiration
effectiveProd  = rawProd * globalMult                          // aceasta e valoarea „X/sec" afișată în UI
```

Reguli: multiplicatorii din aceeași categorie de tip „per bucată" (quills, achievements, sinergii) sunt **aditivi în interiorul categoriei** (`1 + rate*n`), iar categoriile între ele sunt **multiplicative**. Asta previne explozia exponențială și face fiecare sursă predictibilă și testabilă unit.

---

## 3. Click: valoare + scaling

```ts
CLICK_BASE = 1

clickValue = CLICK_BASE
           * (hasSharpenedNib ? 2 : 1)
           * (hasQuillResonance ? (1 + 0.30 * goldenQuills) : 1)
           * (isBuffActive ? 5 : 1)
           + (hasInkEcho ? 0.01 * effectiveProd : 0)   // partea „echo": 1% din producția efectivă/sec
```

**Decizii (cerute explicit de design §Riscuri):**
- Partea **Ink Echo NU e înmulțită cu ×5** din buff. Ea folosește `effectiveProd`, care include deja ×2 din buff — deci sub buff echo-ul e ×2, nu ×10. Fără această regulă, buff + echo ar fi dat ×10 pe 1% din producție și click-ul ar fi eclipsat total idle-ul în fiecare fereastră de buff.
- Cu Ink Echo, click-ul rămâne relevant late-game prin construcție: 1 click ≈ 1% din producția pe secundă, deci 2 click/s ≈ +2% venit — bonus de activitate vizibil dar niciodată dominant.
- Tot ce intră (click + idle + offline) se adună și în `current` și în `totalEarned`.

---

## 4. Upgrade-uri: cost exact + efect exact + unlock

| # | id | Cost (Inspiration) | Efect exact (numeric) | Condiție de unlock (vizibil în shop) |
|---|---|---:|---|---|
| 1 | `sharpenedNib` | **100** | click bază ×2 | totalEarned ≥ 50 |
| 2 | `musesChorus` | **500** | prodGen(wanderingMuse) ×2 | owned(wanderingMuse) ≥ 10 |
| 3 | `goldenInkwell` | **15.000** | globalMult ×1.5 | totalEarned ≥ 10.000 |
| 4 | `ravensGossip` | **25.000** | inkSprite ×(1 + 0.05 × owned(talkingRaven)) | owned(talkingRaven) ≥ 5 ȘI owned(inkSprite) ≥ 10 |
| 5 | `weaversRhythm` | **1.000.000** | enchantedQuill ×(1 + 0.10 × owned(storyLoom)) | owned(storyLoom) ≥ 5 ȘI owned(enchantedQuill) ≥ 10 |
| 6 | `lucidDreaming` | **50.000** | eficiență offline 0.5 → **0.75** ȘI cap offline 8h → **12h** | o revenire din offline ≥ 30 min |
| 7 | `burstOfGenius` | **75.000** | durata buff 15s → **22.5s** (cooldown neschimbat) | buff activat de ≥ 5 ori |
| 8 | `inkEcho` | **200.000** | click += 0.01 × effectiveProd | Σ generatori (orice tip) ≥ 25 |
| 9 | `patronsFavor` | **2.000.000** | toate costurile de generatori ×0.95 | totalEarned ≥ 1.000.000 |
| 10 | `boundAnthology` | **5.000.000** | achievementBonus 0.01 → **0.02** | achievements deblocate ≥ 10 |
| 11 | `quillResonance` | **2.500** **[DECIZIE DE CALIBRARE]** | bonusul quills (1 + 0.30×q) se aplică ȘI pe click | tomesPublished ≥ 1 |

**[DECIZIE DE CALIBRARE] Quill Resonance: 10.000 → 2.500.** Design-ul îl vrea „early buy după reset", dar la 10.000 simularea l-a cumpărat abia la min ~21 al rundei 2 (10k totalEarned se atinge la ~min 8-10). La 2.500 se cumpără la ~min 7-8 și chiar accelerează early game-ul rundei 2, care e partea click-dominată. Toate upgrade-urile 1–10 se resetează la prestige; `quillResonance` persistă (conform design §7).

---

## 5. Milestones de cantitate per generator

**Praguri: 25 / 50 / 100 unități din același generator → producția ACELUI generator ×2 la fiecare prag** (cumulativ: la 100 unități = ×8). Se aplică identic tuturor celor 7 generatori → 21 de milestones de cantitate. ID: `qtyMilestone:<genId>:<25|50|100>`.

```ts
qtyMilestoneMult(g) = Math.pow(2, [25, 50, 100].filter(t => owned(g) >= t).length)
```

De ce exact 25/50/100 (și nu 10/25/50): cu growth 1.15, unitatea #25 din Wandering Muse costă doar 430 — pragul de 25 pică natural în primele ~6 minute și dă primul „×2 badge" devreme; un prag la 10 ar fi trecut neobservat. Pragurile sunt aliniate cu achievements-urile Muse Menagerie / Full Aviary (25 din gen 1/3) — un singur moment de sărbătoare, două recompense.

Milestones de dezvăluire #1–11 (pe totalEarned: 10 / 60 / 100 / 500 / 600 / primul achievement / 6.000 / 50.000 / 65.000 / 700.000 / 10.000.000) rămân EXACT ca în design §6.2 — verificat: fiecare generator devine vizibil la ~50–60% din baseCost, iar simularea confirmă că jucătorul vede mereu următoarea țintă înainte să și-o permită.

---

## 6. Prestige: Publish the Tome

**Formula monedei câștigate (per publish, pe runda curentă):**
```ts
quillsEarned = Math.floor(Math.sqrt(totalEarnedThisRun / 1e5))
// buton activ când quillsEarned >= 1, adică totalEarned >= 100.000
```
Breakpoints: 100k → 1 | 400k → 2 | 900k → 3 | 1,6M → 4 | 2,5M → 5 | 10M → 10 | 1G → 100. Sub-liniară (sqrt): dublezi quill-urile abia la ×4 totalEarned → decizia reală „public acum sau împing?". Pragul 100k e păstrat din design (Publisher's Letter la 50k rămâne teaser valid).

**Efectul per quill: [DECIZIE DE CALIBRARE] +2% → +30% producție globală per Golden Quill, ADITIV între quills, multiplicativ cu restul:**
```ts
quillMult = 1 + 0.30 * goldenQuills   // cu quillResonance se aplică și pe click
```

**De ce am schimbat 2% → 30% (cea mai importantă decizie din acest document):** am rulat simularea cu mai multe valori. Cu +2%/quill, runda 2 (2 quills + achievements păstrate) atinge 100k doar cu **3,8% mai repede** decât runda 1 — prestige-ul ar fi fost cosmetic, iar criteriul de succes §10.6 din design („≥30% mai rapid") matematic imposibil. Sweep-ul (runda 2, 2 quills, condiții identice):

| Bonus per quill | t(100k) runda 2 | Reducere vs. runda 1 (24m23s) |
|---:|---:|---:|
| +2% | 23m27s | 3,8% |
| +10% | 20m55s | 14% |
| +15% | 19m50s | 19% |
| +25% | 17m59s | 26% |
| **+30% (ALES)** | **16m49s** | **31% ✓** |
| +40% | 15m10s | 38% (prea agresiv — al 3-lea prestige ar veni sub 15 min) |

De ce **aditiv** și nu compus: compus (1.3^q) ar exploda — la 20 quills ar fi ×190; aditiv la 20 quills = ×7, controlabil și ușor de afișat („+30% per quill"). Sqrt-ul formulei de câștig frânează oricum acumularea: 20 quills cumulate cer runde de ordinul milioanelor.

**Resetează / persistă:** exact lista din design §7 (runState vs. metaState). `totalEarnedThisRun` se resetează la 0; quills se ADAUGĂ la soldul existent la fiecare publish.

**Clarificări (Agent 6, 2026-07-03 — validate prin teste unit):**
- Câștigul de quills se calculează EXCLUSIV pe `totalEarned` al RUNDEI curente, niciodată pe lifetime (test discriminant: rundă 450k → +2, apoi rundă 100k → +1, total 3 — varianta lifetime ar fi dat 4).
- **Quill Resonance PERSISTĂ prin toate prestige-urile ulterioare** o dată cumpărat (stă în metaState; nu se re-cumpără la fiecare rundă). Cumpărabil doar după primul publish (`tomesPublished ≥ 1`), cost 2.500. Confirmat ca decizie finală — era deja intenția din design §7, acum e fixată prin teste (inclusiv: un save fabricat nu poate strecura resonance în upgrade-urile de rundă).
- Impact empiric verificat prin simulare deterministă cu funcțiile reale ale engine-ului (`tests/unit/progression-speed.test.ts`): t(100k) = 15,8 min cu 0 quills vs **9,8 min cu 3 quills → −38%** (assert permanent în suită: ≥20%).
- Protecție reset: acțiunea `hardReset` (singura care șterge quills) cere `confirm: true` la nivel de API — un dispatch fără flag e no-op garantat.

---

## 7. Buff activ: Moment of Inspiration

```ts
BUFF = {
  duration: 15,            // secunde; 22.5 cu burstOfGenius
  cooldown: 90,            // secunde, măsurat DE LA ACTIVARE (nu de la expirare)
  clickMult: 5,            // doar pe partea de bază a click-ului (NU pe partea Ink Echo — §3)
  prodMult: 2,             // intră în globalMult ca factor separat (§2 pas 8)
}
```
- Uptime: 15/90 = 16,7% bază; 22,5/90 = 25% cu Burst of Genius. Cooldown de la activare = jucătorul nu e pedepsit că a activat „prea devreme".
- Cooldown-ul **continuă să curgă offline** (simplu, prietenos); buff-ul însă NU e niciodată activ în calculul offline.
- Deblocat de milestone Racing Heart (500 totalEarned) — în simulare asta se întâmplă la ~min 2, sub criteriul de 5 min.

---

## 8. Offline progress

```ts
offlineGain = savedProdPerSec                      // effectiveProd la momentul salvării, FĂRĂ buff
            * Math.min(elapsedSeconds, capSeconds) // cap: 28800 (8h); 43200 (12h) cu lucidDreaming
            * efficiency                           // 0.5; 0.75 cu lucidDreaming
// elapsedSeconds = (Date.now() - lastSaveTimestamp) / 1000, clamp la >= 0 (protecție ceas dat înapoi)
```
- Câștigul intră și în `current` și în `totalEarned` (milestones pot sări în față la revenire — intenționat, e momentul „While you were away").
- **De ce cap 8h/12h:** 8h = o noapte de somn contează integral — check-in dimineața e mereu satisfăcător; fără cap, 3 zile de absență ar sări complet peste tier-uri și ar face jocul activ inutil. Lucid Dreaming ridică ambele (eficiență ȘI cap) ca să fie un upgrade care se simte, nu doar +25 puncte procentuale.
- **De ce eficiență <100%:** păstrează un motiv real de a juca activ (activ ai și click + buff, deci raportul real activ/offline e ~2,5–3×).
- Sanity: la finalul rundei 1 (prod ≈ 722/s), 8h @ 50% = **10,4M** Inspiration → cumperi Dream Library (1,4M) + zeci de generatori mid → criteriul §10.7 („≥2 achiziții semnificative") trecut cu marjă. Achievement Night Shift (≥1.000 dintr-o revenire) se atinge cu numai 0,07/s producție — trivial devreme, corect.

---

## 9. Simulare de sanity — metodologie și rezultate

**Script:** `tools/economy-sim.mjs` (păstrat în proiect, re-rulabil oricând). Rulare fără Node pe host:
```
docker run --rm -v "C:\Projects\Games\Fable Idler\tools:/w" node:22-alpine node /w/economy-sim.mjs
```
**Model de jucător semi-activ:** 2 click/s constant; buff activat cu ~20s întârziere după cooldown; cumpărare greedy pe payback (cost / producție marginală); economisește pentru un upgrade dacă e la <45s de venit; achievements simulate cu bonusul lor global. Tick de 1s.

**Runda 1 (0 quills, 0 achievements):**

| Moment | Timp | Notă |
|---|---:|---|
| Primul Wandering Muse | **~8s** | criteriu <30s ✓ |
| Sharpened Nib cumpărat | 1m01s | criteriu <2 min ✓ |
| Primul Ink Sprite | 2m29s | |
| Buff deblocat (500 totalEarned) | ~2m | criteriu <5 min ✓ |
| Primul Talking Raven (generatorul 3) | **13m01s** | vizibil în shop din ~min 3–4 |
| totalEarned 50k (teaser prestige) | 19m30s | |
| **totalEarned 100k → primul quill** | **24m23s** | **criteriu 20–40 min ✓** |
| totalEarned 400k → 2 quills | 35m46s | decizia „public la 1 sau împing la 2" e reală |

Final rundă 1: prod 722/s, 7 achievements, 19 activări buff, generatori [50, 36, 21, 2, 0, 0, 0].

**Runda 2 (2 quills = +60%, 8 achievements incl. Published Author, FĂRĂ achievements noi — conservator):**

| Moment | Timp | vs. runda 1 |
|---|---:|---:|
| Quill Resonance cumpărat | 7m45s | — |
| totalEarned 100k | **16m49s** | **−31% ✓** (criteriu §10.6: ≥30%) |
| totalEarned 900k → 3 quills (al 2-lea publish) | **27m19s** | runda 1 a dat 2 quills în 35m46s → al 2-lea prestige sensibil mai rapid ȘI mai valoros ✓ |

**Runda 3 (5 quills = +150%, 9 achievements):** 100k la **11m45s**, 1,6M (4 quills) la **20m37s** — fiecare tom comprimă vizibil drumul, fără să-l facă trivial. Enchanted Quill la min 14m47s vs. 33m41s în runda 1.

Simularea e conservatoare pentru rundele 2+: îngheață achievements-urile noi și nu modelează cunoștințele jucătorului sau offline-ul — în practică rundele post-prestige vor fi puțin mai rapide decât cifrele de mai sus (direcția sigură).

---

## 10. Riscuri de balans + ce se ajustează primul

**Butoane de ajustare, în ordinea în care se umblă la ele:**
1. **`QUILL_BONUS` (0.30)** — dacă meta loop-ul e prea lent/rapid. ±0.05 mută compresia rundei 2 cu ~4–5 puncte procentuale (vezi tabelul din §6). NU umbla simultan și la formula de quills.
2. **`growth` la primii 3 generatori (1.15/1.15/1.14)** — dacă runda 1 iese din fereastra 20–40 min. −0.01 pe toate trei scurtează cu ~3–4 min.
3. **`baseProd` la talkingRaven (8) și enchantedQuill (47)** — dacă min 10–20 se simte gol (zona cea mai subțire din simulare: 4m17s→9m56s fără evenimente vizibile, doar cumpărături continue).
4. **`PRESTIGE_DIVISOR` (1e5)** — mută momentul primului publish; atenție: milestone-urile Publisher's Letter (50k) și pragul butonului trebuie mutate ÎMPREUNĂ.
5. **`BUFF.cooldown` (90s)** — mai multă/mai puțină activitate cerută.
6. **`CLICK_BASE` (1)** — doar pentru primele 2 minute; nu-l crește peste 2, altfel primul generator pică sub 5s și early game-ul devine banal.

**Riscuri:**
- **Deviația +2% → +30% per quill NU e încă propagată** în `01-game-design.md` (§3, §7) și în textele UI. Cine implementează UI/engine folosește valorile din ACEST document. Risc de inconsistență între documente — vezi secțiunea următoare.
- **Jucători pur idle (0 click după min 5):** simularea presupune 2 click/s susținut; un jucător aproape pasiv va atinge primul prestige în ~35–50 min. Acceptabil (fereastra e pentru semi-activ), dar dacă feedback-ul cere, se umblă la butonul 3.
- **Ink Echo sub buff** — mitigat prin regula din §3 (×5 nu se aplică pe echo). De testat unit exact acest caz.
- **Milestone ×8 la 100 unități + growth 1.12 la tier-urile târzii** — în rundele 4+ combinația poate produce snowball; orizontul v1 (câteva zile) nu ajunge acolo, dar dacă se extinde endgame-ul, pragul 100 poate deveni ×1.5 în loc de ×2.
- **Manipularea ceasului de sistem** pentru offline — capul de 8/12h și clamp-ul `elapsed >= 0` limitează dauna la maximum o „noapte" per manipulare; nu merită efort suplimentar în v1 (joc fără server).
- **Greedy-sim ≠ om real:** cifrele au ±15% marjă realistă. E2E-ul cu timp accelerat (Agent 8) trebuie să valideze măcar „primul generator <30s" și „100k atins".

---

## Constante gata de copiat în engine (`src/engine/balance.ts` — sugestie)

```ts
export const GENERATORS = [
  { id: 'wanderingMuse',  baseCost: 15,         baseProd: 0.1,  growth: 1.15, revealAt: 10 },
  { id: 'inkSprite',      baseCost: 100,        baseProd: 1,    growth: 1.15, revealAt: 60 },
  { id: 'talkingRaven',   baseCost: 1_100,      baseProd: 8,    growth: 1.14, revealAt: 600 },
  { id: 'enchantedQuill', baseCost: 12_000,     baseProd: 47,   growth: 1.13, revealAt: 6_000 },
  { id: 'storyLoom',      baseCost: 130_000,    baseProd: 260,  growth: 1.13, revealAt: 65_000 },
  { id: 'dreamLibrary',   baseCost: 1_400_000,  baseProd: 1400, growth: 1.12, revealAt: 700_000 },
  { id: 'fableForge',     baseCost: 20_000_000, baseProd: 7800, growth: 1.12, revealAt: 10_000_000 },
] as const;

export const QTY_THRESHOLDS = [25, 50, 100] as const; // fiecare: prod generator ×2
export const CLICK_BASE = 1;
export const INK_ECHO_RATE = 0.01;
export const GOLDEN_INKWELL_MULT = 1.5;
export const MUSES_CHORUS_MULT = 2;
export const RAVENS_GOSSIP_RATE = 0.05;   // per talkingRaven, pe inkSprite
export const WEAVERS_RHYTHM_RATE = 0.10;  // per storyLoom, pe enchantedQuill
export const PATRONS_FAVOR_DISCOUNT = 0.95;
export const ACHIEVEMENT_BONUS = 0.01;    // 0.02 cu boundAnthology
export const QUILL_BONUS = 0.30;          // per Golden Quill, aditiv
export const PRESTIGE_DIVISOR = 1e5;      // quills = floor(sqrt(totalEarnedThisRun / PRESTIGE_DIVISOR))
export const BUFF = { duration: 15, durationUpgraded: 22.5, cooldown: 90, clickMult: 5, prodMult: 2 } as const;
export const OFFLINE = { eff: 0.5, effUpgraded: 0.75, capSec: 28_800, capSecUpgraded: 43_200 } as const;
export const UPGRADE_COSTS = {
  sharpenedNib: 100, musesChorus: 500, goldenInkwell: 15_000, ravensGossip: 25_000,
  lucidDreaming: 50_000, burstOfGenius: 75_000, inkEcho: 200_000, weaversRhythm: 1_000_000,
  patronsFavor: 2_000_000, boundAnthology: 5_000_000, quillResonance: 2_500,
} as const;
```

---

## Ce s-a decis
- Growth per generator: 1.15 / 1.15 / 1.14 / 1.13 / 1.13 / 1.12 / 1.12; baseCost/baseProd exact cele din design.
- Ordinea strictă a multiplicatorilor de producție (§2): qty-milestone → per-gen upgrade → sinergie → sumă → inkwell → achievements → quills → buff.
- Click = bază(1) ×2(nib) ×(1+0.30q)(resonance) ×5(buff) + 1% din producția efectivă (Ink Echo, fără ×5).
- Milestones de cantitate: 25/50/100 → ×2 fiecare, toate cele 7 generatoare (21 praguri).
- Prestige: `floor(sqrt(totalEarned/1e5))`, prag 100k; **+30% producție globală per quill, aditiv** (schimbat de la +2%).
- Quill Resonance: cost 2.500 (schimbat de la ~10.000).
- Buff: 15s/90s (cooldown de la activare), ×5 click / ×2 producție; Burst of Genius → 22.5s.
- Offline: 50% eficiență / cap 8h; Lucid Dreaming → 75% / 12h; intră în totalEarned.

## De ce
- Cele două **[DECIZII DE CALIBRARE]** sunt susținute numeric: cu +2%/quill runda 2 era doar cu 3,8% mai rapidă (prestige cosmetic, criteriul §10.6 imposibil); +30% dă exact 31% compresie în simularea conservatoare. Resonance la 10k se cumpăra după ce early game-ul (partea click-dominată, singura unde ajută) se terminase.
- Aditiv în interiorul categoriilor, multiplicativ între ele = fără explozii exponențiale, fiecare sursă testabilă izolat.
- Restul justificărilor sunt inline în §1–§8, lângă fiecare formulă.

## Fișiere create sau modificate
- **Creat:** `C:/Projects/Games/Fable Idler/ai-memory/03-economy-balance.md` (acest document).
- **Creat:** `C:/Projects/Games/Fable Idler/tools/economy-sim.mjs` (simulatorul; comanda de rulare în §9).

## Riscuri
- Vezi §10. Cel mai mare: **inconsistența documentelor** — `01-game-design.md` spune încă „+2% per quill" și „Quill Resonance ~10.000"; sursa de adevăr pentru cifre este ACEST document.
- Simulatorul modelează un jucător greedy semi-activ; cifrele reale pot varia ±15%.

## Ce trebuie să știe următorul agent
- **Agent 5 (engine):** copiază blocul de constante de mai sus; implementează EXACT ordinea din §2 și regula Ink Echo din §3 (fără ×5 pe echo — scrie un unit test dedicat). `totalEarnedThisRun` separat de `current` și de statistica lifetime. Cooldown-ul buff-ului curge offline; buff-ul nu produce offline. Unit tests recomandate pe: breakpoints prestige (100k→1, 400k→2, 900k→3), cost la unitatea #25 (tabel §1), qtyMilestoneMult la 24/25/50/100, offlineGain cu și fără lucidDreaming, clamp elapsed ≥ 0.
- **Agent 4 / UI:** textele afișate: „+30% production per Golden Quill" (NU +2%); formatare numere cu sufixe de la 1e6; preview-ul de prestige folosește formula din §6 pe `totalEarnedThisRun` live.
- **Orchestrator:** de actualizat `01-game-design.md` §3/§7 (+2% → +30%, resonance 2.500) sau măcar de adăugat o notă de referință spre acest document, ca să nu implementeze cineva după cifra veche.
- **Agent 8 (E2E):** validează „primul generator <30s" și că butonul de prestige se activează exact la 100.000 totalEarned.

## Validări făcute
- Simulare completă rulată prin `docker run --rm node:22-alpine` (fără Node pe host), script păstrat în `tools/economy-sim.mjs`; rezultate în §9.
- Criteriile de succes din design §10 verificate numeric: primul generator ~8s (<30s ✓), Sharpened Nib 1m01s (<2 min ✓), buff ~2 min (<5 min ✓), primul prestige 24m23s (20–40 min ✓), runda 2 la 100k −31% (≥30% ✓), offline 8h = 10,4M → ≥2 achiziții majore ✓.
- Sweep pe bonusul per quill (6 valori) — tabel în §6; alegerea +30% e singura care trece criteriul §10.6 fără să facă runda 3 trivială.
- Verificat aritmetic: breakpoints prestige, costuri la unitățile #25/#50, suma geometrică pentru bulk-buy, încadrarea în `number` (max ~1,5e12 în orizontul v1).
