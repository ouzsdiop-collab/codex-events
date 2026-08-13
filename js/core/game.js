// ============================================================
// game.js — Moteur NLHE (No Limit Hold'em) sans UI.
// Gère blindes, tours d'enchères, all-in, side pots et showdown.
// ============================================================

import { makeDeck, shuffle } from './cards.js';
import { evaluate, categoryName } from './evaluator.js';

export const STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown'];

// player: { id, name, stack, style, isHero }
export function createGame({ players, sb = 0.5, bb = 1, buttonIndex = 0 }) {
  const g = {
    players: players.map(p => ({ ...p })),
    sb, bb,
    buttonIndex,
    // état de main (rempli par startHand)
    deck: [],
    board: [],
    street: null,
    pot: 0,
    seats: [],        // état par siège pour la main courante
    currentBet: 0,
    minRaise: bb,
    toAct: null,      // index du siège devant agir
    lastAggressor: null,
    handLog: [],
    handOver: false,
    result: null,
  };
  g.log = (msg) => g.handLog.push(msg);
  return g;
}

function activeSeats(g) {
  return g.seats.filter(s => s.inHand);
}

// Sièges encore capables de miser (pas couchés, pas à tapis).
function seatsCanAct(g) {
  return g.seats.filter(s => s.inHand && !s.allIn);
}

function nextSeatIndex(g, from) {
  const n = g.seats.length;
  for (let k = 1; k <= n; k++) {
    const idx = (from + k) % n;
    const s = g.seats[idx];
    if (s.inHand && !s.allIn) return idx;
  }
  return null;
}

export function startHand(g) {
  const n = g.players.length;
  g.deck = shuffle(makeDeck());
  g.board = [];
  g.street = 'preflop';
  g.pot = 0;
  g.handOver = false;
  g.result = null;
  g.handLog = [];

  g.seats = g.players.map((p, i) => ({
    index: i,
    player: p,
    hole: [],
    inHand: p.stack > 0,
    allIn: false,
    committed: 0,     // total misé dans la main
    streetCommitted: 0, // misé sur la street courante
    folded: false,
    hasActed: false,
  }));

  // Distribution
  for (let r = 0; r < 2; r++) {
    for (const s of g.seats) if (s.inHand) s.hole.push(g.deck.pop());
  }

  // Positions blindes (heads-up : bouton = SB)
  const inHandIdx = g.seats.filter(s => s.inHand).map(s => s.index);
  const btn = g.buttonIndex;
  const order = orderedFrom(inHandIdx, btn);
  let sbSeat, bbSeat;
  if (inHandIdx.length === 2) {
    sbSeat = btn;
    bbSeat = order[1];
  } else {
    sbSeat = order[1];
    bbSeat = order[2];
  }
  postBlind(g, sbSeat, g.sb);
  postBlind(g, bbSeat, g.bb);
  g.currentBet = g.bb;
  g.minRaise = g.bb;
  g.lastAggressor = bbSeat;

  // Premier à parler préflop = après la BB
  g.toAct = nextSeatIndex(g, bbSeat);
  g.log(`Nouvelle main — bouton: ${g.players[btn].name}`);
  return g;
}

// helpers rattachés
export function attachLogger(g) {
  g.log = (msg) => g.handLog.push(msg);
}

function orderedFrom(indices, btn) {
  // indices triés circulairement en partant du bouton
  const sorted = indices.slice().sort((a, b) => a - b);
  const rotated = [];
  const start = sorted.findIndex(i => i === btn);
  for (let k = 0; k < sorted.length; k++) rotated.push(sorted[(start + k) % sorted.length]);
  return rotated;
}

function postBlind(g, idx, amount) {
  const s = g.seats[idx];
  const pay = Math.min(amount, s.player.stack);
  s.player.stack -= pay;
  s.committed += pay;
  s.streetCommitted += pay;
  g.pot += pay;
  if (s.player.stack === 0) s.allIn = true;
}

