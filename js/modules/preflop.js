// ============================================================
// preflop.js — Module "Trainer ranges préflop"
// Modes : RFI (ouvrir/fold), VS_OPEN (3bet/call/fold), PUSH_FOLD (shove/fold)
// ============================================================

import { makeDeck, shuffle } from '../core/cards.js';
import { handNotation, gridHands, parseRange } from '../core/notation.js';
import { RFI, RFI_3, RFI_3_POSITIONS, VS_OPEN, raiserBucket, pushFoldRangeString, POSITIONS } from '../data/ranges.js';
import { recordPreflop } from '../core/storage.js';
import { cardsHTML, el, pct } from '../ui/render.js';

const RFI_POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];
const HERO_VS = ['CO', 'BTN', 'SB', 'BB'];
const PF_STACKS = [8, 10, 12, 15];

let cur = null; // scénario courant

function randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function dealHero() {
  const d = shuffle(makeDeck());
  return [d[0], d[1]];
}

// ---- Génère un scénario selon le mode ----
function newScenario(mode, tableSize = 6) {
  const hole = dealHero();
  const hand = handNotation(hole[0], hole[1]);
  const rfiTable = tableSize === 3 ? RFI_3 : RFI;
  const rfiPositions = tableSize === 3 ? RFI_3_POSITIONS : RFI_POSITIONS;
  if (mode === 'RFI') {
    const pos = randChoice(rfiPositions);
    const range = parseRange(rfiTable[pos]);
    return { mode, hole, hand, pos, range, expected: range.has(hand) ? 'open' : 'fold' };
  }
  if (mode === 'VS_OPEN') {
    const heroPos = randChoice(HERO_VS);
    // relanceur : une position avant le héros
    const heroIdx = POSITIONS.indexOf(heroPos);
    const raiserPos = randChoice(POSITIONS.slice(0, heroIdx).filter(p => p !== 'BB'));
    const bucket = raiserBucket(raiserPos);
    const key = `${heroPos}_vs_${bucket}`;
    const cfg = VS_OPEN[key];
    const threeBet = parseRange(cfg.threeBet);
    const call = parseRange(cfg.call);
    let expected = 'fold';
    if (threeBet.has(hand)) expected = '3bet';
    else if (call.has(hand)) expected = 'call';
    return { mode, hole, hand, pos: heroPos, raiserPos, bucket, threeBet, call, expected };
  }
  // PUSH_FOLD
  const pfPositions = tableSize === 3 ? ['BTN', 'SB'] : RFI_POSITIONS;
  const pos = randChoice(pfPositions);
  const stack = randChoice(PF_STACKS);
  const pf = pushFoldRangeString(pos, stack, tableSize);
  const range = parseRange(pf.range);
  return { mode, hole, hand, pos, stack, palier: pf.palier, range, expected: range.has(hand) ? 'shove' : 'fold' };
}

// ---- Grille de range ----
function gridHTML(scenario) {
  const grid = gridHands();
  let html = '<div class="range-grid">';
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const h = grid[i][j];
      let cls = 'range-cell';
      if (i === j) cls += ' pair';
      if (scenario.mode === 'VS_OPEN') {
        if (scenario.threeBet.has(h)) cls += ' in-3bet';
        else if (scenario.call.has(h)) cls += ' in-call';
      } else if (scenario.range.has(h)) {
        cls += ' in';
      }
      if (h === scenario.hand) cls += ' hi';
      html += `<div class="${cls}">${h}</div>`;
    }
  }
  html += '</div>';
  return html;
}

function legendHTML(mode) {
  if (mode === 'VS_OPEN') {
    return `<div class="legend">
      <span><span class="sw" style="background:var(--red)"></span>3-bet</span>
      <span><span class="sw" style="background:var(--accent)"></span>Call</span>
      <span><span class="sw" style="background:var(--gold)"></span>Ta main</span>
    </div>`;
  }
  return `<div class="legend">
    <span><span class="sw" style="background:var(--good)"></span>Dans la range</span>
    <span><span class="sw" style="background:var(--gold)"></span>Ta main</span>
  </div>`;
}

