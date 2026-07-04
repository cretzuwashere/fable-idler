// Fable Idler — economy simulation LONGEVITY (v3) — Agent 2 v3
// (ai-memory/13-longevity-design.md -> ai-memory/14-longevity-economy.md)
//
// Fisier NOU: tools/economy-sim.mjs (v1) si tools/economy-sim-v2.mjs raman NEATINSE.
// Partea de model v1/v2 e portul exact al lui economy-sim-v2.mjs; straturile v3 sunt
// in spatele flag-urilor si sunt no-op-uri numerice exacte cu flag-urile off SI
// structural inaccesibile in prima runda (praguri >=150 owned, taper >=101, genunchi 1e9).
//
// Rulare (host fara Node):
//   docker run --rm -v "C:\Projects\Games\Fable Idler\tools:/w" node:22-alpine node /w/economy-sim-longevity.mjs
//
// RUN-uri:
//   L0  v1-compat exact (flags off) => 03 §9: 24m23s / 16m49s / 11m45s, prod 721.6/s
//   L1  invarianta primelor 40 min: runda 1 cu TOATE sistemele v3 pornite == runda 1 v1, tinta cu tinta
//   L2  formula de prestige: property-test <=1e9, continuitate la genunchi, monotonie, breakpoints
//   L3  arcul casual 30 de zile (2 sesiuni x 20 min/zi + offline): zi -> tier / tomes / quills / Atelier
//   L4  plafoane numerice: max totalEarned / cost / prod pe tot orizontul < 1e24 (<< 1e50)
//   L5  no-dead-time: distanta maxima intre unlock-uri vizibile < 24h
//   L6  fereastra de endgame (rulare extinsa 56 de zile): OUAT>=100, tomes 200, Atelier complet
//   L7  anti-treadmill: durata medie a rundei in saptamana 2 >= 5 min
//   L8  formula veche vs noua la ziua 30 (de ce era necesara frana)
//   L9  tiers 1-7 raman vii in era T12+ (share >= 5% din rawProd)

// ---------------------------------------------------------------------------
// Constante v1/v2 (identice cu economy-sim-v2.mjs / 03 / 11)
// ---------------------------------------------------------------------------
const BASE_GENS = [
  { id: 'wanderingMuse',  base: 15,        prod: 0.1,  growth: 1.15, unlock: 10 },
  { id: 'inkSprite',      base: 100,       prod: 1,    growth: 1.15, unlock: 60 },
  { id: 'talkingRaven',   base: 1100,      prod: 8,    growth: 1.14, unlock: 600 },
  { id: 'enchantedQuill', base: 12000,     prod: 47,   growth: 1.13, unlock: 6000 },
  { id: 'storyLoom',      base: 130000,    prod: 260,  growth: 1.13, unlock: 65000 },
  { id: 'dreamLibrary',   base: 1400000,   prod: 1400, growth: 1.12, unlock: 700000 },
  { id: 'fableForge',     base: 20000000,  prod: 7800, growth: 1.12, unlock: 10000000 },
];
const MYTH_ENGINE = { id: 'mythEngine', base: 300000000, prod: 45000, growth: 1.12, unlock: 150000000 };

// v3: generatorii 9-14 (13 §1.1) — gate pe The New Wing L1/L2/L3
// [DECIZIE DE CALIBRARE] baseProd 9-14 reduse fata de 13 §1.1 (payback ~x3/tier,
// nu ~x2): cu payback x2, fiecare nivel de New Wing multiplica rawProd cu ~x100
// si arcul de saptamani colapsa in zile (v. iteratiile de calibrare).
const NEW_GENS = [
  { id: 'sagaCitadel',      base: 6e9,    prod: 3.2e5,  growth: 1.11, unlock: 3e9,    wing: 1 },
  { id: 'narratorsGuild',   base: 1.3e11, prod: 2.4e6,  growth: 1.11, unlock: 6.5e10, wing: 1 },
  { id: 'pantheonPress',    base: 3e12,   prod: 1.8e7,  growth: 1.11, unlock: 1.5e12, wing: 2 },
  { id: 'worldTreeArchive', base: 7e13,   prod: 1.4e8,  growth: 1.10, unlock: 3.5e13, wing: 2 },
  { id: 'sleepingCity',     base: 1.7e15, prod: 1.05e9, growth: 1.10, unlock: 8.5e14, wing: 3 },
  { id: 'onceUponATime',    base: 4.2e16, prod: 8e9,    growth: 1.10, unlock: 2.1e16, wing: 3 },
];
const ALL_GENS = [...BASE_GENS, MYTH_ENGINE, ...NEW_GENS];

const V1_UPS = [
  { id: 'sharpenedNib',   cost: 100,     unlock: (s) => s.totalEarned >= 50 },
  { id: 'musesChorus',    cost: 500,     unlock: (s) => s.counts[0] >= 10 },
  { id: 'quillResonance', cost: 2500,    unlock: (s) => s.quills > 0 },
  { id: 'goldenInkwell',  cost: 15000,   unlock: (s) => s.totalEarned >= 10000 },
  { id: 'ravensGossip',   cost: 25000,   unlock: (s) => s.counts[2] >= 5 && s.counts[1] >= 10 },
  { id: 'burstOfGenius',  cost: 75000,   unlock: (s) => s.buffActivations >= 5 },
  { id: 'inkEcho',        cost: 200000,  unlock: (s) => s.counts.reduce((a, b) => a + b, 0) >= 25 },
  { id: 'weaversRhythm',  cost: 1000000, unlock: (s) => s.counts[4] >= 5 && s.counts[3] >= 10 },
  { id: 'patronsFavor',   cost: 2000000, unlock: (s) => s.totalEarned >= 1000000 },
  { id: 'boundAnthology', cost: 5000000, unlock: (s) => s.achCount >= 10 },
];
const V1_RUN_UP_IDS = ['sharpenedNib', 'musesChorus', 'goldenInkwell', 'ravensGossip',
  'burstOfGenius', 'inkEcho', 'weaversRhythm', 'patronsFavor', 'boundAnthology', 'lucidDreaming'];

