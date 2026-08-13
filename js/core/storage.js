// ============================================================
// storage.js — Persistance locale (localStorage) des stats et progrès
// ============================================================

const KEY = 'poker_trainer_v1';

const DEFAULT = {
  preflop: {
    total: 0,
    correct: 0,
    byMode: {},        // { RFI:{total,correct}, VS_OPEN:{...}, PUSH_FOLD:{...} }
    byPosition: {},    // { UTG:{total,correct}, ... }
    tendencies: { loose: 0, tight: 0, passive: 0, aggressive: 0 }, // diagnostic des fuites
    mistakes: [],      // dernières fuites : { hand, pos, mode, chosen, expected, tendency, ts }
  },
  table: {
    handsPlayed: 0,
    netBB: 0,
    handsDealt: 0,     // dénominateur des %
    vpipCount: 0,      // a mis de l'argent volontairement préflop
    pfrCount: 0,       // a relancé préflop
    sawShowdown: 0,
    wonShowdown: 0,
    postflopBets: 0,   // mises/relances postflop
    postflopCalls: 0,  // calls postflop
  },
  history: [],         // snapshots { ts, pfAcc, spots, hands, netBB }
  settings: {
    heroSeat: 'CO',
    botStyle: 'TAG',
    tableSize: 6,
  },
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    return deepMerge(structuredClone(DEFAULT), JSON.parse(raw));
  } catch (e) {
    console.warn('storage load error', e);
    return structuredClone(DEFAULT);
  }
}

export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('storage save error', e); }
}

export function resetState() { localStorage.removeItem(KEY); }

// Diagnostique la nature de la fuite selon (mode, choix, attendu).
export function tendencyOf(mode, chosen, expected) {
  if (chosen === expected) return null;
  if (expected === 'fold' && chosen !== 'fold') return 'loose';   // joue trop de mains
  if (chosen === 'fold' && expected !== 'fold') return 'tight';   // se couche trop
  if (expected === '3bet' && chosen === 'call') return 'passive'; // devrait attaquer
  if (expected === 'call' && chosen === '3bet') return 'aggressive';
  return null;
}

export function recordPreflop(state, { mode, hand, pos, chosen, expected, correct }) {
  const p = state.preflop;
  p.total++;
  if (correct) p.correct++;

  if (!p.byMode[mode]) p.byMode[mode] = { total: 0, correct: 0 };
  p.byMode[mode].total++;
  if (correct) p.byMode[mode].correct++;

  if (!p.byPosition[pos]) p.byPosition[pos] = { total: 0, correct: 0 };
  p.byPosition[pos].total++;
  if (correct) p.byPosition[pos].correct++;

  if (!correct) {
    const tendency = tendencyOf(mode, chosen, expected);
    if (tendency) p.tendencies[tendency] = (p.tendencies[tendency] || 0) + 1;
    p.mistakes.unshift({ hand, pos, mode, chosen, expected, tendency, ts: Date.now() });
    p.mistakes = p.mistakes.slice(0, 50);
  }

  if (p.total % 20 === 0) snapshot(state);
  saveState(state);
}

// Métriques d'une main jouée à la table.
export function recordTableMetrics(state, m) {
  const t = state.table;
  t.handsPlayed++;
  t.handsDealt++;
  t.netBB += m.net;
  if (m.vpip) t.vpipCount++;
  if (m.pfr) t.pfrCount++;
  if (m.sawShowdown) t.sawShowdown++;
  if (m.wonShowdown) t.wonShowdown++;
  t.postflopBets += m.postBets || 0;
  t.postflopCalls += m.postCalls || 0;
  if (t.handsPlayed % 20 === 0) snapshot(state);
  saveState(state);
}

function snapshot(state) {
  const p = state.preflop;
  state.history.push({
    ts: Date.now(),
    pfAcc: p.total ? p.correct / p.total : 0,
    spots: p.total,
    hands: state.table.handsPlayed,
    netBB: Math.round(state.table.netBB * 10) / 10,
  });
  state.history = state.history.slice(-40);
}

function deepMerge(base, override) {
  for (const k of Object.keys(override)) {
    if (override[k] && typeof override[k] === 'object' && !Array.isArray(override[k]) && base[k]) {
      deepMerge(base[k], override[k]);
    } else {
      base[k] = override[k];
    }
  }
  return base;
}