// Actions légales pour le siège devant agir.
export function legalActions(g) {
  if (g.handOver || g.toAct == null) return [];
  const s = g.seats[g.toAct];
  const toCall = g.currentBet - s.streetCommitted;
  const acts = [];
  if (toCall > 0) acts.push({ type: 'fold' });
  if (toCall === 0) acts.push({ type: 'check' });
  if (toCall > 0 && s.player.stack > 0) {
    acts.push({ type: 'call', amount: Math.min(toCall, s.player.stack) });
  }
  // Miser / relancer
  const maxTotal = s.streetCommitted + s.player.stack; // total possible ce street
  const minRaiseTo = g.currentBet + g.minRaise;
  if (s.player.stack > toCall) {
    if (g.currentBet === 0) {
      acts.push({ type: 'bet', min: Math.min(g.bb, maxTotal), max: maxTotal });
    } else {
      acts.push({ type: 'raise', min: Math.min(minRaiseTo, maxTotal), max: maxTotal });
    }
  }
  return acts;
}

// Applique une action. action: {type, amount?} ; amount = TOTAL misé sur la street (pour bet/raise).
export function applyAction(g, action) {
  const s = g.seats[g.toAct];
  const toCall = g.currentBet - s.streetCommitted;

  if (action.type === 'fold') {
    s.inHand = false;
    s.folded = true;
    g.log(`${s.player.name} se couche`);
  } else if (action.type === 'check') {
    g.log(`${s.player.name} check`);
  } else if (action.type === 'call') {
    const pay = Math.min(toCall, s.player.stack);
    commit(g, s, pay);
    g.log(`${s.player.name} suit ${round2(pay)}`);
    if (s.player.stack === 0) s.allIn = true;
  } else if (action.type === 'bet' || action.type === 'raise') {
    const target = Math.min(action.amount, s.streetCommitted + s.player.stack);
    const pay = target - s.streetCommitted;
    // Une relance rouvre l'action seulement si >= minRaise (sinon all-in "court")
    const raiseSize = target - g.currentBet;
    commit(g, s, pay);
    if (raiseSize >= g.minRaise) {
      g.minRaise = raiseSize;
      // rouvre l'action : les autres doivent re-agir
      for (const o of g.seats) if (o.inHand && !o.allIn && o !== s) o.hasActed = false;
    }
    g.currentBet = Math.max(g.currentBet, target);
    g.lastAggressor = s.index;
    if (s.player.stack === 0) s.allIn = true;
    g.log(`${s.player.name} ${action.type === 'bet' ? 'mise' : 'relance à'} ${round2(target)}`);
  }

  s.hasActed = true;
  advance(g);
  return g;
}

function commit(g, s, pay) {
  s.player.stack -= pay;
  s.committed += pay;
  s.streetCommitted += pay;
  g.pot += pay;
}

function bettingRoundComplete(g) {
  const canAct = seatsCanAct(g);
  const inHand = activeSeats(g);
  if (inHand.length <= 1) return true;
  // Tous ceux qui peuvent agir ont agi et égalisé la mise courante ?
  for (const s of canAct) {
    if (!s.hasActed) return false;
    if (s.streetCommitted !== g.currentBet) return false;
  }
  return true;
}

function advance(g) {
  // Un seul joueur restant -> fin
  if (activeSeats(g).length === 1) {
    return endHandUncontested(g);
  }
  if (!bettingRoundComplete(g)) {
    g.toAct = nextSeatIndex(g, g.toAct);
    // s'il ne reste personne pour agir (tous all-in) on avance
    if (g.toAct == null || seatsCanAct(g).length === 0) return runOutAndShowdown(g);
    return;
  }
  // Round terminé -> street suivante
  nextStreet(g);
}

