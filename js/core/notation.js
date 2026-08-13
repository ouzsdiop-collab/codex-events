// ============================================================
// notation.js — Notation des 169 mains de départ + parser de ranges
// ============================================================

import { RANK_LABELS } from './cards.js';

const ORDER = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]; // A..2

// Deux cartes -> notation "AKs" / "AKo" / "77"
export function handNotation(c1, c2) {
  let hi = c1, lo = c2;
  if (c2.rank > c1.rank) { hi = c2; lo = c1; }
  const h = RANK_LABELS[hi.rank];
  const l = RANK_LABELS[lo.rank];
  if (hi.rank === lo.rank) return h + l;              // paire "77"
  const suited = hi.suit === lo.suit ? 's' : 'o';
  return h + l + suited;                               // "AKs" / "AKo"
}

// Retourne la liste des 169 mains, dans l'ordre de la grille (ligne A..2, col A..2).
// Case [i][j] : i>j -> suited (haut-droite), i<j -> offsuit, i==j -> paire.
export function gridHands() {
  const grid = [];
  for (let i = 0; i < 13; i++) {
    const row = [];
    for (let j = 0; j < 13; j++) {
      const r1 = ORDER[i], r2 = ORDER[j];
      const a = RANK_LABELS[r1], b = RANK_LABELS[r2];
      if (i === j) row.push(a + b);
      else if (i < j) row.push(a + b + 's'); // ligne au-dessus de la diagonale = suited
      else row.push(b + a + 'o');            // en-dessous = offsuit
    }
    grid.push(row);
  }
  return grid;
}

const RANK_VAL = {
  A: 14, K: 13, Q: 12, J: 11, T: 10,
  9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2,
};

function pairsFrom(minRank) {
  const out = [];
  for (const r of ORDER) if (r >= minRank) out.push(RANK_LABELS[r] + RANK_LABELS[r]);
  return out;
}

// Développe un token de range en liste de mains.
function expandToken(tok) {
  tok = tok.trim();
  if (!tok) return [];

  // Paires avec + : "77+"
  let m = tok.match(/^([2-9TJQKA])\1\+$/);
  if (m) return pairsFrom(RANK_VAL[m[1]]);

  // Paire simple : "77"
  m = tok.match(/^([2-9TJQKA])\1$/);
  if (m) return [tok];

  // Plage de paires : "22-99"
  m = tok.match(/^([2-9TJQKA])\1-([2-9TJQKA])\2$/);
  if (m) {
    const lo = Math.min(RANK_VAL[m[1]], RANK_VAL[m[2]]);
    const hi = Math.max(RANK_VAL[m[1]], RANK_VAL[m[2]]);
    const out = [];
    for (const r of ORDER) if (r >= lo && r <= hi) out.push(RANK_LABELS[r] + RANK_LABELS[r]);
    return out;
  }

  // Carte haute fixe + : "ATs+", "KJo+"
  m = tok.match(/^([2-9TJQKA])([2-9TJQKA])([so])\+$/);
  if (m) {
    const hi = RANK_VAL[m[1]], from = RANK_VAL[m[2]], suit = m[3];
    const out = [];
    for (let r = from; r < hi; r++) {
      out.push(RANK_LABELS[hi] + RANK_LABELS[r] + suit);
    }
    return out;
  }

  // Plage carte haute fixe : "A2s-A5s"
  m = tok.match(/^([2-9TJQKA])([2-9TJQKA])([so])-\1([2-9TJQKA])\3$/);
  if (m) {
    const hi = RANK_VAL[m[1]], a = RANK_VAL[m[2]], b = RANK_VAL[m[4]], suit = m[3];
    const lo = Math.min(a, b), high = Math.max(a, b);
    const out = [];
    for (let r = lo; r <= high; r++) if (r < hi) out.push(RANK_LABELS[hi] + RANK_LABELS[r] + suit);
    return out;
  }

  // Main simple : "AKs", "T9s", "98o"
  m = tok.match(/^([2-9TJQKA])([2-9TJQKA])([so])$/);
  if (m) return [tok];

  console.warn('Token de range non reconnu :', tok);
  return [];
}

// Parse une chaîne "22+, ATs+, KJo+, T9s" -> Set de mains.
export function parseRange(str) {
  const set = new Set();
  for (const tok of str.split(',')) {
    for (const hand of expandToken(tok)) set.add(hand);
  }
  return set;
}

// Nombre de combos qu'une main-notation représente (paire=6, suited=4, offsuit=12).
export function combosOf(hand) {
  if (hand.length === 2) return 6;
  return hand.endsWith('s') ? 4 : 12;
}

// % du total (1326 combos) couvert par une range (Set de notations).
export function rangePercent(rangeSet) {
  let combos = 0;
  for (const h of rangeSet) combos += combosOf(h);
  return (combos / 1326) * 100;
}
