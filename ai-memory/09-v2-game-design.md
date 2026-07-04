# 09 — V2 Game Design (Agent 1: Product & Game Design Lead, 2026-07-04)

> Convenție (identică v1): documentul e în română; **toate numele de entități sunt în engleză și FINALE**, cu id-uri `camelCase` folosite identic în cod, teste și UI. Acest document extinde v1 fără să-l rescrie — contractele v1 rămân cele din `01`–`05`. Cifrele de aici sunt versiunea INIȚIALĂ de design; valorile FINALE le fixează Agentul de economie v2 (document nou, propus `10-v2-economy-balance.md`), care păstrează structura și id-urile de aici, exact ca relația 01↔03 din v1.

> Deciziile clientului (fixe): (1) multiplayer = DOAR leaderboard cu nickname, save-uri 100% locale, model guest cu token secret, joc complet jucabil offline; (2) nivel nou de upgrade-uri care CHELTUIE Golden Quills și folosește Tomes; (3) mai mult conținut cu personalitate.

---

## 0. Cele patru sisteme noi (nume finale)

| Sistem | Nume (final) | ID cod | Ce este |
|---|---|---|---|
| Magazin meta (cheltuie Golden Quills) | **The Gilded Atelier** | `atelier` | Upgrade-uri permanente cumpărate cu 🪶 + **Relics** deblocate gratuit de praguri de Tomes |
| Eveniment random clickabil | **Stray Spark** | `straySpark` | O scânteie rătăcită care traversează ecranul la interval aleator; click → recompensă din tabel ponderat |
| Colecția de fabule | **The Bookshelf** | `bookshelf` | La fiecare Publish the Tome se generează o fabulă cu titlu procedural + statisticile rundei; bonus per fabulă unică |
| Leaderboard cu nickname | **Hall of Fables** | `hallOfFables` | Clasament global opt-in, backend minimal, model guest-token, degradare grațioasă |