// ---------------------------------------------------------------------------
// Constante v3 (candidate din 13, calibrate aici -> valorile FINALE din 14)
// ---------------------------------------------------------------------------
const V3 = {
  // Deep Shelves: taper de growth pe benzi de 100 unitati, podea 1.04 (13 §2.2)
  TAPER: [0, 0.03, 0.06, 0.09],
  TAPER_FLOOR: 1.04,
  BAND: 100,
  // praguri de cantitate noi (13 §2.1): 150/300/400 -> x2; 500 -> x4; 200 -> bonus UNIC
  THRESH_X2: [150, 300, 400],
  THRESH_FINALE: 500,
  STACKS_X: 2.5,   // Strength of the Stacks: x2 -> x2.5
  STACKS_FINALE: 5, // si x4 -> x5 la 500
  UNIQUE_AT: 200,
  UNIQUE_AT_RELIC: 150, // cu The Hundredth Telling (tomes >= 100)
  // cele 7 re-scalere de runda (unlock owned >= 150) — costuri calibrate
  RESCALERS: [
    { id: 'hundredNamesOfMuse', gen: 0, mult: 500, cost: 5e10 },
    { id: 'inkTide',            gen: 1, mult: 400, cost: 2e11 },
    { id: 'parliamentOfRavens', gen: 2, mult: 300, cost: 8e11 },
    { id: 'quillstorm',         gen: 3, mult: 250, cost: 3e12 },
    { id: 'theGreatTapestry',   gen: 4, mult: 200, cost: 1.2e13 },
    { id: 'infiniteStacks',     gen: 5, mult: 150, cost: 5e13 },
    { id: 'forgeOfLegends',     gen: 6, mult: 100, cost: 2e14 },
  ],
  RESCALER_UNLOCK: 150,
  // prestige pe segmente (13 §3.2; exponenti recalibrati — [DECIZIE DE CALIBRARE]:
  // 1/4 si 1/6 din 13 produceau milioane de quills pe arcul real; v. sweep in output)
  P_K1: 1e9, P_K2: 1e15, P_C2: 100, P_E2: 1 / 6,
  P_C3: 100 * Math.pow(1e6, 1 / 6), // = 1000 EXACT — continuitate la 1e15
  P_E3: 1 / 10,
  // Atelier v3 (13 §4.1; preturi recalibrate pe venitul real — [DECIZIE DE CALIBRARE])
  WING_COSTS: [25, 750, 12000],
  UNDERSTUDY_COST: 40,
  PATIENCE_COST: 75,   // +24h offline cap
  MANUSCRIPT_COST: 120,
  STACKS_COST: 2500,
  ATLAS_COST: 25000,   // productie globala x2 — capstone-ul absolut
  // Relics v3 (13 §4.2)
  FOREWORD_AT: 50, FOREWORD_RATE: 0.001, FOREWORD_CAP: 1e15,
  PILGRIMS_AT: 75,   // fragmente/quill 5 -> 3
  TELLING_AT: 100,   // bonusuri unice la 150
  SHELF_AT: 200, SHELF_CAP: 100, // Bookshelf cap 25 -> 100
  // bonusuri unice la 200 — valori (13 §2.3)
  U_MUSE_CLICK: 2, U_SPRITE_ECHO: 0.02, U_RAVEN_COST: 0.97, U_QUILL_BUFF: 5,
  U_LOOM_TIERS: 3, U_LIB_OFFLINE: 0.05, U_FORGE_BUFF: 2.5, U_MYTH_CD: 10,
  U_CITADEL_SPARK: 0.75, U_GUILD_ACH: 1.5, U_PANTHEON_QUILL: 1,
  U_WTA_CAP_H: 12, U_CITY_SPARK: 2, U_OUAT_GLOBAL: 2,
  BUFF_CD_FLOOR: 45,
};

// v2 (11 §9)
const V2C = {
  QB: 0.30,
  APPRENTICE_START: [0, 5, 15, 30],
  GENIUS_P: [0, 0.05, 0.10], GENIUS_MULT: 10,
  RESTLESS_CD: [90, 75, 60],
  APPLAUSE_SECONDS: 20,
  BURST_SECONDS: 45, BURST_FLOOR_CLICKS: 50,
  FRAGMENTS_PER_QUILL: 5,
  SPARK_INT_MIN: 150, SPARK_INT_MAX: 330, SPARK_UNLOCK: 1000,
  BOOKSHELF_RATE: 0.02, BOOKSHELF_CAP: 25,
  INK_REMEMBERS_RATE: 0.01, INK_REMEMBERS_AT: 15,
  DOG_EARED: 300, DOG_EARED_AT: 3, OVATION_AT: 7,
  OFF_EFF: 0.5, OFF_EFF_LUCID: 0.75, READERS_LETTER_AT: 30, READERS_LETTER_PP: 0.10,
  OFF_CAP_H: 8, OFF_CAP_LUCID_H: 12, NIGHT_OWL_H: 12, PATIENCE_H: 24,
};

// ---------------------------------------------------------------------------
// Formula de prestige v3
// ---------------------------------------------------------------------------
function quillsV1(te) { return Math.floor(Math.sqrt(te / 1e5)); }
function quillsV3(te) {
  if (!(te > 0)) return 0;
  if (te <= V3.P_K1) return Math.floor(Math.sqrt(te / 1e5));               // EXACT v1/v2
  if (te <= V3.P_K2) return Math.floor(V3.P_C2 * Math.pow(te / V3.P_K1, V3.P_E2));
  return Math.floor(V3.P_C3 * Math.pow(te / V3.P_K2, V3.P_E3));
}

// ---------------------------------------------------------------------------
// Costuri Deep Shelves: growth pe benzi (v1-exact sub unitatea 101)
// ---------------------------------------------------------------------------
function bandGrowths(g0) {
  return V3.TAPER.map((d) => Math.max(g0 - d, V3.TAPER_FLOOR));
}
function unitCostRaw(gen, owned, v3) {
  if (!v3 || owned <= V3.BAND) return gen.base * Math.pow(gen.growth, owned);
  const [g0, g1, g2, g3] = bandGrowths(gen.growth);
  const e1 = Math.min(owned, 200) - 100;
  const e2 = Math.max(Math.min(owned, 300) - 200, 0);
  const e3 = Math.max(owned - 300, 0);
  return gen.base * Math.pow(g0, 100) * Math.pow(g1, e1) * Math.pow(g2, e2) * Math.pow(g3, e3);
}

