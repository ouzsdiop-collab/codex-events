// ============================================================
// cards.js — Représentation des cartes et du paquet
// ============================================================

export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 11=J 12=Q 13=K 14=A
export const SUITS = ['s', 'h', 'd', 'c']; // spades, hearts, diamonds, clubs

export const RANK_LABELS = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export const SUIT_LABELS = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_COLORS = { s: 'noir', h: 'rouge', d: 'rouge', c: 'noir' };

// Une carte = { rank: 2..14, suit: 's'|'h'|'d'|'c' }

export function makeCard(rank, suit) {
  return { rank, suit };
}

export function cardToString(card) {
  return RANK_LABELS[card.rank] + card.suit;
}

export function cardToDisplay(card) {
  return RANK_LABELS[card.rank] + SUIT_LABELS[card.suit];
}

// Parse "As", "Kh", "Td", "9c" -> { rank, suit }
export function parseCard(str) {
  if (!str || str.length < 2) return null;
  str = str.trim();
  const suit = str.slice(-1).toLowerCase();
  let rankPart = str.slice(0, -1).toUpperCase();
  if (rankPart === '10') rankPart = 'T';
  const rank = Object.keys(RANK_LABELS).find(r => RANK_LABELS[r] === rankPart);
  if (!rank || !SUITS.includes(suit)) return null;
  return { rank: Number(rank), suit };
}

export function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function shuffle(deck) {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Retire des cartes du paquet (pour tirer autour de cartes connues)
export function removeCards(deck, cards) {
  const keys = new Set(cards.map(cardToString));
  return deck.filter(c => !keys.has(cardToString(c)));
}

export function sameCard(a, b) {
  return a.rank === b.rank && a.suit === b.suit;
}