De ce „Stray Spark" și nu „Wandering Spark": evită coliziunea verbală cu generatorul `wanderingMuse` și cu milestone-ul v1 `theFirstSpark` („The First Spark") — trei entități „wandering/spark" ar fi fost confuze în UI și în cod.

---

## 1. The Gilded Atelier — magazinul meta

Panou nou (tab „Atelier" în coloana centrală, accente `--quill` — e meta, deci violet, conform regulilor de culoare din 04 §1.1). Aici se **cheltuie** Golden Quills. Apare după primul Publish (milestone `theGildedDoor`, §5.2).

### 1.1 REGULA DE AUR (anti-frustrare): bonusul pasiv NU se pierde la cheltuire

**Decizie:** bonusul pasiv de producție se REANCOREAZĂ de pe soldul de quills pe un contor nou, permanent:

```
meta.stats.lifetimeQuillsEarned   // total Golden Quills câștigate vreodată (nu scade niciodată)
meta.goldenQuills                 // PORTOFELUL — soldul cheltuibil în Atelier (poate scădea)

quillMult = 1 + QUILL_BONUS * lifetimeQuillsEarned      // QUILL_BONUS rămâne 0.30 (03 §6)
// Quill Resonance (click) folosește ACELAȘI lifetimeQuillsEarned.
```

- Orice sursă de quills (Publish, Stray Spark, Editor's Due, Story Fragments legate) incrementează **ambele**: portofelul ȘI `lifetimeQuillsEarned`.
- Cheltuirea în Atelier scade DOAR portofelul. `lifetimeQuillsEarned` e monoton crescător.
- **Migrare v1→v2 (exactă, fără pierdere):** în v1 quills nu se cheltuiau niciodată ⇒ la migrare `lifetimeQuillsEarned = meta.goldenQuills` (soldul v1 ≡ totalul câștigat vreodată). Niciun jucător v1 nu pierde un procent de producție.

**Justificare explicită:** dacă cheltuirea ar reduce bonusul pasiv, fiecare achiziție din Atelier ar fi un nerf ascuns de −30% producție per quill cheltuit — jucătorul ar avea nevoie de foaie de calcul ca să afle dacă „merită", iar răspunsul ar fi deseori „nu" (anti-pattern clasic de idle: magazinul meta pe care nimeni nu îndrăznește să-l folosească). Cu ancorarea pe lifetime, fiecare quill „plătește de două ori" **prin design**: o dată pasiv (+30% pentru totdeauna) și o dată activ (cheltuibil în Atelier). Orice achiziție e câștig strict pozitiv → zero regret, zero paralizie. Textul UI „+30% production per Golden Quill *earned*" rămâne adevărat și simplu de comunicat.

### 1.2 Upgrade-urile de Atelier (10 — fiecare cu mecanică DISTINCTĂ)

Toate sunt permanente (metaState), supraviețuiesc prestige-ului, costă Golden Quills din portofel. Upgrade-urile cu nivele au costul per nivel. Context de balans: primul Publish dă 1–2 🪶; la 10 tomuri jucătorul are cumulat ~25–35 🪶 lifetime.

| # | Nume (final) | ID cod | Nivele | Mecanică (tip distinct) | Efect exact | Cost 🪶 | Flavor (ton bibliotecar excentric) |
|---|---|---|---|---|---|---|---|
| 1 | **Apprentice Muse** | `apprenticeMuse` | 3 | Head-start de rundă | Începi fiecare rundă cu **5 / 15 / 30 Wandering Muses** deja angajate | **1** / 3 / 8 | "She opens the shop, lights the candles, and judges your handwriting." |
| 2 | **Self-Writing Contract** | `selfWritingContract` | 1 | Auto-buy | Cumpără automat câte 1 Wandering Muse (max 1/sec) când costul ei e ≤ **1%** din soldul de Inspiration — nu-ți golește niciodată punga | 4 | "The quill signs. The quill hires. The quill does not ask." |
| 3 | **Stroke of Genius** | `strokeOfGenius` | 2 | Crit pe click | **5% / 10%** șansă ca un click să valoreze **×10** — cu feedback vizual obligatoriu: floating number mare auriu + flash („A stroke of genius!") | 2 / 6 | "Sometimes the ink knows before you do." |
| 4 | **Blueprint of Myths** | `blueprintOfMyths` | 1 | Tier nou (endgame) | Deblochează **generatorul 8: Myth Engine** (§1.3) în shop | 12 | "Some machines print pages. This one prints pantheons." |
| 5 | **Restless Heart** | `restlessHeart` | 2 | Cooldown buff | Cooldown-ul Moment of Inspiration **90s → 75s → 60s** | 3 / 7 | "The heart wants what it wants. Mostly: more, sooner." |
| 6 | **Thunderous Applause** | `thunderousApplause` | 1 | Burst la activare buff | Activarea Moment of Inspiration acordă instant **60 de secunde de producție curentă** (o dată per activare) | 4 | "Somewhere, an audience you cannot see is on its feet." |
| 7 | **Night Owl Pact** | `nightOwlPact` | 1 | Plafon offline | Plafonul de offline **+12h**: 8h → **20h** (cu Lucid Dreaming: 12h → **24h**) | 5 | "The ravens agreed to take notes. The owls demanded a contract." |
| 8 | **Sparkcatcher's Net** | `sparkcatchersNet` | 2 | Buff pe evenimentul random | L1: Stray Spark apare de **2× mai des**; L2: recompensele Spark **×2** (definiție exactă în §2.3) | 2 / 5 | "Woven from patience and a little greed." |
| 9 | **Second Bookmark** | `secondBookmark` | 2 | Persistență la prestige | La Publish the Tome, **cele mai ieftine 2 / 4 upgrade-uri de rundă deținute** (dintre cele 10 resetabile) supraviețuiesc resetului | 6 / 14 | "You may keep your place in two stories at once. The book disapproves." |
| 10 | **Editor's Due** | `editorsDue` | 1 | Randament prestige | Fiecare Publish the Tome acordă **+1 Golden Quill bonus** (intră și în portofel, și în lifetime) | 10 | "The editor takes their cut. This time, in your favour." |

- Cost total la nivel maxim: **96 🪶** → sink de lungă durată (~25–35 de tomuri), fără fund fals.
- „Cele mai ieftine" la Second Bookmark = după costul din config (determinist, fără tracking de ordine de cumpărare — simplu de implementat și de testat).
- Stroke of Genius: critul ×10 se aplică pe **întreaga valoare a clickului (inclusiv partea Ink Echo)** — e „momentul de glorie"; frecvența (5–10%) îl ține sub control (echo așteptat = ×1.45/×1.9, sub pragul ×5 interzis în v1 pentru buff). **Economia v2 confirmă prin simulare**; dacă domină, fallback-ul documentat e „crit doar pe partea de bază".

### 1.3 Generatorul 8: **Myth Engine** (`mythEngine`)

| Câmp | Valoare inițială (calibrează economia v2) |
|---|---|
| baseCost | **300.000.000** (15× Fable Forge) |
| baseProd | **45.000 /sec** (~5.8× Fable Forge) |
| growth | **1.12** |
| revealAt (totalEarned) | **150.000.000** (regula v1: ~50% din baseCost) — vizibil DOAR dacă `blueprintOfMyths` e cumpărat |
| Emoji (icon-coin) | ⚙️→ nu (ocupat de Settings); **🏛️** |
| Flavor | "A colossal clockwork engine that dreams entire mythologies and wakes up embarrassed about them." |

Intră în toate regulile v1: milestones de cantitate 25/50/100 → ×2, formatul `qty:mythEngine:<n>`, formula de cost/bulk din 03 §1. Fără Blueprint, rândul nu se randează deloc (nici teaser) — e surpriza Atelier-ului.

### 1.4 Relics — deblocate de praguri de Tomes (gratuite, permanente, automate)

Secțiune proprie în panoul Atelier („Relics of the Published"), cu sloturi vizibile de la început (silhouette + prag afișat — jucătorul vede ținta). Se deblochează automat la atingerea pragului `tomesPublished`, fără cost, cu toast dedicat. **Nu se stochează în save** — se derivă din `tomesPublished` (imposibil de desincronizat).

| Prag Tomes | Nume (final) | ID cod | Efect real | Flavor |
|---|---|---|---|---|
| **3** | **Dog-Eared Page** | `dogEaredPage` | Începi fiecare rundă cu **300 Inspiration** (sare peste primele ~20 de click-uri; Sharpened Nib cumpărabil din secunda 1) | "You marked where the story gets good. It's near the beginning." |
| **7** | **Standing Ovation** | `standingOvation` | **Prima activare** a Moment of Inspiration din fiecare rundă are **durată dublă** (30s; 45s cu Burst of Genius) | "They stood. They clapped. One raven whistled." |
| **15** | **Ink That Remembers** | `inkThatRemembers` | Producție globală **+1% per Tome publicat** (aditiv, fără plafon — la 15 tomuri = +15%, crește pentru totdeauna) | "Every book you bound left a little of itself in the inkwell." |
| **30** | **The Reader's Letter** | `readersLetter` | Eficiența offline **+10 puncte procentuale** (0.5→0.6; cu Lucid Dreaming 0.75→0.85) | "Someone, somewhere, stayed up all night reading you. They wrote to say so." |

De ce relics separate de upgrade-uri: upgrade-urile răspund la „pe ce îmi cheltui quills?", relics răspund la „ce primesc pentru că **public**?" — fac Tomes (numărul de publicări) o resursă de progresie în sine, exact cerința clientului #2, și dau praguri-țintă pe termen lung (3/7/15/30).

---

## 2. Stray Spark — evenimentul random clickabil

### 2.1 Comportament

- O scânteie ✨ (glow `--gold-bright`, trail subtil) apare la interval aleator și **plutește ~10 secunde** pe o traiectorie lină peste zona centrală, apoi dispare. Click pe ea → recompensă din tabelul §2.2 + toast cu rezultatul.
- **Interval de apariție (config):** uniform în **[150s, 330s]** → medie **4 minute** (în banda 3–5 min cerută). Cu Sparkcatcher's Net L1: **[75s, 165s]** (medie 2 min).
- **Maxim 1 spark pe ecran**; timer-ul următorului pornește după colectare sau despawn.
- **Deblocare:** milestone nou `aLightAtTheWindow` la **1.000 totalEarned** pe rundă (§5.2) — primul spark sosește ~min 5 din runda 1; după prestige, milestone-ul se re-atinge în secunde, deci pauza per-rundă e neglijabilă.

### 2.2 Tabelul de recompense (ponderi din 100)

| Pondere | Nume (final) | ID cod | Recompensă exactă |
|---:|---|---|---|
| **45** | **Ink Burst** | `inkBurst` | Inspiration instant = **15 minute de producție curentă** (`900 × effectiveProd`), cu podea `50 × clickPower` (early game, când producția e ~0) |
| **20** | **Frenzy of the Quill** | `quillFrenzy` | Buff **30s**: click power **×7** (frenezie de click — neobișnuit: complementar buffului principal, care e mai ales de producție) |
| **15** | **Gossip Bonanza** | `gossipBonanza` | Buff **60s**: generatorii tier 1–3 (Muse, Sprite, Raven) produc **×5** (buff țintit pe tier-urile „uitate" late-game) |
| **10** | **Time Slip** | `timeSlip` | Cooldown-ul Moment of Inspiration e **resetat instant** + buff-ul pornește gratuit (fără să consume activarea) |
| **8** | **Story Fragment** | `storyFragment` | +1 **Story Fragment** 🧩; la **5 fragmente** se leagă automat un **Golden Quill întreg** (+1 portofel ȘI lifetime, cu toast de sărbătoare). Contor vizibil în Atelier („3/5 fragments") |
| **2** | **Golden Quill** | `goldenQuillDrop` | **+1 Golden Quill** direct (jackpot rar; portofel + lifetime) |

- Un singur „spark buff" activ simultan (`quillFrenzy`/`gossipBonanza`): unul nou îl înlocuiește pe cel vechi. Sunt independenți de Moment of Inspiration (se pot suprapune — moment de glorie legitim).
- **Sparkcatcher's Net L2 („recompense ×2") exact:** `inkBurst` sumă ×2; buff-urile `quillFrenzy`/`gossipBonanza` durată ×2; `storyFragment` dă 2 fragmente; `goldenQuillDrop` dă 2 quills; `timeSlip` neschimbat (nu are magnitudine).
- Venit așteptat de quills: 0.08×0.2 + 0.02 = **0.036 🪶/spark** → la medie 4 min și colectare perfectă ≈ 0.5 🪶/oră — bonus vizibil (~15–20% din venitul de quills al unui jucător activ), niciodată dominant față de Publish.

### 2.3 Reguli anti-abuz (obligatorii, parte din contract)

1. **Nimic în background/offline:** timer-ul de spawn curge DOAR cât tab-ul e vizibil (`visibilitychange` îl pune pe pauză); sparks nu apar și nu se acumulează în calculul offline.
2. **Nimic pending în save:** momentul următorului spawn NU se persistă — se re-extrage la load. Un spark aflat în zbor dispare la refresh. Recompensa se extrage ABIA la click (RNG ne-seedat, ne-persistat) ⇒ save-scumming imposibil (nu există nimic de re-rulat).
3. **Scalare pe stare curentă:** `inkBurst` e procent din producția curentă → nu poate fi „fermat" pe rundă proaspătă pentru sume relevante.
4. Despawn dacă tab-ul devine hidden cât sparkul e în zbor.
5. Recompensele de Inspiration intră normal în `current` + `totalEarned` (nu ocolesc milestones — intenționat, e Inspiration câștigată).

---

## 3. The Bookshelf — colecția de fabule

### 3.1 Generarea fabulei (la fiecare Publish the Tome)

`publishTheTome` adaugă în `meta.fables` o înregistrare:

```ts
interface Fable {
  n: number;                 // numărul tomului (1-based)
  title: string;             // generat procedural, determinist
  publishedAt: number;       // epoch ms
  runStats: {
    totalEarned: number;     // al rundei publicate
    durationMs: number;      // now − run.startedAt  (câmp NOU pe RunState)
    quillsEarned: number;    // câți quills a dat acest publish
  } | null;                  // null = fabulă „faded" din migrarea v1 (§7)
  gilded: boolean;           // true dacă quillsEarned ≥ 5 → cotor auriu (cosmetic)
}
```

**Titlu procedural determinist:** PRNG simplu (mulberry32) cu seed = `hash(n, floor(totalEarned), floor(durationMs/1000))` → alege un șablon + cuvinte. Determinist ⇒ unit-testabil (același seed → același titlu) și „personal" (titlul e amprenta rundei tale).

**Șabloane (3):**
- A: `The {Adjective} {Creature} and the {Object}`
- B: `The {Creature} Who {VerbPhrase}`
- C: `{Adjective} {Creature}, or: How the {Object} Was Won`

**Tabele de cuvinte (finale — extensibile doar prin adăugare la coadă, ca seed-urile vechi să rămână stabile):**
- **Adjectives (14):** Curious, Gilded, Sleepless, Whispering, Ink-Stained, Moonlit, Stubborn, Threadbare, Velvet, Forgetful, Clockwork, Humble, Boastful, Wandering
- **Creatures (14):** Raven, Muse, Fox, Tortoise, Owl, Moth, Librarian, Quill, Sprite, Dragonfly, Bookworm, Cartographer, Lantern, Nightingale
- **Objects (12):** Inkwell, Unwritten Page, Borrowed Star, Last Candle, Paper Crown, Silver Thread, Midnight Library, Lost Footnote, Golden Feather, Sealed Letter, Endless Margin, Second Moon
- **VerbPhrases (8):** Outwrote the Dawn, Counted the Stars Twice, Borrowed Tomorrow, Argued with the Moon, Sold Silence, Misplaced Thursday, Taught the Rain to Read, Slept Through the Ending

→ ~2.800+ combinații distincte; coliziuni de titlu rare și acceptate (vezi bonusul).

### 3.2 Panoul + bonusul de colecție

- **Panou:** raft de cotoare de carte desenate în CSS (culoare derivată din seed; cotor auriu dacă `gilded`), în coloana dreaptă / tab-ul Fable. Click pe un cotor → titlu, „Tome #N", data, statisticile rundei („Earned 2.3M in 24m · +2 🪶"). Fabulele faded (migrare) afișează „*The ink has faded — stats lost to time.*"
- **Bonus de colecție:** **+2% producție globală per fabulă cu titlu UNIC**, plafonat la **25 de fabule numărate** (max +50%). Dedup pe titlu — dacă două runde nimeresc același titlu, se numără o dată (raritate amuzantă, nu pedeapsă: „a reprint!"). Header-ul panoului: „12 fables · +24% production".
- Apare după primul Publish (milestone `theFirstSpine`, §5.2) — raftul se naște odată cu prima fabulă (nu există stare goală).
- E „memoria" jucătorului: fiecare rundă lasă un artefact numit, cu cifrele ei — progresul șters de prestige devine obiect de colecție.

---

## 4. Hall of Fables — leaderboard cu nickname (decizia clientului #1)

### 4.1 Ce se raportează (4 scoruri = 4 clasamente/tab-uri)

| Scor | Sursă locală | Clasament |
|---|---|---|
| **Lifetime Inspiration** | `meta.stats.lifetimeInspiration` | descrescător — scorul principal |
| **Tomes Published** | `meta.tomesPublished` | descrescător |
| **Lifetime Golden Quills** | `meta.stats.lifetimeQuillsEarned` | descrescător |
| **Fastest Publish** | `meta.stats.fastestPublishMs` (NOU: min peste rundele încheiate cu Publish; necesită `run.startedAt`) | crescător; absent până la primul publish post-v2 |

Toate sunt deja/devin câmpuri meta locale — leaderboard-ul e un **martor**, nu o sursă de adevăr; nimic din gameplay nu depinde de el.

### 4.2 Model guest (fix, conform deciziei clientului)

1. Jucătorul deschide panoul Hall of Fables → stare opt-in: input nickname (3–20 caractere, litere/cifre/spații/liniuțe) + notă de transparență: „Only your nickname and these four numbers ever leave this device."
2. Prima trimitere: `POST /api/leaderboard` `{ nickname, scores }` → serverul verifică unicitatea nickname-ului (case-insensitive; 409 → UI cere altul) și emite `{ entryId, token }` (token secret ~128-bit).
3. Tokenul se păstrează în localStorage sub cheia **separată** `fable-idler-leaderboard-v1` `{ nickname, entryId, token, lastSubmittedAt }` — **NU în save-ul jocului**: export/import de save nu trebuie să transporte/dubleze identitatea, iar save-ul rămâne pur gameplay.
4. Actualizări: `PUT /api/leaderboard/{entryId}` cu tokenul în header. **Când:** automat după fiecare Publish the Tome + buton manual „Update now"; throttle client **max 1 trimitere / 60s**. Serverul validează: numere finite, ≥ scorurile anterioare la câmpurile monotone (lifetime/tomes/quills), plafoane de sanitate (respinge > 1e300).
5. FĂRĂ conturi, parole, email. Pierderea tokenului (clear browser data) = intrarea veche rămâne orfană; propunere server: intrările inactive > 90 zile se șterg (GC), eliberând nickname-ul.

### 4.3 UX + stări offline (jocul rămâne static-first)

- **Panoul** apare după primul Publish (milestone `wordTravelsFast`, §5.2) — un jucător de 5 minute nu are ce căuta în clasament, iar momentul post-prestige e cel natural („am publicat — cine mai publică?").
- **Stări:** (a) *opt-in* — input + buton „Claim your place"; (b) *activ* — rândul tău evidențiat cu rank, top 50 pe scorul selectat, „last updated X min ago", refresh; (c) *offline/API absent* — badge discret „The Hall is unreachable — your library doesn't mind." + ultimul clasament din cache (cu timestamp) dacă există; zero erori în consolă, retry silențios cu backoff.
- **Config:** URL-ul API-ului e opțional (`VITE_API_URL` sau echivalent decis de arhitect); dacă lipsește la build, panoul afișează permanent starea „local-only" — build-ul static rămâne 100% funcțional, identic v1.
- **Anti-cheat: acceptat că nu există** (scoruri client-authoritative; save editabil local). Limitare documentată, nu problemă de rezolvat — costul unui server autoritativ contrazice decizia „save-uri 100% locale".

---

## 5. Achievements noi + Milestones noi

### 5.1 Achievements (10 noi → total 24; fiecare +1% global, dublat de Bound Anthology, permanente — regulile v1 neschimbate)

| # | Nume (final) | ID cod | Condiție |
|---|---|---|---|
| 15 | **Patron of the Arts** | `patronOfTheArts` | Cumperi primul upgrade din Atelier |
| 16 | **Spark Chaser** | `sparkChaser` | Prinzi primul Stray Spark |
| 17 | **Lightning in a Bottle** | `lightningInABottle` | Prinzi 25 Stray Sparks (contor nou `meta.stats.sparksCaught`) |
| 18 | **Piece by Piece** | `pieceByPiece` | Legi primul Golden Quill din 5 Story Fragments |
| 19 | **A Shelf of One's Own** | `shelfOfOnesOwn` | 5 fabule pe Bookshelf |
| 20 | **Collected Works** | `collectedWorks` | 15 fabule cu titlu unic |
| 21 | **Mythmaker** | `mythmaker` | Cumperi primul Myth Engine |
| 22 | **Name in Lights** | `nameInLights` | Prima trimitere reușită în Hall of Fables (doar la succes confirmat de server; rămâne blocat pentru jucătorii pur offline — acceptat, analog Night Shift care cere offline) |
| 23 | **Speed Reader** | `speedReader` | Un Publish într-o rundă de sub 10 minute (`durationMs < 600.000`) |
| 24 | **Full Patronage** | `fullPatronage` | Toate upgrade-urile de Atelier la nivel maxim (endgame v2) |

### 5.2 Milestones noi de dezvăluire (4)

| Nume (final) | ID cod | Prag | Ce dezvăluie |
|---|---|---|---|
| **A Light at the Window** | `aLightAtTheWindow` | 1.000 totalEarned (rundă) | Pornește spawn-ul Stray Spark (+ un toast-tutorial o singură dată, la primul unlock lifetime: „Something glimmers past the window. Catch it.") |
| **The Gilded Door** | `theGildedDoor` | `tomesPublished ≥ 1` | Panoul **The Gilded Atelier** (tab nou) |
| **The First Spine** | `theFirstSpine` | `tomesPublished ≥ 1` | Panoul **The Bookshelf** (cu fabula #1 deja pe raft) |
| **Word Travels Fast** | `wordTravelsFast` | `tomesPublished ≥ 1` | Panoul **Hall of Fables** (stare opt-in) |

Mecanic: stau în `run.milestones` ca toate celelalte; cele trei pe `tomesPublished` se re-adaugă instant după fiecare prestige (același mecanism deja testat pentru `hallOfDeeds` — vezi 05, Agent 6). Primul Publish devine „Actul 2" al jocului: trei panouri noi + prima fabulă, cu toast-urile serializate prin coada existentă (max 3 vizibile).

---

## 6. Progresia v2 + criterii de succes

### 6.1 Ce face un jucător cu…

- **0 tomuri (rundă 1):** identic v1 până la 1.000 totalEarned (~min 3), apoi apare primul Stray Spark — primul „gust" de v2, fără să atingă calibrarea rundei 1. Primul Publish (~min 20–40, invariant v1) deschide Actul 2: Atelier + Bookshelf + Hall of Fables + fabula #1. Cu 1–2 🪶 în portofel, **Apprentice Muse L1 (1 🪶) e cumpărabil pe loc** — prima decizie de meta-cheltuială vine la fix.
- **3 tomuri:** relicva **Dog-Eared Page** tocmai a picat (300 Inspiration la start); ~6–8 🪶 lifetime; deține tipic Apprentice Muse L1 + Stroke of Genius L1 sau Sparkcatcher's Net L1; raftul are 3 fabule (+6%); vânează fragmente 🧩; probabil și-a pus nickname-ul. Ținte vizibile: Standing Ovation (7 tomuri), Second Bookmark.
- **10 tomuri:** relicvele 3+7 active; ~25–35 🪶 lifetime; Atelier-ul mid-game (Restless Heart, Night Owl Pact, Second Bookmark); marea țintă: **Blueprint of Myths (12 🪶) → Myth Engine**; urcă în Hall of Fables pe Tomes/Fastest Publish; **Ink That Remembers** (15 tomuri) la orizont — fiecare Publish suplimentar valorează +1% pentru totdeauna, deci publicatul rămâne interesant chiar și fără nevoie de quills.
- **Endgame v2:** Full Patronage (96 🪶 total), Myth Engine la 100 (×8), 25 fabule unice (+50%), The Reader's Letter (30 tomuri) — orizont de câteva săptămâni lejere.

### 6.2 Criterii de succes MĂSURABILE (de verificat unit/E2E/manual)

1. **Primul upgrade de Atelier cumpărabil imediat după primul prestige** — garantat prin construcție: orice Publish dă ≥1 🪶, Apprentice Muse L1 costă exact 1 🪶.
2. **Cumpărarea oricărui upgrade de Atelier NU scade `effectiveProd`** — test unit dedicat (regula de aur §1.1).
3. **Save v1 migrat curat:** quills/tomes/achievements intacte; `lifetimeQuillsEarned == goldenQuills(v1)`; producția post-migrare ≥ producția v1 la stare identică; `tomesPublished` fabule faded pe raft.
4. **Stray Spark:** interval mediu de spawn 4 min (uniform 150–330s) cu tab vizibil; ZERO spawn/acumulare în background/offline (test cu `visibilitychange`); recompensa se extrage doar la click; refresh nu re-invocă sparkul.
5. **Bookshelf determinist:** același `(n, totalEarned, durationMs)` → același titlu (unit test cu valori fixate); primul Publish → exact 1 fabulă.
6. **Leaderboard:** cu API pornit — nickname setat → rândul tău apare în <5s; cu API oprit/absent — zero erori în consolă, joc complet funcțional, panoul în starea „unreachable"; token invalid → intrarea NU e modificată (401 tratat silențios).
7. **Runda post-prestige cu Apprentice Muse L1 + Dog-Eared Page**: t(1.000 totalEarned) măsurabil mai mic decât fără (simulare economie v2).
8. **Toate cele 10 achievements noi** au condiții evaluabile pur din stare/contoare (unit-testabile fără UI).

---

## 7. Migrarea save v1 → v2 (contract inițial pentru arhitect + engine)

Mecanismul există deja (`save.ts`: `CURRENT_SAVE_VERSION`, lanțul `MIGRATIONS` v→v+1, testat cu stub). v2 îl folosește prima dată „pe bune":

- `CURRENT_SAVE_VERSION: 1 → 2`; `MIGRATIONS[1] = (v1) => v2`:
  - `meta.stats.lifetimeQuillsEarned = meta.goldenQuills` (exact — v1 nu cheltuia; regula de aur §1.1);
  - `meta.stats.sparksCaught = 0`, `meta.stats.fastestPublishMs = null` (se populează de la primul publish v2);
  - `meta.storyFragments = 0`; `meta.atelier = {}` (map id → nivel);
  - `meta.fables` = `tomesPublished` intrări **faded** (`runStats: null`, titluri deterministe cu seed = indexul tomului) — un veteran v1 cu 10 tomuri NU pornește raftul (și bonusul lui) de la zero;
  - `run.startedAt = savedAt` (aproximare unică, inofensivă — Fastest Publish ignoră runda în curs la migrare);
  - relics NU se stochează (derivate din `tomesPublished`); cheia `fable-idler-leaderboard-v1` e complet în afara save-ului.
- Cheia localStorage rămâne `fable-idler-save-v1` (numele conține „v1" istoric; versiunea reală stă în payload — decizie 02 §5, nu se redenumește cheia).
- Un save v2 NU trebuie să treacă validatorul ca v1 (versiune necunoscută → fallback, comportament deja testat).

Noi multiplicatoare în lanțul 03 §2 (păstrând regula „aditiv în categorie, multiplicativ între categorii") — poziții propuse, economia v2 confirmă:
- pas 3½ (per-generator): `gossipBonanza` ×5 pe tiers 1–3 cât e activ;
- pas 6½ (global): `× (1 + 0.02 × min(uniqueFables, 25))` (Bookshelf) și `× (1 + 0.01 × tomesPublished)` (Ink That Remembers);
- pas 7 devine `× (1 + 0.30 × lifetimeQuillsEarned)`;
- click: `quillFrenzy` ×7 pe partea de bază (NU pe Ink Echo — aceeași regulă ca buff-ul v1); critul Stroke of Genius pe întregul click (§1.2, de confirmat în simulare).

---

## Ce s-a decis
- Patru sisteme noi cu nume finale: **The Gilded Atelier** (magazin meta pe Golden Quills + 4 **Relics** pe praguri de Tomes 3/7/15/30), **Stray Spark** (eveniment random clickabil, medie 4 min, tabel ponderat cu 6 recompense), **The Bookshelf** (fabule procedurale deterministe + bonus +2%/fabulă unică, cap 25), **Hall of Fables** (leaderboard opt-in, guest-token, 4 scoruri).
- **Regula de aur anti-frustrare:** bonusul pasiv +30%/quill se reancorează pe `meta.stats.lifetimeQuillsEarned` (monoton); `meta.goldenQuills` devine portofel cheltuibil; migrare exactă `lifetime = sold v1`.
- 10 upgrade-uri de Atelier cu mecanici distincte (head-start, auto-buy, crit pe click, tier 8, cooldown buff, burst la activare, plafon offline, buff pe eveniment, persistență la prestige, randament prestige), cost total 96 🪶; generatorul 8 **Myth Engine** în spatele Blueprint of Myths.
- 10 achievements noi (total 24) + 4 milestones noi de dezvăluire; primul Publish = „Actul 2" (Atelier + Bookshelf + Hall of Fables simultan); Spark de la 1.000 totalEarned.
- Leaderboard: save-urile rămân locale; tokenul în cheie localStorage separată de save; degradare grațioasă fără API; anti-cheat inexistent = limitare acceptată explicit.
- Migrarea v1→v2 prin lanțul `MIGRATIONS` existent, cu fabule „faded" retroactive pentru veterani.

## De ce
- Reancorarea pe lifetime elimină singurul mod în care un magazin de quills putea strica jocul: cheltuiala ca nerf ascuns. Fiecare quill plătește de două ori prin design → Atelier-ul e pură bucurie, zero regret.
- Relics pe praguri de Tomes transformă publicatul în resursă de progresie (cerința #2 „folosește și Tomes"), cu ținte pe termen lung care nu costă nimic.
- Stray Spark + fabulele procedurale + micro-copy-ul relicvelor livrează cerința #3 (personalitate): evenimente de atenție cu jackpot rar, artefacte personale numite, glume de bibliotecar — nu doar cifre.
- Spark-ul e echilibrat ca bonus (~0.5 🪶/h, 15–20% din venit), cu anti-abuz structural (nimic pending în save, nimic offline, scalare pe producția curentă).
- Leaderboard-ul e martor, nu autoritate — respectă litera deciziei clientului (100% local, guest, opt-in, degradare grațioasă) și nu adaugă niciun punct de eșec în bucla de joc.
- Toate pragurile noi respectă calibrarea v1 (runda 1 neatinsă până la 1.000 totalEarned; primul prestige rămâne invariantul 20–40 min).

## Fișiere create sau modificate
- **Creat:** `C:/Projects/Games/Fable Idler/ai-memory/09-v2-game-design.md` (acest document).
- **Modificat (doar notă de trimitere, permisă):** `C:/Projects/Games/Fable Idler/ai-memory/01-game-design.md` — o linie care trimite la 09 pentru extensia v2.

## Riscuri
- **Calibrare inițială:** costurile de Atelier (96 🪶 total), ponderile Spark, +2%/fabulă și cifrele Myth Engine sunt valori de design — economia v2 le calibrează prin simulare (extinde `tools/economy-sim.mjs`); NU schimbați structura/id-urile, doar cifrele, și documentați cu **[DECIZIE DE CALIBRARE]** ca în 03.
- **Stroke of Genius pe întregul click** (inclusiv Ink Echo) poate umfla click-ul late-game — fallback documentat: crit doar pe partea de bază. De tranșat în simularea economiei v2 (§1.2).
- **Stack de multiplicatori v2** (Bookshelf +50% + Ink That Remembers nelimitat + relics) — de verificat în simulare că rundele 10+ nu devin triviale; buton de ajustare: plafonul de fabule numărate (25) și rata +1%/tome.
- **Trei panouri simultan la primul Publish** — potențial copleșitor; mitigare: coada de toast-uri existentă + ordinea fixă a reveal-urilor (Bookshelf → Atelier → Hall of Fables). UI v2 decide detaliile.
- **Backend nou = suprafață operațională nouă** (primul server al proiectului): scope minimal strict (2 endpoint-uri + GET clasament); arhitectul v2 decide stack/deploy compose; jocul nu depinde de el (criteriul 6.2.6).
- **Pierderea tokenului de leaderboard** (clear browser data) lasă nickname-ul blocat până la GC-ul de 90 zile — limitare acceptată, de documentat în README v2.
- **Tabelele de cuvinte sunt append-only** — inserarea în mijloc schimbă titlurile istorice regenerabile; regula e în §3.1, dar trebuie respectată de toți agenții următori.

## Ce trebuie să știe următorul agent
- **Agent economie v2 (`10-v2-economy-balance.md`):** calibrează §1.2 (costuri Atelier), §1.3 (Myth Engine), §2.2 (ponderi + mărimi Spark), §3.2 (+2%/fabulă, cap 25), §1.4 (relics) FĂRĂ să redenumești nimic; invariante de păstrat: primul upgrade Atelier = 1 🪶 (criteriul 6.2.1), runda 1 v1 neatinsă sub 1.000 totalEarned, venit Spark ≤ ~20% din venitul de quills; tranșează critul pe echo și pozițiile noilor multiplicatori (§7); extinde simulatorul cu: jucător care prinde 50%/100% din sparks.
- **Agent arhitect v2:** schema save v2 + `MIGRATIONS[1]` conform §7; stările noi: `meta.atelier` (map id→nivel), `meta.storyFragments`, `meta.fables`, `stats.lifetimeQuillsEarned/sparksCaught/fastestPublishMs`, `run.startedAt`, `run.sparkBuff`; spark-ul are nevoie de un canal UI→engine pentru spawn/click (spawn-ul e efect de shell — timer în game-loop/UI, NU în `tick` pur; recompensa se aplică printr-o acțiune `collectSpark` cu rezultatul extras în shell, ca tick-ul să rămână determinist); definește contractul API leaderboard (2–3 endpoint-uri) + serviciul compose; `VITE_API_URL` opțional la build.
- **Agent UI v2:** Atelier = tab violet (`--quill`) în coloana centrală; Relics cu sloturi-silhouette vizibile; Spark = element animat clickabil cu `data-testid="stray-spark"`; Bookshelf = cotoare CSS din seed; Hall of Fables cu cele 3 stări din §4.3; feedback-ul critului (§1.2) e obligatoriu, nu opțional; toast-tutorial la primul spark o singură dată lifetime.
- **Agent teste v2:** criteriile 6.2.1–6.2.8 sunt lista de teste; unit: regula de aur (producția nu scade la cheltuire), determinismul titlurilor, migrarea v1→v2 câmp cu câmp, Second Bookmark („cele mai ieftine K"), anti-abuz spark (nimic în offline); E2E: fluxul opt-in leaderboard cu API mock + starea offline fără erori de consolă.
- ID-urile din tabelele acestui document sunt contractul comun — folosiți-le literal (ca în v1).

## Validări făcute
- Coerență cu contractele v1 reale (nu doar documentele): `MetaState`/`stats` din `src/engine/types.ts`, mecanismul `MIGRATIONS`/`CURRENT_SAVE_VERSION` din `src/engine/save.ts` (există, gol, testat cu stub — exact ce cere migrarea §7), formatul milestone `qty:<gen>:<n>` și comportamentul re-add post-prestige pentru milestones pe meta (05, Agent 6) — toate verificate pe disc pe branch-ul `feature/v2-expansion`.
- Unicitatea id-urilor noi verificată contra TUTUROR listelor v1 (7 generatori, 11 upgrade-uri, 14 achievements, 14+ milestones): zero coliziuni; „Stray Spark" ales deliberat ca să evite `theFirstSpark`/`wanderingMuse`.
- Aritmetică: venit spark 0.036 🪶/spark → ~0.5 🪶/h (sub 20% din venitul din Publish al unui jucător activ); cost total Atelier 96 🪶 vs. acumulare ~25–35 🪶 la 10 tomuri → sink pe orizontul 25–35 tomuri; Apprentice Muse L1 = 1 🪶 ≤ minimul garantat de orice Publish; Myth Engine păstrează raporturile v1 (cost ×15, prod ×5.8, reveal ~50% din baseCost); crit așteptat pe echo ×1.45–1.9 < pragul ×5 interzis în v1.
- Criteriile v1 neatinse: nimic nou sub 1.000 totalEarned în runda 1; pragul de prestige (100k) și formula quills neschimbate; toate mecanicile v1 rămân valide fără modificări de cifre.
- Document static — validarea numerică fină e sarcina economiei v2 (simulare), ca în relația 01↔03 din v1.

> **Notă v3 (2026-07-04):** alungirea jocului („The Long Road": generatorii 9–14, praguri de cantitate >100, frânarea formulei de quills peste 1e9, Atelier extins + Relics 50–200 tomes) e proiectată în `13-longevity-design.md`; acest document rămâne contractul v2, neschimbat.
