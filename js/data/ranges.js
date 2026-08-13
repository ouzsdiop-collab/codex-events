// ============================================================
// ranges.js — Charts de référence préflop (6-max)
//
// AVERTISSEMENT : ce sont des ranges de RÉFÉRENCE pédagogiques,
// proches d'un jeu solide/GTO mais volontairement simplifiées.
// Elles servent à corriger les grosses fuites, pas à te faire jouer
// une stratégie mixte parfaite. Tu peux les éditer ici librement.
// ============================================================

// Positions 6-max, de la plus early à la plus late.
export const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

// ---------- RFI : ouvrir ou fold (pot non ouvert) ----------
// Chaîne de range par position d'ouverture.
export const RFI = {
  UTG: '22+, A2s+, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, 65s, ATo+, KJo+, QJo',
  HJ:  '22+, A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, 65s, 54s, ATo+, KJo+, QJo',
  CO:  '22+, A2s+, K5s+, Q7s+, J7s+, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, A7o+, K9o+, Q9o+, J9o+, T9o',
  BTN: '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 95s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K7o+, Q8o+, J8o+, T8o+, 98o, 87o',
  SB:  '22+, A2s+, K5s+, Q6s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A4o+, K9o+, Q9o+, J9o+, T9o',
  // BB n'a pas de RFI (déjà dans le pot) — géré en "vs open".
};

// ---------- Face à une seule relance (single raise) ----------
// On simplifie le monde en 2 catégories de relanceur :
//   'early' = UTG / HJ (range serrée)  |  'late' = CO / BTN / SB (range large)
// Pour chaque position du héros, on donne quoi 3-bet (value+bluff) et quoi caller.
// Tout le reste = fold. Le héros ne peut réagir que depuis une position APRÈS le relanceur.

export const VS_OPEN = {
  // Héros au CO face à un open early
  CO_vs_early:  { threeBet: 'QQ+, AKs, AKo, A5s',                       call: 'TT-99, AQs, AJs, KQs' },
  CO_vs_late:   { threeBet: 'JJ+, AQs+, AKo, A5s-A4s, KJs+',            call: 'TT-77, AJs-ATs, KTs+, QJs, JTs, AQo' },

  // Héros au BTN
  BTN_vs_early: { threeBet: 'QQ+, AKs, AKo, A5s',                       call: 'JJ-99, AQs, AJs, KQs, QJs, JTs' },
  BTN_vs_late:  { threeBet: 'JJ+, AQs+, AKo, A5s-A4s, KJs+, QJs',       call: 'TT-66, AJs-A9s, KTs+, QTs+, J9s+, T9s, 98s, AQo, AJo, KQo' },

  // Héros en SB (OOP — on 3-bet plus, on flat moins)
  SB_vs_early:  { threeBet: 'TT+, AQs+, AKo, A5s-A4s',                  call: '99-88, AJs, KQs' },
  SB_vs_late:   { threeBet: '99+, AJs+, AQo+, A5s-A4s, KJs+, QJs',      call: '77-55, ATs-A9s, KTs, QTs, JTs' },

  // Héros en BB (défense large, cote du pot favorable)
  BB_vs_early:  { threeBet: 'JJ+, AKs, AKo, A5s',                       call: 'TT-22, A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, 65s, AJo+, KQo' },
  BB_vs_late:   { threeBet: 'TT+, AQs+, AKo, A5s-A3s, KJs+',            call: '99-22, A2s+, K5s+, Q8s+, J8s+, T8s+, 96s+, 86s+, 75s+, 65s, 54s, A8o+, KTo+, QTo+, JTo' },
};

// Regroupe un relanceur -> catégorie
export function raiserBucket(pos) {
  return (pos === 'UTG' || pos === 'HJ') ? 'early' : 'late';
}

// ---------- RFI 3-max (tables courtes) ----------
// En 3-max il n'y a que BTN / SB / BB. Les ranges d'ouverture sont bien
// plus larges qu'en 6-max. (Références pédagogiques, éditables.)
export const RFI_3 = {
  BTN: '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o+, K6o+, Q8o+, J8o+, T8o+, 98o, 87o, 76o',
  SB:  '22+, A2s+, K4s+, Q6s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o',
};
export const RFI_3_POSITIONS = ['BTN', 'SB'];

