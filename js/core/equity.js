// ============================================================
// equity.js — Calcul d'équité (Monte Carlo) et outils EV
// ============================================================

import { makeDeck, removeCards, cardToString } from './cards.js';
import { evaluate } from './evaluator.js';

// Tire k cartes au hasard depuis un paquet (Fisher-Yates partiel).
function drawRandom(deck, k, excludeSet) {
  const pool = deck.filter(c => !excludeSet.has(cardToString(c)));
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, k);
}

/**
 * Équité d'une main héros contre 1..N adversaires aléatoires (mains inconnues),
 * ou contre des mains adverses précises.
 *
 * @param {Array} hero        - 2 cartes du héros
 * @param {Array} board       - 0 à 5 cartes communes connues
 * @param {number} nOpponents - nombre d'adversaires à mains aléatoires
 * @param {number} iterations - nombre de simulations
 * @param {Array<Array>} villains - (optionnel) mains adverses précises
 * @returns { win, tie, lose, equity }  (fractions 0..1)
 */
export function equityMonteCarlo(hero, board = [], nOpponents = 1, iterations = 20000, villains = []) {
  const deck = makeDeck();
  const known = [...hero, ...board];
  for (const v of villains) known.push(...v);
  const knownSet = new Set(known.map(cardToString));

  const totalOpponents = nOpponents + villains.length;
  let win = 0, tie = 0, lose = 0;

  for (let it = 0; it < iterations; it++) {
    const need = (5 - board.length) + nOpponents * 2;
    const drawn = drawRandom(deck, need, knownSet);

    let di = 0;
    const fullBoard = board.concat(drawn.slice(0, 5 - board.length));
    di = 5 - board.length;

    const heroScore = evaluate(hero.concat(fullBoard));

    let heroBeatsAll = true;
    let tied = false;

    // Adversaires précis
    for (const v of villains) {
      const vScore = evaluate(v.concat(fullBoard));
      if (vScore > heroScore) { heroBeatsAll = false; break; }
      if (vScore === heroScore) tied = true;
    }
    // Adversaires aléatoires
    if (heroBeatsAll) {
      for (let o = 0; o < nOpponents; o++) {
        const vHand = drawn.slice(di, di + 2); di += 2;
        const vScore = evaluate(vHand.concat(fullBoard));
        if (vScore > heroScore) { heroBeatsAll = false; break; }
        if (vScore === heroScore) tied = true;
      }
    }

    if (!heroBeatsAll) lose++;
    else if (tied) tie++;
    else win++;
  }

  const n = win + tie + lose;
  return {
    win: win / n,
    tie: tie / n,
    lose: lose / n,
    // Équité partage les splits équitablement (approx : /2 pour un split, correct en heads-up)
    equity: (win + tie / (totalOpponents + 1)) / n,
  };
}

// Cote du pot : mise à payer / (pot + mise à payer). Retourne fraction 0..1.
export function potOdds(toCall, potBeforeCall) {
  if (toCall <= 0) return 0;
  return toCall / (potBeforeCall + toCall);
}

// EV d'un call simple : gagner (pot) * equity - (toCall) * (1 - equity)
// pot = pot AVANT notre call (hors notre mise à payer)
export function evCall(equity, pot, toCall) {
  return equity * pot - (1 - equity) * toCall;
}

// Cote implicite requise : combien il faut espérer gagner en plus pour rendre le call profitable
export function requiredEquity(toCall, potBeforeCall) {
  return potOdds(toCall, potBeforeCall);
}