function scenarioPrompt(s) {
  if (s.mode === 'RFI') {
    return `Pot non ouvert. Tu es à <span class="tag pos">${s.pos}</span>. Action ?`;
  }
  if (s.mode === 'VS_OPEN') {
    return `<span class="tag pos">${s.raiserPos}</span> ouvre (relance). Tu es à <span class="tag hero">${s.pos}</span>. Action ?`;
  }
  return `Tournoi — tapis effectif <b>${s.stack} BB</b>. Tu es à <span class="tag pos">${s.pos}</span>, pot non ouvert. Action ?`;
}

function actionButtons(s) {
  if (s.mode === 'RFI') {
    return [['open', 'Ouvrir (relancer)', 'good'], ['fold', 'Se coucher', 'bad']];
  }
  if (s.mode === 'VS_OPEN') {
    return [['3bet', '3-bet', 'warn'], ['call', 'Suivre', 'primary'], ['fold', 'Se coucher', 'bad']];
  }
  return [['shove', 'Tapis (shove)', 'good'], ['fold', 'Se coucher', 'bad']];
}

const ACTION_LABEL = { open: 'ouvrir', fold: 'te coucher', '3bet': '3-bet', call: 'suivre', shove: 'faire tapis' };

function explain(s, chosen, correct) {
  const inRange = s.mode === 'VS_OPEN'
    ? (s.threeBet.has(s.hand) ? '3-bet' : s.call.has(s.hand) ? 'call' : 'fold')
    : (s.expected);
  let msg = `Réponse de référence : <b>${ACTION_LABEL[s.expected] || s.expected}</b>.`;
  if (s.mode === 'PUSH_FOLD') {
    msg += ` À ${s.stack}BB, la range de shove ${s.pos} couvre environ ${pct(sizeOf(s.range))}. `;
    msg += s.expected === 'shove'
      ? `${s.hand} est assez fort pour partir à tapis ici — fold serait trop serré et laisse filer de l'EV.`
      : `${s.hand} est trop faible pour shove profitablement à cette profondeur.`;
  } else if (s.mode === 'RFI') {
    msg += s.expected === 'open'
      ? ` ${s.hand} fait partie des mains qu'on ouvre à ${s.pos}. Fold ici, c'est laisser de l'argent sur la table.`
      : ` ${s.hand} est en-dehors de la range d'ouverture à ${s.pos} : l'ouvrir devient déficitaire sur le long terme.`;
  } else {
    if (s.expected === '3bet') msg += ` ${s.hand} joue mieux en 3-bet (value ou semi-bluff) qu'en call passif.`;
    else if (s.expected === 'call') msg += ` ${s.hand} a la cote et la jouabilité pour suivre, mais pas assez pour 3-bet pour la value.`;
    else msg += ` ${s.hand} n'a ni la value pour 3-bet ni assez d'équité/jouabilité pour défendre face à ${s.raiserPos}.`;
  }
  return msg;
}

function sizeOf(rangeSet) {
  let combos = 0;
  for (const h of rangeSet) combos += (h.length === 2 ? 6 : h.endsWith('s') ? 4 : 12);
  return combos / 1326;
}

