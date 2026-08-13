// ============================================================
// analysis.js — Moteur d'analyse du jeu + génération de stratégie
// Transforme les stats accumulées en profil, diagnostic et plan.
// ============================================================

// Seuils "sains" (repères pédagogiques) — dépendent de la taille de table.
// En 3-max, on joue BEAUCOUP plus de mains qu'en 6-max : les bandes VPIP/PFR
// sont donc bien plus larges, sinon le diagnostic serait faux.
const BANDS_6 = {
  pfAcc:  { good: 0.75, warn: 0.60 },
  vpip:   { lo: 20, hi: 30, hardLo: 15, hardHi: 36 },
  pfr:    { lo: 15, hi: 24, hardLo: 10, hardHi: 30 },
  gap:    { warn: 8, bad: 14 },
  wtsd:   { lo: 22, hi: 32, hardLo: 19, hardHi: 36 },
  af:     { lo: 1.3, hi: 3.5, hardLo: 0.8 },
};
const BANDS_3 = {
  pfAcc:  { good: 0.75, warn: 0.60 },
  vpip:   { lo: 35, hi: 52, hardLo: 28, hardHi: 62 },
  pfr:    { lo: 28, hi: 44, hardLo: 20, hardHi: 55 },
  gap:    { warn: 10, bad: 18 },
  wtsd:   { lo: 26, hi: 40, hardLo: 22, hardHi: 46 },
  af:     { lo: 1.3, hi: 3.8, hardLo: 0.9 },
};
function bandsFor(tableSize) { return tableSize === 3 ? BANDS_3 : BANDS_6; }

function acc(o) { return o && o.total ? o.correct / o.total : null; }
function pctStatusBand(v, b) {
  if (v == null) return 'na';
  if (v >= b.lo && v <= b.hi) return 'good';
  if (v < b.hardLo || v > b.hardHi) return 'bad';
  return 'warn';
}

export function computeProfile(state) {
  const p = state.preflop;
  const t = state.table;
  const spots = p.total;
  const hands = t.handsDealt;
  const tableSize = (state.settings && state.settings.tableSize) === 3 ? 3 : 6;
  const gameType = (state.settings && state.settings.gameType) || 'tournament';
  const BANDS = bandsFor(tableSize);

  // --- Préflop ---
  const pfAcc = acc(p);
  const byMode = {};
  for (const m of ['RFI', 'VS_OPEN', 'PUSH_FOLD']) byMode[m] = acc(p.byMode[m]);
  const byPosition = Object.entries(p.byPosition)
    .map(([pos, o]) => ({ pos, acc: acc(o), n: o.total }))
    .sort((a, b) => (a.acc ?? 1) - (b.acc ?? 1));

  // Tendance dominante des fuites
  const tend = p.tendencies || {};
  const tendTotal = Object.values(tend).reduce((s, x) => s + x, 0);
  let dominantTendency = null;
  if (tendTotal >= 4) {
    const [key, n] = Object.entries(tend).sort((a, b) => b[1] - a[1])[0];
    if (n / tendTotal >= 0.35) dominantTendency = { key, n, share: n / tendTotal };
  }

  // --- Table ---
  const has = hands >= 1;
  const vpip = has ? (t.vpipCount / hands) * 100 : null;
  const pfr = has ? (t.pfrCount / hands) * 100 : null;
  const gap = (vpip != null && pfr != null) ? vpip - pfr : null;
  const wtsd = has ? (t.sawShowdown / hands) * 100 : null;
  const wsd = t.sawShowdown ? (t.wonShowdown / t.sawShowdown) * 100 : null;
  const af = t.postflopCalls > 0 ? t.postflopBets / t.postflopCalls
            : (t.postflopBets > 0 ? 99 : null);

  // Classification de style (seuils adaptés à la taille de table)
  const looseCut = tableSize === 3 ? 52 : 30;
  const tightCut = tableSize === 3 ? 35 : 22;
  let style = null;
  if (hands >= 25 && vpip != null && af != null) {
    if (vpip < tightCut && af >= 1.5) style = 'Serré-agressif (TAG) — bonne base solide';
    else if (vpip > looseCut && af >= 1.5) style = 'Large-agressif (LAG) — rentable mais volatil';
    else if (vpip < tightCut && af < 1.3) style = 'Serré-passif (nit) — tu rates de la value';
    else if (vpip > looseCut - 2 && af < 1.2) style = 'Large-passif (calling station) — la fuite la plus chère';
    else style = 'Profil équilibré';
  }

  const idealVpip = `Idéal ${BANDS.vpip.lo}–${BANDS.vpip.hi} %`;
  const idealPfr = `Idéal ${BANDS.pfr.lo}–${BANDS.pfr.hi} %`;
  const idealWtsd = `Idéal ${BANDS.wtsd.lo}–${BANDS.wtsd.hi} %`;

  const metrics = [
    metric('Précision préflop', pfAcc, v => (v * 100).toFixed(0) + '%',
      pfAcc == null ? 'na' : pfAcc >= BANDS.pfAcc.good ? 'good' : pfAcc >= BANDS.pfAcc.warn ? 'warn' : 'bad',
      'Vise > 75 %', spots, 10),
    metric('VPIP', vpip, v => v.toFixed(0) + '%', pctStatusBand(vpip, BANDS.vpip), idealVpip, hands, 15),
    metric('PFR', pfr, v => v.toFixed(0) + '%', pctStatusBand(pfr, BANDS.pfr), idealPfr, hands, 15),
    metric('Passivité (VPIP−PFR)', gap, v => v.toFixed(0) + ' pts',
      gap == null ? 'na' : gap <= BANDS.gap.warn ? 'good' : gap <= BANDS.gap.bad ? 'warn' : 'bad',
      'Plus c\'est bas, mieux c\'est', hands, 15),
    metric('Abattage (WTSD)', wtsd, v => v.toFixed(0) + '%', pctStatusBand(wtsd, BANDS.wtsd), idealWtsd, hands, 20),
    metric('Agressivité postflop (AF)', af, v => (v >= 99 ? '∞' : v.toFixed(1)),
      af == null ? 'na' : af >= BANDS.af.lo && af <= BANDS.af.hi ? 'good' : af < BANDS.af.hardLo ? 'bad' : 'warn',
      `Idéal ${BANDS.af.lo}–${BANDS.af.hi}`, t.postflopBets + t.postflopCalls, 12),
  ];

  return {
    sample: { spots, hands },
    context: { tableSize, gameType },
    preflop: { acc: pfAcc, byMode, byPosition, tendencies: tend, dominantTendency },
    table: { vpip, pfr, gap, wtsd, wsd, af },
    style, metrics, bands: BANDS,
  };
}