// ---------- Push / Fold 3-max ----------
// Shove non ouvert depuis BTN ou SB, tapis effectif court. Plus large qu'en 6-max.
export const PUSH_FOLD_3 = {
  BTN: {
    8:  '22+, A2s+, A2o+, K2s+, K5o+, Q5s+, Q8o+, J7s+, J9o+, T7s+, T9o, 96s+, 86s+, 75s+, 65s, 54s',
    10: '22+, A2s+, A2o+, K2s+, K7o+, Q7s+, Q9o+, J8s+, J9o+, T8s+, 98s, 97s+, 87s',
    12: '22+, A2s+, A4o+, K5s+, K8o+, Q8s+, QTo+, J8s+, T8s+, 98s',
    15: '22+, A2s+, A7o+, K8s+, KTo+, Q9s+, QJo, J9s+, T9s',
  },
  SB: {
    8:  '22+, A2s+, A2o+, K2s+, K4o+, Q4s+, Q7o+, J6s+, J8o+, T6s+, T9o, 95s+, 85s+, 74s+, 64s+, 54s',
    10: '22+, A2s+, A2o+, K2s+, K6o+, Q6s+, Q8o+, J7s+, J9o+, T7s+, 97s+, 86s+, 76s, 65s',
    12: '22+, A2s+, A3o+, K4s+, K8o+, Q7s+, Q9o+, J8s+, T8s+, 98s',
    15: '22+, A2s+, A6o+, K7s+, K9o+, Q8s+, QTo+, J9s+, T9s',
  },
};

// ---------- Push / Fold tournoi (tapis court, pot non ouvert) ----------
// Range de tapis (shove) par position et par tapis effectif en BB.
// Basé sur des charts Nash simplifiées. Sous ~ ces tapis, on shove ou on fold.
export const PUSH_FOLD = {
  UTG: {
    8:  '22+, A7s+, A9o+, KTs+, KQo, QJs',
    10: '22+, A8s+, ATo+, KJs+, KQo',
    12: '33+, A9s+, AJo+, KQs',
    15: '55+, ATs+, AQo+, KQs',
  },
  HJ: {
    8:  '22+, A5s+, A8o+, K9s+, KJo+, QTs+, JTs',
    10: '22+, A7s+, A9o+, KTs+, KQo, QJs',
    12: '22+, A8s+, ATo+, KJs+',
    15: '44+, A9s+, AJo+, KQs',
  },
  CO: {
    8:  '22+, A2s+, A5o+, K7s+, K9o+, Q9s+, QTo+, J9s+, T9s',
    10: '22+, A2s+, A7o+, K9s+, KJo+, QTs+, JTs',
    12: '22+, A4s+, A8o+, KTs+, KQo, QJs',
    15: '33+, A7s+, ATo+, KJs+, KQo',
  },
  BTN: {
    8:  '22+, A2s+, A2o+, K2s+, K7o+, Q6s+, Q9o+, J7s+, J9o+, T7s+, 97s+, 86s+, 76s',
    10: '22+, A2s+, A4o+, K5s+, K9o+, Q8s+, QTo+, J8s+, T8s+, 98s',
    12: '22+, A2s+, A7o+, K8s+, KTo+, Q9s+, QJo, J9s+, T9s',
    15: '22+, A3s+, A9o+, KTs+, KJo+, QTs+, JTs',
  },
  SB: {
    8:  '22+, A2s+, A2o+, K2s+, K5o+, Q4s+, Q8o+, J6s+, J9o+, T6s+, T9o, 96s+, 86s+, 75s+, 65s',
    10: '22+, A2s+, A3o+, K3s+, K8o+, Q6s+, Q9o+, J7s+, J9o+, T7s+, 97s+, 86s+, 76s',
    12: '22+, A2s+, A5o+, K6s+, K9o+, Q8s+, QTo+, J8s+, T8s+, 98s',
    15: '22+, A2s+, A8o+, K9s+, KJo+, QTs+, JTs',
  },
};

// Trouve le tapis "seuil" applicable pour une profondeur donnée (arrondi au palier <=).
export function pushFoldRangeString(pos, stackBB, tableSize = 6) {
  const table = (tableSize === 3 ? PUSH_FOLD_3 : PUSH_FOLD)[pos];
  if (!table) return null;
  const paliers = Object.keys(table).map(Number).sort((a, b) => a - b);
  let chosen = paliers[0];
  for (const p of paliers) if (stackBB >= p) chosen = p;
  // Au-delà du plus grand palier connu, on ne shove plus large que ce palier.
  return { palier: chosen, range: table[chosen] };
}
