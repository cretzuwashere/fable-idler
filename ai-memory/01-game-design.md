# 01 — Game Design (Agent 1: Product & Game Design Lead)

> Convenție: documentul e în română; **toate numele de entități din joc sunt în engleză și FINALE** — se folosesc identic în cod, teste și UI. ID-urile de cod sugerate sunt în `camelCase` lângă fiecare entitate.

> **⚠️ Notă de calibrare (adăugată la quality gate, Agent 9):** cifrele de balans din acest document sunt versiunea INIȚIALĂ de design. Valorile FINALE sunt în `03-economy-balance.md` (sursa de adevăr — vezi 03 §6/§10/§13) și în `src/engine/config.ts`. Diferențe principale: **+30% producție per Golden Quill** (nu +2%) și **Quill Resonance costă 2.500** (nu ~10.000).

---

## 1. Fantezia centrală + ton vizual/narativ

Jucătorul este un **Fable Weaver** — un Țesător de Fabule într-un atelier-bibliotecă luminat de lumânări, undeva la marginea lumii poveștilor. Fiecare click smulge o scânteie de **Inspiration** din aer; muzele, corbii vorbitori și penele fermecate pe care le tocmește adună Inspiration și pentru el, iar când tomul e plin, îl **publică** — lumea îi premiază opera cu **Golden Quills**, pene de aur care îi fac pentru totdeauna condeiul mai ager. Tonul vizual: *storybook cald* — pergament, cerneală albastru-închis, accente aurii, lumină de lumânare, ilustrații ușor capricioase (whimsical), niciodată dark/horror. Tonul textelor: ușor jucăuș, ca notele de subsol ale unui bibliotecar excentric.

---

## 2. Core loop și meta loop

