// ============================================================
// evaluator.js — Évaluateur de main (5 à 7 cartes)
// Retourne un score numérique comparable : plus grand = meilleure main.
// ============================================================

export const HAND_CATEGORIES = {
  8: 'Quinte flush',
  7: 'Carré',
  6: 'Full',
  5: 'Couleur',
  4: 'Quinte',
  3: 'Brelan',
  2: 'Double paire',
  1: 'Paire',
  0: 'Hauteur',
};

// Encode une catégorie + jusqu'à 5 rangs de départage sur une base 15.
function encode(category, kickers) {
  let score = category;
  for (let i = 0; i < 5; i++) {
    score = score * 15 + (kickers[i] || 0);
  }
  return score;
}

// Trouve la plus haute quinte dans un ensemble de rangs (Array de rangs uniques triés desc).
// Gère l'As bas (A-2-3-4-5). Retourne le rang haut de la quinte, ou 0.
function findStraightHigh(uniqueRanks) {
  const present = new Set(uniqueRanks);
  // As bas : traiter le 14 comme un 1 pour la roue
  const ranks = uniqueRanks.slice();
  if (present.has(14)) ranks.push(1);
  const set = new Set(ranks);
  const sorted = [...set].sort((a, b) => b - a);
  for (const high of sorted) {
    if (high < 5) break;
    let ok = true;
    for (let k = 0; k < 5; k++) {
      if (!set.has(high - k)) { ok = false; break; }
    }
    if (ok) return high;
  }
  return 0;
}

// Évalue exactement les meilleures 5 cartes parmi 5, 6 ou 7 cartes.
export function evaluate(cards) {
  // Comptage des rangs et des couleurs
  const rankCount = {};
  const suitGroups = { s: [], h: [], d: [], c: [] };
  for (const c of cards) {
    rankCount[c.rank] = (rankCount[c.rank] || 0) + 1;
    suitGroups[c.suit].push(c.rank);
  }

  const uniqueRanks = Object.keys(rankCount).map(Number).sort((a, b) => b - a);

  // Couleur / quinte flush
  let flushSuit = null;
  for (const s of ['s', 'h', 'd', 'c']) {
    if (suitGroups[s].length >= 5) flushSuit = s;
  }

  if (flushSuit) {
    const flushRanks = [...new Set(suitGroups[flushSuit])].sort((a, b) => b - a);
    const sfHigh = findStraightHigh(flushRanks);
    if (sfHigh) return encode(8, [sfHigh]);
  }

  // Groupes par nombre d'occurrences
  const byCount = { 4: [], 3: [], 2: [], 1: [] };
  for (const r of uniqueRanks) {
    byCount[rankCount[r]].push(r);
  }

  // Carré
  if (byCount[4].length) {
    const quad = byCount[4][0];
    const kicker = uniqueRanks.filter(r => r !== quad)[0] || 0;
    return encode(7, [quad, kicker]);
  }

  // Full (brelan + paire)
  if (byCount[3].length >= 2) {
    // deux brelans : meilleur brelan + paire depuis le second
    const [t1, t2] = byCount[3];
    return encode(6, [t1, t2]);
  }
  if (byCount[3].length === 1 && byCount[2].length >= 1) {
    const trip = byCount[3][0];
    const pair = byCount[2][0];
    return encode(6, [trip, pair]);
  }

  // Couleur
  if (flushSuit) {
    const flushRanks = [...new Set(suitGroups[flushSuit])].sort((a, b) => b - a).slice(0, 5);
    return encode(5, flushRanks);
  }

  // Quinte
  const straightHigh = findStraightHigh(uniqueRanks);
  if (straightHigh) return encode(4, [straightHigh]);

  // Brelan
  if (byCount[3].length === 1) {
    const trip = byCount[3][0];
    const kickers = uniqueRanks.filter(r => r !== trip).slice(0, 2);
    return encode(3, [trip, ...kickers]);
  }

  // Double paire
  if (byCount[2].length >= 2) {
    const [p1, p2] = byCount[2];
    const kicker = uniqueRanks.filter(r => r !== p1 && r !== p2)[0] || 0;
    return encode(2, [p1, p2, kicker]);
  }

  // Paire
  if (byCount[2].length === 1) {
    const pair = byCount[2][0];
    const kickers = uniqueRanks.filter(r => r !== pair).slice(0, 3);
    return encode(1, [pair, ...kickers]);
  }

  // Hauteur
  return encode(0, uniqueRanks.slice(0, 5));
}

export function categoryOf(score) {
  // Recompose la catégorie à partir du score encodé.
  let s = score;
  for (let i = 0; i < 5; i++) s = Math.floor(s / 15);
  return s;
}

export function categoryName(score) {
  return HAND_CATEGORIES[categoryOf(score)];
}
