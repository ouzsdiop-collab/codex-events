// ============================================================
// bot.js — IA des adversaires (préflop par force de main, postflop par équité)
// Styles : TAG, LAG, NIT, STATION.
// ============================================================

import { legalActions } from './game.js';
import { equityMonteCarlo } from './equity.js';
import { handNotation } from './notation.js';

export const STYLES = {
  TAG:     { label: 'TAG (serré-agressif)',  openAdj: 0,  callSlack: 0.00, aggression: 0.75, bluff: 0.30, threeBetPremium: 15 },
  LAG:     { label: 'LAG (large-agressif)',  openAdj: -2, callSlack: 0.05, aggression: 0.85, bluff: 0.45, threeBetPremium: 13 },
  NIT:     { label: 'Nit (très serré)',      openAdj: 2,  callSlack: -0.03, aggression: 0.55, bluff: 0.10, threeBetPremium: 17 },
  STATION: { label: 'Calling station',       openAdj: -1, callSlack: 0.18, aggression: 0.25, bluff: 0.08, threeBetPremium: 18 },
};

// --- Force préflop : formule de Chen ---
const CHEN_HIGH = { 14: 10, 13: 8, 12: 7, 11: 6 };
function chenValue(rank) {
  if (CHEN_HIGH[rank]) return CHEN_HIGH[rank];
  return rank / 2;
}

export function chenScore(hole) {
  const [a, b] = hole[0].rank >= hole[1].rank ? [hole[0], hole[1]] : [hole[1], hole[0]];
  let score;
  if (a.rank === b.rank) {
    score = Math.max(chenValue(a.rank) * 2, 5);
  } else {
    score = chenValue(a.rank);
    const gap = a.rank - b.rank - 1;
    if (gap === 0) score += 0;
    else if (gap === 1) score -= 1;
    else if (gap === 2) score -= 2;
    else if (gap === 3) score -= 4;
    else score -= 5;
    if (gap <= 1 && a.rank < 12) score += 1; // bonus connecteur
    if (a.suit === b.suit) score += 2;         // suited
  }
  return Math.round(score);
}

// Seuils d'ouverture (RFI) par position, en score de Chen.
const OPEN_THRESHOLD = { UTG: 10, HJ: 9, CO: 8, BTN: 6, SB: 7, BB: 6 };

function seatPosition(g, seatIndex) {
  // Approxime la position par distance au bouton.
  const n = g.seats.filter(s => s.inHand || s.folded).length;
  const btn = g.buttonIndex;
  const distFromBtn = ((seatIndex - btn) + g.seats.length) % g.seats.length;
  // distFromBtn: 0=BTN, 1=SB, 2=BB, 3=UTG, ...
  const map6 = { 0: 'BTN', 1: 'SB', 2: 'BB', 3: 'UTG', 4: 'HJ', 5: 'CO' };
  return map6[distFromBtn] || 'CO';
}

// Décision principale du bot. Retourne une action valide de legalActions(g).
export function decideBot(g, seatIndex, styleName = 'TAG') {
  const style = STYLES[styleName] || STYLES.TAG;
  const acts = legalActions(g);
  if (!acts.length) return null;
  const s = g.seats[seatIndex];
  const toCall = g.currentBet - s.streetCommitted;
  const pot = g.pot;

  if (g.street === 'preflop') {
    return decidePreflop(g, s, style, acts, toCall);
  }
  return decidePostflop(g, s, style, acts, toCall, pot);
}

function pick(acts, type) { return acts.find(a => a.type === type); }

function decidePreflop(g, s, style, acts, toCall) {
  const score = chenScore(s.hole) - style.openAdj; // style ajuste l'exigence
  const pos = seatPosition(g, s.index);
  const facingRaise = g.currentBet > g.bb + 1e-9;

  if (!facingRaise) {
    // Pot non ouvert (ou seulement blindes) : ouvrir ou fold/check
    const threshold = OPEN_THRESHOLD[pos] ?? 8;
    if (score >= threshold) {
      const raise = pick(acts, 'raise') || pick(acts, 'bet');
      if (raise) {
        const target = clamp(g.bb * 2.5 + g.pot * 0.15, raise.min, raise.max);
        return { type: raise.type, amount: round2(target) };
      }
    }
    // BB peut checker gratuitement
    if (pick(acts, 'check')) return { type: 'check' };
    // Station limpe parfois avec des mains moyennes
    if (style === STYLES.STATION && score >= 5 && pick(acts, 'call') && toCall <= g.bb) {
      return pick(acts, 'call');
    }
    return pick(acts, 'fold') || pick(acts, 'check');
  }

  // Face à une relance : 3-bet / call / fold selon la force
  const chen = chenScore(s.hole);
  if (chen >= style.threeBetPremium) {
    const raise = pick(acts, 'raise');
    if (raise) {
      const target = clamp(g.currentBet * 3, raise.min, raise.max);
      return { type: 'raise', amount: round2(target) };
    }
  }
  // Call : force correcte + cote raisonnable
  const callThreshold = 8 - style.callSlack * 20; // station call plus large
  if (chen >= callThreshold && pick(acts, 'call')) {
    // évite de payer trop cher relatif au stack
    if (toCall <= s.player.stack * 0.5 || chen >= 16) return pick(acts, 'call');
  }
  return pick(acts, 'fold') || pick(acts, 'check');
}

function decidePostflop(g, s, style, acts, toCall, pot) {
  const nOpp = g.seats.filter(o => o.inHand && o.index !== s.index).length;
  const iters = nOpp >= 3 ? 250 : 400;
  const { equity } = equityMonteCarlo(s.hole, g.board, nOpp, iters);

  const canCheck = !!pick(acts, 'check');
  const betAct = pick(acts, 'bet') || pick(acts, 'raise');
  const callAct = pick(acts, 'call');
  const foldAct = pick(acts, 'fold');

  if (canCheck) {
    // Personne n'a misé : value bet, semi-bluff, ou check
    const wantsValue = equity > 0.62;
    const wantsBluff = Math.random() < style.bluff && equity < 0.35;
    if ((wantsValue || wantsBluff) && betAct && Math.random() < style.aggression + (wantsValue ? 0.2 : 0)) {
      const size = clamp(pot * (wantsValue ? 0.66 : 0.5), betAct.min, betAct.max);
      return { type: betAct.type, amount: round2(size) };
    }
    return { type: 'check' };
  }

  // Face à une mise : cote du pot
  const potOdds = toCall / (pot + toCall);
  // Relance value avec grosse équité
  if (equity > 0.78 && betAct && Math.random() < style.aggression) {
    const size = clamp((pot + toCall) * 0.9 + toCall, betAct.min, betAct.max);
    return { type: betAct.type, amount: round2(size) };
  }
  // Call si équité > cote (+ marge de style)
  if (callAct && equity + style.callSlack >= potOdds) {
    return callAct;
  }
  // Semi-bluff relance occasionnel
  if (betAct && equity > 0.30 && Math.random() < style.bluff * 0.5) {
    const size = clamp((pot + toCall) * 0.75 + toCall, betAct.min, betAct.max);
    return { type: betAct.type, amount: round2(size) };
  }
  return foldAct || callAct || { type: 'check' };
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function round2(x) { return Math.round(x * 100) / 100; }