export default {
  id: 'preflop',
  title: 'Trainer préflop',
  icon: '🎯',
  mount(root, ctx) {
    const tableSize = ctx.state.settings.tableSize === 3 ? 3 : 6;
    // En 3-max, le jeu "face à un open" 6-max n'a pas de sens : on masque le mode.
    const MODES = tableSize === 3
      ? [['RFI', 'RFI (ouvrir/fold)'], ['PUSH_FOLD', 'Push/Fold (tournoi)']]
      : [['RFI', 'RFI (ouvrir/fold)'], ['VS_OPEN', 'Face à un open'], ['PUSH_FOLD', 'Push/Fold (tournoi)']];
    let mode = 'RFI';
    let answered = false;

    function statsFor(m) {
      const bm = ctx.state.preflop.byMode[m];
      if (!bm || !bm.total) return '—';
      return `${Math.round((bm.correct / bm.total) * 100)}% (${bm.total})`;
    }

    function render() {
      cur = newScenario(mode, tableSize);
      answered = false;
      root.innerHTML = `
        <h1>🎯 Trainer ranges préflop <span class="tag pos" style="vertical-align:middle">${tableSize}-max</span></h1>
        <p class="subtitle">Décide vite et juste. Le bot corrige ta décision face à une range de référence solide.</p>
        <div class="warnbox">Ranges de <b>référence pédagogiques</b> (proches GTO, simplifiées) — édite-les dans <span class="pill">js/data/ranges.js</span>. Change la taille de table dans les réglages (colonne de gauche).</div>

        <div class="row" style="margin-bottom:18px">
          <div class="mode-tabs row"></div>
        </div>

        <div class="grid2">
          <div class="panel">
            <h2>Spot</h2>
            <div id="prompt" style="font-size:15px;margin-bottom:16px">${scenarioPrompt(cur)}</div>
            <div id="hero-cards" style="margin-bottom:8px">${cardsHTML(cur.hole)}</div>
            <div class="hint">Ta main : <b>${cur.hand}</b></div>
            <div class="action-bar" id="actions"></div>
            <div id="feedback"></div>
          </div>
          <div class="panel">
            <h2>Range de référence</h2>
            <div id="grid">${gridHTML(cur)}</div>
            ${legendHTML(cur.mode)}
          </div>
        </div>

        <div class="panel">
          <h2>Ta progression</h2>
          <div class="row">
            <div class="stat"><div class="v">${statsFor('RFI')}</div><div class="l">RFI</div></div>
            <div class="stat"><div class="v">${statsFor('VS_OPEN')}</div><div class="l">Face à open</div></div>
            <div class="stat"><div class="v">${statsFor('PUSH_FOLD')}</div><div class="l">Push/Fold</div></div>
            <div class="stat"><div class="v">${ctx.state.preflop.total}</div><div class="l">Spots joués</div></div>
          </div>
        </div>
      `;

      // Tabs de mode
      const tabs = root.querySelector('.mode-tabs');
      for (const [m, lbl] of MODES) {
        const b = el(`<button class="btn ${m === mode ? 'primary' : 'ghost'}">${lbl}</button>`);
        b.onclick = () => { mode = m; render(); };
        tabs.appendChild(b);
      }

      // Boutons d'action
      const bar = root.querySelector('#actions');
      for (const [act, lbl, cls] of actionButtons(cur)) {
        const b = el(`<button class="btn ${cls}">${lbl}</button>`);
        b.onclick = () => answer(act);
        bar.appendChild(b);
      }
    }

    function answer(chosen) {
      if (answered) return;
      answered = true;
      const correct = chosen === cur.expected;
      recordPreflop(ctx.state, {
        mode: cur.mode, hand: cur.hand, pos: cur.pos,
        chosen, expected: cur.expected, correct,
      });
      const fb = root.querySelector('#feedback');
      fb.innerHTML = `
        <div class="feedback ${correct ? 'good' : 'bad'}">
          ${correct ? '✅ Correct !' : '❌ Fuite'} — tu as choisi <b>${ACTION_LABEL[chosen] || chosen}</b>.
          <div class="explain">${explain(cur, chosen, correct)}</div>
        </div>
        <div class="action-bar"><button class="btn primary lg" id="next">Spot suivant →</button></div>
      `;
      // désactive les boutons
      root.querySelectorAll('#actions .btn').forEach(b => b.disabled = true);
      root.querySelector('#next').onclick = render;
      // MAJ stats affichées
      root.querySelectorAll('.stat .v')[0].textContent = statsFor('RFI');
      root.querySelectorAll('.stat .v')[1].textContent = statsFor('VS_OPEN');
      root.querySelectorAll('.stat .v')[2].textContent = statsFor('PUSH_FOLD');
      root.querySelectorAll('.stat .v')[3].textContent = ctx.state.preflop.total;
    }

    // raccourcis clavier
    root.tabIndex = 0;
    render();
  },
};
