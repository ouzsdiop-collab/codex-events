// ============================================================
// storage.js — Persistance locale (localStorage) des stats et progrès
// ============================================================

const KEY = 'poker_trainer_v1';

const DEFAULT = {
  preflop: {
    total: 0,
    correct: 0,
    byMode: {},        // { RFI: {t,c}, VS_OPEN: {...}, PUSH_FOLD: {...} }
    mistakes: [],      // dernières fuites : { hand, pos, mode, chosen, expected, ts }
  },
  table: {
    handsPlayed: 0,
    netBB: 0,          // gain/perte net cumulé en BB
    sessions: 0,
  },
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
    const parsed = JSON.parse(raw);
    return deepMerge(structuredClone(DEFAULT), parsed);
  } catch (e) {
    console.warn('storage load error', e);
    return structuredClone(DEFAULT);
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('storage save error', e);
  }
}

export function resetState() {
  localStorage.removeItem(KEY);
}

export function recordPreflop(state, { mode, hand, pos, chosen, expected, correct }) {
  const p = state.preflop;
  p.total++;
  if (correct) p.correct++;
  if (!p.byMode[mode]) p.byMode[mode] = { total: 0, correct: 0 };
  p.byMode[mode].total++;
  if (correct) p.byMode[mode].correct++;
  if (!correct) {
    p.mistakes.unshift({ hand, pos, mode, chosen, expected, ts: Date.now() });
    p.mistakes = p.mistakes.slice(0, 50);
  }
  saveState(state);
}

export function recordTableHand(state, netBB) {
  state.table.handsPlayed++;
  state.table.netBB += netBB;
  saveState(state);
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
