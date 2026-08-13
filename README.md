# 🃏 PokerCoach — entraîneur perso NLHE

Une app web **pour m'entraîner seul** au Texas Hold'em No Limit et **monter de niveau** — pas un jeu pour débutant, mais un coach qui corrige mes décisions face à des ranges de référence proches du jeu optimal.

Aucune dépendance, aucun build : c'est du HTML/CSS/JavaScript pur. Tes stats sont stockées **localement** dans le navigateur (localStorage).

## ▶️ Lancer l'app

Comme l'app utilise des modules ES, il faut la servir via un petit serveur local (l'ouvrir en `file://` ne marchera pas) :

```bash
# depuis la racine du projet
python3 -m http.server 8099
# puis ouvre http://localhost:8099 dans ton navigateur
```

(N'importe quel serveur statique fait l'affaire : `npx serve`, l'extension Live Server de VS Code, etc.)

## 🧩 Les 3 modules

### 🎯 Trainer ranges préflop
Le cœur de la progression. Le bot te pose des spots aléatoires et corrige ta décision face à une range de référence :
- **RFI** — ouvrir ou se coucher, par position (UTG → SB).
- **Face à un open** — 3-bet / suivre / se coucher.
- **Push/Fold (tournoi)** — tapis ou fold à tapis court (8–15 BB).

Chaque réponse est notée, la grille 13×13 montre la range de référence, et tes % de réussite par mode sont suivis.

### 🃏 Table vs bots
Une table 6-max complète contre 5 bots. Moteur NLHE maison (blindes, tours d'enchères, all-in, **side pots**, abattage). Après chaque main, le **coach** analyse notamment ta décision préflop vs la range de référence. Style des bots réglable : TAG, LAG, Nit, Calling station.

### 🔬 Analyseur EV
Entre une situation (ta main, le board, le pot, la mise à payer, le nombre d'adversaires) → **équité** (Monte Carlo), **cote du pot**, **EV du call** et un verdict clair.

## 🛠️ Personnaliser

- **Les ranges** de référence sont dans [`js/data/ranges.js`](js/data/ranges.js) — édite-les librement (notation standard : `22+, ATs+, KJo+, T9s`…). Ce sont des ranges pédagogiques proches GTO, volontairement simplifiées.
- **Le style / l'agressivité des bots** : [`js/core/bot.js`](js/core/bot.js) (objet `STYLES`).

## 🏗️ Architecture

```
index.html            → coquille + navigation
css/styles.css        → thème "table de feutre"
js/
  core/
    cards.js          → cartes, paquet, mélange
    evaluator.js      → évaluateur de main 5–7 cartes (testé)
    equity.js         → équité Monte Carlo + cote/EV
    notation.js       → 169 mains + parser de ranges
    game.js           → moteur NLHE (side pots, all-in)
    bot.js            → IA des adversaires (Chen préflop, équité postflop)
    storage.js        → persistance localStorage
  data/ranges.js      → charts de référence (RFI, vs open, push/fold)
  ui/render.js        → helpers de rendu (cartes, grilles)
  modules/            → home, preflop, table, analyzer
  app.js              → routeur
```

## ⚠️ Note honnête

Les ranges sont des **références pédagogiques** pour corriger les grosses fuites, pas une stratégie GTO mixte parfaite. L'équité de l'analyseur est calculée contre des mains **aléatoires** (surestimée par rapport à une vraie range de relance) : à ajuster mentalement. Les bots sont de bons sparring-partners, pas des solveurs.
