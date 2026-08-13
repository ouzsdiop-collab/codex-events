// ============================================================
// home.js — Tableau de bord (accueil)
// ============================================================

import { RANK_LABELS } from '../core/cards.js';

export default {
  id: 'home',
  title: 'Accueil',
  icon: '🏠',
  mount(root, ctx, nav) {
    const p = ctx.state.preflop;
    const t = ctx.state.table;
    const acc = p.total ? Math.round((p.correct / p.total) * 100) : 0;

    const mistakesHTML = p.mistakes.length
      ? p.mistakes.slice(0, 8).map(m => `
          <div class="m">
            <span class="pill">${m.hand}</span>
            <span class="tag pos">${m.pos}</span>
            <span class="hint">${m.mode}</span>
            <span style="margin-left:auto">choisi <b style="color:var(--bad)">${m.chosen}</b> · attendu <b style="color:var(--good)">${m.expected}</b></span>
          </div>`).join('')
      : '<p class="hint">Aucune fuite enregistrée pour l\'instant. Va t\'entraîner !</p>';

    root.innerHTML = `
      <h1>👋 Salut — prêt à progresser ?</h1>
      <p class="subtitle">Ton QG d'entraînement poker. Choisis un module et le bot te corrige en temps réel.</p>

      <div class="panel">
        <h2>Vue d'ensemble</h2>
        <div class="row">
          <div class="stat ${acc>=70?'good':acc>0?'':''}"><div class="v">${acc}%</div><div class="l">Précision préflop</div></div>
          <div class="stat"><div class="v">${p.total}</div><div class="l">Spots joués</div></div>
          <div class="stat"><div class="v">${t.handsPlayed}</div><div class="l">Mains vs bots</div></div>
          <div class="stat ${t.netBB>=0?'good':'bad'}"><div class="v">${t.netBB>=0?'+':''}${Math.round(t.netBB*10)/10}</div><div class="l">Net BB (table)</div></div>
        </div>
      </div>

      <div class="grid2">
        <div class="panel" style="cursor:pointer" data-go="preflop">
          <h2>🎯 Trainer ranges préflop</h2>
          <p class="hint">Drille tes décisions d'ouverture, de 3-bet/call, et de push-fold tournoi. Le cœur de la progression.</p>
          <button class="btn primary">Commencer →</button>
        </div>
        <div class="panel" style="cursor:pointer" data-go="table">
          <h2>🃏 Table vs bots</h2>
          <p class="hint">Joue du 6-max contre des bots stylés, avec analyse du coach après chaque main.</p>
          <button class="btn primary">Jouer →</button>
        </div>
        <div class="panel" style="cursor:pointer" data-go="analyzer">
          <h2>🔬 Analyseur EV</h2>
          <p class="hint">Une situation précise ? Obtiens équité, cote et EV du call, avec le verdict.</p>
          <button class="btn primary">Analyser →</button>
        </div>
        <div class="panel">
          <h2>🩹 Tes dernières fuites</h2>
          <div class="mistakes-list">${mistakesHTML}</div>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-go]').forEach(elm => {
      elm.addEventListener('click', () => nav(elm.dataset.go));
    });
  },
};
