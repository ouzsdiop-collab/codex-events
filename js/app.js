// ============================================================
// app.js — Routeur + montage des modules
// ============================================================

import { loadState, saveState, resetState } from './core/storage.js';
import { STYLES } from './core/bot.js';
import home from './modules/home.js';
import preflop from './modules/preflop.js';
import table from './modules/table.js';
import analyzer from './modules/analyzer.js';

const MODULES = [home, preflop, table, analyzer];
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
  footer.innerHTML = `
    <label class="field" style="margin-bottom:8px">Style des bots
      <select id="botStyle">
        ${Object.entries(STYLES).map(([k, v]) => `<option value="${k}" ${state.settings.botStyle === k ? 'selected' : ''}>${v.label}</option>`).join('')}
      </select>
    </label>
    <button class="btn ghost" id="reset" style="width:100%">Réinitialiser mes stats</button>
    <div style="margin-top:10px">Données stockées localement (localStorage).</div>
  `;
  bar.appendChild(footer);

  footer.querySelector('#botStyle').onchange = (e) => {
    state.settings.botStyle = e.target.value;
    saveState(state);
    if (current === 'table') nav('table');
  };
  footer.querySelector('#reset').onclick = () => {
    if (confirm('Effacer toutes tes stats et ta progression ?')) {
      resetState();
      location.reload();
    }
  };
}

buildSidebar();
const start = (location.hash || '#home').slice(1);
nav(MODULES.find(m => m.id === start) ? start : 'home');
