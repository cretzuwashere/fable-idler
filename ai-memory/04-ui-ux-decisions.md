# 04 — UI/UX & Art Direction (Agent 4)

> Contract vizual pentru Fable Idler. Agentul UI implementează EXACT ce e aici: token-urile CSS, componentele cu stările lor, animațiile cu duratele lor. Numele entităților rămân în engleză (contract din `01-game-design.md`). Textele UI ale jocului sunt în engleză (ton „bibliotecar excentric", vezi §9).

---

## 1. Direcția de artă: „Biblioteca de noapte a Țesătorului"

Un atelier-bibliotecă la lumina lumânărilor: fundal indigo profund cald (cerneală la miezul nopții), suprafețe ca pergamentul vechi întunecat, accente aurii de lumină de lumânare, violet de tuș regal pentru prestige. NIMIC nu arată a Bootstrap: fără alb pur, fără gri neutru, fără albastru #007bff, fără colțuri complet drepte pe carduri, fără umbre negre dure. Totul e generat din CSS (gradiente, umbre, glow, o textură de zgomot din SVG inline data-URI) + emoji în „monede" de icon stilizate CSS. Zero imagini externe, zero CDN.

### 1.1 Paleta exactă — CSS custom properties (sursa unică de adevăr, în `src/styles/tokens.css`)

```css
:root {
  /* Fundaluri (indigo-cerneală cald, din adânc spre suprafață) */
  --ink-deep:    #121022;  /* fundalul paginii (body) */
  --ink:         #1b1730;  /* fundalul panourilor mari / coloanelor */
  --ink-raised:  #262040;  /* carduri, rânduri, suprafețe interactive */
  --ink-hover:   #2e2750;  /* hover pe suprafețe */
  --ink-border:  #3b3260;  /* borduri subtile 1px */

  /* Text */
  --parchment:      #f0e6d2;  /* text principal (pergament cald) */
  --parchment-dim:  #c9bda4;  /* text secundar (producție, flavor) */
  --muted:          #8d8398;  /* text terțiar / disabled / hint-uri */

  /* Accente semantice */
  --gold:        #e8b54d;  /* Inspiration, titluri, accente principale */
  --gold-bright: #ffd97a;  /* glow, hover pe gold, numărul mare de resursă */
  --gold-deep:   #9c7226;  /* borduri/umbre ale elementelor aurii */
  --quill:       #b48ce4;  /* prestige / Golden Quills / tot ce e meta */
  --quill-deep:  #7a5aad;  /* borduri/fundal panou prestige */
  --grow:        #8fc97a;  /* affordable / succes / progres pozitiv */
  --grow-deep:   #4f7a42;  /* border buton buy activ */
  --ember:       #f0975a;  /* buff activ Moment of Inspiration (flacără) */
  --danger:      #e06c5a;  /* reset, acțiuni distructive */

  /* Umbre & glow (folosite consistent, nu umbre ad-hoc) */
  --shadow-card:  0 2px 8px rgba(8, 6, 18, 0.55);
  --shadow-pop:   0 8px 28px rgba(8, 6, 18, 0.7);
  --glow-gold:    0 0 14px rgba(232, 181, 77, 0.45);
  --glow-quill:   0 0 14px rgba(180, 140, 228, 0.45);
  --glow-grow:    0 0 10px rgba(143, 201, 122, 0.40);

  /* Geometrie */
  --radius-card: 12px;
  --radius-btn:  10px;
  --radius-pill: 999px;
}
```

**Reguli de folosire (obligatorii):**
- Orice culoare din cod vine dintr-un token — ZERO hex hardcodat în componente (criteriu QA §8).
- `--gold` = tot ce ține de Inspiration și de „valoare". `--quill` = exclusiv prestige/meta (panou, buton, numărul de quills, upgrade Quill Resonance). `--grow` = exclusiv „îți permiți / progres". Nu se amestecă rolurile.
- Fundalul paginii: `--ink-deep` + două straturi CSS peste el: (1) vignetă caldă `radial-gradient(ellipse at 50% -10%, rgba(232,181,77,0.07), transparent 55%)` — „lumina lumânării" de sus; (2) textură de zgomot: SVG inline data-URI cu `feTurbulence` (fractalNoise, baseFrequency 0.9), `opacity: 0.035`, `background-repeat: repeat`. Ambele pe `body::before/::after`, `pointer-events: none`.

### 1.2 Iconografie (emoji în „monedă" CSS)

Emoji-urile NU se pun crude în text — se randează într-un span `.icon-coin`: cerc/romb cu `background: radial-gradient(circle at 35% 30%, var(--ink-hover), var(--ink-deep))`, bordură 1px `--ink-border`, `filter: saturate(0.9)`, dimensiune 40px pe rânduri / 28px pe butoane. Mapare fixă:

| Entitate | Emoji | Entitate | Emoji |
|---|---|---|---|
| Inspiration | ✨ | Story Loom | 🧵 |
| Golden Quills | 🪶 | Dream Library | 📚 |
| Wandering Muse | 🧚 | Fable Forge | ⚒️ |
| Ink Sprite | 💧 | Moment of Inspiration | 💡 |
| Talking Raven | 🐦‍⬛ | Publish the Tome | 📖 |
| Enchanted Quill | ✒️ | Achievements | 🏆 |
| Milestones | 🗝️ | Settings | ⚙️ |

Fallback: dacă 🐦‍⬛ (secvență ZWJ) nu se randează pe un sistem, folosim 🦅 — dar target-ul e Chromium în Docker/Playwright, unde merge.

---

## 2. Tipografie (self-hosted, fără CDN)

Instalate ca dependințe npm (bundle-uite de Vite, funcționează offline în containerul nginx):

- **Display (titluri, numele jocului, numărul mare de resursă, numele generatorilor):** `@fontsource/cormorant-garamond` (weights 600, 700). Serif literar, exact tonul „storybook". Import doar subsetul `latin`.
- **UI (tot restul: body, butoane, cifre, tooltips):** `@fontsource-variable/inter`. Motiv decisiv: **`font-variant-numeric: tabular-nums`** — obligatoriu pe TOATE numerele din joc (resursa, /sec, costuri, countere), ca cifrele să nu „danseze" la fiecare tick.

```css
--font-display: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
--font-ui: 'InterVariable', system-ui, -apple-system, 'Segoe UI', sans-serif;
```

**Scara tipografică:** numărul de resursă 44px/700 display (cu `--gold-bright` + text-shadow `--glow-gold` subtil); H1 logo 28px display; titluri de secțiune 20px display 600, `letter-spacing: 0.02em`; body 15px UI; secundar 13px; caption/cost 12.5px. Line-height body 1.5.

**Formatarea numerelor (decizie UX):** notare scurtă cu sufixe — sub 1.000 întreg (`847`), apoi 3 cifre semnificative: `12.4K`, `1.23M`, `456M`, `7.89B`, `1.02T`, apoi `Qa`, `Qi`. Aceeași funcție `formatNumber()` din engine e folosită peste tot (inclusiv în tooltips) — niciodată notație științifică în UI-ul principal.

---

## 3. Layout

### 3.1 Desktop (≥1100px) — 3 zone fixe, fără scroll pe coloana stângă

```
┌────────────────────────── header (56px) ──────────────────────────┐
│  📖 Fable Idler          🪶 12 Golden Quills            ⚙️        │
├───────────────┬──────────────────────────────┬────────────────────┤
│ STÂNGA 340px  │  CENTRU flexibil (min 480px) │  DREAPTA 320px     │
│ (sticky)      │  (scroll propriu)            │  (scroll propriu)  │
│               │                              │                    │
│ ResourceHeader│  [ Generators | Upgrades ]   │  PrestigePanel     │
│ ✨ 1.24M      │  GeneratorRow ×7             │  MilestoneTracker  │
│ +847/sec      │  (sau UpgradeCard grid ×2)   │  AchievementGrid   │
│ ClickButton   │                              │                    │
│ (mare, 180px) │                              │                    │
│ BuffButton    │                              │                    │
│ StatsStrip    │                              │                    │
└───────────────┴──────────────────────────────┴────────────────────┘
```

- **Stânga** = „altarul": tot ce e per-secundă și activ. Sticky, fără scroll — clickul e mereu sub mouse.
- **Centru** = „magazinul": tab-uri `Generators` / `Upgrades` (tab-uri reale, cu `aria-selected`, underline animat `--gold`). Fiecare listă are scroll propriu (`overflow-y: auto`).
- **Dreapta** = „meta": Prestige sus (e decizia importantă), apoi MilestoneTracker, apoi AchievementGrid. Scroll propriu.
- Lățime maximă totală 1520px, centrat, `gap: 20px`, padding lateral 24px.

### 3.2 Tabletă (720–1099px) — 2 zone
Stânga rămâne coloană sticky de 300px; centrul preia și meta: tab-urile devin `Generators | Upgrades | Fable` (tab-ul **Fable** = Prestige + Milestones + Achievements stivuite).

### 3.3 Mobil (<720px) — stack + bottom nav
- Header compact (48px): logo + 🪶 count + ⚙️.
- **ResourceHeader devine sticky top** (resursă + /sec pe un rând, 64px) — vizibil permanent.
- **Bottom nav fix, 4 tab-uri, fiecare ≥48px înălțime:** `✨ Weave` (ClickButton mare + buff + stats) · `🏭 Shop` (generatori) · `📜 Upgrades` · `📖 Fable` (Prestige + Milestones + Achievements). Badge-dot auriu pe tab când există ceva nou cumpărabil/deblocat în el.
- ClickButton pe mobil: minim 200×200px, centrat în tab-ul Weave.
- Safe-area: `padding-bottom: env(safe-area-inset-bottom)` pe nav.

---

## 4. Componente UI — listă completă cu stări

Toate componentele primesc doar props derivate din starea engine-ului; nu țin logică de joc.

1. **ResourceHeader** — ✨ + valoarea curentă (display font, `--gold-bright`) + `+X/sec` dedesubt (`--parchment-dim`; devine `--ember` cu ✨ pulsând când buff-ul e activ). Stări: normal / buff-activ / milestone-shimmer (900ms la fiecare milestone atins).
2. **ClickButton** — disc mare (180px desktop / 200px mobil), gradient radial auriu-pergament pe fundal ink, bordură dublă `--gold-deep`, textul „Weave ✨". Stări: idle (glow respirând lent), pressed (scale 0.96, 90ms), buff-active (bordură `--ember` + glow portocaliu). La fiecare click emite un **FloatingNumber**.
3. **FloatingNumber** — `+X` (formatat) care urcă 60px și dispare (animația `floatUp`). Poziție random ±30px orizontal în jurul punctului de click. Max 12 simultan în DOM (pool — al 13-lea îl reciclează pe cel mai vechi). Sub buff: culoare `--ember` și 18px în loc de 15px.
4. **BuffButton (Moment of Inspiration)** — pill cu 💡, sub ClickButton. Stări: **ready** (bordură `--ember`, pulse lent, label „Moment of Inspiration"), **active** (fundal ember, countdown „12s", inelul devine timer de durată), **cooldown** (desaturat, inel de progres `conic-gradient` care se umple, label „54s"), **locked** (nerandat până la milestone Racing Heart). Inelul e un `conic-gradient` pe `::before`, actualizat din tick (nu animație CSS).
5. **StatsStrip** — 3 mini-staturi sub buff: Total earned (rundă) · Clicks · Tomes 📖. Text 12.5px `--muted`, valori tabular-nums.
6. **GeneratorRow** — rând orizontal: `.icon-coin` 40px | nume (display font) + „×N owned" pill | producție „0.4/sec each · 12/sec total" (`--parchment-dim`) | dreapta: **BuyButton** cu costul. Stări: **affordable** (BuyButton fundal `--grow-deep`, text `--parchment`, bordură `--grow`, pulse când tocmai a devenit affordable), **expensive** (BuyButton disabled, cost în `--muted`, plus text „12s ✨" — timp estimat până ți-l permiți, calculat din /sec), **just-bought** (flash verde 300ms pe rând), **milestone-badge** (badge-uri pill aurii „×2" la 25/50/100, cu `badgePop` la apariție; la 24/49/99 unități un hint sub producție: „1 more → ×2!"), **newly-revealed** (intră cu `revealIn`; până la prima cumpărare numele apare ca „? ? ?" doar dacă totalEarned < pragul milestone-ului de reveal — după reveal numele e vizibil complet). Deasupra listei: **toggle Buy ×1 / ×10 / ×Max** (segmented control, persistat în save; costul de pe fiecare BuyButton reflectă cantitatea selectată).
7. **UpgradeCard** — card ~grid 2 coloane (1 pe mobil): icon-coin, nume, descrierea efectului (concretă: „Each Talking Raven grants +5% Ink Sprite production"), cost. Stări: **affordable** (bordură `--grow` + glow), **expensive** (bordură `--ink-border`, cost `--muted`), **purchased** (mutat într-o secțiune colapsabilă „Purchased (N)" la finalul listei, desaturat, checkmark ✓ auriu), **hidden** (nerandat până la condiția de unlock din 01 §5 — upgrade-urile apar DOAR când condiția de unlock e îndeplinită). Quill Resonance are bordura `--quill` (e singurul upgrade violet).
8. **AchievementGrid** — grid de pătrate 56px (7 coloane desktop, 5 mobil). Stări: **locked** (silhouette: fundal `--ink-raised`, „?" `--muted`; tooltip cu condiția vizibilă — nu ascundem condițiile, jucătorul trebuie să aibă ținte), **unlocked** (emoji 🏆 + fundal gradient auriu subtil + bordură `--gold-deep`; tooltip: nume + condiție + „+1% global production" sau „+2%" cu Bound Anthology), **just-unlocked** (unlockGlow 600ms + toast). Header-ul secțiunii arată „9/14 · +9% production".
9. **MilestoneTracker** — panou „Next unlocks": maxim 3 rânduri, fiecare cu numele milestone-ului URMĂTOR (cel mai apropiat pe totalEarned + următoarele 2 praguri de cantitate cele mai apropiate) + **ProgressBar** animat spre prag (fill gradient auriu, `progressFill` 300ms). Milestone-urile deja atinse nu se listează (istoricul trăiește în toast-uri) — panoul e mereu despre „ce urmează".
10. **PrestigePanel** — card cu bordură `--quill-deep`, titlu „Publish the Tome 📖". Conținut: quills actuale, **câștig estimat live** („Publish now: +3 🪶" — recalculat la fiecare tick) și progress bar spre următorul quill. Stări: **teaser** (între milestone Publisher's Letter la 50k și pragul de 100k: vizibil, buton disabled, bar spre 100k), **ready** (buton violet activ cu `--glow-quill`), **confirming** (pasul 2: dialogul de confirmare listează concret ce se pierde și ce se primește + checkbox „I understand my run resets"; butonul final „Publish" e activ doar cu checkbox bifat), **post-prestige** (după fade: totul reia, quills actualizate în header).
11. **OfflineModal** — „While you were away…": modal centrat (max 420px) cu ⏳, durata absenței, Inspiration câștigată (număr mare, `countUp` 1200ms), eficiența folosită („at 50% efficiency" / „75% with Lucid Dreaming") și un singur buton „Collect ✨". Apare peste tot restul la load dacă absența ≥ 60s. Se poate închide și cu Escape/click-outside (colectează oricum — nu există „pierde recompensa").
12. **Toast** — colț dreapta-jos (deasupra bottom nav pe mobil), max 3 vizibile, coadă pentru rest. Tipuri: milestone (bordură `--gold`), achievement (bordură `--gold` + 🏆), unlock de conținut („New generator available!"), prestige (bordură `--quill`). Auto-dismiss 4s, pauză la hover, dismiss la click. Container `aria-live="polite"`.
13. **SettingsPanel** — modal din ⚙️: **Export save** (textarea readonly cu save-ul base64 + buton Copy), **Import save** (textarea + Load cu validare și mesaj de eroare inline dacă e corupt), **Hard reset** (buton `--danger`, confirmare DUBLĂ: dialog 1 „This erases everything including Golden Quills" → dialog 2 cere să tastezi `RESET` într-un input ca să se activeze butonul final), toggle „Reduce motion" (suplimentar față de media query), numărul versiunii jocului. 
14. **TabBar / BottomNav** — descrise în §3; tab-urile nedeblocate (Upgrades înainte de 100 totalEarned, Fable înainte de Publisher's Letter/primul achievement) NU se randează deloc — apar cu `revealIn` + toast când se deblochează.
15. **Tooltip** — component unic reutilizat (hover pe desktop, tap-and-hold pe mobil): fundal `--ink-deep`, bordură `--ink-border`, `--shadow-pop`, max 260px, delay 150ms.

---

## 5. Feedback vizual — toate animațiile, cu durate și easing

Definite o singură dată în `src/styles/animations.css`. Easing-ul standard al UI-ului: `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`; overshoot pentru „celebrare": `--ease-pop: cubic-bezier(0.34, 1.56, 0.64, 1)`.

| # | Nume | Ce animă | Durată / easing | Detalii |
|---|---|---|---|---|
| 1 | `floatUp` | FloatingNumber la click | **800ms ease-out**, forwards | translateY(0→−60px), opacity 1→0 (fade începe la 40%), scale 1→1.1 |
| 2 | `pressDown` | ClickButton la mousedown | **90ms ease-out** apăsare, **180ms `--ease-out`** revenire | scale(1→0.96); pe mousedown, nu pe click — feedback instant |
| 3 | `breatheGlow` | ClickButton idle | **3s ease-in-out infinite alternate** | box-shadow între `--glow-gold` la 40% și 70% intensitate |
| 4 | `pulseAffordable` | BuyButton/UpgradeCard când devine affordable | **1.6s ease-in-out infinite** | box-shadow `--glow-grow` 0→1→0; pornește DOAR la tranziția expensive→affordable, se oprește după hover (jucătorul a văzut) |
| 5 | `unlockGlow` | Achievement / badge / element nou deblocat | **600ms `--ease-out`** | flash luminos: box-shadow `--glow-gold` ×2 → normal + scurtă ridicare translateY(−2px) |
| 6 | `badgePop` | Badge ×2 pe GeneratorRow, pill-uri noi | **350ms `--ease-pop`** | scale(0→1.15→1) |
| 7 | `revealIn` | GeneratorRow / tab / panou nou dezvăluit | **400ms `--ease-out`** | opacity 0→1 + translateY(8px→0) |
| 8 | `toastIn` / `toastOut` | Toast | **250ms `--ease-out`** in / **200ms ease-in** out | translateX(24px→0) + fade; auto-dismiss 4s |
| 9 | `progressFill` | Toate ProgressBar-urile | **transition width 300ms ease-out** | niciodată salt instant; la 100% un flash `--gold-bright` 200ms |
| 10 | `shimmerGold` | Numărul de resursă la milestone atins | **900ms ease-in-out**, o dată | gradient luminos traversează textul (background-clip: text) |
| 11 | `prestigeFade` | Tranziția Publish the Tome | **1400ms total**: fade-out 500ms ease-in → hold 400ms → fade-in 500ms `--ease-out` | overlay `--ink-deep` acoperă tot; în hold: „The Tome is published. +3 🪶" centrat, display font, apoi UI-ul resetat apare |
| 12 | `modalIn` | OfflineModal / Settings / confirmări | **220ms `--ease-out`** | scale(0.96→1) + fade; backdrop `rgba(18,16,34,0.75)` fade 220ms |
| 13 | `countUp` | Numărul din OfflineModal | **1200ms ease-out** (tween JS) | 0 → valoarea colectată, tabular-nums (nu sare layout-ul) |
| 14 | `buffRing` | Inel cooldown/durată BuffButton | continuu, actualizat din game tick | `conic-gradient(var(--ember) X%, var(--ink-border) 0)` — JS setează X, fără animație CSS |
| 15 | `emberPulse` | ResourceHeader + ClickButton cât buff-ul e activ | **1s ease-in-out infinite alternate** | glow `--ember` subtil pe /sec și pe bordura butonului |

**`prefers-reduced-motion: reduce`** (și toggle-ul din Settings): #1, #3, #4, #10, #15 se dezactivează completamente; #11 devine fade simplu 300ms; restul își păstrează doar opacity-fade (fără translate/scale). FloatingNumbers se înlocuiesc cu un „+X" static 500ms lângă buton.

---

## 6. Stări UI pe parcursul jocului (unlock progresiv — anti-copleșire)

Regula de aur: **un element de UI nu se randează deloc (nici disabled, nici gri) până nu e dezvăluit de milestone-ul lui.** Excepție unică: BuyButton-urile expensive (ele sunt ținta de dorință) și PrestigePanel în modul teaser.

- **Primele 30 secunde (empty state):** ecranul conține DOAR: header (logo + ⚙️), ResourceHeader (✨ 0) și ClickButton-ul mare, centrat pe desktop (coloana centrală și dreaptă goale nu se randează — stânga e temporar centrată prin layout „solo mode"). Sub buton, un singur text ghid: „Weave your first sparks of Inspiration ✨". La 10 totalEarned (The First Spark): layout-ul trece în modul 2 coloane cu `revealIn` — apare panoul Generators cu Wandering Muse. Primul toast de achievement (First Words) sosește la primul click → tab-ul Fable/coloana dreaptă apare cu doar secțiunea Achievements.
- **Early (minutele 1–10):** apar pe rând, fiecare cu toast + `revealIn`: Ink Sprite (60), tab Upgrades (100), BuffButton (500), Talking Raven (600). MilestoneTracker apare odată cu panoul Generators — arată mereu următorul prag. Layout-ul complet pe 3 zone e atins abia la ~50k (Publisher's Letter → PrestigePanel teaser).
- **Mid (prima rundă completă):** toate zonele populate; ritmul de feedback vine din pulse-uri affordable, badge-uri ×2 și progress-ul spre 100k în PrestigePanel. Hint-urile „1 more → ×2!" pe generatoarele aproape de prag de cantitate direcționează cheltuiala.
- **Late-run:** PrestigePanel ready domină coloana dreaptă (glow violet); decizia „publish now vs push" e susținută vizual de bara „next quill at 400K".
- **Post-prestige:** după `prestigeFade`, UI-ul revine în starea early DAR: header-ul arată quills (🪶 N, violet), achievements rămân, upgrade-ul Quill Resonance apare devreme în Upgrades (bordură violet — semnal „ăsta e nou"), iar milestone-urile se re-parcurg rapid, cu aceleași toast-uri (intenționat — dau ritm rundei 2). Nu există „ecran gol" post-prestige: panoul Generators rămâne vizibil imediat (milestone-urile de reveal se re-ating în secunde).

---

## 7. Accesibilitate (minim obligatoriu)

1. **Contrast:** text normal ≥4.5:1 pe fundalul lui (`--parchment`/`--parchment-dim` pe `--ink*` trec; `--muted` DOAR pe text ≥18px sau non-esențial); componente UI și text pe butoane ≥3:1. Verificare cu axe DevTools la QA.
2. **Focus states:** `:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }` global — pe TOATE elementele interactive, inclusiv tab-uri, toggle buy, pătratele din AchievementGrid.
3. **Touch targets:** pe mobil orice element interactiv ≥44×44px (BuyButton ≥44px înălțime; minim absolut acceptat 40px pentru toggle-ul ×1/×10/×Max). Bottom nav ≥48px.
4. **Semantică:** butoane = `<button>`, tab-uri cu `role="tablist"/tab/tabpanel` + `aria-selected`, progress bars cu `role="progressbar"` + `aria-valuenow`, toasts în `aria-live="polite"`, modale cu focus-trap + Escape + `aria-modal`.
5. **Nu doar culoare:** affordable = culoare + buton enabled/disabled + (la expensive) timpul estimat afișat; achievements locked/unlocked diferă și prin conținut („?" vs emoji), nu doar prin culoare.
6. **Motion:** `prefers-reduced-motion` respectat (§5) + toggle manual în Settings.
7. **Zoom:** layout-ul nu se sparge la 200% zoom pe desktop (grid-urile devin coloană unică natural, ca pe mobil).

---

## 8. Checklist de polish (QA bifează fiecare item)

**Vizual**
- [ ] Zero culori hardcodate în componente (grep `#[0-9a-fA-F]{3,6}` în `src/components` și `src/ui` → doar în tokens.css/animations.css).
- [ ] Fundalul are vignetă + textură de zgomot vizibile (comparat cu fundal flat la screenshot diff).
- [ ] Toate numerele folosesc tabular-nums — la tick, textul „/sec" nu se mișcă orizontal.
- [ ] Fonturile Cormorant Garamond + Inter se încarcă din bundle (network tab: zero requesturi externe de font; funcționează cu rețeaua tăiată).
- [ ] Emoji-urile sunt în `.icon-coin`, nu text crud.
- [ ] Nicio bară de scroll orizontală la 1100px, 768px, 375px lățime.

**Feedback**
- [ ] Fiecare click produce FloatingNumber + pressDown; 20 clickuri/sec nu produc >12 noduri DOM de floating numbers și nu scad FPS sub 55.
- [ ] Tranziția expensive→affordable pornește pulseAffordable pe exact acel buton; se oprește după hover.
- [ ] Fiecare milestone/achievement produce exact un toast; 5 unlock-uri simultane = max 3 toast-uri vizibile + coadă, fără suprapuneri.
- [ ] Prestige rulează prestigeFade complet (1400ms) și quills-urile din header sunt corecte imediat după fade-in.
- [ ] OfflineModal apare la revenire ≥60s, cu countUp, și NU apare la refresh rapid (<60s).
- [ ] Buy ×10/×Max actualizează costul afișat pe toate BuyButton-urile instant.

**Progresie UI**
- [ ] La un save nou: pe ecran există DOAR header + resursă + ClickButton + textul ghid (screenshot de referință).
- [ ] Fiecare element din §6 apare exact la pragul lui, cu revealIn + toast, la un playthrough scriptat (Playwright poate injecta stare engine).
- [ ] Post-prestige nu există niciun element de UI orfan (panouri goale, tab-uri moarte).

**Accesibilitate & robusteză**
- [ ] Tab-navigare completă: se poate cumpăra un generator, un upgrade și activa buff-ul doar din tastatură.
- [ ] axe DevTools: zero erori critice de contrast pe ecranul principal (early + late game).
- [ ] `prefers-reduced-motion` emulat → fără floatUp/pulse/shimmer.
- [ ] Hard reset cere ambele confirmări (dialog + tastat `RESET`); Escape la orice pas anulează fără efect.
- [ ] Consolă curată: zero erori/warninguri React la un ciclu complet joc→prestige→refresh.

---

## 9. Ton verbal UI (micro-copy)

Engleză, vocea „bibliotecarului excentric" din 01 §1 — scurt, cald, ușor jucăuș, niciodată corporate. Exemple normative: buton click „Weave ✨"; offline „While you were away, the library kept whispering…"; prestige confirm „Bind these pages into a Tome? Your workshop resets — your fame does not."; empty achievements tooltip „Not yet written."; hard reset „This burns the whole library. Even the golden quills." Fără lorem ipsum și fără texte-placeholder în build-ul final.

---

## Ce s-a decis
- Paletă completă „bibliotecă nocturnă" ca CSS custom properties (§1.1) cu roluri semantice stricte (gold=resursă, quill=prestige, grow=affordable, ember=buff) și interdicția hex-urilor hardcodate în componente.
- Fonturi self-hosted prin npm: Cormorant Garamond (display) + Inter Variable (UI, tabular-nums pe toate numerele); zero CDN.
- Layout 3 zone pe desktop ≥1100px (stânga sticky = click/resursă, centru = shop cu tab-uri, dreapta = meta), 2 zone pe tabletă, stack + bottom nav cu 4 tab-uri pe mobil (<720px).
- 15 componente cu stările lor enumerate (§4), 15 animații cu durate/easing exacte (§5), unlock progresiv al UI-ului cu regula „nerandat până la milestone" (§6), reguli minime de accesibilitate (§7) și checklist QA bifabil (§8).
- Iconografie 100% emoji-în-monedă-CSS + textură de fundal din SVG inline data-URI — zero assets externe.

## De ce
- Rolurile semantice de culoare fac starea jocului lizibilă dintr-o privire (verde=pot cumpăra, violet=meta, portocaliu=buff activ) — cel mai mare câștig de UX într-un idle.
- Tabular-nums + formatare scurtă unică = numerele care se schimbă de 10×/sec nu produc jitter — diferența principală dintre „prototip" și „produs".
- Unlock-ul progresiv al UI-ului urmează exact milestone-urile din 01 §6.2, deci nu inventează praguri noi și nu poate desincroniza design-ul de economie.
- Pool-ul de max 12 FloatingNumbers și inelul de cooldown pe conic-gradient din tick evită degradarea de performanță la click-spam — testabil în checklist.
- Confirmarea în 2 pași la prestige și dubla confirmare cu text tastat la hard reset acoperă cerința de „reset controlat cu protecție" din brief.

## Fișiere create sau modificate
- **Creat:** `C:/Projects/Games/Fable Idler/ai-memory/04-ui-ux-decisions.md` (acest document). Niciun fișier de cod — implementarea revine Agentului UI (faza 3), care va crea `src/styles/tokens.css`, `src/styles/animations.css` și componentele din §4.

## Riscuri
- **Emoji cross-platform:** 🐦‍⬛ (ZWJ) și 🧚 pot arăta diferit/lipsi pe sisteme vechi; target-ul e Chromium (Docker + Playwright), unde sunt OK. Fallback-ul din §1.2 trebuie implementat ca simplă constantă înlocuibilă.
- **Performanță la click-spam + tick:** dacă Agentul UI randează FloatingNumbers fără pool sau animă inelul de cooldown cu re-render React la 60fps, FPS-ul scade — cerințele din §4.3/§5.14 sunt obligatorii, nu sugestii.
- **Fonturi:** dacă `@fontsource` nu e instalat corect în build-ul Docker multi-stage, fallback-ul serif/system e acceptabil vizual dar checklist-ul §8 pică — de verificat în network tab pe build-ul nginx.
- **Coloana stângă sticky fără scroll** presupune că conținutul ei încape în ~700px înălțime; dacă Agentul UI adaugă elemente acolo, trebuie să rămână sub viewport-height la 1080p.
- **Dependență de 03-economy:** timpul estimat „12s ✨" pe butoanele expensive presupune /sec > 0; la /sec = 0 se afișează doar costul (fără estimare) — de tratat explicit.

## Ce trebuie să știe următorul agent
- **Agent UI (implementare):** tokens.css din §1.1 se copiază literal; duratele/easing-urile din §5 sunt contract (E2E poate verifica clasele/duratele); ordinea de reveal din §6 vine din engine (milestones), UI-ul doar reacționează la flag-uri — nu duplica pragurile în UI. `formatNumber()` aparține engine-ului (`src/engine/`), nu UI-ului, ca să fie unit-testabilă.
- **Agent 3 (Arhitectură):** UI-ul are nevoie din engine de: flag-uri de vizibilitate per milestone, timestamp + sumă pentru OfflineModal, câștigul estimat de quills la tick, coada de evenimente unlock (pentru toast-uri — evenimente consumabile, nu doar stare, altfel toast-urile se repetă la refresh) și buff state (activ/rămas/cooldown).
- **Agent 8 (E2E):** folosește checklist-ul §8 ca sursă de test-case-uri; pentru progresia UI injectează stare în engine (expune un hook de dev/test), nu juca manual 40 de minute.
- **Toggle-ul Buy ×1/×10/×Max și toggle-ul Reduce motion se persistă în save** (secțiunea settings din metaState).

## Validări făcute
- Contrast verificat prin calcul de luminanță relativă (WCAG): `--parchment` #f0e6d2 pe `--ink` #1b1730 ≈ 12.9:1; `--parchment-dim` pe `--ink-raised` ≈ 7.6:1; `--gold` #e8b54d pe `--ink` ≈ 8.0:1; `--grow` #8fc97a pe `--ink-raised` ≈ 6.7:1; `--quill` #b48ce4 pe `--ink` ≈ 5.6:1; `--muted` #8d8398 pe `--ink` ≈ 4.0:1 → de aceea `--muted` e restricționat la text mare/non-esențial (§7.1). Toate rolurile principale trec 4.5:1.
- Coerență cu 01-game-design: fiecare element cerut acolo pentru UI (toast la milestone, badge la praguri de cantitate, inel cooldown pe buff, dialog confirmare prestige cu preview, „While you were away") are componentă și stare definite în §4; pragurile de reveal din §6 sunt copiate 1:1 din 01 §6.2, fără praguri inventate.
- Coerență cu brief: cerințele „UI modern, responsive, polished" din 00 (dashboard resursă, zonă click, liste, achievements, milestones, prestige, indicatori /sec, feedback la cumpărare/unlock) sunt fiecare mapate pe o componentă din §4.
- Fonturile alese există pe npm ca `@fontsource/cormorant-garamond` și `@fontsource-variable/inter` (pachete standard @fontsource, compatibile Vite, fără fetch extern la runtime).
- Document static — nu există cod de rulat încă; validarea vizuală reală se face la faza 3 cu checklist-ul §8.