**Core loop (secunde → minute):**
1. **Click** pe zona centrală („Weave") → +Inspiration (bază: 1/click).
2. Cumperi **generatori** → producție idle de Inspiration/sec.
3. Cumperi **upgrade-uri** → multiplicatori, sinergii, mecanici noi.
4. Atingi **milestones** → se dezvăluie conținut nou (generatori, tab-uri, buff).
5. Activezi periodic **Moment of Inspiration** (buff activ) → decizie de timing.
6. Repetă la o scară tot mai mare.

**Meta loop (zeci de minute → ore):**
7. La prag, **Publish the Tome** (prestige) → resetezi progresul rundei, primești **Golden Quills** permanente → fiecare rundă nouă e semnificativ mai rapidă → țintești tomuri tot mai valoroase.

**Offline loop:** la revenire, jocul calculează producția din timestamp (eficiență 50% bază, upgradabilă) și o prezintă ca „While you were away…" — recompensă vizibilă, nu silențioasă.

---

## 3. Resursa principală și moneda de prestige

| Rol | Nume (final) | ID cod | Simbol UI | Note |
|---|---|---|---|---|
| Resursa principală | **Inspiration** | `inspiration` | ✨ (icon SVG „scânteie de cerneală") | Se câștigă din click + generatori; se cheltuie pe generatori/upgrade-uri. Se urmăresc separat: `current` (sold) și `totalEarned` (cumulat pe rundă — baza pentru milestones și prestige). |
| Moneda de prestige | **Golden Quills** | `goldenQuills` | 🪶 (icon SVG „pană aurie") | Permanentă. Fiecare Golden Quill = **+2% producție globală** (multiplicativ cu restul). Nu se cheltuie în v1 — e un multiplicator pasiv (simplu de echilibrat și de înțeles). |

---

## 4. Generatori automați (7) — ordinea de unlock = ordinea din tabel

Cifrele sunt **ordine de mărime** (progresie tip Cookie Clicker: cost ~×9–11 între tier-uri, producție ~×7–8; growth per unitate ~1.15). Agentul de economie (03) calibrează valorile finale, dar păstrează raporturile și ordinea.

| # | Nume (final) | ID cod | Fantezie (flavor) | Cost bază | Prod. bază /sec |
|---|---|---|---|---|---|
| 1 | **Wandering Muse** | `wanderingMuse` | O muză rătăcitoare îți șoptește idei când trece pe lângă fereastră. | 15 | 0.1 |
| 2 | **Ink Sprite** | `inkSprite` | Un spiriduș de cerneală care mâzgălește singur marginile paginilor. | 100 | 1 |
| 3 | **Talking Raven** | `talkingRaven` | Un corb vorbitor care adună bârfe și legende din șapte ținuturi. | 1.100 | 8 |
| 4 | **Enchanted Quill** | `enchantedQuill` | O pană fermecată care scrie singură, fără să obosească vreodată. | 12.000 | 47 |
| 5 | **Story Loom** | `storyLoom` | Un război de țesut care împletește fire narative în tapiserii de poveste. | 130.000 | 260 |
| 6 | **Dream Library** | `dreamLibrary` | O bibliotecă ce colecționează visele cititorilor adormiți. | 1.400.000 | 1.400 |
| 7 | **Fable Forge** | `fableForge` | O forjă mitică unde arhetipurile sunt topite și turnate în fabule noi. | 20.000.000 | 7.800 |

**Regula de dezvăluire:** generatorul N+1 devine vizibil în shop când `totalEarned` atinge ~50–60% din costul lui de bază (vezi milestones §6.2) — jucătorul vede mereu „următorul obiect de dorit", fără să vadă tot arborele de la început. Brief-ul cere ≥5 generatori; livrăm 7 pentru un arc de progresie mai lung.

---

## 5. Upgrade-uri (10) — fiecare cu mecanică DISTINCTĂ

Costurile finale le dă agentul de economie; aici dau condiția de unlock (gameplay) și ordinea de mărime a costului. Toate sunt one-time purchases.

| # | Nume (final) | ID cod | Mecanică (tip distinct) | Efect | Unlock | Cost orientativ |
|---|---|---|---|---|---|---|
| 1 | **Sharpened Nib** | `sharpenedNib` | Multiplicator pe click | Click power ×2 | 50 total Inspiration | ~100 |
| 2 | **Muse's Chorus** | `musesChorus` | Multiplicator pe generator specific | Wandering Muse ×2 | Deții 10 Wandering Muse | ~500 |
| 3 | **Golden Inkwell** | `goldenInkwell` | Multiplicator global | Toată producția ×1.5 | 10.000 total Inspiration | ~15.000 |
| 4 | **Raven's Gossip** | `ravensGossip` | Sinergie generator→generator | Fiecare Talking Raven dă +5% producție la Ink Sprite | Deții 5 Ravens și 10 Sprites | ~25.000 |
| 5 | **Weaver's Rhythm** | `weaversRhythm` | Sinergie (a doua, tier înalt) | Fiecare Story Loom dă +10% producție la Enchanted Quill | Deții 5 Looms și 10 Quills | ~1.000.000 |
| 6 | **Lucid Dreaming** | `lucidDreaming` | Offline progress | Eficiența offline 50% → **75%** | Revii dintr-o sesiune offline ≥ 30 min | ~50.000 |
| 7 | **Burst of Genius** | `burstOfGenius` | Durata buff-ului activ | Moment of Inspiration durează +50% (15s → 22.5s) | Ai activat buff-ul de 5 ori | ~75.000 |
| 8 | **Ink Echo** | `inkEcho` | Hibrid click↔idle | Fiecare click adaugă și **+1% din producția/sec** curentă | Deții 25 generatori (total, orice tip) | ~200.000 |
| 9 | **Patron's Favor** | `patronsFavor` | Reducere de cost | Toți generatorii costă −5% | 1.000.000 total Inspiration | ~2.000.000 |
| 10 | **Bound Anthology** | `boundAnthology` | Scalare pe achievements | Bonusul fiecărui achievement se dublează (+1% → +2% global) | 10 achievements deblocate | ~5.000.000 |

Bonus post-prestige (al 11-lea, opțional dar recomandat — leagă meta loop-ul de click):
| 11 | **Quill Resonance** | `quillResonance` | Interacțiune prestige→click | Bonusul Golden Quills se aplică și pe click power | Ai publicat ≥1 Tome | ~10.000 (după reset e „early buy") |

Brief-ul cere ≥5 upgrade-uri; livrăm 10–11, minim 8 tipuri de mecanică diferite (click mult, generator mult, global mult, sinergie ×2, offline, buff duration, click-din-producție, cost reduction, achievement scaling, prestige→click).

---

## 6. Achievements și Milestones

### 6.1 Achievements (14) — fiecare dă **+1% producție globală** permanent (aditiv între ele, multiplicativ cu restul; se păstrează la prestige)

| # | Nume (final) | ID cod | Condiție |
|---|---|---|---|
| 1 | **First Words** | `firstWords` | Primul click |
| 2 | **The Storyteller Awakens** | `storytellerAwakens` | Cumperi primul generator |
| 3 | **Busy Fingers** | `busyFingers` | 1.000 click-uri totale |
| 4 | **Whispered Legends** | `whisperedLegends` | 1.000 total Inspiration câștigată |
| 5 | **A Thousand Tales** | `aThousandTales` | 100.000 total Inspiration câștigată |
| 6 | **Hoarder of Ideas** | `hoarderOfIdeas` | Deții 1.000.000 Inspiration simultan (sold curent) |
| 7 | **Muse Menagerie** | `museMenagerie` | Deții 25 Wandering Muse |
| 8 | **Full Aviary** | `fullAviary` | Deții 25 Talking Raven |
| 9 | **Well-Rounded Library** | `wellRoundedLibrary` | Deții ≥1 din fiecare generator (toate 7) |
| 10 | **Industrial Fiction** | `industrialFiction` | Atingi 1.000 Inspiration/sec |
| 11 | **Night Shift** | `nightShift` | Colectezi ≥1.000 Inspiration din offline progress dintr-o singură revenire |
| 12 | **Moment Seizer** | `momentSeizer` | Activezi Moment of Inspiration de 10 ori |
| 13 | **Published Author** | `publishedAuthor` | Primul Publish the Tome |
| 14 | **Serial Novelist** | `serialNovelist` | 3 Publish the Tome |

### 6.2 Milestones / unlock-uri (14) — praguri care dezvăluie conținut VIZIBIL (cu toast/animație la unlock)

| # | Nume (final) | ID cod | Prag | Ce deblochează vizibil |
|---|---|---|---|---|
| 1 | **The First Spark** | `theFirstSpark` | 10 total Inspiration | Panoul de generatori + Wandering Muse în shop |
| 2 | **Whispers in Ink** | `whispersInInk` | 60 total Inspiration | Ink Sprite apare în shop |
| 3 | **Craftsman's Tools** | `craftsmansTools` | 100 total Inspiration | Tab-ul **Upgrades** |
| 4 | **Racing Heart** | `racingHeart` | 500 total Inspiration | Butonul **Moment of Inspiration** (buff activ) |
| 5 | **A Feathered Friend** | `aFeatheredFriend` | 600 total Inspiration | Talking Raven apare în shop |
| 6 | **Hall of Deeds** | `hallOfDeeds` | Primul achievement | Tab-ul **Achievements** devine vizibil |
| 7 | **The Quill Stirs** | `theQuillStirs` | 6.000 total Inspiration | Enchanted Quill apare în shop |
| 8 | **The Publisher's Letter** | `thePublishersLetter` | 50.000 total Inspiration | Panoul **Prestige** (preview Golden Quills, încă neactivabil) |
| 9 | **Threads of Narrative** | `threadsOfNarrative` | 65.000 total Inspiration | Story Loom apare în shop |
| 10 | **Doors of the Library** | `doorsOfTheLibrary` | 700.000 total Inspiration | Dream Library apare în shop |
| 11 | **Heat of Creation** | `heatOfCreation` | 10.000.000 total Inspiration | Fable Forge apare în shop |
| 12 | **Choir of Muses** | `choirOfMuses` | 25 × Wandering Muse | Wandering Muse producție **×2** + badge vizual pe card |
| 13 | **Sprite Swarm** | `spriteSwarm` | 25 × Ink Sprite | Ink Sprite producție **×2** + badge |
| 14 | **Regulă generală de cantitate** | `qtyMilestone:<gen>:<n>` | **25 / 50 / 100** unități din ORICE generator | Producția acelui generator **×2 la fiecare prag** + badge (#12–13 sunt instanțele numite pentru primii doi; regula se aplică tuturor celor 7 → în practică 21+ milestones de cantitate) |

Milestones #1–11 sunt pe `totalEarned` pe rundă (se re-parcurg după prestige — intenționat: dau ritm rundei noi, care oricum le traversează în minute). Achievements sunt permanente.

---

## 7. Prestige: **Publish the Tome**

- **Acțiune (nume final):** `publishTheTome` — buton „Publish the Tome" în panoul Prestige, cu confirmare explicită (dialog cu preview: „Vei primi X Golden Quills").
- **Condiție minimă:** `totalEarned` pe runda curentă ≥ **100.000 Inspiration** (sub prag butonul e vizibil dar disabled, cu progres afișat — „The Publisher's Letter" de la 50.000 îl dezvăluie devreme ca teaser).
- **Formula conceptuală:** `goldenQuillsEarned = floor( sqrt( totalEarnedThisRun / 100.000 ) )` → 100k = 1 quill, 400k = 2, 900k = 3, 10M = 10. Sub-liniară, ca să încurajeze rundele mai lungi dar să nu pedepsească publicarea timpurie. Agentul de economie poate ajusta exponentul/divizorul, păstrând proprietatea „primul quill la ~100k".
- **Efect permanent:** fiecare Golden Quill = **+2% producție globală** (cu Quill Resonance: și pe click).
- **Se resetează:** Inspiration (current + totalEarned al rundei), toți generatorii, upgrade-urile 1–10, milestones #1–11 și pragurile de cantitate, buff cooldown.
- **Persistă:** Golden Quills, numărul de tomuri publicate (`tomesPublished`), achievements + bonusurile lor, upgrade-ul Quill Resonance (o dată cumpărat), statistici lifetime (click-uri totale, Inspiration all-time), setările.
- **De ce merită:** la primul prestige tipic (~300–600k earned → 2 quills + Quill Resonance disponibil + ~8–10 achievements a câte +1%) runda a doua pornește cu ~15–25% producție bonus și cunoștințele jucătorului → primele 10 minute ale rundei 2 comprimă ~25 de minute din runda 1. Fiecare tom următor scurtează vizibil drumul înapoi.

---

## 8. Acțiunea activă secundară: **Moment of Inspiration**

- **ID cod:** `momentOfInspiration` (buton dedicat lângă zona de click, deblocat de milestone-ul „Racing Heart").
- **Efect (bază):** timp de **15 secunde**, click power **×5** și producția globală **×2**.
- **Cooldown (bază):** **90 secunde** (afișat ca inel de progres pe buton).
- **Upgrade asociat:** Burst of Genius (+50% durată). Economia poate adăuga ulterior upgrade de cooldown, dar nu e obligatoriu în v1.
- **De ce există:** creează o decizie activă de *timing* (îl activezi înainte de o sesiune de click-uri sau când vrei să atingi pragul unui generator scump), nu doar click brut. Sinergizează cu Ink Echo (click-ul fură din producție, iar producția e dublată în buff).

---

## 9. Progresia pe termen scurt / mediu / lung

**Scurt (primele 10 minute):**
- 0:00–0:30 — click-uri manuale → prima Wandering Muse (<30s). Achievements „First Words", „The Storyteller Awakens".
- 0:30–3:00 — 3–5 Muses, primul Ink Sprite, upgrade Sharpened Nib, tab Upgrades deblocat, buff-ul apare (~500 total).
- 3:00–10:00 — Talking Raven, primele sinergii vizibile în /sec, 2–3 achievements, primele milestones de cantitate la orizont. Ritm: un unlock vizibil la fiecare 60–90s.

**Mediu (prima oră, primul prestige):**
- min 10–25 — Enchanted Quill, Golden Inkwell, Raven's Gossip; producția trece de click ca sursă dominantă; jucătorul folosește buff-ul strategic.
- min 20–40 — `totalEarned` trece de 100k → **primul Publish the Tome realizabil**; decizia „public acum la 1 quill sau împing spre 400k pentru 2?".
- min 40–60 — runda 2 cu quills + Quill Resonance: progres vizibil mai rapid, Story Loom atins mult mai devreme.

**Lung (3+ prestige-uri):**
- Tomuri succesive → zeci de Golden Quills → rundele ating Dream Library și Fable Forge; achievements de late-game (Serial Novelist, Industrial Fiction, Hoarder of Ideas) devin ținte.
- Offline progress + Lucid Dreaming fac check-in-urile scurte satisfăcătoare (revii, colectezi, cumperi 2 tier-uri, repornești buff-ul).
- Endgame v1: toate cele 14 achievements + Fable Forge la 25 (milestone ×2) — orizont de câteva zile de joc lejer.

---

## 10. Criterii de succes măsurabile (de verificat în E2E/manual)

1. Primul generator cumpărabil în **<30 secunde** de click (cost 15, click bază 1 → max 15 click-uri).
2. Primul upgrade (Sharpened Nib) accesibil în **<2 minute**.
3. Buff-ul activ deblocat în **<5 minute** de joc normal.
4. Un unlock/milestone vizibil cel puțin la fiecare **~2 minute** în primele 20 de minute.
5. Primul prestige realizabil în **20–40 minute de joc activ** (cu buff folosit rezonabil).
6. După primul prestige, timpul până la 100k `totalEarned` scade cu **≥30%** față de runda 1.
7. 8 ore offline (bază 50%) produc o sumă care permite **≥2 achiziții semnificative** la revenire (nu doar mărunțiș).
8. Niciun „dead time" >3 minute în prima oră în care jucătorul să nu aibă nimic accesibil de cumpărat sau vreun prag vizibil aproape.

---

## Ce s-a decis
- Tema completă „Fable Weaver": resursă **Inspiration** (✨), monedă de prestige **Golden Quills** (🪶), prestige **Publish the Tome**, buff activ **Moment of Inspiration**.
- 7 generatori (Wandering Muse → Fable Forge) cu costuri/producții orientative și regulă de dezvăluire progresivă.
- 10+1 upgrade-uri cu mecanici distincte (nu doar +X%): click, per-generator, global, 2 sinergii, offline, durată buff, click-din-producție, cost reduction, scalare pe achievements, prestige→click.
- 14 achievements (+1% global fiecare, permanente) și 14 milestones (11 pe totalEarned + regula de cantitate 25/50/100 → ×2).
- Formula conceptuală de prestige `floor(sqrt(totalEarned/1e5))`, +2%/quill, listă explicită reset vs. persistă.

## De ce
- O singură resursă + o monedă meta = economie testabilă unit și ușor de înțeles; complexitatea vine din mecanici de upgrade, nu din resurse multiple.
- Milestones pe `totalEarned` (nu pe sold) ca să nu penalizeze cheltuitul — pattern standard idle care evită „hoarding paralysis".
- Achievements permanente cu bonus mic = prestige-ul nu șterge tot sentimentul de progres.
- Formula sub-liniară de quills creează decizia clasică „publish now vs. push further" fără să blocheze jucătorii lenți.
- 7 generatori (peste minimul de 5) pentru ca 3+ prestige-uri să aibă conținut nou de atins.

## Fișiere create sau modificate
- **Creat:** `C:/Projects/Games/Fable Idler/ai-memory/01-game-design.md` (acest document).

## Riscuri
- **Calibrare:** cifrele de cost/producție sunt orientative; dacă agentul de economie schimbă raporturile fără să păstreze pragurile milestones (§6.2) și pragul de prestige (100k), criteriile de succes §10 pică. Pragurile și formulele trebuie ajustate ÎMPREUNĂ.
- **Ink Echo + buff** poate produce spike-uri de click OP dacă economia nu plafonează (recomand: procentul Ink Echo se calculează pe producția fără buff, sau se acceptă ca „moment de glorie" — de decis în 03).
- **Regula de cantitate 25/50/100 ×2** e putere multă cumulat — economia trebuie s-o includă explicit în curbele de progresie.
- **Re-parcurgerea milestones după prestige** cere ca engine-ul să separe clar starea de rundă de starea permanentă (vezi mai jos).

## Ce trebuie să știe următorul agent
- **Agent 2 (Economy):** calibrează pe structura din §4–§7 fără să redenumească nimic; growth per unitate ~1.15; păstrează „primul generator <30s" și „primul prestige 20–40 min" ca invariante; decide plafonul offline (propun 8h bază / 12h cu Lucid Dreaming) și tratamentul Ink Echo sub buff.
- **Agent 3 (Arhitectură):** starea trebuie împărțită în `runState` (resetabil la prestige: inspiration, generatori, upgrade-uri 1–10, milestones) și `metaState` (goldenQuills, tomesPublished, achievements, quillResonance, statistici lifetime, settings). `totalEarned` pe rundă e o valoare distinctă de soldul curent — milestones și prestige se calculează pe ea.
- **Agent 4 (UI/UX):** ton storybook cald (§1); toast/animație la fiecare milestone; badge-uri pe carduri la pragurile de cantitate; buton buff cu inel de cooldown; dialog de confirmare la prestige cu preview de quills; secțiune „While you were away" la revenire.
- ID-urile de cod din tabele sunt contractul comun — folosiți-le literal.

## Validări făcute
- Verificat coerența pragurilor: fiecare milestone de dezvăluire (§6.2) e la ~50–60% din costul de bază al generatorului corespunzător (60/100, 600/1.100, 6k/12k, 65k/130k, 700k/1.4M, 10M/20M) → jucătorul vede următorul generator înainte să și-l permită, niciodată mult prea devreme.
- Verificat matematic „primul generator <30s": cost 15, 1/click → 15 click-uri.
- Verificat că cerințele minime din brief sunt depășite: 7 generatori (≥5), 10–11 upgrade-uri (≥5), 14 achievements (≥10), 14+ milestones (≥10), 1 prestige cu impact real, offline progress inclus.
- Verificat unicitatea tuturor ID-urilor de cod (fără coliziuni între generatori/upgrade-uri/achievements/milestones).
- Document static — nu există încă cod de rulat; validarea numerică a economiei e sarcina Agentului 2.
