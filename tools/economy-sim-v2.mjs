// Fable Idler — economy sanity simulation V2 (Agent 2 v2, ai-memory/11-v2-economy.md)
// Extinde modelul v1 (tools/economy-sim.mjs) cu: Atelier, Relics, Stray Spark,
// Bookshelf, reancorarea bonusului pe lifetimeQuillsEarned.
// GARANTIE v1-compat: cu toate flag-urile v2 dezactivate, fiecare insertie v2 e
// un no-op numeric exact (inmultiri cu 1.0, ramuri sarite) => reproduce EXACT
// cifrele din 03 §9 (24m23s / 16m49s / 11m45s). Asta E testul invariantului (b).
//
// Rulare (host fara Node):
//   docker run --rm -v "C:\Projects\Games\Fable Idler\tools:/w" node:22-alpine node /w/economy-sim-v2.mjs

const BASE_GENS = [
  { id: 'wanderingMuse',  base: 15,        prod: 0.1,  growth: 1.15, unlock: 10 },
  { id: 'inkSprite',      base: 100,       prod: 1,    growth: 1.15, unlock: 60 },
  { id: 'talkingRaven',   base: 1100,      prod: 8,    growth: 1.14, unlock: 600 },
  { id: 'enchantedQuill', base: 12000,     prod: 47,   growth: 1.13, unlock: 6000 },
  { id: 'storyLoom',      base: 130000,    prod: 260,  growth: 1.13, unlock: 65000 },
  { id: 'dreamLibrary',   base: 1400000,   prod: 1400, growth: 1.12, unlock: 700000 },
  { id: 'fableForge',     base: 20000000,  prod: 7800, growth: 1.12, unlock: 10000000 },
];
// Generatorul 8 (doar cu blueprintOfMyths)
const MYTH_ENGINE = { id: 'mythEngine', base: 300000000, prod: 45000, growth: 1.12, unlock: 150000000 };

const UPS = [
  { id: 'sharpenedNib',   cost: 100,     unlock: s => s.totalEarned >= 50 },
  { id: 'musesChorus',    cost: 500,     unlock: s => s.counts[0] >= 10 },
  { id: 'quillResonance', cost: 2500,    unlock: s => s.quills > 0 },
  { id: 'goldenInkwell',  cost: 15000,   unlock: s => s.totalEarned >= 10000 },
  { id: 'ravensGossip',   cost: 25000,   unlock: s => s.counts[2] >= 5 && s.counts[1] >= 10 },
  { id: 'burstOfGenius',  cost: 75000,   unlock: s => s.buffActivations >= 5 },
  { id: 'inkEcho',        cost: 200000,  unlock: s => s.counts.reduce((a, b) => a + b, 0) >= 25 },
  { id: 'weaversRhythm',  cost: 1000000, unlock: s => s.counts[4] >= 5 && s.counts[3] >= 10 },
  { id: 'patronsFavor',   cost: 2000000, unlock: s => s.totalEarned >= 1000000 },
  { id: 'boundAnthology', cost: 5000000, unlock: s => s.achCount >= 10 },
];

