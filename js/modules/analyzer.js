// ============================================================
// analyzer.js — Module "Analyseur EV"
// Entrée : main héros, board, adversaires, pot, mise à payer.
// Sortie : équité, cote du pot, EV du call, verdict + conseil.
// ============================================================

import { parseCard, cardToString } from '../core/cards.js';
import { equityMonteCarlo, potOdds, evCall } from '../core/equity.js';
import { cardsHTML, el, pct } from '../ui/render.js';

function parseCardList(str) {
  if (!str.trim()) return [];
  const tokens = str.trim().split(/[\s,]+/);
  const cards = [];
  for (const t of tokens) {
    const c = parseCard(t);
    if (!c) return { error: `Carte invalide : "${t}"` };
    cards.push(c);
  }
  return cards;
}

function dedupeCheck(cards) {
  const seen = new Set();
  for (const c of cards) {
    const k = cardToString(c);
    if (seen.has(k)) return `Carte en double : ${k}`;
    seen.add(k);
  }
  return null;
}

export default {
  id: 'analyzer',
  title: 'Analyseur EV',
  icon: '🔬',
  mount(root, ctx) {
    root.innerHTML = `
      <h1>🔬 Analyseur d'équité & EV</h1>
      <p class="subtitle">Entre une situation, le bot calcule ton équité réelle, ta cote et l'EV de suivre — et pointe la fuite.</p>

      <div class="grid2">
        <div class="panel">
          <h2>Situation</h2>
          <div class="row" style="align-items:flex-end;gap:16px">
            <label class="field" style="flex:1">Ta main (ex: As Kh)
              <input type="text" id="hero" placeholder="As Kh" value="As Ks">
            </label>
            <label class="field" style="flex:1">Board (0 à 5 cartes)
              <input type="text" id="board" placeholder="Qs Js 2h" value="Qs Js 2h">
            </label>
          </div>
          <div class="row" style="margin-top:14px">
            <label class="field">Adversaires
              <input type="number" id="opp" min="1" max="8" value="1" style="width:80px">
            </label>
            <label class="field">Pot actuel (avant ton call)
              <input type="number" id="pot" min="0" step="0.5" value="10" style="width:120px">
            </label>
            <label class="field">Mise à payer
              <input type="number" id="tocall" min="0" step="0.5" value="6" style="width:120px">
            </label>
          </div>
          <div class="row" style="margin-top:16px">
            <button class="btn primary lg" id="calc">Analyser</button>
            <span class="hint" id="parsed"></span>
          </div>
          <div id="err" style="color:var(--bad);font-size:13px;margin-top:8px"></div>
        </div>

        <div class="panel">
          <h2>Résultat</h2>
          <div id="result"><p class="hint">Renseigne la situation puis clique sur « Analyser ».</p></div>
        </div>
      </div>

      <div class="panel">
        <h2>Comment lire ça</h2>
        <div class="hint" style="line-height:1.7">
          <b>Équité</b> = ta part du pot en % si tout le monde va à l'abattage (calculée par simulation Monte Carlo, adversaires à mains aléatoires).<br>
          <b>Cote du pot</b> = l'équité minimale dont tu as besoin pour que suivre soit rentable = mise / (pot + mise).<br>
          <b>EV du call</b> = espérance de gain en jetons si tu suis. Positive → call rentable, négative → fold.<br>
          <span style="color:var(--warn)">Note : contre des adversaires à mains aléatoires, l'équité est surestimée par rapport à une vraie range de relance. Ajuste mentalement.</span>
        </div>
      </div>
    `;

    const $ = sel => root.querySelector(sel);

    function analyze() {
      $('#err').textContent = '';
      const hero = parseCardList($('#hero').value);
      const board = parseCardList($('#board').value);
      if (hero.error) return fail(hero.error);
      if (board.error) return fail(board.error);
      if (hero.length !== 2) return fail('Ta main doit contenir exactement 2 cartes.');
      if (board.length > 5) return fail('Le board contient au maximum 5 cartes.');
      const all = [...hero, ...board];
      const dup = dedupeCheck(all);
      if (dup) return fail(dup);

      const nOpp = Math.max(1, Math.min(8, parseInt($('#opp').value) || 1));
      const pot = Math.max(0, parseFloat($('#pot').value) || 0);
      const toCall = Math.max(0, parseFloat($('#tocall').value) || 0);

      $('#result').innerHTML = '<p class="hint">Calcul en cours…</p>';
      // léger délai pour laisser le navigateur peindre
      setTimeout(() => {
        const iters = nOpp >= 4 ? 15000 : 30000;
        const res = equityMonteCarlo(hero, board, nOpp, iters);
        const need = potOdds(toCall, pot);
        const ev = evCall(res.equity, pot, toCall);
        renderResult(hero, board, nOpp, res, need, ev, pot, toCall);
      }, 20);
    }

    function fail(msg) { $('#err').textContent = msg; }

    function renderResult(hero, board, nOpp, res, need, ev, pot, toCall) {
      const profitable = ev >= 0;
      const margin = res.equity - need;
      let verdict, cls, advice;
      if (toCall === 0) {
        verdict = 'Pas de mise à payer'; cls = 'good';
        advice = res.equity > 0.6
          ? `Avec ${pct(res.equity)} d'équité et rien à payer, tu peux miser pour la value.`
          : `Rien à payer : tu peux checker ou tenter un bluff selon la texture.`;
      } else if (profitable) {
        verdict = `✅ Call rentable (EV +${ev.toFixed(2)})`; cls = 'good';
        advice = `Ton équité (${pct(res.equity)}) dépasse la cote requise (${pct(need)}) de ${(margin * 100).toFixed(1)} pts. `
          + (margin > 0.15 ? `Marge confortable : envisage même de relancer pour la value.` : `Marge fine : call correct, mais attention aux cotes implicites/inversées.`);
      } else {
        verdict = `❌ Call déficitaire (EV ${ev.toFixed(2)})`; cls = 'bad';
        advice = `Il te faut ${pct(need)} d'équité pour payer, tu n'as que ${pct(res.equity)}. `
          + `Fold, sauf forte cote implicite (gros stacks derrière) ou tirage qui peut se réaliser.`;
      }

      $('#result').innerHTML = `
        <div style="margin-bottom:12px">${cardsHTML(hero, 'sm')} ${board.length ? '<span style="margin:0 8px;color:var(--text-dim)">sur</span>' + cardsHTML(board, 'sm').replace('cards-row','cards-row') : ''}</div>
        <div class="row" style="margin-bottom:8px">
          <div class="stat ${res.equity >= need ? 'good' : 'bad'}"><div class="v">${pct(res.equity)}</div><div class="l">Équité (vs ${nOpp})</div></div>
          <div class="stat"><div class="v">${toCall > 0 ? pct(need) : '—'}</div><div class="l">Cote requise</div></div>
          <div class="stat ${ev >= 0 ? 'good' : 'bad'}"><div class="v">${ev >= 0 ? '+' : ''}${ev.toFixed(2)}</div><div class="l">EV du call</div></div>
        </div>
        <div class="hint">Win ${pct(res.win)} · Split ${pct(res.tie)} · Perte ${pct(res.lose)}</div>
        <div class="feedback ${cls}" style="margin-top:14px">${verdict}
          <div class="explain">${advice}</div>
        </div>
      `;
    }

    $('#calc').onclick = analyze;
    root.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') analyze(); }));
    analyze();
  },
};
