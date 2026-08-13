// ============================================================
// render.js — Helpers de rendu HTML (cartes, grilles, etc.)
// ============================================================

import { RANK_LABELS, SUIT_LABELS, SUIT_COLORS } from '../core/cards.js';

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function cardHTML(card, size = '') {
  if (!card) return `<div class="card ${size} empty"></div>`;
  const color = SUIT_COLORS[card.suit] === 'rouge' ? 'red' : 'black';
  return `<div class="card ${size} ${color}">${RANK_LABELS[card.rank]}<span class="suit">${SUIT_LABELS[card.suit]}</span></div>`;
}

export function cardsHTML(cards, size = '') {
  return `<div class="cards-row">${cards.map(c => cardHTML(c, size)).join('')}</div>`;
}

export function cardBackHTML(size = '') {
  return `<div class="card ${size} back">·</div>`;
}

export function pct(x) { return (x * 100).toFixed(1) + '%'; }
export function bb(x) { return (Math.round(x * 100) / 100) + ' BB'; }
