// Fable Idler — economy sanity simulation (Agent 2)
// Model: joc semi-activ — 2 click/s constant, buff activat cu ~20s intarziere dupa cooldown,
// cumparare greedy pe payback (cost/prod marginala), upgrade-urile au prioritate daca-s la <45s distanta.

const GENS = [
  { id: 'wanderingMuse',  base: 15,        prod: 0.1,  growth: 1.15, unlock: 10 },
  { id: 'inkSprite',      base: 100,       prod: 1,    growth: 1.15, unlock: 60 },
  { id: 'talkingRaven',   base: 1100,      prod: 8,    growth: 1.14, unlock: 600 },
  { id: 'enchantedQuill', base: 12000,     prod: 47,   growth: 1.13, unlock: 6000 },
  { id: 'storyLoom',      base: 130000,    prod: 260,  growth: 1.13, unlock: 65000 },
  { id: 'dreamLibrary',   base: 1400000,   prod: 1400, growth: 1.12, unlock: 700000 },
  { id: 'fableForge',     base: 20000000,  prod: 7800, growth: 1.12, unlock: 10000000 },
];

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

function simulate(cfg) {
  const s = {
    counts: new Array(7).fill(0),
    ins: 0, totalEarned: 0, clicks: 0,
    quills: cfg.quills || 0,
    achCount: cfg.startAch || 0,
    buffActivations: 0,
    ups: new Set(),
    earnedAch: new Set(),
  };
  const events = [];
  const crossed = new Set();
  const targets = [1e3, 1e4, 5e4, 1e5, 4e5, 9e5];
  let buffEnd = -1, cdEnd = 0, t = 0;
  const dt = 1, REACT = 20;

  const qtyMult = i => { let m = 1; for (const th of [25, 50, 100]) if (s.counts[i] >= th) m *= 2; return m; };
  const qtyMultAt = (i, c) => { let m = 1; for (const th of [25, 50, 100]) if (c >= th) m *= 2; return m; };

  function prodGen(i, cOverride) {
    const c = cOverride === undefined ? s.counts[i] : cOverride;
    let p = c * GENS[i].prod * qtyMultAt(i, c);
    if (i === 0 && s.ups.has('musesChorus')) p *= 2;
    if (i === 1 && s.ups.has('ravensGossip')) p *= (1 + 0.05 * s.counts[2]);
    if (i === 3 && s.ups.has('weaversRhythm')) p *= (1 + 0.10 * s.counts[4]);
    return p;
  }
  const QB = cfg.quillBonus;
  function globalMult(buffed) {
    let m = 1;
    if (s.ups.has('goldenInkwell')) m *= 1.5;
    m *= (1 + (s.ups.has('boundAnthology') ? 0.02 : 0.01) * s.achCount);
    m *= (1 + QB * s.quills);
    if (buffed) m *= 2;
    return m;
  }
  function totalProd(buffed) {
    let sum = 0; for (let i = 0; i < 7; i++) sum += prodGen(i);
    return sum * globalMult(buffed);
  }
  function clickValue(buffed) {
    let base = 1;
    if (s.ups.has('sharpenedNib')) base *= 2;
    if (s.ups.has('quillResonance')) base *= (1 + QB * s.quills);
    if (buffed) base *= 5;
    let v = base;
    if (s.ups.has('inkEcho')) v += 0.01 * totalProd(buffed);
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

  const firstBuy = {};
  while (t < cfg.maxTime) {
    const buffed = t < buffEnd;
    const cps = cfg.clickRate;
    const gain = totalProd(buffed) * dt + clickValue(buffed) * cps * dt;
    s.clicks += cps * dt;
    s.ins += gain; s.totalEarned += gain;
    checkAch();

    for (const tg of targets) {
      if (s.totalEarned >= tg && !crossed.has(tg)) {
        crossed.add(tg);
        events.push(`t=${fmt(t)}  totalEarned>=${tg.toExponential(0)}  (prod=${totalProd(false).toFixed(1)}/s, ach=${s.achCount})`);
      }
    }

    // buff: unlocked la 500 totalEarned, activat cu intarziere REACT dupa cooldown
    if (s.totalEarned >= 500 && t >= cdEnd + REACT && t >= buffEnd) {
      const dur = s.ups.has('burstOfGenius') ? 22.5 : 15;
      buffEnd = t + dur; cdEnd = t + 90; s.buffActivations++;
    }

    // upgrades: cumpara tot ce e unlocked si affordable (ieftin -> scump)
    for (const u of UPS.slice().sort((a, b) => a.cost - b.cost)) {
      if (!s.ups.has(u.id) && u.unlock(s) && s.ins >= u.cost) {
        s.ins -= u.cost; s.ups.add(u.id);
        events.push(`t=${fmt(t)}  UPGRADE ${u.id} (${u.cost})`);
      }
    }

    // save-for-upgrade: daca cel mai ieftin upgrade unlocked e la <45s de venit, nu cumpara generatori
    const pending = UPS.filter(u => !s.ups.has(u.id) && u.unlock(s)).map(u => u.cost);
    const cheapest = pending.length ? Math.min(...pending) : Infinity;
    const income = totalProd(false) + clickValue(false) * cfg.clickRate;
    const saving = cheapest > s.ins && cheapest <= s.ins + income * 45;

    if (!saving) {
      // generatori: greedy pe payback
      let guard = 0;
      while (guard++ < 50) {
        let best = -1, bestPay = Infinity;
        for (let i = 0; i < 7; i++) {
          if (s.totalEarned < GENS[i].unlock) continue;
          const c = cost(i);
          if (c > s.ins) continue;
          const marginal = prodGen(i, s.counts[i] + 1) - prodGen(i);
          const pay = c / Math.max(marginal, 1e-9);
          if (pay < bestPay) { bestPay = pay; best = i; }
        }
        if (best < 0) break;
        s.ins -= cost(best); s.counts[best]++;
        if (!firstBuy[GENS[best].id]) {
          firstBuy[GENS[best].id] = t;
          events.push(`t=${fmt(t)}  FIRST BUY ${GENS[best].id}`);
        }
      }
    }

    const q = Math.floor(Math.sqrt(s.totalEarned / 1e5));
    if (q >= cfg.stopAtQuills) break;
    t += dt;
  }

  return {
    t, events, firstBuy,
    totalEarned: s.totalEarned,
    prod: totalProd(false),
    achCount: s.achCount,
    quillsEarned: Math.floor(Math.sqrt(s.totalEarned / 1e5)),
    buffActivations: s.buffActivations,
    counts: s.counts.slice(),
    ups: [...s.ups],
  };
}

function fmt(sec) {
  const m = Math.floor(sec / 60), ss = Math.floor(sec % 60);
  return `${m}m${String(ss).padStart(2, '0')}s`;
}

console.log('=== RUNDA 1 (0 quills, 0 achievements initiale, 2 click/s, stop la 2 quills / 400k) ===');
const r1 = simulate({ quills: 0, startAch: 0, clickRate: 2, maxTime: 5400, stopAtQuills: 2, quillBonus: 0.02 });
r1.events.forEach(e => console.log('  ' + e));
console.log(`  SFARSIT: t=${fmt(r1.t)}, totalEarned=${Math.round(r1.totalEarned)}, quills castigabili=${r1.quillsEarned}, prod=${r1.prod.toFixed(1)}/s, ach=${r1.achCount}, buffs=${r1.buffActivations}`);
console.log(`  generatori: [${r1.counts.join(', ')}]  upgrades: ${r1.ups.join(', ')}`);

console.log('');
console.log('=== RUNDA 2 FINAL (+30%/quill, Quill Resonance 2500, 2 quills, ach din runda 1 + publishedAuthor) ===');
const r2 = simulate({ quills: 2, startAch: r1.achCount + 1, clickRate: 2, maxTime: 5400, stopAtQuills: 3, freezeAch: true, quillBonus: 0.30 });
r2.events.forEach(e => console.log('  ' + e));
console.log(`  SFARSIT: t=${fmt(r2.t)}, totalEarned=${Math.round(r2.totalEarned)}, quills castigabili=${r2.quillsEarned}, prod=${r2.prod.toFixed(1)}/s`);
console.log(`  generatori: [${r2.counts.join(', ')}]  upgrades: ${r2.ups.join(', ')}`);

console.log('');
console.log('=== RUNDA 3 (5 quills = +150%, 9 achievements) ===');
const r3 = simulate({ quills: 5, startAch: 9, clickRate: 2, maxTime: 7200, stopAtQuills: 4, freezeAch: true, quillBonus: 0.30 });
r3.events.forEach(e => console.log('  ' + e));
console.log(`  SFARSIT: t=${fmt(r3.t)}, totalEarned=${Math.round(r3.totalEarned)}, quills castigabili=${r3.quillsEarned}, prod=${r3.prod.toFixed(1)}/s`);

console.log('');
console.log('=== VERIFICARI PUNCTUALE ===');
// primul generator din click-uri pure
console.log(`  Primul Wandering Muse: cost 15, click=1, 2 click/s -> ~8s (criteriu <30s: OK)`);
// costuri la praguri de cantitate
for (const [i, th] of [[0, 25], [0, 50], [2, 25]]) {
  const c = Math.ceil(GENS[i].base * Math.pow(GENS[i].growth, th - 1));
  console.log(`  Cost unitatea #${th} din ${GENS[i].id}: ${c}`);
}
// offline: 8h la 50% cu productia de la finalul rundei 1
const off8 = r1.prod * 0.5 * 8 * 3600;
const off12 = r1.prod * 0.75 * 12 * 3600;
console.log(`  Offline 8h @50% cu prod finala runda 1 (${r1.prod.toFixed(1)}/s): ${Math.round(off8)} Inspiration`);
console.log(`  Offline 12h @75% (Lucid Dreaming): ${Math.round(off12)} Inspiration`);
// prestige breakpoints
console.log(`  Quills: 100k->1, 400k->2, 900k->3, 1.6M->4, 2.5M->5, 10M->10, 1G->100`);