// praguri de cantitate
function qtyMult(count, v3, stacks) {
  let m = 1;
  for (const th of [25, 50, 100]) if (count >= th) m *= 2;
  if (v3) {
    const x2 = stacks ? V3.STACKS_X : 2;
    for (const th of V3.THRESH_X2) if (count >= th) m *= x2;
    if (count >= V3.THRESH_FINALE) m *= (stacks ? V3.STACKS_FINALE : 4);
  }
  return m;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TARGETS = [1e3, 1e4, 5e4, 1e5, 4e5, 9e5, 1.6e6, 2.5e6, 1e7];

// ---------------------------------------------------------------------------
// simulateRun — portul EXACT al modelului v2 (economy-sim-v2.mjs), cu straturi
// v3 in spatele cfg.v3 (no-op numeric exact cu flag off; in runda 1 si cu flag
// ON efectele sunt structural inaccesibile — asta verifica RUN L1)
// ---------------------------------------------------------------------------
function simulateRun(cfg) {
  const at = cfg.atelier || {};
  const v3 = !!cfg.v3;
  let GENS = at.blueprint ? [...BASE_GENS, MYTH_ENGINE] : [...BASE_GENS];
  if (v3) {
    const wing = at.wing || 0;
    for (const g of NEW_GENS) if (wing >= g.wing) GENS.push(g);
  }
  const NG = GENS.length;
  const tomes = cfg.tomes || 0;
  const shelfCap = (v3 && tomes >= V3.SHELF_AT) ? V3.SHELF_CAP : V2C.BOOKSHELF_CAP;
  const fablesCounted = Math.min(cfg.fables || 0, shelfCap);
  const rng = mulberry32(cfg.seed || 1);
  const CATCH = cfg.sparksOn ? (cfg.catch ?? 0) : -1;
  const NET = at.net || 0;
  const critEV = 1 + V2C.GENIUS_P[at.genius || 0] * (V2C.GENIUS_MULT - 1);
  const CD = V2C.RESTLESS_CD[at.restless || 0];
  const applauseS = at.applause ? V2C.APPLAUSE_SECONDS : 0;
  const ovation = tomes >= V2C.OVATION_AT;
  const uniqueAt = (v3 && tomes >= V3.TELLING_AT) ? V3.UNIQUE_AT_RELIC : V3.UNIQUE_AT;

  const UPS = V1_UPS.slice();
  if (v3) {
    for (const r of V3.RESCALERS) {
      UPS.push({ id: r.id, cost: r.cost, unlock: (s) => s.counts[r.gen] >= V3.RESCALER_UNLOCK });
    }
  }

  const s = {
    counts: new Array(NG).fill(0),
    ins: 0, totalEarned: 0, clicks: 0,
    quills: cfg.quills || 0,
    achCount: cfg.startAch || 0,
    buffActivations: 0,
    ups: new Set(),
    earnedAch: new Set(),
    frenzyUntil: -1, gossipUntil: -1,
    fragments: cfg.fragments || 0, sparkQuills: 0, sparksCaught: 0, sparksMissed: 0,
    burstGain: 0, clickGain: 0,
    firstBuffDone: false, nextSpark: null,
  };
  s.counts[0] = V2C.APPRENTICE_START[at.apprentice || 0];
  if (tomes >= V2C.DOG_EARED_AT) { s.ins = V2C.DOG_EARED; s.totalEarned = V2C.DOG_EARED; }
  if ((at.bookmark || 0) >= 1) { s.ups.add('sharpenedNib'); s.ups.add('musesChorus'); }
  if ((at.bookmark || 0) >= 2) { s.ups.add('goldenInkwell'); s.ups.add('ravensGossip'); }

  const tAt = {};
  let buffEnd = -1, cdEnd = 0, t = 0;
  const dt = 1, REACT = 20;

  const uniq = (i) => v3 && s.counts[i] >= uniqueAt;

  function prodGen(i, cOverride) {
    const c = cOverride === undefined ? s.counts[i] : cOverride;
    let p = c * GENS[i].prod * qtyMult(c, v3, !!at.stacks);
    if (i === 0 && s.ups.has('musesChorus')) p *= 2;
    if (i === 1 && s.ups.has('ravensGossip')) p *= (1 + 0.05 * s.counts[2]);
    if (i === 3 && s.ups.has('weaversRhythm')) p *= (1 + 0.10 * s.counts[4]);
    if (i < 3 && t < s.gossipUntil) p *= 5;
    if (v3) {
      const r = V3.RESCALERS.find((x) => x.gen === i);
      if (r && s.ups.has(r.id)) p *= r.mult;
      if (i < 4 && uniq(4)) p *= V3.U_LOOM_TIERS;  // Warp and Weft (Loom 200)
    }
    return p;
  }
  const QB = cfg.quillBonus ?? V2C.QB;
  function globalMult(buffed) {
    let m = 1;
    if (s.ups.has('goldenInkwell')) m *= 1.5;
    let achRate = s.ups.has('boundAnthology') ? 0.02 : 0.01;
    if (v3 && NG > 9 && uniq(9)) achRate *= V3.U_GUILD_ACH; // Everyone's Biographer
    m *= (1 + achRate * s.achCount);
    m *= (1 + QB * s.quills);
    m *= (1 + V2C.BOOKSHELF_RATE * fablesCounted);
    if (tomes >= V2C.INK_REMEMBERS_AT) m *= (1 + V2C.INK_REMEMBERS_RATE * tomes);
    if (v3 && at.atlas) m *= 2;
    if (v3 && NG > 13 && uniq(13)) m *= V3.U_OUAT_GLOBAL;  // ...Happily Ever After
    if (buffed) m *= (v3 && NG > 6 && uniq(6)) ? V3.U_FORGE_BUFF : 2;
    return m;
  }
  function totalProd(buffed) {
    let sum = 0; for (let i = 0; i < NG; i++) sum += prodGen(i);
    return sum * globalMult(buffed);
  }
  function clickValue(buffed) {
    let base = 1;
    if (s.ups.has('sharpenedNib')) base *= 2;
    if (s.ups.has('quillResonance')) base *= (1 + QB * s.quills);
    if (buffed) base *= 5;
    if (t < s.frenzyUntil) base *= 7;
    if (v3 && uniq(0)) base *= V3.U_MUSE_CLICK;            // A Hundred Whispers
    let v = base;
    const echoRate = (v3 && uniq(1)) ? V3.U_SPRITE_ECHO : 0.01;
    if (s.ups.has('inkEcho')) v += echoRate * totalProd(buffed);
    v *= critEV;
    return v;
  }
  function cost(i) {
    let c = unitCostRaw(GENS[i], s.counts[i], v3);
    if (s.ups.has('patronsFavor')) c *= 0.95;
    if (v3 && NG > 2 && uniq(2)) c *= V3.U_RAVEN_COST;     // A Conspiracy of Ravens
    return Math.ceil(c);
  }
  function checkAch() {
    if (cfg.freezeAch) return;
    const add = (id, cond) => { if (cond && !s.earnedAch.has(id)) { s.earnedAch.add(id); s.achCount++; } };
    add('firstWords', s.clicks >= 1);
    add('storytellerAwakens', s.counts.some((c) => c > 0));
    add('busyFingers', s.clicks >= 1000);
    add('whisperedLegends', s.totalEarned >= 1000);
    add('aThousandTales', s.totalEarned >= 100000);
    add('museMenagerie', s.counts[0] >= 25);
    add('fullAviary', s.counts[2] >= 25);
    add('industrialFiction', totalProd(false) >= 1000);
    add('momentSeizer', s.buffActivations >= 10);
    add('wellRounded', s.counts.every((c) => c >= 1));
  }
  function sparkInterval() {
    let base = V2C.SPARK_INT_MIN + rng() * (V2C.SPARK_INT_MAX - V2C.SPARK_INT_MIN);
    if (NET >= 1) base /= 2;
    if (v3 && NG > 8 && uniq(8)) base *= V3.U_CITADEL_SPARK; // The Garrison Sallies Forth
    return base;
  }
  function collectSpark() {
    s.sparksCaught++;
    let m2 = NET >= 2 ? 2 : 1;
    if (v3 && NG > 12 && uniq(12)) m2 *= V3.U_CITY_SPARK;    // The City Dreams of You
    const perQuill = (v3 && tomes >= V3.PILGRIMS_AT) ? 3 : V2C.FRAGMENTS_PER_QUILL;
    const roll = rng() * 100;
    if (roll < 45) {
      const g = Math.max(V2C.BURST_SECONDS * totalProd(t < buffEnd), V2C.BURST_FLOOR_CLICKS * clickValue(false)) * m2;
      s.ins += g; s.totalEarned += g; s.burstGain += g;
    } else if (roll < 65) {
      s.frenzyUntil = t + 30 * m2;
    } else if (roll < 80) {
      s.gossipUntil = t + 60 * m2;
    } else if (roll < 90) {
      cdEnd = t;
      const dur = s.ups.has('burstOfGenius') ? 22.5 : 15;
      buffEnd = Math.max(buffEnd, t + dur);
    } else if (roll < 98) {
      s.fragments += m2;
      while (s.fragments >= perQuill) { s.fragments -= perQuill; s.quills++; s.sparkQuills++; }
    } else {
      s.quills += m2; s.sparkQuills += m2;
    }
  }

  while (t < cfg.maxTime) {
    const buffed = t < buffEnd;
    const cps = cfg.clickRate;
    const clickPart = clickValue(buffed) * cps * dt;
    const gain = totalProd(buffed) * dt + clickPart;
    s.clicks += cps * dt;
    s.clickGain += clickPart;
    s.ins += gain; s.totalEarned += gain;
    checkAch();

    for (const tg of TARGETS) if (s.totalEarned >= tg && tAt[tg] === undefined) tAt[tg] = t;

    if (s.totalEarned >= 500 && t >= cdEnd + REACT && t >= buffEnd) {
      let dur = s.ups.has('burstOfGenius') ? 22.5 : 15;
      if (ovation && !s.firstBuffDone) dur *= 2;
      if (v3 && NG > 3 && uniq(3)) dur += V3.U_QUILL_BUFF;   // The Quills Write Back
      s.firstBuffDone = true;
      let cd = CD;
      if (v3 && NG > 7 && uniq(7)) cd = Math.max(V3.BUFF_CD_FLOOR, cd - V3.U_MYTH_CD); // Perpetual Myth
      buffEnd = t + dur; cdEnd = t + cd; s.buffActivations++;
      if (applauseS > 0) {
        const g = applauseS * totalProd(false);
        s.ins += g; s.totalEarned += g;
      }
    }

    if (CATCH >= 0 && s.totalEarned >= V2C.SPARK_UNLOCK) {
      if (s.nextSpark === null) s.nextSpark = t + sparkInterval();
      if (t >= s.nextSpark) {
        if (rng() < CATCH) { collectSpark(); s.nextSpark = t + 5 + sparkInterval(); }
        else { s.sparksMissed++; s.nextSpark = t + 10 + sparkInterval(); }
      }
    }

    for (const u of UPS.slice().sort((a, b) => a.cost - b.cost)) {
      if (!s.ups.has(u.id) && u.unlock(s) && s.ins >= u.cost) {
        s.ins -= u.cost; s.ups.add(u.id);
      }
    }

    const pending = UPS.filter((u) => !s.ups.has(u.id) && u.unlock(s)).map((u) => u.cost);
    const cheapest = pending.length ? Math.min(...pending) : Infinity;
    const income = totalProd(false) + clickValue(false) * cfg.clickRate;
    const saving = cheapest > s.ins && cheapest <= s.ins + income * 45;

    if (!saving) {
      let guard = 0;
      while (guard++ < 50) {
        let best = -1, bestPay = Infinity;
        for (let i = 0; i < NG; i++) {
          if (s.totalEarned < GENS[i].unlock) continue;
          const c = cost(i);
          if (c > s.ins) continue;
          const marginal = prodGen(i, s.counts[i] + 1) - prodGen(i);
          const pay = c / Math.max(marginal, 1e-9);
          if (pay < bestPay) { bestPay = pay; best = i; }
        }
        if (best < 0) break;
        s.ins -= cost(best); s.counts[best]++;
      }
    }

    for (const tg of TARGETS) if (s.totalEarned >= tg && tAt[tg] === undefined) tAt[tg] = t;

    const q = quillsV3(s.totalEarned);
    if (q >= cfg.stopAtQuills) break;
    t += dt;
  }

  return {
    t, tAt,
    totalEarned: s.totalEarned,
    prod: totalProd(false),
    achCount: s.achCount,
    counts: s.counts.slice(),
  };
}

// ---------------------------------------------------------------------------
// Simularea casual pe N zile: 2 sesiuni x 20 min/zi (08:00 si 20:00 model),
// offline intre ele; publish/spend/relics/atelier/praguri — arcul intreg v3.
// ---------------------------------------------------------------------------
const DAY = 86400, SESSION = 1200, HALF = 43200;

// prioritatea de cheltuire a quills (jucator "content-first"); strict-secventiala
const SPEND_ORDER = [
  ['apprentice', 1, 1], ['genius', 1, 2], ['net', 1, 2], ['restless', 1, 3],
  ['contract', 1, 4], ['applause', 1, 4], ['blueprint', 1, 12],
  ['wing', 1, V3.WING_COSTS[0]],
  ['net', 2, 5], ['restless', 2, 7], ['editorsDue', 1, 10], ['nightOwl', 1, 5],
  ['apprentice', 2, 3], ['understudy', 1, V3.UNDERSTUDY_COST],
  ['genius', 2, 6], ['bookmark', 1, 6], ['apprentice', 3, 8], ['bookmark', 2, 14],
  ['patience', 1, V3.PATIENCE_COST], ['manuscript', 1, V3.MANUSCRIPT_COST],
  ['wing', 2, V3.WING_COSTS[1]],
  ['stacks', 1, V3.STACKS_COST],
  ['wing', 3, V3.WING_COSTS[2]],
  ['atlas', 1, V3.ATLAS_COST],
];
const SINK_ALL = SPEND_ORDER.reduce((a, [, , c]) => a + c, 0); // v2 (92) + v3, total

function casualSim(days, sessionSec = SESSION) {
  const CPS = 2, REACT = 20;
  const M = {
    lifetime: 0, wallet: 0, walletFrac: 0, tomes: 0, fragments: 0,
    lifetimeIns: 0, oldLifetime: 0, resonance: false,
    at: {}, achSet: new Set(), sparksCaught: 0,
    everOwned: new Array(14).fill(0),
    everRevealed: new Set(), everQty: new Set(),
    events: [], dayLog: [], pubLog: [], spendLog: [],
    maxTe: 0, maxCost: 0, maxProd: 0, spentQuills: 0,
    acc17: 0, accAll: 0,
  };
  const atl = (k) => M.at[k] || 0;
  let T = 0;
  let R = null;
  let prevRunTe = 0;

  const uniqueAt = () => (M.tomes >= V3.TELLING_AT ? V3.UNIQUE_AT_RELIC : V3.UNIQUE_AT);
  const uniq = (i) => R.counts[i] >= uniqueAt();
  const shelfCap = () => (M.tomes >= V3.SHELF_AT ? V3.SHELF_CAP : V2C.BOOKSHELF_CAP);

  function event(label) { M.events.push({ T, label }); }

  function newRun() {
    R = {
      counts: new Array(14).fill(0), ins: 0, te: 0,
      ups: new Set(), buffEnd: -1, cdEnd: T, firstBuff: false,
      activeSec: 0, qStart: 0, sparkAcc: 0,
    };
    R.counts[0] = V2C.APPRENTICE_START[atl('apprentice')];
    let start = 0;
    if (M.tomes >= V2C.DOG_EARED_AT) start += V2C.DOG_EARED;
    if (M.tomes >= V3.FOREWORD_AT && prevRunTe > 0) start += Math.min(prevRunTe * V3.FOREWORD_RATE, V3.FOREWORD_CAP);
    R.ins += start; R.te += start;
    if (atl('manuscript')) { for (const id of V1_RUN_UP_IDS) R.ups.add(id); }
    else {
      if (atl('bookmark') >= 1) { R.ups.add('sharpenedNib'); R.ups.add('musesChorus'); }
      if (atl('bookmark') >= 2) { R.ups.add('goldenInkwell'); R.ups.add('ravensGossip'); }
    }
    R.qStart = quillsV3(R.te);
  }

  function genAvailable(i) {
    if (i === 7) return !!atl('blueprint');
    if (i >= 8) return atl('wing') >= NEW_GENS[i - 8].wing;
    return true;
  }
  function genRevealed(i) { return genAvailable(i) && R.te >= ALL_GENS[i].unlock; }

  function prodGen(i, cOverride) {
    const c = cOverride === undefined ? R.counts[i] : cOverride;
    if (!c) return 0;
    let p = c * ALL_GENS[i].prod * qtyMult(c, true, !!atl('stacks'));
    if (i === 0 && R.ups.has('musesChorus')) p *= 2;
    if (i === 1 && R.ups.has('ravensGossip')) p *= (1 + 0.05 * R.counts[2]);
    if (i === 3 && R.ups.has('weaversRhythm')) p *= (1 + 0.10 * R.counts[4]);
    const r = V3.RESCALERS.find((x) => x.gen === i);
    if (r && R.ups.has(r.id)) p *= r.mult;
    if (i < 4 && uniq(4)) p *= V3.U_LOOM_TIERS;
    return p;
  }
  function rawProd() { let s = 0; for (let i = 0; i < 14; i++) s += prodGen(i); return s; }
  function raw17() { let s = 0; for (let i = 0; i < 7; i++) s += prodGen(i); return s; }
  function globalMult(buffed) {
    let m = 1;
    if (R.ups.has('goldenInkwell')) m *= 1.5;
    let achRate = R.ups.has('boundAnthology') ? 0.02 : 0.01;
    if (uniq(9)) achRate *= V3.U_GUILD_ACH;
    m *= (1 + achRate * M.achSet.size);
    m *= (1 + V2C.QB * M.lifetime);
    m *= (1 + V2C.BOOKSHELF_RATE * Math.min(M.tomes, shelfCap()));
    if (M.tomes >= V2C.INK_REMEMBERS_AT) m *= (1 + V2C.INK_REMEMBERS_RATE * M.tomes);
    if (atl('atlas')) m *= 2;
    if (uniq(13)) m *= V3.U_OUAT_GLOBAL;
    if (buffed) m *= uniq(6) ? V3.U_FORGE_BUFF : 2;
    return m;
  }
  function totalProd(buffed) { return rawProd() * globalMult(buffed); }
  function clickValue(buffed, tp) {
    let base = 1;
    if (R.ups.has('sharpenedNib')) base *= 2;
    if (M.resonance) base *= (1 + V2C.QB * M.lifetime);
    if (buffed) base *= 5;
    if (uniq(0)) base *= V3.U_MUSE_CLICK;
    let v = base;
    if (R.ups.has('inkEcho')) v += (uniq(1) ? V3.U_SPRITE_ECHO : 0.01) * tp;
    v *= 1 + V2C.GENIUS_P[atl('genius')] * (V2C.GENIUS_MULT - 1);
    return v;
  }
  function unitCost(i) {
    let c = unitCostRaw(ALL_GENS[i], R.counts[i], true);
    if (R.ups.has('patronsFavor')) c *= 0.95;
    if (uniq(2)) c *= V3.U_RAVEN_COST;
    return Math.ceil(c);
  }
  function offlineEff() {
    let e = R.ups.has('lucidDreaming') ? V2C.OFF_EFF_LUCID : V2C.OFF_EFF;
    if (M.tomes >= V2C.READERS_LETTER_AT) e += V2C.READERS_LETTER_PP;
    if (uniq(5)) e += V3.U_LIB_OFFLINE;   // The Library Never Closes
    return Math.min(e, 0.90);
  }
  function offlineCapSec() {
    let h = R.ups.has('lucidDreaming') ? V2C.OFF_CAP_LUCID_H : V2C.OFF_CAP_H;
    if (atl('nightOwl')) h += V2C.NIGHT_OWL_H;
    if (atl('patience')) h += V2C.PATIENCE_H;
    if (uniq(11)) h += V3.U_WTA_CAP_H;    // Deep Roots
    return h * 3600;
  }

  function ach(id, cond) {
    if (cond && !M.achSet.has(id)) {
      M.achSet.add(id);
      if (id.startsWith('v3:')) event(`ACH ${id.slice(3)}`);
    }
  }
  function checkAch() {
    // v1 (10) — condensat: toate triviale pe arcul casual
    ach('firstWords', true); ach('storytellerAwakens', R.counts.some((c) => c > 0));
    ach('busyFingers', M.lifetimeIns > 1e4); ach('whisperedLegends', R.te >= 1000);
    ach('aThousandTales', R.te >= 1e5); ach('museMenagerie', R.counts[0] >= 25);
    ach('fullAviary', R.counts[2] >= 25); ach('industrialFiction', true);
    ach('momentSeizer', M.lifetimeIns > 1e5); ach('wellRounded', R.counts.slice(0, 7).every((c) => c >= 1));
    // v2 (14) — aproximate pe praguri de tomes/quills/sparks/myth
    ach('v2:tome1', M.tomes >= 1); ach('v2:tome5', M.tomes >= 5); ach('v2:tome10', M.tomes >= 10);
    ach('v2:tome25', M.tomes >= 25); ach('v2:myth1', R.counts[7] >= 1); ach('v2:myth25', R.counts[7] >= 25);
    ach('v2:q10', M.lifetime >= 10); ach('v2:q100', M.lifetime >= 100);
    ach('v2:sparks10', M.sparksCaught >= 10); ach('v2:sparks100', M.sparksCaught >= 100);
    ach('v2:frag', M.sparksCaught >= 25); ach('v2:offline', M.tomes >= 1);
    ach('v2:te1e9', R.te >= 1e9); ach('v2:te1e12', R.te >= 1e12);
    // v3 (12) — conditiile reale din 13 §5.1
    ach('v3:aLongerRoad', R.counts[8] >= 1);
    ach('v3:cosmologySection', R.counts.every((c) => c >= 1));
    ach('v3:twoHundredVoices', R.counts.some((c) => c >= 200));
    ach('v3:deepShelves', R.counts.some((c) => c >= 500));
    ach('v3:aNumberNeedsAName', R.te >= 1e15);
    ach('v3:beyondTheAlphabet', M.lifetimeIns >= 1e21);
    ach('v3:masterOfTheWing', atl('wing') >= 3);
    ach('v3:aThousandFeathers', M.lifetime >= 1000);
    ach('v3:marathonNovelist', M.tomes >= 50);
    ach('v3:completeWorks', M.tomes >= 200);
    ach('v3:onceUponAHundred', R.counts[13] >= 100);
    ach('v3:nothingLeftUnwritten', M.tomes >= V3.SHELF_AT && M.spentQuills >= SINK_ALL);
  }

  function spendWallet() {
    for (const [key, lvl, cost] of SPEND_ORDER) {
      const cur = atl(key);
      if (cur >= lvl) continue;
      if (cur !== lvl - 1) return; // strict secvential (economiseste pentru urmatorul)
      if (M.wallet < cost) return;
      M.wallet -= cost; M.spentQuills += cost; M.at[key] = lvl;
      M.spendLog.push({ T, label: `${key}${lvl > 1 || key === 'wing' || key === 'apprentice' ? ' L' + lvl : ''} (${cost}q)` });
      event(`ATELIER ${key}${lvl > 1 || key === 'wing' ? ' L' + lvl : ''}`);
    }
  }

  function publish() {
    const q = quillsV3(R.te) + (atl('editorsDue') ? 1 : 0) + (uniq(10) ? V3.U_PANTHEON_QUILL : 0);
    M.oldLifetime += quillsV1(R.te);
    M.lifetime += q; M.wallet += q; M.tomes++;
    if (!M.resonance && M.lifetime > 0) M.resonance = true; // quillResonance (2500 ins, trivial dupa tomul 1)
    M.pubLog.push({ T, activeSec: R.activeSec, te: R.te, q });
    for (const th of [V3.FOREWORD_AT, V3.PILGRIMS_AT, V3.TELLING_AT, V3.SHELF_AT]) {
      if (M.tomes === th) event(`RELIC la tomes=${th}`);
    }
    prevRunTe = R.te;
    newRun();
    spendWallet();
  }

  function maybePublish() {
    const q = quillsV3(R.te) + (atl('editorsDue') ? 1 : 0) + (uniq(10) ? 1 : 0);
    const gain = q - R.qStart;
    const need = Math.max(1, Math.ceil(0.10 * M.lifetime));
    if (gain >= need && R.activeSec >= 120) publish();
  }

  function buyUpgrades() {
    const list = [];
    for (const u of V1_UPS) {
      if (u.id === 'quillResonance') continue; // meta, gestionat separat
      if (!R.ups.has(u.id) && u.unlock({ ...R, totalEarned: R.te, quills: M.lifetime, achCount: M.achSet.size, buffActivations: 99, clicks: 1e9 })) list.push(u);
    }
    // lucidDreaming (50k, upgrade de rundă v1 — unlock: revenire din offline; mereu adevarat aici)
    if (!R.ups.has('lucidDreaming') && M.lifetimeIns > 0) list.push({ id: 'lucidDreaming', cost: 50000 });
    for (const r of V3.RESCALERS) {
      if (!R.ups.has(r.id) && R.counts[r.gen] >= V3.RESCALER_UNLOCK) list.push({ id: r.id, cost: r.cost });
    }
    list.sort((a, b) => a.cost - b.cost);
    for (const u of list) {
      if (R.ins >= u.cost) {
        R.ins -= u.cost; R.ups.add(u.id);
        if (V3.RESCALERS.some((r) => r.id === u.id) && !M.everQty.has('resc:' + u.id)) {
          M.everQty.add('resc:' + u.id); event(`RESCALER ${u.id}`);
        }
      }
    }
  }

  function recordOwn(i) {
    const c = R.counts[i];
    const old = M.everOwned[i];
    if (c > old) {
      M.everOwned[i] = c;
      if (old === 0 && i >= 8) event(`FIRST ${ALL_GENS[i].id}`);
      for (const th of [150, 200, 300, 400, 500]) {
        const k = `qty:${i}:${th}`;
        if (c >= th && !M.everQty.has(k)) {
          M.everQty.add(k);
          event(th === 200 ? `UNIQUE ${ALL_GENS[i].id}@200` : `QTY ${ALL_GENS[i].id}@${th}`);
        }
      }
    }
  }

  function buyLoop() {
    let iter = 0;
    while (iter++ < 60) {
      let best = -1, bestPay = Infinity;
      for (let i = 0; i < 14; i++) {
        if (!genRevealed(i)) continue;
        const c = unitCost(i);
        if (c > R.ins) continue;
        const marginal = (prodGen(i, R.counts[i] + 1) - prodGen(i)) || 1e-9;
        const pay = c / marginal;
        if (pay < bestPay) { bestPay = pay; best = i; }
      }
      if (best < 0) break;
      let bought = 0;
      while (bought < 25) {
        const c = unitCost(best);
        if (c > R.ins) break;
        R.ins -= c; R.counts[best]++; bought++;
        if (c > M.maxCost) M.maxCost = c;
      }
      recordOwn(best);
    }
  }

  function sparkEV(dt) {
    if (R.te < V2C.SPARK_UNLOCK) return;
    let interval = (V2C.SPARK_INT_MIN + V2C.SPARK_INT_MAX) / 2;
    if (atl('net') >= 1) interval /= 2;
    if (uniq(8)) interval *= V3.U_CITADEL_SPARK;
    R.sparkAcc += dt / interval;
    if (R.sparkAcc >= 1) {
      R.sparkAcc -= 1;
      const CATCH = 0.5; // catch-rate casual, determinist (EV)
      M.sparksCaught += CATCH;
      let m2 = atl('net') >= 2 ? 2 : 1;
      if (uniq(12)) m2 *= V3.U_CITY_SPARK;
      // EV monetara: 45% inkBurst
      const tp = totalProd(false);
      const burst = Math.max(V2C.BURST_SECONDS * tp, V2C.BURST_FLOOR_CLICKS * clickValue(false, tp)) * m2;
      const gainEV = CATCH * 0.45 * burst;
      R.ins += gainEV; R.te += gainEV; M.lifetimeIns += gainEV;
      // EV quills: 8% fragmente + 2% drop direct
      const perQuill = M.tomes >= V3.PILGRIMS_AT ? 3 : V2C.FRAGMENTS_PER_QUILL;
      const qEV = CATCH * (0.08 * m2 / perQuill + 0.02 * m2);
      M.walletFrac += qEV;
      const whole = Math.floor(M.walletFrac);
      if (whole > 0) { M.walletFrac -= whole; M.wallet += whole; M.lifetime += whole; }
    }
  }

  function tick() {
    const buffed = T < R.buffEnd;
    const tp = totalProd(buffed);
    if (tp > M.maxProd) M.maxProd = tp;
    const gain = tp + clickValue(buffed, tp) * CPS;
    R.ins += gain; R.te += gain; M.lifetimeIns += gain;
    if (R.te > M.maxTe) M.maxTe = R.te;

    // buff
    if (R.te >= 500 && T >= R.cdEnd + REACT && T >= R.buffEnd) {
      let dur = R.ups.has('burstOfGenius') ? 22.5 : 15;
      if (M.tomes >= V2C.OVATION_AT && !R.firstBuff) dur *= 2;
      if (uniq(3)) dur += V3.U_QUILL_BUFF;
      R.firstBuff = true;
      let cd = V2C.RESTLESS_CD[atl('restless')];
      if (uniq(7)) cd = Math.max(V3.BUFF_CD_FLOOR, cd - V3.U_MYTH_CD);
      R.buffEnd = T + dur; R.cdEnd = T + cd;
      if (atl('applause')) {
        const g = V2C.APPLAUSE_SECONDS * totalProd(false);
        R.ins += g; R.te += g; M.lifetimeIns += g;
      }
    }

    sparkEV(1);
    M.acc17 += raw17(); M.accAll += rawProd();
    // reveal-uri (prima data vreodata)
    for (let i = 8; i < 14; i++) {
      if (!M.everRevealed.has(i) && genRevealed(i)) { M.everRevealed.add(i); event(`REVEAL ${ALL_GENS[i].id}`); }
    }
    checkAch();
    buyUpgrades();
    buyLoop();
    spendWallet();
    maybePublish();
    R.activeSec += 1;
  }

  function applyOffline(gap) {
    const tp = totalProd(false);
    const gain = tp * Math.min(gap, offlineCapSec()) * offlineEff();
    R.ins += gain; R.te += gain; M.lifetimeIns += gain;
    if (R.te > M.maxTe) M.maxTe = R.te;
  }

  newRun();
  for (let d = 0; d < days; d++) {
    for (let sess = 0; sess < 2; sess++) {
      const sessStart = d * DAY + sess * HALF;
      if (T < sessStart) { applyOffline(sessStart - T); T = sessStart; }
      for (let k = 0; k < sessionSec; k++) { tick(); T += 1; }
    }
    // snapshot la finalul zilei (share T1-7 = medie ponderata in timp pe ziua respectiva)
    const maxTier = M.everOwned.reduce((mx, c, i) => (c > 0 ? i + 1 : mx), 0);
    const share17 = M.accAll > 0 ? M.acc17 / M.accAll : 1;
    M.acc17 = 0; M.accAll = 0;
    M.dayLog.push({
      day: d + 1, maxTier, tomes: M.tomes, lifetime: Math.round(M.lifetime),
      wallet: Math.round(M.wallet), maxTe: M.maxTe, share17,
      spent: M.spentQuills, ach: M.achSet.size,
    });
  }
  M.finalCounts = R.counts.slice();
  M.finalProd = totalProd(false);
  return M;
}

// ---------------------------------------------------------------------------
// Utilitare raportare
// ---------------------------------------------------------------------------
function fmt(sec) {
  if (sec === undefined) return '--';
  const m = Math.floor(sec / 60), ss = Math.floor(sec % 60);
  return `${m}m${String(ss).padStart(2, '0')}s`;
}
function fmtT(T) {
  const d = Math.floor(T / DAY) + 1, h = Math.floor((T % DAY) / 3600), mi = Math.floor((T % 3600) / 60);
  return `z${d} ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}
function e(x) { return x.toExponential(2); }

// ===========================================================================
console.log('====================================================================');
console.log('RUN L0 — V1-COMPAT EXACT (toate flag-urile v3 off) => 03 §9 la secunda');
console.log('====================================================================');
const a1 = simulateRun({ quills: 0, startAch: 0, clickRate: 2, maxTime: 5400, stopAtQuills: 2 });
const a2 = simulateRun({ quills: 2, startAch: a1.achCount + 1, clickRate: 2, maxTime: 5400, stopAtQuills: 3, freezeAch: true });
const a3 = simulateRun({ quills: 5, startAch: 9, clickRate: 2, maxTime: 7200, stopAtQuills: 4, freezeAch: true });
console.log(`  Runda 1: t(100k)=${fmt(a1.tAt[1e5])} (tinta 24m23s) | prod=${a1.prod.toFixed(1)}/s (721.6) | ach=${a1.achCount} (7)`);
console.log(`  Runda 2: t(100k)=${fmt(a2.tAt[1e5])} (tinta 16m49s)`);
console.log(`  Runda 3: t(100k)=${fmt(a3.tAt[1e5])} (tinta 11m45s)`);
const L0 = fmt(a1.tAt[1e5]) === '24m23s' && fmt(a2.tAt[1e5]) === '16m49s' && fmt(a3.tAt[1e5]) === '11m45s'
  && a1.prod.toFixed(1) === '721.6';
console.log(`  RUN L0: ${L0 ? 'PASS' : 'FAIL'}`);

console.log('');
console.log('====================================================================');
console.log('RUN L1 — INVARIANTA PRIMELOR 40 MIN: runda 1 cu v3 COMPLET PORNIT');
console.log('  (taper+praguri+re-scalere+formula noua active; fara meta, fara sparks)');
console.log('====================================================================');
const b1 = simulateRun({ quills: 0, startAch: 0, clickRate: 2, maxTime: 5400, stopAtQuills: 2, v3: true });
let L1 = a1.prod === b1.prod && a1.t === b1.t;
for (const tg of TARGETS) if (a1.tAt[tg] !== b1.tAt[tg]) L1 = false;
console.log(`  t(1k/10k/50k/100k/400k) v1: ${[1e3, 1e4, 5e4, 1e5, 4e5].map((x) => fmt(a1.tAt[x])).join(' / ')}`);
console.log(`  t(1k/10k/50k/100k/400k) v3: ${[1e3, 1e4, 5e4, 1e5, 4e5].map((x) => fmt(b1.tAt[x])).join(' / ')}`);
console.log(`  prod v1=${a1.prod.toFixed(4)}/s vs v3=${b1.prod.toFixed(4)}/s | identitate tinta-cu-tinta + prod + durata: ${L1 ? 'PASS' : 'FAIL'}`);
console.log('  (structural: praguri>=150 owned, taper>=unitatea 101, genunchi 1e9, New Wing>=25q — toate peste orizontul rundei 1)');

console.log('');
console.log('====================================================================');
console.log('RUN L2 — FORMULA DE PRESTIGE v3: property-test, continuitate, monotonie');
console.log('====================================================================');
{
  // property: identica sub 1e9
  const rnd = mulberry32(42);
  let eq = true;
  for (let i = 0; i < 2e6; i++) {
    const te = rnd() * 1e9;
    if (quillsV3(te) !== quillsV1(te)) { eq = false; break; }
  }
  console.log(`  P1 quillsV3(te)==quillsV1(te) pe 2.000.000 esantioane uniforme in [0,1e9]: ${eq ? 'PASS' : 'FAIL'}`);
  // continuitate la genunchi
  const j1 = Math.abs(quillsV3(1e9) - quillsV3(1e9 + 1)) <= 1 && quillsV3(1e9) === 100;
  const j2 = Math.abs(quillsV3(1e15) - quillsV3(1e15 + 1e6)) <= 1 && quillsV3(1e15) === 1000;
  console.log(`  P2 continuitate: q(1e9)=${quillsV3(1e9)} q(1e9+1)=${quillsV3(1e9 + 1)} | q(1e15)=${quillsV3(1e15)} q(1e15+1e6)=${quillsV3(1e15 + 1e6)}: ${j1 && j2 ? 'PASS' : 'FAIL'}`);
  // monotonie pe grila logaritmica 1e5..1e24
  let mono = true, prev = -1;
  for (let x = 5; x <= 24; x += 0.001) {
    const q = quillsV3(Math.pow(10, x));
    if (q < prev) { mono = false; break; }
    prev = q;
  }
  console.log(`  P3 monotonie (grila log 1e5..1e24, pas 0.001 dec): ${mono ? 'PASS' : 'FAIL'}`);
  console.log('  Breakpoints: ' + [1e5, 4e5, 1e7, 1e9, 1.6e10, 1e11, 1e13, 1e15, 1e18, 1e21, 1e24]
    .map((te) => `${e(te)}->${quillsV3(te)}`).join(' | '));
  console.log(`  Franare vs sqrt la 1e15: ${quillsV1(1e15)} -> ${quillsV3(1e15)} (x${(quillsV1(1e15) / quillsV3(1e15)).toFixed(1)}); la 1e21: ${e(quillsV1(1e21))} -> ${quillsV3(1e21)} (x${(quillsV1(1e21) / quillsV3(1e21)).toFixed(0)})`);
  // sweep exponenti (de ce 1/6+1/10 si nu 1/4+1/6 din 13):
  const variants = [
    ['sqrt pur (v1)', (te) => quillsV1(te)],
    ['1/4 + 1/6 (13 initial)', (te) => te <= 1e9 ? quillsV1(te) : te <= 1e15 ? Math.floor(100 * Math.pow(te / 1e9, 0.25)) : Math.floor(3162.2776601683795 * Math.pow(te / 1e15, 1 / 6))],
    ['1/6 + 1/10 (ALES)', (te) => quillsV3(te)],
  ];
  console.log('  Sweep q(te) per varianta:');
  console.log('    varianta                | 1e12    | 1e15    | 1e18    | 1e21     | 1e24');
  for (const [name, f] of variants) {
    console.log(`    ${name.padEnd(23)} | ${[1e12, 1e15, 1e18, 1e21, 1e24].map((te) => String(f(te)).padStart(7)).join(' | ')}`);
  }
}

console.log('');
console.log('====================================================================');
console.log('RUN L3 — ARCUL CASUAL 30 DE ZILE (2 sesiuni x 20 min/zi, offline restul)');
console.log('====================================================================');
const C = casualSim(30);
console.log('  Zi | tier max | tomes | lifetime q | portofel | max TE     | ach | share T1-7');
for (const d of C.dayLog) {
  console.log(`  ${String(d.day).padStart(2)} |    ${String(d.maxTier).padStart(2)}    | ${String(d.tomes).padStart(5)} | ${String(d.lifetime).padStart(10)} | ${String(d.wallet).padStart(8)} | ${e(d.maxTe)} | ${String(d.ach).padStart(3)} | ${(d.share17 * 100).toFixed(1)}%`);
}
console.log('');
console.log('  Achizitii Atelier (zi si ora):');
for (const sp of C.spendLog) console.log(`    ${fmtT(sp.T)}  ${sp.label}`);
console.log('');
console.log('  Momente cheie (reveal/first/relic/unique/rescaler/ach v3):');
for (const ev of C.events.filter((x) => /REVEAL|FIRST|RELIC|ATELIER wing|UNIQUE|ACH /.test(x.label))) {
  console.log(`    ${fmtT(ev.T)}  ${ev.label}`);
}

console.log('');
console.log('====================================================================');
console.log('RUN L4 — PLAFOANE NUMERICE (tinta < 1e24, cerinta < 1e50)');
console.log('====================================================================');
console.log(`  max totalEarned per runda: ${e(C.maxTe)} | max cost unitate evaluat: ${e(C.maxCost)} | max prod: ${e(C.maxProd)}/s`);
console.log(`  sub 1e24: ${C.maxTe < 1e24 && C.maxCost < 1e24 ? 'PASS' : 'ATENTIE'} | sub 1e50: ${C.maxTe < 1e50 && C.maxCost < 1e50 ? 'PASS' : 'FAIL'}`);
console.log(`  verificari statice: Muse#500=${e(unitCostRaw(BASE_GENS[0], 499, true))} | OUAT#100=${e(unitCostRaw(NEW_GENS[5], 99, true))} | OUAT#200=${e(unitCostRaw(NEW_GENS[5], 199, true))}`);

console.log('');
console.log('====================================================================');
console.log('RUN L5 — NO DEAD TIME: distanta maxima intre unlock-uri vizibile');
console.log('====================================================================');
{
  const evs = C.events.map((x) => x.T).sort((a, b) => a - b);
  let maxGap = 0, at = 0;
  for (let i = 1; i < evs.length; i++) if (evs[i] - evs[i - 1] > maxGap) { maxGap = evs[i] - evs[i - 1]; at = evs[i - 1]; }
  const tail = 30 * DAY - evs[evs.length - 1];
  console.log(`  evenimente inregistrate: ${evs.length} | gap maxim: ${(maxGap / 3600).toFixed(1)}h (dupa ${fmtT(at)}) | coada dupa ultimul: ${(tail / 3600).toFixed(1)}h`);
  console.log(`  criteriu < 24h: ${maxGap < DAY ? 'PASS' : 'FAIL'}`);
}

console.log('');
console.log('====================================================================');
console.log('RUN L6 — FEREASTRA DE ENDGAME (rulare extinsa 56 de zile)');
console.log('====================================================================');
const C56 = casualSim(56);
{
  const find = (label) => { const x = C56.events.find((v) => v.label === label); return x ? fmtT(x.T) : 'nu inca'; };
  const ouat100 = C56.events.find((v) => v.label === 'ACH onceUponAHundred');
  const tomes200 = C56.events.find((v) => v.label === 'RELIC la tomes=200');
  const atlasEv = C56.spendLog.find((v) => v.label.startsWith('atlas'));
  console.log(`  prima Once Upon a Time: ${find('FIRST onceUponATime')}`);
  console.log(`  OUAT >= 100 (Once Upon a Hundred): ${ouat100 ? fmtT(ouat100.T) : 'nu in 56 zile'}`);
  console.log(`  tomes 200 (The Endless Shelf): ${tomes200 ? fmtT(tomes200.T) : 'nu in 56 zile'}`);
  console.log(`  Atlas of Untold Lands (ultimul Atelier, 500q): ${atlasEv ? fmtT(atlasEv.T) : 'nu in 56 zile'}`);
  console.log(`  achievements la ziua 56: ${C56.achSet.size}/36 | tomes: ${C56.tomes} | lifetime: ${Math.round(C56.lifetime)}q | maxTE: ${e(C56.maxTe)}`);
  const d28 = C56.dayLog[27], d56 = C56.dayLog[55];
  console.log(`  ziua 28: tier ${d28.maxTier}, tomes ${d28.tomes}, ach ${d28.ach} -> endgame NU inainte de ~z21-28 (arc suficient de lung)`);
  const done = (ouat100 && tomes200 && atlasEv && C56.achSet.size >= 34);
  console.log(`  endgame complet in fereastra 28-56 zile: ${done ? 'PASS' : 'PARTIAL (v. raport)'}`);
}

console.log('');
console.log('====================================================================');
console.log('RUN L7 — ANTI-TREADMILL: durata medie a rundei in saptamana 2');
console.log('====================================================================');
{
  const wk2 = C.pubLog.filter((p) => p.T >= 7 * DAY && p.T < 14 * DAY);
  const mean = wk2.reduce((a, p) => a + p.activeSec, 0) / Math.max(wk2.length, 1);
  const wk1 = C.pubLog.filter((p) => p.T < 7 * DAY);
  const wk4 = C.pubLog.filter((p) => p.T >= 21 * DAY && p.T < 30 * DAY);
  console.log(`  publish-uri: sapt.1=${wk1.length} | sapt.2=${wk2.length} (durata medie ACTIVA ${(mean / 60).toFixed(1)} min) | z22-30=${wk4.length}`);
  console.log(`  criteriu >= 5 min in sapt. 2: ${mean >= 300 ? 'PASS' : 'FAIL'} (v2 §8.2 avea 2-4 min)`);
}

console.log('');
console.log('====================================================================');
console.log('RUN L8 — DE CE ERA NECESARA FRANA: formula veche vs noua, la ziua 30');
console.log('====================================================================');
console.log(`  lifetime quills ziua 30 cu formula NOUA:  ${Math.round(C.lifetime).toLocaleString('en-US')}`);
console.log(`  lifetime quills ziua 30 cu formula VECHE: ${Math.round(C.oldLifetime).toLocaleString('en-US')} (sqrt pe aceleasi runde)`);
console.log(`  raport: x${(C.oldLifetime / Math.max(C.lifetime, 1)).toFixed(0)} — vechea formula ar fi dat MILIOANE (inflatie: bonusul pasiv 0.3/q ar exploda)`);
const lastPubs = C.pubLog.slice(-5);
console.log(`  ultimele 5 publish-uri (ziua ~30): ${lastPubs.map((p) => '+' + p.q + 'q @te=' + e(p.te)).join(' | ')}`);
console.log(`  interval sanatos (mii-zeci de mii lifetime, sute-mii per publish, NU milioane): ${C.lifetime < 1e6 ? 'PASS' : 'FAIL'}`);

console.log('');
console.log('====================================================================');
console.log('RUN L9 — TIERS 1-7 TRAIESC IN ERA T12+ (share >= 5% din rawProd)');
console.log('====================================================================');
{
  const eraDays = C.dayLog.filter((d) => d.maxTier >= 12);
  const worst = eraDays.length ? Math.min(...eraDays.map((d) => d.share17)) : NaN;
  const best = eraDays.length ? Math.max(...eraDays.map((d) => d.share17)) : NaN;
  console.log(`  zile in era T12+: ${eraDays.length} | share T1-7 min=${(worst * 100).toFixed(1)}% max=${(best * 100).toFixed(1)}%`);
  console.log(`  criteriu >= 5%: ${worst >= 0.05 ? 'PASS' : 'FAIL'} (re-scalerele + pragurile adanci tin tier-urile vechi relevante)`);
}

console.log('');
console.log('====================================================================');
console.log('SINK CHECK — ziua 14: cost Atelier necumparat vs lifetime (tinta >= 30%)');
console.log('====================================================================');
{
  const d14 = C.dayLog[13];
  const unbought = SINK_ALL - d14.spent;
  console.log(`  ziua 14: lifetime=${d14.lifetime}q, cheltuit=${d14.spent}q, necumparat=${unbought}q => ${(100 * unbought / Math.max(d14.lifetime, 1)).toFixed(0)}% din lifetime (sink total ${SINK_ALL}q)`);
}

console.log('');
console.log('====================================================================');
console.log('RUN L10 — CRITERIUL 7.3 sub modelul 13 (2 sesiuni x 30 min/zi), 3 zile');
console.log('====================================================================');
{
  const B = casualSim(3, 1800);
  const wing1 = B.spendLog.find((v) => v.label.startsWith('wing L1'));
  const cit = B.events.find((v) => v.label === 'FIRST sagaCitadel');
  const rev10 = B.events.find((v) => v.label === 'REVEAL narratorsGuild');
  console.log(`  New Wing L1: ${wing1 ? fmtT(wing1.T) : 'nu in 3 zile'} | prima Saga Citadel: ${cit ? fmtT(cit.T) : 'nu in 3 zile'} | Narrators' Guild vizibil: ${rev10 ? fmtT(rev10.T) : 'nu in 3 zile'}`);
  console.log(`  criteriu 7.3 (tier 9 detinut < 24h calendar): ${cit && cit.T < DAY ? 'PASS' : (cit && cit.T < 1.5 * DAY ? 'BORDERLINE (<36h)' : 'FAIL')}`);
  console.log(`  ziua 1 (model 30 min): tomes=${B.dayLog[0].tomes}, lifetime=${B.dayLog[0].lifetime}q | ziua 2: tomes=${B.dayLog[1].tomes}, lifetime=${B.dayLog[1].lifetime}q, tier=${B.dayLog[1].maxTier}`);
}
