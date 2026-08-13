// ============================================================
// strategy.js — Module "Ma stratégie"
// Analyse le jeu accumulé, affiche le profil, le diagnostic et un plan
// priorisé qui se raffine au fil des sessions.
// ============================================================

import { computeProfile, generateStrategy } from '../core/analysis.js';

const STATUS_COLOR = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', na: 'var(--text-dim)' };
const TEND_LABEL = { loose: 'Trop large', tight: 'Trop serré', passive: 'Trop passif', aggressive: 'Trop agressif' };

function sparkline(history) {
  const pts = history.filter(h => h.spots > 0);
  if (pts.length < 2) return '<span class="hint">Pas encore assez d\'historique pour tracer une évolution.</span>';
  const W = 320, H = 70, pad = 6;
  const xs = pts.map((_, i) => pad + (i * (W - 2 * pad)) / (pts.length - 1));
  const ys = pts.map(h => H - pad - h.pfAcc * (H - 2 * pad));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `
    <svg width="${W}" height="${H}" style="max-width:100%">
      <line x1="${pad}" y1="${H - pad - 0.75 * (H - 2 * pad)}" x2="${W - pad}" y2="${H - pad - 0.75 * (H - 2 * pad)}" stroke="var(--line)" stroke-dasharray="3 3"/>
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2"/>
      ${xs.map((x, i) => `<circle cx="${x}" cy="${ys[i]}" r="2.5" fill="var(--accent)"/>`).join('')}
    </svg>
    <div class="hint">Précision préflop dans le temps (pointillés = objectif 75 %). Actuel : <b>${Math.round(last.pfAcc * 100)}%</b> sur ${last.spots} spots.</div>`;
}

export default {
  id: 'strategy',
  title: 'Ma stratégie',
  icon: '📈',
  mount(root, ctx, nav) {
    const profile = computeProfile(ctx.state);
    const strat = generateStrategy(profile);

    const metricsHTML = profile.metrics.map(m => `
      <div class="stat" style="border-left:3px solid ${STATUS_COLOR[m.status]}">
        <div class="v" style="color:${STATUS_COLOR[m.status]}">${m.display}</div>
        <div class="l">${m.label}</div>
        <div class="hint" style="font-size:11px;margin-top:2px">${m.note || m.ideal}</div>
      </div>`).join('');

    const tend = profile.preflop.tendencies;
    const tendTotal = Object.values(tend).reduce((s, x) => s + x, 0);
    const tendHTML = tendTotal
      ? Object.entries(tend).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k, n]) => {
          const w = Math.round((n / tendTotal) * 100);
          return `<div style="margin:6px 0">
            <div class="hint" style="display:flex;justify-content:space-between"><span>${TEND_LABEL[k]}</span><span>${n}</span></div>
            <div style="height:8px;background:var(--bg-3);border-radius:4px;overflow:hidden"><div style="width:${w}%;height:100%;background:var(--warn)"></div></div>
          </div>`;
        }).join('')
      : '<span class="hint">Aucune fuite préflop enregistrée. Va t\'entraîner pour alimenter le diagnostic.</span>';

    const chantiersHTML = strat.chantiers.map(c => `
      <div class="panel" style="margin:0 0 14px;border-left:4px solid var(--accent)">
        <div class="row" style="align-items:center;gap:10px">
          <span class="tag hero">Priorité ${c.priority}</span>
          <h2 style="margin:0;font-size:16px">${c.title}</h2>
        </div>
        <p class="hint" style="margin:8px 0 6px">${c.diagnosis}</p>
        <div class="coach"><strong>À appliquer :</strong> ${c.rule}</div>
      </div>`).join('');

    const modeAcc = profile.preflop.byMode;
    const modeHTML = ['RFI', 'VS_OPEN', 'PUSH_FOLD'].map(m => {
      const a = modeAcc[m];
      const lbl = { RFI: 'RFI', VS_OPEN: 'Face à open', PUSH_FOLD: 'Push/Fold' }[m];
      return `<div class="stat"><div class="v">${a == null ? '—' : Math.round(a * 100) + '%'}</div><div class="l">${lbl}</div></div>`;
    }).join('');

    const readinessBadge = {
      cold: '<span class="tag" style="background:rgba(210,153,34,.18);color:var(--warn)">Diagnostic à démarrer</span>',
      active: '<span class="tag" style="background:rgba(248,81,73,.18);color:var(--bad)">Chantiers en cours</span>',
      clean: '<span class="tag" style="background:rgba(63,185,80,.18);color:var(--good)">Solide — on affine</span>',
    }[strat.readiness] || '';

    root.innerHTML = `
      <h1>📈 Ma stratégie</h1>
      <p class="subtitle">Le bot analyse ton jeu au fil des sessions et fait évoluer ton plan. Plus tu joues, plus c'est précis.</p>

      <div class="panel" style="border-left:4px solid var(--gold)">
        <div class="row" style="align-items:center;gap:12px;margin-bottom:6px">
          <h2 style="margin:0">Synthèse</h2>${readinessBadge}
        </div>
        <p style="font-size:15px;margin:0">${strat.summary}</p>
        <div class="hint" style="margin-top:8px">Basé sur ${profile.sample.spots} spots préflop et ${profile.sample.hands} mains jouées.</div>
      </div>

      <h2 style="margin:22px 0 12px">🎯 Ton plan (priorisé)</h2>
      ${chantiersHTML || '<p class="hint">Aucun chantier — rejoue pour générer un plan.</p>'}

      <div class="grid2" style="margin-top:8px">
        <div class="panel" style="margin:0">
          <h2>Profil de joueur</h2>
          ${profile.style ? `<div class="tag hero" style="margin-bottom:12px">${profile.style}</div>` : '<div class="hint" style="margin-bottom:12px">Joue ~25 mains pour classer ton style.</div>'}
          <div class="row">${metricsHTML}</div>
        </div>
        <div class="panel" style="margin:0">
          <h2>Nature de tes fuites préflop</h2>
          ${tendHTML}
          <h2 style="margin-top:18px;font-size:15px">Précision par mode</h2>
          <div class="row">${modeHTML}</div>
        </div>
      </div>

      <div class="panel">
        <h2>Évolution</h2>
        ${sparkline(ctx.state.history)}
      </div>

      <div class="panel">
        <h2>Comment ça marche</h2>
        <div class="hint" style="line-height:1.7">
          Ce plan est recalculé à chaque visite à partir de tout ce que tu as joué. Traite les priorités <b>dans l'ordre</b> :
          entraîne-toi sur le chantier n°1 (Trainer préflop / Table), reviens, et regarde le plan se mettre à jour.
          On peaufinera ensemble les repères (ranges, seuils) au fur et à mesure que ton niveau monte.
          <div class="row" style="margin-top:12px">
            <button class="btn primary" id="go-preflop">→ Trainer préflop</button>
            <button class="btn" id="go-table">→ Table vs bots</button>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#go-preflop').onclick = () => nav('preflop');
    root.querySelector('#go-table').onclick = () => nav('table');
  },
};
