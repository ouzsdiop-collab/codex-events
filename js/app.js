// ============================================================
// app.js — Routeur + montage des modules
// ============================================================

import { loadState, saveState, resetState } from './core/storage.js';
import { STYLES } from './core/bot.js';
import home from './modules/home.js';
import preflop from './modules/preflop.js';
import table from './modules/table.js';
import analyzer from './modules/analyzer.js';
import strategy from './modules/strategy.js';

const MODULES = [home, preflop, table, analyzer, strategy];
const state = loadState();
const ctx = { state, save: () => saveState(state) };

let current = null;

function nav(id) {
  const mod = MODULES.find(m => m.id === id) || home;
  current = mod.id;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.id === mod.id));
  const main = document.getElementById('main');
  main.innerHTML = '';
  mod.mount(main, ctx, nav);
  location.hash = mod.id;
}

function buildSidebar() {
  const bar = document.getElementById('sidebar');
  bar.innerHTML = `
    <div class="brand">Poker<span>Coach</span></div>
    <div class="brand-sub">Ton entraîneur perso</div>
  `;
  for (const m of MODULES) {
    const b = document.createElement('button');
    b.className = 'nav-btn';
    b.dataset.id = m.id;
    b.innerHTML = `<span class="ico">${m.icon}</span> ${m.title}`;
    b.onclick = () => nav(m.id);
    bar.appendChild(b);
  }

  const footer = document.createElement('div');
  footer.className = 'sidebar-footer';
  const s = state.settings;
  const opt = (v, cur, lbl) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${lbl}</option>`;
  footer.innerHTML = `
    <div style="font-weight:700;color:var(--text);margin-bottom:6px">⚙️ Format de jeu</div>
    <label class="field" style="margin-bottom:8px">Table
      <select id="tableSize">
        ${opt(6, s.tableSize, '6-max')}${opt(3, s.tableSize, '3-max')}
      </select>
    </label>
    <label class="field" style="margin-bottom:8px">Tapis de départ
      <select id="startStackBB">
        ${[15, 25, 40, 60, 100].map(v => opt(v, s.startStackBB, v + ' BB')).join('')}
      </select>
    </label>
    <label class="field" style="margin-bottom:8px">Antes
      <select id="ante">
        ${opt(0, s.ante, 'Aucune')}${opt(0.125, s.ante, '1/8 BB')}${opt(0.25, s.ante, '1/4 BB')}
      </select>
    </label>
    <label class="field" style="margin-bottom:8px">Style des bots
      <select id="botStyle">
        ${Object.entries(STYLES).map(([k, v]) => opt(k, state.settings.botStyle, v.label)).join('')}
      </select>
    </label>
    <button class="btn ghost" id="reset" style="width:100%">Réinitialiser mes stats</button>
    <div style="margin-top:10px">Tournoi à élimination · données stockées localement.</div>
  `;
  bar.appendChild(footer);

  const applySetting = (key, val, isNum) => {
    state.settings[key] = isNum ? Number(val) : val;
    saveState(state);
    // Rerender le module courant pour prendre en compte le nouveau format
    if (['table', 'preflop', 'strategy', 'home'].includes(current)) nav(current);
  };
  footer.querySelector('#tableSize').onchange = e => applySetting('tableSize', e.target.value, true);
  footer.querySelector('#startStackBB').onchange = e => applySetting('startStackBB', e.target.value, true);
  footer.querySelector('#ante').onchange = e => applySetting('ante', e.target.value, true);
  footer.querySelector('#botStyle').onchange = e => applySetting('botStyle', e.target.value, false);
  footer.querySelector('#reset').onclick = () => {
    if (confirm('Effacer toutes tes stats et ta progression ?')) { resetState(); location.reload(); }
  };
}

buildSidebar();
const start = (location.hash || '#home').slice(1);
nav(MODULES.find(m => m.id === start) ? start : 'home');