function metric(label, value, fmt, status, ideal, sample, minSample) {
  const enough = sample >= minSample;
  return {
    label, value,
    display: value == null || !enough ? '—' : fmt(value),
    status: enough ? status : 'na',
    ideal,
    note: enough ? null : `échantillon insuffisant (${sample}/${minSample})`,
  };
}

const TENDENCY_FIX = {
  loose: {
    title: 'Tu joues trop de mains (trop large)',
    rule: 'Avant chaque entrée dans le pot, vérifie : « est-ce dans ma range de référence à cette position ? » Coupe les mains offsuit faibles hors position.',
  },
  tight: {
    title: 'Tu te couches trop (trop serré)',
    rule: 'Ouvre et défends toute ta range de référence — surtout au bouton et en SB. Un fold de trop, c\'est de l\'EV laissée sur la table.',
  },
  passive: {
    title: 'Tu attaques trop peu (call au lieu de 3-bet)',
    rule: 'Tes mains premium et tes bluffs (Ax suited) doivent 3-bet, pas suivre. Suivre ne fait que grossir le pot en position d\'infériorité.',
  },
  aggressive: {
    title: 'Tu 3-bet / relances trop souvent',
    rule: 'Structure tes 3-bet : value + quelques bluffs choisis. Les mains marginales préfèrent souvent suivre plutôt que se faire 4-bet dessus.',
  },
};

const MODE_LABEL = { RFI: 'l\'ouverture (RFI)', VS_OPEN: 'le jeu face à un open (3-bet/call)', PUSH_FOLD: 'le push/fold tournoi' };