function nextStreet(g) {
  // reset street
  for (const s of g.seats) { s.streetCommitted = 0; s.hasActed = false; }
  g.currentBet = 0;
  g.minRaise = g.bb;

  if (g.street === 'preflop') { dealBoard(g, 3); g.street = 'flop'; }
  else if (g.street === 'flop') { dealBoard(g, 1); g.street = 'turn'; }
  else if (g.street === 'turn') { dealBoard(g, 1); g.street = 'river'; }
  else if (g.street === 'river') { return showdown(g); }

  // Si <=1 peut encore agir, on déroule jusqu'au showdown
  if (seatsCanAct(g).length <= 1) {
    // il peut rester des mises à égaliser? non, tous all-in ou 1 actif
    if (activeSeats(g).length >= 2) return runOutAndShowdown(g);
  }
  // Premier à parler postflop = premier siège actif après le bouton
  g.toAct = firstToActPostflop(g);
  if (g.toAct == null) return runOutAndShowdown(g);
}

function firstToActPostflop(g) {
  return nextSeatIndex(g, g.buttonIndex);
}

function dealBoard(g, count) {
  g.deck.pop(); // burn
  for (let i = 0; i < count; i++) g.board.push(g.deck.pop());
  g.log(`${g.street === 'preflop' ? 'Flop' : g.street === 'flop' ? 'Turn' : 'River'} : ${g.board.map(c => c.rank + c.suit).join(' ')}`);
}

function runOutAndShowdown(g) {
  // Distribue les cartes manquantes du board sans enchères
  while (g.board.length < 5) {
    if (g.board.length === 0) dealBoard(g, 3);
    else dealBoard(g, 1);
  }
  return showdown(g);
}

function endHandUncontested(g) {
  const winner = activeSeats(g)[0];
  winner.player.stack += g.pot;
  g.log(`${winner.player.name} remporte ${round2(g.pot)} (adversaires couchés)`);
  g.handOver = true;
  g.result = { winners: [winner.index], pot: g.pot, showdown: false };
  g.toAct = null;
  return g;
}

// Calcule et distribue les side pots au showdown.
function showdown(g) {
  g.street = 'showdown';
  const contenders = activeSeats(g);
  // Évalue chaque main
  const scores = {};
  for (const s of contenders) scores[s.index] = evaluate(s.hole.concat(g.board));

  // Construction des pots par niveaux de "committed"
  const levels = [...new Set(g.seats.filter(s => s.committed > 0).map(s => s.committed))].sort((a, b) => a - b);
  let prev = 0;
  const pots = []; // { amount, eligible:[idx] }
  for (const lvl of levels) {
    const layer = lvl - prev;
    const participants = g.seats.filter(s => s.committed >= lvl);
    const amount = layer * participants.length;
    const eligible = participants.filter(s => s.inHand).map(s => s.index);
    if (amount > 0) pots.push({ amount, eligible });
    prev = lvl;
  }

  const payouts = {};
  const winnersAll = new Set();
  for (const pot of pots) {
    if (pot.eligible.length === 0) continue;
    let best = -1, winners = [];
    for (const idx of pot.eligible) {
      if (scores[idx] > best) { best = scores[idx]; winners = [idx]; }
      else if (scores[idx] === best) winners.push(idx);
    }
    const share = pot.amount / winners.length;
    for (const w of winners) {
      payouts[w] = (payouts[w] || 0) + share;
      winnersAll.add(w);
    }
  }

  for (const [idx, amt] of Object.entries(payouts)) {
    g.seats[idx].player.stack += amt;
  }

  g.handOver = true;
  g.toAct = null;
  g.result = {
    winners: [...winnersAll],
    showdown: true,
    hands: contenders.map(s => ({
      index: s.index,
      name: s.player.name,
      hole: s.hole,
      category: categoryName(scores[s.index]),
      score: scores[s.index],
    })),
    payouts,
  };
  for (const w of winnersAll) g.log(`${g.players[w].name} gagne ${round2(payouts[w])} au showdown`);
  return g;
}

function round2(x) { return Math.round(x * 100) / 100; }

// Rotation du bouton pour la main suivante (vers le prochain joueur avec du stack).
export function moveButton(g) {
  const n = g.players.length;
  for (let k = 1; k <= n; k++) {
    const idx = (g.buttonIndex + k) % n;
    if (g.players[idx].stack > 0) { g.buttonIndex = idx; break; }
  }
}
