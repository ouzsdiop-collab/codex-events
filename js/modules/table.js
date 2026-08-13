// ============================================================
// table.js — Module "Table vs bots" (NLHE 6-max)
// Le héros joue, les bots agissent automatiquement, le coach analyse.
// ============================================================

import { createGame, startHand, legalActions, applyAction, moveButton } from '../core/game.js';
import { decideBot, STYLES, chenScore } from '../core/bot.js';
import { handNotation, parseRange } from '../core/notation.js';
import { RFI } from '../data/ranges.js';
import { equityMonteCarlo } from '../core/equity.js';
import { recordTableMetrics } from '../core/storage.js';
import { cardsHTML, cardBackHTML, el, pct } from '../ui/render.js';

// Ancrages écran (en %) pour 6 sièges — le héros est toujours en bas au centre.
const ANCHORS = [
  { left: 50, top: 92 },  // 0 héros
  { left: 12, top: 72 },  // 1
  { left: 6,  top: 30 },  // 2
  { left: 50, top: 8 },   // 3
  { left: 94, top: 30 },  // 4
  { left: 88, top: 72 },  // 5
];

const POS_NAMES_6 = { 0: 'BTN', 1: 'SB', 2: 'BB', 3: 'UTG', 4: 'HJ', 5: 'CO' };