// Génère un plan priorisé à partir du profil.
export function generateStrategy(profile) {
  const { sample, preflop, table, style } = profile;
  const BANDS = profile.bands || bandsFor(profile.context ? profile.context.tableSize : 6);
  const chantiers = [];

  // 0) Pas assez de données
  if (sample.spots < 15 && sample.hands < 15) {
    return {
      readiness: 'cold',
      summary: 'Encore trop peu de données pour un vrai diagnostic. Joue une première session : ~20 spots préflop et ~20 mains à la table.',
      chantiers: [{
        priority: 1,
        title: 'Établir une base de référence',
        diagnosis: `Tu as ${sample.spots} spots et ${sample.hands} mains enregistrés.`,
        rule: 'Passe sur le Trainer préflop et joue quelques mains vs bots. Reviens ici : je te donnerai ta première stratégie personnalisée.',
      }],
    };
  }

  // 1) Tendance préflop dominante
  if (preflop.dominantTendency) {
    const fix = TENDENCY_FIX[preflop.dominantTendency.key];
    if (fix) chantiers.push({
      severity: 3 + preflop.dominantTendency.share,
      title: fix.title,
      diagnosis: `Sur tes fuites préflop, ${Math.round(preflop.dominantTendency.share * 100)} % sont du type « ${preflop.dominantTendency.key} ».`,
      rule: fix.rule,
    });
  }

  // 2) Mode préflop le plus faible
  const weakMode = Object.entries(preflop.byMode)
    .filter(([m, a]) => a != null)
    .sort((a, b) => a[1] - b[1])[0];
  if (weakMode && weakMode[1] != null && weakMode[1] < 0.65) {
    chantiers.push({
      severity: 2 + (0.65 - weakMode[1]),
      title: `Consolider ${MODE_LABEL[weakMode[0]]}`,
      diagnosis: `Ta précision sur ce mode n'est que de ${Math.round(weakMode[1] * 100)} %.`,
      rule: `Fais 15–20 spots ciblés sur ce mode dans le Trainer préflop, en regardant la grille de référence après chaque erreur.`,
    });
  }

  // 3) Fuites de métriques table
  if (sample.hands >= 25) {
    const { vpip, gap, wtsd, af } = table;
    if (vpip != null && vpip > BANDS.vpip.hardHi) chantiers.push(mChant(3.2, `VPIP trop élevé (${vpip.toFixed(0)} %)`, `Tu entres dans trop de pots.`, `Resserre vers ${BANDS.vpip.lo}–${Math.round((BANDS.vpip.lo + BANDS.vpip.hi) / 2)} % : élimine les mains offsuit faibles et les tirages spéculatifs hors position.`));
    else if (vpip != null && vpip < BANDS.vpip.hardLo) chantiers.push(mChant(2.4, `VPIP trop bas (${vpip.toFixed(0)} %)`, `Tu joues trop peu de mains.`, 'Élargis surtout au bouton et en SB : tu laisses des blindes non contestées.'));
    if (gap != null && gap > BANDS.gap.bad) chantiers.push(mChant(3.0, `Jeu préflop trop passif (écart ${gap.toFixed(0)} pts)`, `Tu suis bien plus souvent que tu ne relances.`, 'Quand tu décides d\'entrer dans un pot, relance plutôt que suivre. Le call passif préflop est rarement le meilleur choix.'));
    if (wtsd != null && wtsd > BANDS.wtsd.hardHi) chantiers.push(mChant(2.8, `Tu vas trop à l\'abattage (WTSD ${wtsd.toFixed(0)} %)`, `Tu payes trop de mises sur les dernières streets.`, 'Sur turn/river, couche tes mains marginales face à une grosse agression : ton bluff-catcher n\'a pas toujours la cote.'));
    else if (wtsd != null && wtsd < BANDS.wtsd.hardLo) chantiers.push(mChant(2.2, `Tu te couches trop tôt (WTSD ${wtsd.toFixed(0)} %)`, `Tu abandonnes avant l\'abattage.`, 'Paie plus souvent quand tu as la cote du pot et une main qui bat des bluffs.'));
    if (af != null && af < BANDS.af.hardLo) chantiers.push(mChant(2.9, `Postflop trop passif (AF ${af.toFixed(1)})`, `Tu checkes/suis au lieu de miser.`, 'Mise pour la value avec tes bonnes mains et semi-bluffe tes tirages, plutôt que de subir l\'action.'));
  }

  chantiers.sort((a, b) => b.severity - a.severity);
  const top = chantiers.slice(0, 3).map((c, i) => ({ priority: i + 1, ...c }));

  let summary;
  if (top.length === 0) {
    summary = style
      ? `Profil ${style}. Aucune fuite majeure détectée sur l'échantillon actuel — continue et affine.`
      : `Pas de fuite majeure détectée. Continue à jouer pour affiner le diagnostic.`;
  } else {
    summary = style
      ? `Profil actuel : ${style}. Priorité n°1 : ${top[0].title.toLowerCase()}.`
      : `Priorité n°1 : ${top[0].title.toLowerCase()}.`;
  }

  return { readiness: top.length ? 'active' : 'clean', summary, chantiers: top, style };
}

function mChant(severity, title, diagnosis, rule) {
  return { severity, title, diagnosis, rule };
}