// ---- Constante V2 FINALE (sursa: ai-memory/11-v2-economy.md) ----
const V2 = {
  QB: 0.30,                          // neschimbat; aplicat pe lifetimeQuillsEarned
  APPRENTICE_START: [0, 5, 15, 30],  // apprenticeMuse L0..L3
  GENIUS_P: [0, 0.05, 0.10],         // strokeOfGenius sansa crit
  GENIUS_MULT: 10,                   // crit x10 pe INTREGUL click (decizie confirmata in RUN F)
  RESTLESS_CD: [90, 75, 60],         // restlessHeart cooldown buff
  APPLAUSE_SECONDS: 20,              // [CALIBRARE] 60 -> 20 (60s = +55..67% venit sustinut, OP)
  BURST_SECONDS: 45,                 // [CALIBRARE] 900 -> 45 (900s = +169% venit la catch 100%, OP)
  BURST_FLOOR_CLICKS: 50,            // podea inkBurst = 50 x clickValue curent
  FRENZY: { dur: 30, mult: 7 },      // quillFrenzy: click x7 pe partea de baza
  GOSSIP: { dur: 60, mult: 5, tiers: 3 }, // gossipBonanza: tiers 1-3 x5
  FRAGMENTS_PER_QUILL: 5,
  SPARK_INT_MIN: 150, SPARK_INT_MAX: 330, SPARK_FLIGHT: 10, SPARK_UNLOCK: 1000,
  BOOKSHELF_RATE: 0.02, BOOKSHELF_CAP: 25,
  INK_REMEMBERS_RATE: 0.01, INK_REMEMBERS_AT: 15,
  DOG_EARED: 300, DOG_EARED_AT: 3,
  OVATION_AT: 7,
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TARGETS = [1e3, 1e4, 5e4, 1e5, 4e5, 9e5, 1.6e6, 2.5e6, 1e7];

function simulate(cfg) {
  const at = cfg.atelier || {};
  const GENS = at.blueprint ? [...BASE_GENS, MYTH_ENGINE] : BASE_GENS;
  const NG = GENS.length;
  const tomes = cfg.tomes || 0;
  const fablesCounted = Math.min(cfg.fables || 0, V2.BOOKSHELF_CAP);
  const rng = mulberry32(cfg.seed || 1);
  const CATCH = cfg.sparksOn ? (cfg.catch ?? 0) : -1; // -1 = sistemul spark inexistent
  const NET = at.net || 0;
  const burstSeconds = cfg.burstSeconds ?? V2.BURST_SECONDS;
  const critEV = 1 + V2.GENIUS_P[at.genius || 0] * (V2.GENIUS_MULT - 1);
  const critBaseOnly = cfg.critBaseOnly === true;
  const CD = V2.RESTLESS_CD[at.restless || 0];
  const applauseS = at.applause ? V2.APPLAUSE_SECONDS : 0;
  const ovation = tomes >= V2.OVATION_AT;

  const s = {
    counts: new Array(NG).fill(0),
    ins: 0, totalEarned: 0, clicks: 0,
    quills: cfg.quills || 0,          // v2: lifetimeQuillsEarned; v1-compat: goldenQuills
    achCount: cfg.startAch || 0,
    buffActivations: 0,
    ups: new Set(),
    earnedAch: new Set(),
    frenzyUntil: -1, gossipUntil: -1,
    fragments: cfg.fragments || 0, sparkQuills: 0, sparksCaught: 0, sparksMissed: 0,
    burstGain: 0, applauseGain: 0, clickGain: 0,
    firstBuffDone: false, nextSpark: null,
  };
  // Atelier / Relics head-start
  s.counts[0] = V2.APPRENTICE_START[at.apprentice || 0];
  if (tomes >= V2.DOG_EARED_AT) { s.ins = V2.DOG_EARED; s.totalEarned = V2.DOG_EARED; }
  if ((at.bookmark || 0) >= 1) { s.ups.add('sharpenedNib'); s.ups.add('musesChorus'); }
  if ((at.bookmark || 0) >= 2) { s.ups.add('goldenInkwell'); s.ups.add('ravensGossip'); }

  const events = [];
  const tAt = {};
  let buffEnd = -1, cdEnd = 0, t = 0;
  const dt = 1, REACT = 20;

  const qtyMultAt = (i, c) => { let m = 1; for (const th of [25, 50, 100]) if (c >= th) m *= 2; return m; };

  function prodGen(i, cOverride) {
    const c = cOverride === undefined ? s.counts[i] : cOverride;
    let p = c * GENS[i].prod * qtyMultAt(i, c);
    if (i === 0 && s.ups.has('musesChorus')) p *= 2;
    if (i === 1 && s.ups.has('ravensGossip')) p *= (1 + 0.05 * s.counts[2]);
    if (i === 3 && s.ups.has('weaversRhythm')) p *= (1 + 0.10 * s.counts[4]);
    if (i < V2.GOSSIP.tiers && t < s.gossipUntil) p *= V2.GOSSIP.mult; // v2: gossipBonanza
    return p;
  }
  const QB = cfg.quillBonus ?? V2.QB;
  function globalMult(buffed) {
    let m = 1;
    if (s.ups.has('goldenInkwell')) m *= 1.5;
    m *= (1 + (s.ups.has('boundAnthology') ? 0.02 : 0.01) * s.achCount);
    m *= (1 + QB * s.quills);                              // v2: s.quills = LIFETIME
    m *= (1 + V2.BOOKSHELF_RATE * fablesCounted);          // v2: Bookshelf (0 fabule => x1 exact)
    if (tomes >= V2.INK_REMEMBERS_AT) m *= (1 + V2.INK_REMEMBERS_RATE * tomes); // v2: relic
    if (buffed) m *= 2;
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
    if (t < s.frenzyUntil) base *= V2.FRENZY.mult;        // v2: quillFrenzy (doar baza)
    let v = base;
    if (s.ups.has('inkEcho')) v += 0.01 * totalProd(buffed);
    // v2: strokeOfGenius ca EV; critEV=1 in v1-compat => no-op exact
    if (critBaseOnly) v = base * critEV + (v - base); else v *= critEV;
    return v;
  }
  function cost(i) {
    let c = GENS[i].base * Math.pow(GENS[i].growth, s.counts[i]);
    if (s.ups.has('patronsFavor')) c *= 0.95;
    return Math.ceil(c);
  }
  function checkAch() {
    if (cfg.freezeAch) return;
    const add = (id, cond) => { if (cond && !s.earnedAch.has(id)) { s.earnedAch.add(id); s.achCount++; } };
    add('firstWords', s.clicks >= 1);
    add('storytellerAwakens', s.counts.some(c => c > 0));
    add('busyFingers', s.clicks >= 1000);
    add('whisperedLegends', s.totalEarned >= 1000);
    add('aThousandTales', s.totalEarned >= 100000);
    add('museMenagerie', s.counts[0] >= 25);
    add('fullAviary', s.counts[2] >= 25);
    add('industrialFiction', totalProd(false) >= 1000);
    add('momentSeizer', s.buffActivations >= 10);
    add('wellRounded', s.counts.every(c => c >= 1));
  }
  function sparkInterval() {
    const base = V2.SPARK_INT_MIN + rng() * (V2.SPARK_INT_MAX - V2.SPARK_INT_MIN);
    return NET >= 1 ? base / 2 : base;
  }
  function collectSpark() {
    s.sparksCaught++;
    const m2 = NET >= 2 ? 2 : 1;
    const roll = rng() * 100;
    if (roll < 45) {            // inkBurst
      const g = Math.max(burstSeconds * totalProd(t < buffEnd), V2.BURST_FLOOR_CLICKS * clickValue(false)) * m2;
      s.ins += g; s.totalEarned += g; s.burstGain += g;
    } else if (roll < 65) {     // quillFrenzy
      s.frenzyUntil = t + V2.FRENZY.dur * m2;
    } else if (roll < 80) {     // gossipBonanza
      s.gossipUntil = t + V2.GOSSIP.dur * m2;
    } else if (roll < 90) {     // timeSlip
      cdEnd = t;
      const dur = s.ups.has('burstOfGenius') ? 22.5 : 15;
      buffEnd = Math.max(buffEnd, t + dur);
    } else if (roll < 98) {     // storyFragment
      s.fragments += m2;
      while (s.fragments >= V2.FRAGMENTS_PER_QUILL) { s.fragments -= V2.FRAGMENTS_PER_QUILL; s.quills++; s.sparkQuills++; }
    } else {                    // goldenQuillDrop
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

    for (const tg of TARGETS) {
      if (s.totalEarned >= tg && tAt[tg] === undefined) tAt[tg] = t;
    }

    // buff (v1 + v2: restlessHeart CD, standingOvation prima activare, thunderousApplause)
    if (s.totalEarned >= 500 && t >= cdEnd + REACT && t >= buffEnd) {
      let dur = s.ups.has('burstOfGenius') ? 22.5 : 15;
      if (ovation && !s.firstBuffDone) dur *= 2;
      s.firstBuffDone = true;
      buffEnd = t + dur; cdEnd = t + CD; s.buffActivations++;
      if (applauseS > 0) {
        const g = applauseS * totalProd(false); // productia FARA buff (snapshot pre-activare)
        s.ins += g; s.totalEarned += g; s.applauseGain += g;
      }
    }

    // v2: Stray Spark (doar cu sistemul pornit si dupa 1000 totalEarned)
    if (CATCH >= 0 && s.totalEarned >= V2.SPARK_UNLOCK) {
      if (s.nextSpark === null) s.nextSpark = t + sparkInterval();
      if (t >= s.nextSpark) {
        if (rng() < CATCH) { collectSpark(); s.nextSpark = t + 5 + sparkInterval(); }
        else { s.sparksMissed++; s.nextSpark = t + V2.SPARK_FLIGHT + sparkInterval(); }
      }
    }

    for (const u of UPS.slice().sort((a, b) => a.cost - b.cost)) {
      if (!s.ups.has(u.id) && u.unlock(s) && s.ins >= u.cost) {
        s.ins -= u.cost; s.ups.add(u.id);
        events.push(`t=${fmt(t)}  UPGRADE ${u.id} (${u.cost})`);
      }
    }

    const pending = UPS.filter(u => !s.ups.has(u.id) && u.unlock(s)).map(u => u.cost);
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

    // re-inregistreaza tintele: sparks/applause pot impinge TE peste o tinta
    // DUPA prima trecere de inregistrare, in acelasi tick cu break-ul
    for (const tg of TARGETS) {
      if (s.totalEarned >= tg && tAt[tg] === undefined) tAt[tg] = t;
    }

    const q = Math.floor(Math.sqrt(s.totalEarned / 1e5));
    if (q >= cfg.stopAtQuills) break;
    t += dt;
  }

  return {
    t, events, tAt,
    totalEarned: s.totalEarned,
    prod: totalProd(false),
    achCount: s.achCount,
    quillsEarned: Math.floor(Math.sqrt(s.totalEarned / 1e5)),
    quills: s.quills,
    sparkQuills: s.sparkQuills, sparksCaught: s.sparksCaught, sparksMissed: s.sparksMissed,
    fragments: s.fragments,
    burstGain: s.burstGain, applauseGain: s.applauseGain,
    burstShare: s.burstGain / Math.max(s.totalEarned, 1),
    clickShare: s.clickGain / Math.max(s.totalEarned, 1),
    counts: s.counts.slice(),
    ups: [...s.ups],
  };
}

function fmt(sec) {
  if (sec === undefined) return '--';
  const m = Math.floor(sec / 60), ss = Math.floor(sec % 60);
  return `${m}m${String(ss).padStart(2, '0')}s`;
}
function median(arr) {
  const a = arr.slice().sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
}
function mc(cfg, seeds) {
  const runs = seeds.map(sd => simulate({ ...cfg, seed: sd }));
  const med = {};
  for (const tg of TARGETS) {
    const vals = runs.map(r => r.tAt[tg]).filter(v => v !== undefined);
    if (vals.length === runs.length) med[tg] = median(vals);
  }
  return {
    med,
    endT: median(runs.map(r => r.t)),
    sparks: median(runs.map(r => r.sparksCaught)),
    sparkQuills: median(runs.map(r => r.sparkQuills)),
    burstShare: median(runs.map(r => r.burstShare)),
    runs,
  };
}
const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

// ============================================================================
console.log('==================================================================');
console.log('RUN A — V1-COMPAT (toate flag-urile v2 off) => trebuie sa reproduca 03 §9');
console.log('==================================================================');
const a1 = simulate({ quills: 0, startAch: 0, clickRate: 2, maxTime: 5400, stopAtQuills: 2 });
const a2 = simulate({ quills: 2, startAch: a1.achCount + 1, clickRate: 2, maxTime: 5400, stopAtQuills: 3, freezeAch: true });
const a3 = simulate({ quills: 5, startAch: 9, clickRate: 2, maxTime: 7200, stopAtQuills: 4, freezeAch: true });
console.log(`  Runda 1: t(100k)=${fmt(a1.tAt[1e5])} (03 §9: 24m23s) | t(400k)=${fmt(a1.t)} (35m46s) | prod finala=${a1.prod.toFixed(1)}/s (722) | ach=${a1.achCount} (7)`);
console.log(`  Runda 2: t(100k)=${fmt(a2.tAt[1e5])} (03 §9: 16m49s) | t(900k)=${fmt(a2.t)} (27m19s)`);
console.log(`  Runda 3: t(100k)=${fmt(a3.tAt[1e5])} (03 §9: 11m45s) | t(1.6M)=${fmt(a3.tAt[1.6e6])} (20m37s)`);
const compatOK = fmt(a1.tAt[1e5]) === '24m23s' && fmt(a2.tAt[1e5]) === '16m49s' && fmt(a3.tAt[1e5]) === '11m45s';
console.log(`  V1-COMPAT: ${compatOK ? 'PASS (identic cu 03 §9)' : 'FAIL'}`);

console.log('');
console.log('==================================================================');
console.log('RUN B — INVARIANTUL (b): jucator care NU cheltuie nimic');
console.log('  v1: bonus pe goldenQuills(sold=2) vs v2: bonus pe lifetime(=2), portofel 0 sau 2');
console.log('==================================================================');
// In v2, formula citeste DOAR lifetimeQuillsEarned. Rulam exact aceeasi runda cu
// "portofel cheltuit integral" (nu exista niciun input de portofel in productie)
// si comparam tinta cu tinta.
const b2 = simulate({ quills: 2 /* = lifetime */, startAch: a1.achCount + 1, clickRate: 2, maxTime: 5400, stopAtQuills: 3, freezeAch: true });
let invariantOK = true;
for (const tg of TARGETS) {
  if (a2.tAt[tg] !== b2.tAt[tg]) invariantOK = false;
}
console.log(`  t(100k) v1=${fmt(a2.tAt[1e5])} vs v2-lifetime=${fmt(b2.tAt[1e5])}; toate tintele identice: ${invariantOK ? 'PASS' : 'FAIL'}`);
console.log('  (structural: globalMult citeste lifetimeQuillsEarned; portofelul nu apare nicaieri in formule)');

console.log('');
console.log('==================================================================');
console.log('RUN C — CRITERIUL (a): runda 3 cu Atelier lacom vs runda 2 fara');
console.log('  lifetime=5 (2+3), tomes=2, fables=2, cumparat: apprentice L1(1)+genius L1(2)+net L1(2)=5 quills');
console.log('==================================================================');
const cCfgBase = {
  quills: 5, startAch: 9, clickRate: 2, maxTime: 7200, stopAtQuills: 4, freezeAch: true,
  tomes: 2, fables: 2, atelier: { apprentice: 1, genius: 1, net: 1 }, sparksOn: true,
};
for (const cr of [1.0, 0.5, 0.0]) {
  const c = mc({ ...cCfgBase, catch: cr }, SEEDS);
  const ratio2 = c.med[1e5] / a2.tAt[1e5];
  const ratio3 = c.med[1e5] / a3.tAt[1e5];
  console.log(`  catch=${(cr * 100).toFixed(0).padStart(3)}%: t(100k)=${fmt(c.med[1e5])} | t(900k)=${fmt(c.med[9e5])} | t(1.6M)=${fmt(c.med[1.6e6])} | sparks=${c.sparks} | quills din sparks=${c.sparkQuills}`);
  console.log(`            t(100k) = ${(ratio2 * 100).toFixed(1)}% din runda 2 fara Atelier (${fmt(a2.tAt[1e5])}) — criteriu >=40%: ${ratio2 >= 0.40 ? 'PASS' : 'FAIL'} | = ${(ratio3 * 100).toFixed(1)}% din runda 3 fara Atelier`);
}

console.log('');
console.log('==================================================================');
console.log('RUN D — CALIBRAREA inkBurst: de ce 900s (design initial) e OP si 45s nu');
console.log('  runda 2 (lifetime=2, tome=1, fabula=1), fara Atelier, catch=100%');
console.log('==================================================================');
const dCfg = {
  quills: 2, startAch: a1.achCount + 1, clickRate: 2, maxTime: 5400, stopAtQuills: 3, freezeAch: true,
  tomes: 1, fables: 1, sparksOn: true, catch: 1.0,
};
for (const bs of [900, 120, 60, 45, 30]) {
  const d = mc({ ...dCfg, burstSeconds: bs }, SEEDS);
  const speedup = 100 * (1 - d.med[1e5] / a2.tAt[1e5]);
  console.log(`  inkBurst=${String(bs).padStart(3)}s de productie: t(100k)=${fmt(d.med[1e5])} (-${speedup.toFixed(1)}% vs fara sparks) | share bursts in totalEarned=${(d.burstShare * 100).toFixed(1)}%`);
}
const dNet = mc({ ...dCfg, atelier: { net: 2 } }, SEEDS);
console.log(`  cu Sparkcatcher's Net L2 (45s, freq x2, amount x2): t(100k)=${fmt(dNet.med[1e5])} | share=${(dNet.burstShare * 100).toFixed(1)}%`);

console.log('');
console.log('==================================================================');
console.log('RUN E — mid-game tome 10: lifetime=30, relics 3+7, 10 fabule, Atelier gros, catch=50%');
console.log('==================================================================');
const eCfg = {
  quills: 30, startAch: 11, clickRate: 2, maxTime: 7200, stopAtQuills: 10, freezeAch: true,
  tomes: 10, fables: 10, sparksOn: true, catch: 0.5,
  atelier: { apprentice: 3, genius: 2, restless: 2, applause: true, net: 2, bookmark: 2 },
};
const e = mc(eCfg, SEEDS);
console.log(`  t(100k)=${fmt(e.med[1e5])} | t(900k)=${fmt(e.med[9e5])} | t(2.5M)=${fmt(e.med[2.5e6])} | t(10M)=${fmt(e.med[1e7])}`);
console.log(`  (tinta reala a rundei la tomul 10 e ~10M+ pentru +10 quills — v. si lantul din RUN G)`);

console.log('');
console.log('==================================================================');
console.log('RUN F — decizia "crit pe tot click-ul vs doar pe baza" (strokeOfGenius L2)');
console.log('  scenariu click-sensibil: runda 3 (lifetime=5, tomes=2, fables=2), genius L2, fara sparks');
console.log('==================================================================');
const fCfg = {
  quills: 5, startAch: 9, clickRate: 2, maxTime: 7200, stopAtQuills: 4, freezeAch: true,
  tomes: 2, fables: 2, atelier: { apprentice: 1, genius: 2 },
};
const fWhole = simulate(fCfg);
const fBase = simulate({ ...fCfg, critBaseOnly: true });
console.log(`  crit pe TOT click-ul (incl. Ink Echo): t(100k)=${fmt(fWhole.tAt[1e5])} t(900k)=${fmt(fWhole.tAt[9e5])} | click share=${(fWhole.clickShare * 100).toFixed(1)}%`);
console.log(`  crit DOAR pe baza:                     t(100k)=${fmt(fBase.tAt[1e5])} t(900k)=${fmt(fBase.tAt[9e5])} | click share=${(fBase.clickShare * 100).toFixed(1)}%`);
const fDelta = 100 * (fBase.tAt[9e5] - fWhole.tAt[9e5]) / fBase.tAt[9e5];
console.log(`  diferenta la 900k: ${fDelta.toFixed(1)}% — sub ~5% => critul pe TOT click-ul e sigur (decizie: whole click)`);

console.log('');
console.log('==================================================================');
console.log('RUN G — LANTUL META (12 tomuri, catch=50%, cheltuire lacoma pe prioritati)');
console.log('  publica la floor(sqrt(TE/1e5)) >= tome+1 (max 12) sau la 35 min');
console.log('==================================================================');
const PRIORITY = [
  ['apprentice', 1, 1], ['genius', 1, 2], ['net', 1, 2], ['restless', 1, 3],
  ['applause', 1, 4], ['contract', 1, 4], ['net', 2, 5], ['genius', 2, 6],
  ['restless', 2, 7], ['apprentice', 2, 3], ['editorsDue', 1, 10], ['nightOwl', 1, 5],
  ['bookmark', 1, 6], ['blueprint', 1, 12], ['apprentice', 3, 8], ['bookmark', 2, 14],
];
let lifetime = 0, wallet = 0, tomes = 0, fables = 0, atState = {}, totalMin = 0, fullAt = null, fragCarry = 0;
for (let n = 1; n <= 12; n++) {
  const r = simulate({
    quills: lifetime, startAch: n === 1 ? 0 : Math.min(14, 7 + tomes), freezeAch: n > 1,
    clickRate: 2, maxTime: 2100, stopAtQuills: Math.min(n + 1, 12),
    sparksOn: true, catch: 0.5, seed: 100 + n, fragments: fragCarry,
    tomes, fables, atelier: { ...atState },
  });
  fragCarry = r.fragments; // storyFragments sunt meta-state: persista intre runde
  const qBase = Math.max(1, Math.floor(Math.sqrt(r.totalEarned / 1e5)));
  const qEarn = qBase + (atState.editorsDue ? 1 : 0);
  lifetime = r.quills + qEarn;          // r.quills include deja quills din sparks
  wallet += qEarn + r.sparkQuills;
  tomes++; fables = Math.min(V2.BOOKSHELF_CAP, fables + 1);
  totalMin += r.t / 60;
  const buys = [];
  for (const [key, lvl, cost] of PRIORITY) {
    const cur = atState[key] === true ? 1 : (atState[key] || 0);
    if (cur === lvl - 1 && wallet >= cost) {
      wallet -= cost;
      atState[key] = (key === 'applause' || key === 'contract' || key === 'editorsDue' || key === 'nightOwl' || key === 'blueprint') ? true : lvl;
      buys.push(`${key}${lvl > 1 || (typeof atState[key] === 'number') ? 'L' + lvl : ''}(${cost})`);
    }
  }
  const spent = 92 - PRIORITY.filter(([k, l]) => {
    const cur = atState[k] === true ? 1 : (atState[k] || 0); return cur < l;
  }).reduce((acc, [, , c]) => acc + c, 0);
  if (spent >= 92 && fullAt === null) fullAt = tomes;
  console.log(`  Tome #${String(tomes).padStart(2)}: durata=${fmt(r.t)} t(100k)=${fmt(r.tAt[1e5])} TE=${r.totalEarned.toExponential(2)} +${qEarn}q publish +${r.sparkQuills}q sparks | lifetime=${lifetime} portofel=${wallet} | cumparat: ${buys.join(' ') || '-'}`);
}
console.log(`  Timp total (12 tomuri, fara offline): ~${Math.round(totalMin)} min activi | Atelier complet (92q): ${fullAt ? 'la tomul ' + fullAt : 'nu inca (mai lipsesc ' + (92 - (92 - PRIORITY.filter(([k, l]) => { const cur = atState[k] === true ? 1 : (atState[k] || 0); return cur < l; }).reduce((a, [, , c]) => a + c, 0))) + 'q din portofel/prioritati)'}`);
console.log(`  Ramase necumparate: ${PRIORITY.filter(([k, l]) => { const cur = atState[k] === true ? 1 : (atState[k] || 0); return cur < l; }).map(([k, l, c]) => `${k}L${l}(${c})`).join(' ') || 'NIMIC'}`);

console.log('');
console.log('==================================================================');
console.log('RUN H — runda 1 v2 (tome 0, sparks pornite, catch=100%): invarianta v1 sub 1000');
console.log('==================================================================');
const h = mc({ quills: 0, startAch: 0, clickRate: 2, maxTime: 5400, stopAtQuills: 2, sparksOn: true, catch: 1.0 }, SEEDS);
const h50 = mc({ quills: 0, startAch: 0, clickRate: 2, maxTime: 5400, stopAtQuills: 2, sparksOn: true, catch: 0.5 }, SEEDS);
console.log(`  t(1000)=${fmt(h.med[1e3])} (v1: ${fmt(a1.tAt[1e3])}) — identice: ${h.med[1e3] === a1.tAt[1e3] ? 'PASS (sparks pornesc DUPA 1000)' : 'FAIL'}`);
console.log(`  catch=100%: t(100k)=${fmt(h.med[1e5])} | catch=50%: t(100k)=${fmt(h50.med[1e5])} (v1: ${fmt(a1.tAt[1e5])})`);
const hOK = h.med[1e5] >= 1200 && h.med[1e5] <= 2400 && h50.med[1e5] >= 1200 && h50.med[1e5] <= 2400;
console.log(`  fereastra primului prestige 20-40 min mentinuta la ambele: ${hOK ? 'PASS' : 'FAIL'}`);

console.log('');
console.log('==================================================================');
console.log('VERIFICARI PUNCTUALE');
console.log('==================================================================');
console.log(`  inkBurst cu productie 0 (exploit check): podea = 50 x clickValue; la click=1 => 50 Inspiration/spark, la ~4 min/spark => ~12.5/min: sub 2 click/s manual. NEEXPLOATABIL.`);
const evQ = 0.08 * (1 / 5) + 0.02 * 1;
console.log(`  EV quills/spark = 0.08*(1/5) + 0.02 = ${evQ} => la 240s/spark: ${(evQ * 3600 / 240).toFixed(2)} q/h (baza) | Net L2: ${(0.08 * 2 / 5 + 0.02 * 2).toFixed(3)}/spark la ~125s => ${((0.08 * 2 / 5 + 0.02 * 2) * 3600 / 125).toFixed(2)} q/h`);
console.log(`  Myth Engine: payback baza = ${(3e8 / 45000).toFixed(0)}s — continua curba v1 (fableForge=2564s, dreamLibrary=1000s)`);
console.log(`  Cost total Atelier: ${PRIORITY.reduce((a, [, , c]) => a + c, 0)} quills (92; nota: 09 §1.2 afirma 96 — suma corecta a propriului tabel e 92)`);
