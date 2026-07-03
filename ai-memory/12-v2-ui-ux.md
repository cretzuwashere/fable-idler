# 12 — V2 UI/UX (Agent 4: UI/UX, 2026-07-04)

> Extensie a contractului vizual v1 (`04-ui-ux-decisions.md`) pentru sistemele v2 din `09-v2-game-design.md`. NIMIC din 04 nu se rescrie: aceleași token-uri, aceleași fonturi, același layout 3/2/1 zone, aceleași reguli QA. Acest document adaugă DOAR: 4 panouri/elemente noi, 8 animații noi (#16–#23), token-uri derivate noi (exclusiv în `tokens.css`), microcopy și data-testid-uri noi. Regula de culoare din 04 §1.1 se extinde natural: **`--quill` (violet) domină tot ce e meta v2** — Atelier, Relics, Story Fragments, Hall of Fables; `--gold` rămâne resursă/Spark; `--grow` rămâne exclusiv „îți permiți".

> ID-urile de sisteme/upgrade-uri/relics sunt cele din 09 (contract comun, literal). Textele UI sunt în engleză, vocea bibliotecarului excentric (04 §9).

---

## 0. Token-uri derivate noi (se adaugă în `src/ui/styles/tokens.css` — singurul loc cu culori brute, regula QA 04 §8 neschimbată)

```css
:root {
  /* v2 — Atelier / meta (familia --quill) */
  --glow-quill-soft: 0 0 10px rgba(180, 140, 228, 0.22);   /* carduri Atelier idle */
  --quill-tint:      rgba(180, 140, 228, 0.12);            /* fundal rând propriu leaderboard, hover Atelier */

  /* v2 — Stray Spark (familia --gold) */
  --spark-halo: 0 0 18px rgba(255, 217, 122, 0.65), 0 0 42px rgba(232, 181, 77, 0.35);

  /* v2 — cotoare Bookshelf (paleta „piele de carte", seed alege indexul 1–8) */
  --spine-1: #6d4a8f;  /* violet încins */
  --spine-2: #8f4a5e;  /* burgund */
  --spine-3: #4a6d8f;  /* albastru ardezie */
  --spine-4: #4f7a42;  /* verde (reuse --grow-deep) */
  --spine-5: #9c7226;  /* auriu vechi (reuse --gold-deep) */
  --spine-6: #8f6d4a;  /* maro piele */
  --spine-7: #4a8f7a;  /* verde-albăstrui */
  --spine-8: #5e5e8f;  /* indigo șters */
}
```

Cotoarele sunt decorative (nu poartă text) → fără constrângeri de contrast; fabulele „faded" (migrare v1) nu au token propriu: `filter: grayscale(0.7); opacity: 0.55` peste token-ul de seed.

---

## 1. Plasarea panourilor în cele 3 layouturi v1

Regula de aur 04 §6 rămâne: **nimic nu se randează înainte de milestone-ul lui.** Toate cele 4 panouri v2 apar la milestone-urile din 09 §5.2. Coloana STÂNGĂ (altarul) rămâne NEATINSĂ — constrângerea „încape în ~700px" din 04 e conservată prin construcție.

### 1.1 Desktop (≥1100px)

```
┌────────────────────────── header (56px) ─────────────────────────────┐
│ 📖 Fable Idler      🪶 4 Golden Quills (=PORTOFEL, tooltip lifetime) ⚙️│
├───────────────┬──────────────────────────────────┬───────────────────┤
│ STÂNGA 340px  │ CENTRU (min 480px)               │ DREAPTA 320px     │
│ (neschimbată) │ [Generators|Upgrades|Atelier|    │ PrestigePanel     │
│               │            Hall of Fables]       │ BookshelfPanel ◄NOU│
│               │  · Atelier = AtelierPanel        │ MilestoneTracker  │
│               │  · Hall of Fables = Leaderboard  │ AchievementGrid   │
└───────────────┴──────────────────────────────────┴───────────────────┘
        (stratul StraySparkLayer plutește PESTE coloana centrală)
```

- **AtelierPanel** = al 3-lea tab în TabBar-ul central, apare după `theGildedDoor`. Underline-ul tabului activ e `--quill` (nu `--gold`) — singurul tab violet + badge-dot violet când un upgrade e affordable sau o relicvă tocmai s-a deblocat.
- **Hall of Fables (LeaderboardPanel)** = al 4-lea tab central, după `wordTravelsFast`; underline `--quill` (e meta). Montat DOAR când tabul e activ → regula „auto-refresh doar când e vizibil" devine trivială.
- **BookshelfPanel** = coloana dreaptă, IMEDIAT sub PrestigePanel, după `theFirstSpine`. Intenționat: publici cu butonul de sus → cartea nouă alunecă pe raftul de dedesubt (`bookSlideIn`) — cauzalitatea e fizică, pe verticală.
- La 480px lățime de centru, 4 tab-uri × ~118px încap („Hall of Fables" la 13px ≈ 92px). Sub 4 tab-uri active (înainte de primul Publish) — identic v1.

### 1.2 Tabletă (720–1099px)

Tab-urile centrale devin: `Generators | Upgrades | Atelier | Fable`. **Hall of Fables NU primește tab propriu** (5 tab-uri nu încap confortabil la 720px): LeaderboardPanel devine ultima secțiune din tabul **Fable**, care se stivuiește: Prestige → Bookshelf → Milestones → Achievements → Hall of Fables. Precedent v1: `tab-achievements` e deja „secțiune, nu tab" pe desktop (05, decizia #3) — E2E țintește `leaderboard-panel`, nu tabul.

### 1.3 Mobil (<720px) — bottom nav trece de la 4 la 5 tab-uri DUPĂ primul Publish

**Decizie:** apare al 5-lea tab `🪶 Atelier` (între Upgrades și Fable), DOAR după `theGildedDoor`. Înainte de primul Publish, nav-ul are exact cele 4 tab-uri v1 — zero regresie pentru jucătorii noi (și E2E-ul v1 rămâne valid pe rundă proaspătă).

- `✨ Weave | 🏭 Shop | 📜 Upgrades | 🪶 Atelier | 📖 Fable` — la 375px: 5 × 75px ≥ 44px lățime, înălțime ≥48px (04 §7.3 respectat). Label-urile scad de la 12px la **11px** când sunt 5 tab-uri („Upgrades", cel mai lung, ≈ 54px la 11px — încape fără trunchiere).
- Tabul **Fable** rămâne containerul meta: Prestige → Bookshelf → Milestones → Achievements → Hall of Fables (aceeași ordine ca pe tabletă).
- De ce nu sub-tab-uri în Fable: Atelier e magazinul-vedetă al v2 și singurul loc unde se CHELTUIE o resursă — îngroparea lui la 2 tap-uri adâncime i-ar ucide ritmul de vizitare. Bookshelf/Hall sunt consultative (vizitate rar) — stau bine stivuite în Fable.
- Badge-dot (regula v1): Atelier — violet, când ceva e cumpărabil/nou; Fable — auriu, regulile v1 + fabulă nouă pe raft.

### 1.4 Ordinea de reveal la primul Publish („Actul 2", 09 riscuri)

După `prestigeFade` (neschimbat, 1400ms): reveal-urile intră serializat cu `revealIn` la interval de 250ms, în ordinea fixă **Bookshelf → Atelier → Hall of Fables**, cu 3 toast-uri prin coada existentă (max 3 vizibile — exact la limită, fără suprapunere). Bookshelf primul pentru că e recompensa emoțională („cartea ta există"), Atelier al doilea („ai și bani de cheltuit"), Hall ultimul (opt-in, fără presiune).

---

## 2. AtelierPanel — „The Gilded Atelier"

Panou violet: card mare cu bordură `--quill-deep` (rima vizuală cu PrestigePanel — ambele sunt meta), fundal `--ink`, titlu display „The Gilded Atelier 🪶".

### 2.1 Header-ul de sold — regula de aur FĂCUTĂ VIZIBILĂ

Două numere, ierarhie clară, mereu vizibile (sticky în interiorul panoului la scroll):

```
┌──────────────────────────────────────────────────────────────┐
│  Purse: 4 🪶                    Lifetime earned: 11 🪶        │
│  (display 28px, --quill)        (13px, --parchment-dim)      │
│                                 → +330% production, forever. │
│  "Spending from your purse never touches your renown."       │
│  (12.5px, --muted, permanent — NU tooltip, NU colapsabil)    │
│  🧩 Story Fragments: 3/5 · two more bind a golden quill      │
└──────────────────────────────────────────────────────────────┘
```

- Microcopy-ul anti-frică e **text permanent**, nu tooltip — e cel mai important mesaj al panoului (elimină paralizia de cheltuire, 09 §1.1).
- La cumpărare: numărul Purse scade cu `walletSpend` (#23), numărul Lifetime NU se mișcă deloc (nici reflow — tabular-nums) — dovada vizuală a regulii de aur.
- Chip-ul `golden-quills` din header-ul global arată de acum PORTOFELUL; tooltip: „Purse 4 🪶 · Lifetime 11 🪶 — your +330% production never decreases."

### 2.2 Cardurile de upgrade (10, grid 2 coloane desktop / 1 coloană mobil)

Anatomie: `.icon-coin` | nume (display font) + pips de nivel `●●○` la cele multi-nivel | descrierea efectului nivelului URMĂTOR (concretă: „Start each run with 15 Wandering Muses") | flavor 12.5px italic `--parchment-dim` | buton de cumpărare cu costul în 🪶.

| Stare | Aspect |
|---|---|
| **affordable** | bordură card `--quill` + `--glow-quill-soft`; BUTONUL păstrează semantica v1: fundal `--grow-deep`, bordură `--grow` („îți permiți" rămâne verde peste tot); `pulseAffordable` la tranziție, oprit după hover |
| **expensive** | bordură `--ink-border`, cost în `--muted` + sub el „Need 3 more 🪶" (12.5px) — echivalentul ETA-ului v1 (quills nu au /sec, deci afișăm diferența, nu timpul) |
| **leveled-partial** | pips parțial pline (`--quill`), efectul curent listat mic sub descriere: „Now: 5 Muses → Next: 15" |
| **maxed** | mutat în secțiunea colapsabilă „Fully Commissioned (N)" la finalul grilei (pattern-ul v1 „Purchased"), desaturat, ✓ violet |
| **locked-by-tomes** | *(rezervat — în v2.0 NICIUN upgrade de Atelier nu e blocat de tomes; starea există doar la sloturile de Relics, §3. Documentat ca să nu fie inventată o blocare inexistentă în 09.)* |

**Confirmare la cumpărăturile scumpe:** orice achiziție cu cost **≥ 10 🪶** (editorsDue 10, blueprintOfMyths 12, secondBookmark L2 14) deschide un Modal v1 (modalIn 220ms): „Commission the **Blueprint of Myths** for 12 🪶?" + rândul fix: „Your purse pays. Your renown keeps every feather it ever earned." Butoane: „Commission" (violet) / „Not yet". Sub 10 🪶 — cumpărare directă (fricțiune zero la ritmul mic al monedei).

Feedback la cumpărare: flash violet 300ms pe card (echivalentul `just-bought` verde din v1) + `walletSpend` pe ambele solduri afișate (header global + header panou).

### 2.3 Detalii per-upgrade care ating alte componente v1 (retușuri, nu redesign)

- **strokeOfGenius** — feedback OBLIGATORIU (09): FloatingNumber variantă crit (22px, `--gold-bright`, „+X ✦") + `critFlash` (#21) pe ClickButton + caption „A stroke of genius!" 800ms sub buton. Sub reduced-motion: „+X ✦ (a stroke of genius!)" static 500ms.
- **editorsDue** — PrestigePanel preview devine breakdown când e deținut: „Publish now: +3 🪶 *(+1 Editor's Due)*".
- **secondBookmark** — dialogul de confirmare prestige primește un rând când e deținut: „Bookmarked: *Sharpened Nib, Whispering Gallery* survive the reset." (numele reale, calculate din engine).
- **nightOwlPact** — OfflineModal: textele de eficiență/plafon vin deja din engine; nicio schimbare de componentă, doar stringul „up to 20h" corect.
- **selfWritingContract** — GeneratorRow Wandering Muse primește un micro-badge pill violet „auto" cu tooltip „The contract hires one whenever it costs under 1% of your ink."
- **blueprintOfMyths** — rândul `generator-mythEngine` (🏛️) intră în GeneratorList prin regulile v1 existente (revealIn, teaser „? ? ?" NU se aplică — fără Blueprint rândul nu există deloc, 09 §1.3).

---

## 3. Relics — secțiunea „Relics of the Published" (în AtelierPanel, sub upgrade-uri)

4 sloturi pe un rând (2×2 pe mobil), TOATE vizibile de la prima deschidere a Atelierului (09 §1.4 — jucătorul vede țintele).

| Stare | Aspect |
|---|---|
| **locked** | silhouette: `.icon-coin` 40px cu emoji la `filter: brightness(0.35) grayscale(1)`, nume în `--muted`, sub el progres „**4/7 tomes**" + ProgressBar v1 subțire (fill `--quill`); tooltip: efectul complet + flavor (nu ascundem nimic — ținte, ca la achievements v1) |
| **just-unlocked** | `relicUnlock` (#18) + toast kind `relic`: „A relic takes its place in the Atelier: **Standing Ovation**." |
| **unlocked** | emoji plin, bordură `--gold-deep` (relicvele sunt singurul element AURIU din Atelier — sunt câștigate prin publicare, nu cumpărate; distincția plătit/primit se vede în culoare), efectul pe scurt sub nume |

Iconografie (extensie 04 §1.2): `dogEaredPage` 📑 · `standingOvation` 👏 · `inkThatRemembers` 🏺 · `readersLetter` 💌. Progresul vine din `meta.tomesPublished` (derivat, 09) — UI nu ține stare proprie.

---

## 4. Stray Spark — elementul clickabil zburător

> **Decizie de contract:** `data-testid="stray-spark"` — conform 09 §„Ce trebuie să știe următorul agent" (id-urile din 09 se folosesc literal). Varianta „wandering-spark" din brief-ul orchestratorului e un rest al numelui vechi respins în 09 §0 (coliziune cu `wanderingMuse`/`theFirstSpark`) și NU se folosește nicăieri.

### 4.1 Cum arată

- `<button class="stray-spark" data-testid="stray-spark" aria-label="A stray spark drifts by — catch it!">`: miez de 10px `--gold-bright` (cerc), halo `--spark-halo`, 2 puncte de trenă pe `::before/::after` (4px/3px, opacity 0.5/0.25, întârziate 120/240ms pe aceeași traiectorie prin `sparkBob`). **Hitbox 48×48px** (padding transparent) — țintă de touch reală, nu pixel-hunting.
- E un `<button>` real: focusable (Tab ajunge la el cât există), Enter/Space îl prind — colectabil integral din tastatură.
- **NU e intruziv:** fără sunet, fără dim pe restul UI-ului, `pointer-events` doar pe spark (stratul e transparent la click), z-index între conținut și toast-uri (sub toasts, sub modale — un modal deschis acoperă sparkul, corect).

### 4.2 Zbor și zone de spawn (per layout)

- **StraySparkLayer** = strat `position: fixed` peste tot viewport-ul, dar traiectoria e ALEASĂ să traverseze doar zona sigură: la spawn, JS citește `getBoundingClientRect()` pentru lista de keep-out (**click-area, buff-button, prestige-button, header, TabBar/BottomNav, colțul toast-urilor**), umflate cu 24px, și alege dintre 4 lane-uri diagonale candidate peste **coloana centrală** (desktop/tabletă) prima care nu intersectează nimic; fallback garantat: banda orizontală 72–160px sub header.
- **Mobil:** banda de zbor = între ResourceHeader-ul sticky și bottom nav −16px; pe tabul Weave traiectoria e restricționată la treimea de sus (deasupra ClickButton-ului de 200px). Sparkul plutește peste ORICE tab activ (nu doar Weave) — milestone-ul l-a pornit, tabul nu contează.
- Zbor **10s** (contract 09 §2.1), diagonal lin cu bob sinusoidal; ultimele 800ms fade-out (despawn). Max 1 pe ecran; refresh mid-flight → dispare (09 anti-abuz — timerul e în shell, nu în save; UI doar randează).

### 4.3 Feedback la prindere

1. `pointerdown` (nu click — prinderea trebuie să se simtă instant) → elementul dispare imediat, un nod tranzient redă `sparkBurst` (#17) în punctul prinderii: 8 particule aurii radiale 40px + inel care se dilată, 450ms.
2. Toast kind `spark` (bordură `--gold-bright`, ✨) cu recompensa concretă: „A stray spark! **+2.4M Inspiration**, straight from the aether."
3. Recompensele-buff (`quillFrenzy`/`gossipBonanza`) afișează un **pill de buff secundar** lângă BuffButton (aceeași anatomie cu inel de durată conic-gradient din tick, bordură `--gold-bright` — NU `--ember`, ca să nu se confunde cu Moment of Inspiration), `data-testid="spark-buff-pill"`.
4. Primul spark prins vreodată → toast-tutorial unic lifetime (09 §5.2): „Something glimmers past the window. Catch it."

### 4.4 Reduced-motion (media query ȘI toggle-ul din Settings)

Fără zbor: sparkul apare **static** într-un slot fix (desktop/tabletă: colțul dreapta-sus al coloanei centrale; mobil: sub ResourceHeader, dreapta), `fadeOnly` 250ms in, rămâne 10s, fade out. `sparkBurst` → fade simplu 200ms, fără particule. Toast-ul rămâne identic. (Sloturile fixe fac și E2E-ul determinist sub reduced-motion.)

---

## 5. BookshelfPanel — „The Bookshelf"

Card v1 standard (bordură `--ink-border`), titlu „The Bookshelf", header-contor: „**12 fables · +24% production**" (la cap: „**25/25 counted — the shelf is full of wonders (+50%)**"; fabulele peste cap se adaugă vizual, contorul rămâne).

- **Raftul:** rânduri de cotoare CSS pe o „scândură" (border-bottom 3px `--gold-deep` cu gradient), `flex-wrap`, scroll vertical propriu peste ~3 rânduri. Cotor = `<button>` 18–26px lățime × 64–80px înălțime (ambele din seed), fundal token `--spine-{1..8}` (seed % 8) cu un highlight vertical subtil (`linear-gradient` alb 6% pe muchia stângă), `border-radius: 2px 3px 3px 2px`, 1–2 „nervuri" orizontale prin box-shadow inset.
- **Gilded** (`quillsEarned ≥ 5`): fundal `linear-gradient(180deg, var(--gold), var(--gold-deep))` + muchie `--gold-bright` 1px — se vede de peste tot pe raft.
- **Faded** (migrare v1): grayscale + opacity (§0), fără dată.
- **Hover/tap** → Tooltip-ul v1 (max 260px): titlul cu display font italic („*The Sleepless Fox and the Borrowed Star*"), „Tome #7 · 12 Oct", „Earned 2.3M in 24m · +2 🪶"; la faded: „*The ink has faded — stats lost to time.*" Fiecare cotor are `aria-label` = titlu + numărul tomului.
- **Fabulă nouă:** după fade-in-ul post-prestige, cotorul intră cu `bookSlideIn` (#19) + toast kind `fable` (violet): „A new fable joins your shelf: *…*". Dacă titlul e duplicat (dedup 09 §3.2): toast „A reprint! The shelf counts it but once."

---

## 6. LeaderboardPanel — „Hall of Fables"

Card cu bordură `--quill-deep`, titlu „Hall of Fables 🏅". **Niciun element al panoului nu blochează vreodată jocul** — orice eroare trăiește DOAR în interiorul cardului.

### 6.1 Mașina de stări (toate cu data-testid, §9)

| Stare | Conținut |
|---|---|
| **local-only** (build fără API URL) | O singură frază, permanentă: „The Hall exists in a library far away. This build keeps to itself." — fără input, fără buton, fără request-uri. |
| **opt-in** (API configurat, fără nickname) | Heading „Join the fellowship of the Hall", input nickname (3–20 caractere, validare inline la blur), nota de transparență (09): „Only your nickname and these four numbers ever leave this device.", buton violet „**Claim your place**". |
| **submitting** | butonul disabled + spinner (reduced-motion: text „Sending word…"). |
| **error-nickname-taken** (409) | eroare inline sub input (`--danger`): „That name is already inked in the ledger. Try another." — inputul PĂSTREAZĂ valoarea. |
| **error-invalid** (client) | „A name needs 3 to 20 characters — letters, numbers, spaces, dashes." |
| **active** | segmented control cu 4 scoruri (`Inspiration | Tomes | Quills | Fastest`), **tabel top 20**, rândul propriu evidențiat (fundal `--quill-tint` + bordură stângă 3px `--quill`); dacă nu ești în top 20: rând separat sub tabel „**#134 — Quillsworth · 8.2M**" cu aceeași evidențiere; footer: „Last updated 2m ago" + buton „Update now" (disabled 5s după click). |
| **loading** | 5 rânduri skeleton cu `skeletonPulse` (#22); reduced-motion: statice la opacity 0.5. |
| **empty** (API ok, zero intrări) | „The Hall stands empty. Be the first name on its walls." |
| **offline / API absent la runtime** | badge discret în header-ul cardului: „**The courier seems lost between libraries.** The Hall is unreachable — your library doesn't mind." + ultimul clasament din cache cu timestampul lui („as of 14:02"); retry silențios cu backoff, **zero erori/warninguri în consolă** (criteriu 09 §6.2.6). |
| **token-invalid** (401) | tratat silențios (09 §4.3); badge: „The Hall no longer knows your seal. Claim a new name to rejoin." + revenire la opt-in, cache-ul rămâne vizibil. |

### 6.2 Reguli de refresh

- **Vizibil** = componenta montată ∧ `IntersectionObserver.isIntersecting` ∧ `document.visibilityState === 'visible'`. (Pe desktop montarea = tabul Hall activ; pe tabletă/mobil panoul e secțiune în Fable → observer-ul contează.)
- Auto-refresh GET la **60s** doar cât e vizibil; primul fetch la intrarea în vizibilitate. Refresh manual oricând (cu cooldown-ul de 5s). Trimiterea scorurilor (POST/PUT, throttle 60s) aparține stratului de servicii al arhitectului — panoul doar afișează „last submitted".
- Divergență documentată față de 09 §4.3 („top 50"): UI afișează **top 20** — ține panoul sub ~600px fără scroll intern și e suficient pentru aspirație; contractul API rămâne neschimbat (poate întoarce 50, UI randează 20 + rândul propriu). Decizie de UI, reversibilă dintr-o constantă.

---

## 7. Animații noi (#16–#23, în `animations.css`, aceleași `--ease-out`/`--ease-pop`)

| # | Nume | Ce animă | Durată / easing | Detalii | Reduced-motion |
|---|---|---|---|---|---|
| 16 | `sparkFloat` (+`sparkBob`) | zborul Stray Spark | **10.000ms linear** (traiectoria) + bob 1.6s ease-in-out infinite alternate (translateY ±6px); fade-out în ultimele 800ms | endpoints prin CSS vars `--spark-x0/y0/x1/y1` setate de JS la spawn | fără zbor: slot static de colț, `fadeOnly` 250ms in/out |
| 17 | `sparkBurst` | prinderea sparkului | **450ms `--ease-pop`**, forwards | 8 particule radiale 40px + inel dilatat 0→56px, opacity→0 | fade simplu 200ms, fără particule |
| 18 | `relicUnlock` | slotul de relicvă la deblocare | **900ms `--ease-out`** | crossfade silhouette→color + inel auriu flash (unlockGlow ×1.5) + scale 0.92→1 | `fadeOnly` 250ms crossfade |
| 19 | `bookSlideIn` | cotorul nou pe raft | **500ms `--ease-pop`** | translateY(−14px) rotate(−4°) → 0/0, opacity 0→1 | `fadeOnly` 250ms |
| 20 | `leaderboardRowHighlight` | rândul propriu la refresh cu rank îmbunătățit | **1200ms ease-in-out, o dată** | fundal pulsează `--quill-tint`→×2→înapoi; evidențierea statică (bordură stângă) e permanentă | fără puls; doar evidențierea statică |
| 21 | `critFlash` | ClickButton la crit Stroke of Genius | **300ms ease-out** | flash radial `--gold-bright` pe bordură + FloatingNumber crit 22px; caption „A stroke of genius!" fade 800ms | „+X ✦ (a stroke of genius!)" static 500ms |
| 22 | `skeletonPulse` | rândurile de loading leaderboard | **1.2s ease-in-out infinite** | opacity 0.4↔0.7 pe blocuri `--ink-raised` | static la 0.5 |
| 23 | `walletSpend` | chip-ul 🪶 (header + Atelier) la cheltuire | **250ms `--ease-out`** | scale 1→0.94→1 + glow scurt `--glow-quill` | fără scale; doar actualizarea numărului |

Toate intră și în blocul `.reduce-motion` (toggle-ul manual din Settings), identic cu media query — pattern-ul existent din `animations.css`.

---

## 8. Microcopy (engleză, vocea bibliotecarului — normative)

| Context | Text |
|---|---|
| Atelier header (subtitle) | „Spend your quills on wonders. Your renown is not for sale — every quill you've **earned** keeps its +30%, forever." |
| Atelier, sub Purse (permanent) | „Spending from your purse never touches your renown." |
| Confirmare cumpărătură scumpă | „Commission the **Blueprint of Myths** for 12 🪶? Your purse pays. Your renown keeps every feather it ever earned." · butoane: „Commission" / „Not yet" |
| Spark: inkBurst toast | „A stray spark! **+2.4M Inspiration**, straight from the aether." |
| Spark: quillFrenzy toast | „The quill is frenzied! Clicks ×7 for 30s. Write faster." |
| Spark: storyFragment toast | „A fragment of an untold story. **3/5** collected." |
| Spark: fragmente complete | „Five fragments, one truth: **+1 Golden Quill**, bound by hand." |
| Spark: goldenQuillDrop | „A golden quill, out of thin air. The library pretends not to notice. **+1 🪶**" |
| Spark: primul, tutorial (o dată lifetime) | „Something glimmers past the window. Catch it." |
| Relic locked (tooltip) | „Sealed until **7 Tomes** are published — 4/7. The Hall keeps count." |
| Relic unlock toast | „A relic takes its place in the Atelier: **Standing Ovation**." |
| Bookshelf: fabulă nouă | „A new fable joins your shelf: *The Sleepless Fox and the Borrowed Star*." |
| Bookshelf: duplicat | „A reprint! The shelf counts it but once." |
| Bookshelf: faded (tooltip) | „*The ink has faded — stats lost to time.*" |
| Hall: opt-in heading + buton | „Join the fellowship of the Hall" → „**Claim your place**" |
| Hall: transparență | „Only your nickname and these four numbers ever leave this device." |
| Hall: offline | „**The courier seems lost between libraries.** The Hall is unreachable — your library doesn't mind." |
| Hall: nickname luat | „That name is already inked in the ledger. Try another." |
| Hall: succes (toast, o dată) | „Welcome to the Hall, **Quillsworth**. May your shelf grow heavy." |
| Hall: local-only build | „The Hall exists in a library far away. This build keeps to itself." |

---

## 9. Contract data-testid NOU (complet, pentru E2E) + checklist de polish

### 9.1 data-testid (convențiile v1: id-uri literale din engine, un singur element în DOM per testid)

| testid | Element |
|---|---|
| `tab-atelier` | tabul Atelier (TabBar centru ≥720px / BottomNav <720px — un singur element în DOM) |
| `tab-hall` | tabul Hall of Fables (EXISTĂ DOAR pe desktop ≥1100px; pe tabletă/mobil panoul e secțiune în Fable) |
| `atelier-panel` | rădăcina AtelierPanel |
| `atelier-purse` / `atelier-lifetime` | cele două solduri din header-ul panoului |
| `atelier-fragments` | contorul 🧩 „3/5" |
| `atelier-upgrade-<id>` | cardul (id-urile literale din 09: `apprenticeMuse`, `selfWritingContract`, `strokeOfGenius`, `blueprintOfMyths`, `restlessHeart`, `thunderousApplause`, `nightOwlPact`, `sparkcatchersNet`, `secondBookmark`, `editorsDue`) |
| `atelier-buy-<id>` | butonul de cumpărare din card (disabled = expensive) |
| `atelier-confirm-dialog` / `atelier-confirm` | dialogul de confirmare ≥10 🪶 / butonul final „Commission" |
| `relic-<id>` | slotul de relicvă (`dogEaredPage`, `standingOvation`, `inkThatRemembers`, `readersLetter`) — atribut `data-state="locked|unlocked"` |
| `relic-progress-<id>` | textul de progres „4/7 tomes" (doar în locked) |
| `stray-spark` | sparkul zburător (`<button>`; NU „wandering-spark" — vezi §4) |
| `spark-buff-pill` | pill-ul de buff secundar (quillFrenzy/gossipBonanza) — atribut `data-buff="quillFrenzy|gossipBonanza"` |
| `bookshelf-panel` / `bookshelf-count` | rădăcina raftului / header-ul „12 fables · +24%" |
| `fable-spine-<n>` | cotorul tomului #n (1-based) — atribute `data-gilded`, `data-faded` |
| `leaderboard-panel` | rădăcina Hall of Fables (ținta E2E pe TOATE layouturile) — atribut `data-state="local-only|opt-in|loading|active|offline|empty"` |
| `leaderboard-nickname-input` / `leaderboard-join` / `leaderboard-error` | fluxul opt-in |
| `leaderboard-score-tab-<key>` | segmented control (`lifetimeInspiration`, `tomesPublished`, `lifetimeQuills`, `fastestPublish`) |
| `leaderboard-table` / `leaderboard-row-self` / `leaderboard-rank-self` | tabelul / rândul propriu în top / rândul propriu sub tabel |
| `leaderboard-refresh` / `leaderboard-updated` / `leaderboard-offline` | Update now / „last updated" / badge-ul de courier |
| `generator-mythEngine` / `buy-mythEngine` | GRATIS prin pattern-ul v1 existent `generator-<id>` (nu se randează fără Blueprint) |
| `floating-number` + `data-crit="true"` | FloatingNumber-ul de crit (testid-ul v1 rămâne; critul e atribut) |
| `crit-caption` | caption-ul „A stroke of genius!" |
| `toast` cu `data-toast-kind` NOU: `spark` / `relic` / `fable` | toast-urile v2 (kind-urile v1 rămân) |

### 9.2 Checklist de polish (QA bifează)

**Regula de aur & Atelier**
- [ ] Cumpărarea oricărui upgrade de Atelier NU modifică `per-second` afișat și NU mișcă `atelier-lifetime` (nici măcar 1px — tabular-nums).
- [ ] Microcopy-ul „never touches your renown" e vizibil permanent în AtelierPanel (nu tooltip).
- [ ] Achiziții ≥10 🪶 cer confirmare; sub 10 🪶 nu apare dialog; Escape anulează fără efect.
- [ ] Relics: toate cele 4 sloturi vizibile de la prima deschidere, cu progres corect; deblocarea produce exact un toast + relicUnlock.
- [ ] grep `#[0-9a-fA-F]{3,6}` pe componentele noi → hituri DOAR în tokens.css/animations.css.

**Stray Spark**
- [ ] Traiectoria nu intersectează NICIODATĂ click-area/buff-button/prestige-button/nav-uri (E2E: bounding boxes pe 3 viewport-uri × 10 spawn-uri forțate).
- [ ] Max 1 spark; refresh mid-flight → dispare fără erori; tab hidden → despawn.
- [ ] Prinderea din tastatură (Tab + Enter) funcționează; hitbox ≥44×44px.
- [ ] Reduced-motion: spark static în slotul de colț, fără sparkFloat/sparkBurst; toast-ul apare identic.
- [ ] 3 sparks prinși consecutiv nu scad FPS sub 55 (nodurile de burst se curăță).

**Bookshelf**
- [ ] 40 de fabule pe raft: fără scroll orizontal, scroll vertical propriu; contorul arată cap-ul „25/25" corect.
- [ ] Cotoarele gilded/faded se disting și fără culoare (gilded are muchia luminoasă; faded n-are dată în tooltip) — 04 §7.5.
- [ ] Migrare v1 cu 10 tomes → 10 cotoare faded prezente la primul load, cu titluri stabile la refresh.

**Hall of Fables**
- [ ] Build fără API URL: starea local-only, ZERO request-uri de rețea, zero erori consolă.
- [ ] API oprit la runtime: badge courier + cache cu timestamp, zero erori consolă, jocul complet funcțional.
- [ ] 409 → eroare inline, input păstrat; 401 → revenire silențioasă la opt-in.
- [ ] Network tab: request-uri DOAR cât panoul e vizibil (tab activ / secțiune în viewport); interval 60s respectat.
- [ ] Rândul propriu evidențiat în top 20 SAU afișat sub tabel cu rank — niciodată ambele.

**Layout & progresie**
- [ ] 375px cu 5 tab-uri: fiecare ≥48px înălțime, label-uri netrunchiate, fără scroll orizontal.
- [ ] Înainte de primul Publish: ZERO elemente v2 în DOM (în afara sparkului după 1.000 totalEarned) — UI-ul v1 e pixel-identic.
- [ ] La primul Publish: reveal-urile în ordinea Bookshelf → Atelier → Hall, max 3 toast-uri vizibile, fără suprapuneri.
- [ ] Tab-navigare completă: cumpără upgrade Atelier + join leaderboard doar din tastatură.
- [ ] axe DevTools: zero erori critice de contrast pe AtelierPanel + LeaderboardPanel.

---

## Ce s-a decis
- **Plasare:** Atelier = tab central nou (violet, după primul Publish) pe desktop/tabletă și al 5-lea tab în bottom nav pe mobil (nav-ul rămâne cu 4 tab-uri până la primul Publish — zero regresie); Hall of Fables = tab central pe desktop, secțiune finală în tabul Fable pe tabletă/mobil; Bookshelf = coloana dreaptă sub PrestigePanel (desktop) / în Fable (rest); coloana stângă v1 neatinsă.
- **Regula de aur vizualizată:** două solduri permanente în AtelierPanel (Purse violet mare / Lifetime imobil) + microcopy anti-frică permanent + `walletSpend` doar pe portofel; chip-ul global 🪶 arată portofelul, tooltip-ul arată lifetime-ul.
- **Stări complete** pentru: carduri Atelier (affordable/expensive/leveled-partial/maxed; „locked-by-tomes" documentat ca inexistent la upgrade-uri — trăiește doar pe Relics), sloturi Relics (locked cu progres/just-unlocked/unlocked), Stray Spark (zbor 10s, keep-out rects, hitbox 48px, buton real), Bookshelf (normal/gilded/faded + dedup „reprint"), Leaderboard (10 stări, tabel top 20, vizibilitate prin IntersectionObserver, auto-refresh 60s).
- **8 animații noi #16–#23** cu durate/easing fixe + regulă reduced-motion pentru fiecare (inclusiv slotul static de colț pentru spark).
- **Confirmare la cumpărături ≥10 🪶**; feedback crit obligatoriu (critFlash + caption); `data-testid="stray-spark"` (nu „wandering-spark") conform contractului 09.
- 8 token-uri de cotor + 3 token-uri glow/tint noi, exclusiv în tokens.css.

## De ce
- Atelier ca tab central (nu în coloana meta): e un MAGAZIN — locul lui e lângă Generators/Upgrades, în zona „cheltuială", iar violetul îl separă semantic; pe mobil merită tab propriu pentru că e singurul sink de quills și motorul de retenție v2.
- Bookshelf sub PrestigePanel: cauzalitate fizică publish→carte pe verticală; e recompensa emoțională a prestige-ului, nu un magazin.
- Hall of Fables montat per-tab pe desktop + IntersectionObserver pe rest: regula „refresh doar când e vizibil" devine structurală, nu polling ascuns — respectă static-first.
- Cele două solduri + microcopy permanent atacă direct singurul risc UX al v2 (frica de cheltuire) — regula de aur din 09 §1.1 trebuie VĂZUTĂ, nu doar implementată.
- 5 tab-uri doar după primul Publish: jucătorul nou păstrează exact UI-ul v1 calibrat (09: runda 1 neatinsă), iar lățimea de 375px rămâne în toleranțele 04 §7.3.
- Top 20 în loc de top 50 (divergență documentată): panoul încape fără scroll intern; aspirația o dă rândul propriu cu rank, nu lungimea listei.

## Fișiere create sau modificate
- **Creat:** `C:/Projects/Games/Fable Idler/ai-memory/12-v2-ui-ux.md` (acest document).
- **Modificat (doar notă de trimitere, permisă):** `C:/Projects/Games/Fable Idler/ai-memory/04-ui-ux-decisions.md` — o linie sub header care trimite la 12 pentru extensiile v2.
- Niciun fișier de cod — implementarea revine Agentului UI v2 (tokens.css §0, animations.css §7, componentele §2–§6).

## Riscuri
- **Keep-out-ul sparkului e runtime, nu static:** dacă implementarea sare peste verificarea rect-urilor la spawn, sparkul poate acoperi butonul de Publish exact în momentul deciziei — checklist-ul are test explicit pe 3 viewport-uri; fallback-ul (banda sub header) trebuie să existe.
- **5 tab-uri la 375px** e la limita de jos: dacă se adaugă VREODATĂ al 6-lea tab, bottom nav-ul trebuie regândit (nu înghesuit) — decizie de blocat aici.
- **Coloana dreaptă desktop are acum 4 secțiuni** (Prestige+Bookshelf+Milestones+Achievements) — Bookshelf trebuie plafonat la ~3 rânduri de cotoare cu scroll intern, altfel împinge Milestones sub fold la 1080p.
- **Auto-refresh + throttle-ul de submit (60s) sunt straturi diferite** (UI vs serviciu) — dacă arhitectul nu expune „lastSubmittedAt", footer-ul „last updated" poate minți; contractul de serviciu trebuie să-l includă.
- **Chip-ul `golden-quills` își schimbă semantica** (era total, devine portofel) — testele E2E v1 care asertează valoarea lui după prestige trebuie revizuite de Agentul de teste v2 (documentat mai jos).
- **Emoji-urile noi** (🏺 📑 👏 💌 🏛️ 🧩 🏅): țintă Chromium (OK, ca în v1); fallback-urile rămân constante înlocuibile în `icons.ts`.

## Ce trebuie să știe următorul agent
- **Agent UI v2 (implementare):** token-urile din §0 se copiază literal în tokens.css; animațiile §7 în animations.css cu pattern-ul existent (`.anim-*` + blocurile media-query ȘI `.reduce-motion`); sparkul e `<button>` cu pointerdown, în strat fixed cu keep-out la spawn (§4.2); LeaderboardPanel nu aruncă NIMIC în consolă la API absent (catch total + backoff); reveal-urile Actului 2 în ordinea fixă §1.4; NU duplica praguri — totul vine din milestones/engine (regula v1).
- **Agent arhitect v2:** UI are nevoie în plus de: evenimente consumabile noi în `subscribeToEvents` (`spark` spawn/collect cu recompensa rezolvată, `relic`, `fable` cu titlul, `fragmentBound`), starea spark-buff-ului (tip + remaining) pentru pill, `lastSubmittedAt`/`lastFetchedAt` + cache-ul clasamentului în serviciul de leaderboard (NU în save), și flag build-time pentru local-only (absența `VITE_API_URL`).
- **Agent teste v2 (E2E):** țintește `leaderboard-panel` (nu `tab-hall` — există doar pe desktop); `stray-spark` e testid-ul contractual; pentru spawn determinist cere un hook de test (`forceSpark`) în `__FABLE_TEST__` — de negociat cu arhitectul; ATENȚIE: `golden-quills` afișează portofelul post-cheltuire (testele v1 care îl echivalau cu quills câștigate se actualizează); reduced-motion mută sparkul în slot static — folosește-l pentru testele de click.
- **Agent economie v2:** dacă schimbă pragul de confirmare (10 🪶) sau cap-ul Bookshelf (25), §2.2/§5 se actualizează aici, nu se hardcodează în componente.
- Ordinea secțiunilor din tabul Fable (tabletă/mobil) e contract: Prestige → Bookshelf → Milestones → Achievements → Hall of Fables.

## Validări făcute
- **Coerență cu 09:** toate id-urile folosite literal (10 upgrade-uri, 4 relics, 6 recompense spark, 4 milestones, `mythEngine`); zbor 10s conform 09 §2.1 (varianta „~8s" din brief respinsă); `data-testid="stray-spark"` conform 09 §„Ce trebuie să știe" (varianta „wandering-spark" din brief = numele vechi respins în 09 §0); butonul „Claim your place" conform 09 §4.3 („Join the fellowship" păstrat ca heading); stările offline/401/local-only acoperă criteriul 09 §6.2.6.
- **Coerență cu 04 + codul real de pe disc:** citit `src/ui/styles/tokens.css` și `animations.css` — token-urile noi urmează exact pattern-ul existent (culori brute doar acolo, clase `.anim-*`, blocuri duale media-query/`.reduce-motion`); numerotarea animațiilor continuă de la #15; rolurile semantice de culoare respectate (grow rămâne DOAR affordability, inclusiv în Atelier; ember rămâne exclusiv Moment of Inspiration — buff-urile spark folosesc gold-bright).
- **Coerență cu 05 (contractele reale):** convențiile data-testid v1 respectate (id-uri literale engine, un element per testid, pattern `generator-<id>` acoperă mythEngine gratis); nota 05 despre `tab-achievements`-ca-secțiune folosită ca precedent pentru `leaderboard-panel`; chip-ul `golden-quills` există deja cu testid — doar semantica se extinde.
- **Aritmetică layout:** 4 tab-uri × ~118px la centru minim 480px (desktop) ✓; 5 tab-uri × 75px la 375px cu label 11px („Upgrades" ≈ 54px) ≥44px lățime ✓; coloana stângă neatinsă (constrângerea ~700px din 04 conservată) ✓.
- **Contrast (calcul luminanță, ca în 04):** textele noi folosesc exclusiv perechile deja validate în 04 (`--parchment`/`--parchment-dim`/`--quill`/`--gold` pe `--ink*`); cotoarele sunt decorative fără text; `--quill-tint` e fundal sub `--parchment` (contrastul textului rămâne cel al `--ink-raised`, validat).
- Document static — validarea vizuală reală se face la implementare cu checklist-ul §9.2.