export default {
  id: 'table',
  title: 'Table vs bots',
  icon: '🃏',
  mount(root, ctx) {
    const style = ctx.state.settings.botStyle || 'TAG';
    const HERO = 0;
    let heroStartStack = 100;
    let heroFirstPreflopAction = null; // pour l'analyse
    let heroHoleNotation = null;
    // Trackers de métriques pour la main courante
    let mVPIP = false, mPFR = false, mPostBets = 0, mPostCalls = 0;

    // Construit les joueurs (héros + 5 bots)
    const names = ['Toi', 'Bot Léo', 'Bot Max', 'Bot Ava', 'Bot Zoé', 'Bot Sam'];
    const players = names.map((name, i) => ({
      id: i, name, stack: 100, isHero: i === HERO,
      style: i === HERO ? null : style,
    }));
    let g = createGame({ players, sb: 0.5, bb: 1, buttonIndex: Math.floor(Math.random() * 6) });

    function heroPos() {
      const dist = ((HERO - g.buttonIndex) + 6) % 6;
      return POS_NAMES_6[dist];
    }

    function beginHand() {
      // relance les tapis vidés (mode entraînement, pas de bust-out)
      for (const p of g.players) if (p.stack <= 0) p.stack = 100;
      moveButtonIfNeeded();
      startHand(g);
      heroStartStack = g.players[HERO].stack + g.seats[HERO].committed;
      heroFirstPreflopAction = null;
      mVPIP = false; mPFR = false; mPostBets = 0; mPostCalls = 0;
      heroHoleNotation = handNotation(g.seats[HERO].hole[0], g.seats[HERO].hole[1]);
      render();
      driveBots();
    }

    let firstHand = true;
    function moveButtonIfNeeded() {
      if (firstHand) { firstHand = false; return; }
      moveButton(g);
    }

    // Fait jouer les bots jusqu'à ce que ce soit au héros ou fin de main.
    function driveBots() {
      if (g.handOver) return endHand();
      if (g.toAct === HERO) { render(); return; }
      const seatIdx = g.toAct;
      const styleName = g.players[seatIdx].style || 'TAG';
      render();
      setTimeout(() => {
        if (g.handOver || g.toAct !== seatIdx) return;
        const act = decideBot(g, seatIdx, styleName);
        setSeatAction(seatIdx, act);
        applyAction(g, act);
        driveBots();
      }, 650);
    }

    const seatActionLabels = {};
    function setSeatAction(idx, act) {
      const map = { fold: 'fold', check: 'check', call: 'call', bet: 'mise', raise: 'relance' };
      seatActionLabels[idx] = map[act.type] || act.type;
    }

    function heroAct(act) {
      if (g.toAct !== HERO || g.handOver) return;
      if (g.street === 'preflop') {
        if (heroFirstPreflopAction === null) heroFirstPreflopAction = act.type;
        // VPIP = argent mis volontairement (call d'une mise, mise ou relance)
        if (act.type === 'raise' || act.type === 'bet') { mVPIP = true; mPFR = true; }
        else if (act.type === 'call') mVPIP = true;
      } else {
        if (act.type === 'bet' || act.type === 'raise') mPostBets++;
        else if (act.type === 'call') mPostCalls++;
      }
      setSeatAction(HERO, act);
      applyAction(g, act);
      driveBots();
    }

    function endHand() {
      render();
      const heroEndStack = g.players[HERO].stack;
      const net = heroEndStack - heroStartStack; // en BB (bb=1)
      const sawShowdown = !!(g.result && g.result.showdown && g.result.hands.some(h => h.index === HERO));
      const wonShowdown = sawShowdown && g.result.winners.includes(HERO);
      recordTableMetrics(ctx.state, {
        net, vpip: mVPIP, pfr: mPFR, sawShowdown, wonShowdown,
        postBets: mPostBets, postCalls: mPostCalls,
      });
      renderCoach(net);
    }

    // ---------- RENDU ----------
    function render() {
      const potStr = (Math.round(g.pot * 100) / 100);
      let seatsHTML = '';
      for (let i = 0; i < 6; i++) {
        const scr = ANCHORS[((i - HERO) + 6) % 6]; // héros -> anchor 0
        const s = g.seats[i];
        const p = g.players[i];
        const isBtn = g.buttonIndex === i;
        const acting = g.toAct === i && !g.handOver;
        const folded = s && s.folded;
        const dist = ((i - g.buttonIndex) + 6) % 6;
        const posName = POS_NAMES_6[dist];
        let cardsPart = '';
        if (s && s.inHand) {
          if (i === HERO || g.handOver) cardsPart = cardsHTML(s.hole, 'xs');
          else cardsPart = `<div class="cards-row">${cardBackHTML('xs')}${cardBackHTML('xs')}</div>`;
        } else if (s && s.folded) {
          cardsPart = '<div class="hint" style="font-size:10px">couché</div>';
        }
        const betPart = s && s.streetCommitted > 0 ? `<div class="bet">mise ${Math.round(s.streetCommitted*100)/100}</div>` : '<div class="bet"></div>';
        seatsHTML += `
          <div class="seat ${acting ? 'acting' : ''} ${folded ? 'folded' : ''} ${i === HERO ? 'hero' : ''}"
               style="left:${scr.left}%;top:${scr.top}%;transform:translate(-50%,-50%)">
            ${isBtn ? '<div class="dealer-btn">D</div>' : ''}
            <div class="name">${p.name} <span class="tag pos" style="font-size:10px;padding:1px 5px">${posName}</span></div>
            <div class="stack">${Math.round(p.stack*100)/100} BB</div>
            <div style="margin:4px 0">${cardsPart}</div>
            <div class="action-lbl">${seatActionLabels[i] || ''}</div>
            ${betPart}
          </div>`;
      }

      const boardHTML = g.board.length ? cardsHTML(g.board, 'sm') : '<div class="hint">— pré-flop —</div>';

      root.innerHTML = `
        <h1>🃏 Table 6-max vs bots</h1>
        <p class="subtitle">Tu es à <span class="tag hero">${heroPos()}</span>. Bots en style <b>${STYLES[style].label}</b>. Le coach t'analyse après chaque main.</p>

        <div class="felt" style="position:relative">
          <div class="board-area">
            <div class="pot-badge">Pot : ${potStr} BB</div>
            <div>${boardHTML}</div>
          </div>
          ${seatsHTML}
        </div>

        <div id="controls"></div>
        <div class="grid2" style="margin-top:18px">
          <div class="panel" style="margin:0"><h2>Historique de la main</h2><div class="log" id="log"></div></div>
          <div class="panel" style="margin:0"><h2>Coach</h2><div id="coach"><p class="hint">Joue la main jusqu'au bout pour recevoir l'analyse.</p></div>
            <div class="row" style="margin-top:12px">
              <div class="stat"><div class="v">${ctx.state.table.handsPlayed}</div><div class="l">Mains jouées</div></div>
              <div class="stat ${ctx.state.table.netBB>=0?'good':'bad'}"><div class="v">${ctx.state.table.netBB>=0?'+':''}${Math.round(ctx.state.table.netBB*10)/10}</div><div class="l">Net BB</div></div>
            </div>
          </div>
        </div>
      `;

      // log
      const logEl = root.querySelector('#log');
      logEl.innerHTML = g.handLog.map(l => `<div>${l}</div>`).join('');
      logEl.scrollTop = logEl.scrollHeight;

      renderControls();
      if (g.handOver) renderCoach(g.players[HERO].stack - heroStartStack);
    }

    function renderControls() {
      const c = root.querySelector('#controls');
      if (g.handOver) {
        const won = g.result && g.result.winners.includes(HERO);
        c.innerHTML = `<div class="action-bar">
          <div class="feedback ${won ? 'good' : 'bad'}" style="margin:0;flex:1">
            ${resultText()}
          </div>
        </div>
        <div class="action-bar"><button class="btn primary lg" id="newhand">Nouvelle main →</button></div>`;
        c.querySelector('#newhand').onclick = () => { for (const k in seatActionLabels) delete seatActionLabels[k]; beginHand(); };
        return;
      }
      if (g.toAct !== HERO) {
        c.innerHTML = `<div class="action-bar"><span class="hint">En attente des adversaires…</span></div>`;
        return;
      }
      const acts = legalActions(g);
      const s = g.seats[HERO];
      const toCall = Math.round((g.currentBet - s.streetCommitted) * 100) / 100;
      const betAct = acts.find(a => a.type === 'bet' || a.type === 'raise');

      let html = '<div class="action-bar">';
      if (acts.find(a => a.type === 'fold')) html += `<button class="btn bad" data-act="fold">Se coucher</button>`;
      if (acts.find(a => a.type === 'check')) html += `<button class="btn" data-act="check">Check</button>`;
      if (acts.find(a => a.type === 'call')) html += `<button class="btn good" data-act="call">Suivre ${toCall}</button>`;
      html += '</div>';

      if (betAct) {
        html += `<div class="action-bar">
          <input type="range" id="sizer" min="${betAct.min}" max="${betAct.max}" step="0.5" value="${Math.min(betAct.max, Math.max(betAct.min, Math.round(g.pot)))}" style="flex:1;min-width:180px">
          <span id="sizeval" class="pill"></span>
          <button class="btn warn" data-act="betsize">${betAct.type === 'bet' ? 'Miser' : 'Relancer à'}</button>
        </div>
        <div class="action-bar">
          <button class="btn ghost" data-frac="0.5">½ pot</button>
          <button class="btn ghost" data-frac="0.75">¾ pot</button>
          <button class="btn ghost" data-frac="1">Pot</button>
          <button class="btn ghost" data-frac="max">All-in</button>
          <span class="hint">Ta main : <b>${heroHoleNotation}</b></span>
        </div>`;
      }
      c.innerHTML = html;

      c.querySelectorAll('[data-act]').forEach(b => {
        b.onclick = () => {
          const a = b.dataset.act;
          if (a === 'fold') heroAct({ type: 'fold' });
          else if (a === 'check') heroAct({ type: 'check' });
          else if (a === 'call') heroAct({ type: 'call' });
          else if (a === 'betsize') {
            const val = parseFloat(root.querySelector('#sizer').value);
            heroAct({ type: betAct.type, amount: val });
          }
        };
      });
      const sizer = c.querySelector('#sizer');
      if (sizer) {
        const sv = c.querySelector('#sizeval');
        const upd = () => sv.textContent = (Math.round(parseFloat(sizer.value) * 100) / 100) + ' BB';
        sizer.oninput = upd; upd();
        c.querySelectorAll('[data-frac]').forEach(b => {
          b.onclick = () => {
            const f = b.dataset.frac;
            let target;
            if (f === 'max') target = betAct.max;
            else target = Math.min(betAct.max, Math.max(betAct.min, g.currentBet + parseFloat(f) * (g.pot)));
            sizer.value = Math.round(target * 100) / 100; upd();
          };
        });
      }
    }

    function resultText() {
      if (!g.result) return '';
      if (!g.result.showdown) {
        const w = g.result.winners[0];
        return g.players[w].name === 'Toi'
          ? `Tu remportes le pot (${Math.round(g.pot*100)/100} BB), tout le monde s'est couché.`
          : `${g.players[w].name} remporte le pot, les autres se sont couchés.`;
      }
      const parts = g.result.hands.map(h => `${h.name}: ${h.category}`).join(' · ');
      const winNames = g.result.winners.map(i => g.players[i].name).join(', ');
      return `Abattage — ${parts}. <b>Gagnant : ${winNames}</b>.`;
    }

    // ---------- COACH ----------
    let coachDone = false;
    function renderCoach(net) {
      const coach = root.querySelector('#coach');
      if (!coach) return;
      const notes = [];

      // 1) Analyse préflop : première action du héros vs range de référence
      const pos = heroPos();
      if (pos !== 'BB' && RFI[pos]) {
        const inRange = parseRange(RFI[pos]).has(heroHoleNotation);
        const acted = heroFirstPreflopAction;
        if (acted) {
          const opened = (acted === 'bet' || acted === 'raise');
          const folded = acted === 'fold';
          if (opened && !inRange) notes.push(`⚠️ <strong>Préflop :</strong> tu as ouvert ${heroHoleNotation} depuis ${pos}, hors de la range de référence — trop large ici.`);
          else if (folded && inRange) notes.push(`⚠️ <strong>Préflop :</strong> ${heroHoleNotation} s'ouvre depuis ${pos}. Fold laisse de l'EV.`);
          else if (opened && inRange) notes.push(`✅ <strong>Préflop :</strong> ouverture correcte de ${heroHoleNotation} à ${pos}.`);
          else if (folded && !inRange) notes.push(`✅ <strong>Préflop :</strong> fold discipliné de ${heroHoleNotation} à ${pos}.`);
        }
      }

      // 2) Équité à l'abattage (si le héros y est allé)
      if (g.result && g.result.showdown) {
        const heroHand = g.result.hands.find(h => h.index === HERO);
        if (heroHand) {
          notes.push(`Tu es allé à l'abattage avec <b>${heroHand.category}</b>.`);
        }
      }

      // 3) Résultat en BB
      const sign = net >= 0 ? '+' : '';
      notes.push(`Résultat de la main : <b style="color:${net>=0?'var(--good)':'var(--bad)'}">${sign}${Math.round(net*100)/100} BB</b>.`);

      coach.innerHTML = notes.map(n => `<div class="coach">${n}</div>`).join('');
    }

    // Lancement
    beginHand();
  },
};
