# ⚽ Prépa FC

Appli de productivité gamifiée pour la prépa : **Pronote**, **DS & khôlles**, **to-do**, **périodes de révision**, **timer focus**… et un **club de foot** qui progresse quand tu bosses.

## Lancer l'appli

Il faut [Node.js](https://nodejs.org) ≥ 20.

```bash
npm install
npm run dev        # appli sur http://localhost:5173 (+ serveur Pronote sur :8787)
```

Version « production » (un seul serveur, port 8787) :

```bash
npm run build
npm start          # http://localhost:8787
```

Pour tester sans Pronote : **Pronote & réglages → 🧪 Charger la démo**.

## Fonctionnalités

| Écran | Ce que ça fait |
|---|---|
| 🏠 **QG** | « Quoi faire maintenant ? » : tâches triées par urgence, DS/khôlle proche dans la matière, priorité et matières faibles (moyenne < ta moyenne générale). Alerte si une éval arrive sans aucune tâche de préparation. Compte à rebours vers la prochaine éval, journée du jour, devoirs à rendre. |
| ⏱️ **Focus** | Pomodoro / minuteur / chrono libre, lié à une tâche. En fin de session tu notes ta concentration (1-5) → gains XP et budget. Pause auto, son + notification. Ajout manuel d'une session oubliée. |
| ✅ **To-do** | Devoirs (importés de Pronote ou manuels), estimation du temps, priorité, date. Ajout rapide : `Exos 1-8 #Maths 1h30 !`. Quand tu coches, l'appli te demande le **temps réel**. |
| 🗓️ **Révisions** | Une période (dates, temps dispo/jour, jours off) + la liste de ce que tu veux faire avec tes estimations → planning jour par jour, alerte si c'est trop chargé. Les estimations sont **corrigées automatiquement** d'après ton historique. |
| 📝 **DS & khôlles** | Colloscope, DS, concours blancs, avec programme, colleur, salle, tâches de préparation et barre d'avancement. Après coup, tu entres ta note → prime + ajout aux moyennes. |
| 📅 **Emploi du temps** | Semaine type agenda : cours Pronote (annulations, évals), DS/khôlles, créneaux perso récurrents et tes sessions de travail. |
| 📊 **Notes** | Notes Pronote + manuelles, moyennes pondérées par matière, évolution. |
| ⚽ **Mon club** | Voir ci-dessous. |
| 📈 **Stats** | Heatmap de régularité, temps par semaine et par matière, et surtout **calibration de tes estimations** (nuage estimé/réel, facteur par matière). |

### Calibration des estimations

Pour chaque tâche terminée on calcule le ratio r = réel / estimé. Le facteur affiché est la **moyenne géométrique** des ratios, exp((1/n) Σ ln rᵢ) — c'est la bonne moyenne pour des rapports : une tâche 2× trop longue et une 2× trop courte se compensent (facteur 1), alors que la moyenne arithmétique donnerait (2 + 0,5)/2 = 1,25.
Dès 3 tâches dans une matière, l'appli corrige tes nouvelles estimations dans cette matière (sinon elle utilise le facteur global).

### Le club

- Chaque minute de travail rapporte **10 XP** et **10 k€** de budget, multipliés par ta **série** (+5 %/jour consécutif ≥ 25 min, max +50 %), ta concentration (×0,8 à ×1,2) et le niveau **Sponsors**.
- Bonus : tâche terminée, **estimation précise** (±15 % → gros bonus), bonne note en DS/khôlle, passage de niveau.
- **90 min de travail = 1 match** de championnat (10 équipes, 18 journées, top 2 promu, 2 derniers relégués, 4 divisions jusqu'à la *Ligue des Grandes Écoles*).
- **Mercato** : achète/vends des joueurs (note, potentiel, âge). Le meilleur XI joue automatiquement en 4-3-3.
- **Infrastructures** (5 niveaux) : centre d'entraînement (tes joueurs progressent pendant que tu bosses), centre de formation (pépites gratuites), réseau de recruteurs (meilleurs joueurs au mercato), stade (avantage domicile + recettes), sponsors (+8 % de budget/niveau).

## Pronote

La connexion passe par le petit serveur local (`server/index.ts`) qui utilise la librairie [pawnote](https://github.com/LiterateInk/Pawnote.js) : Pronote ne peut pas être interrogé directement depuis un navigateur.

- **Identifiants** : URL de la page élève + identifiant + mot de passe. Le mot de passe n'est jamais stocké : Pronote renvoie un jeton de reconnexion, gardé dans le navigateur.
- **QR code** (si ton établissement passe par un ENT) : génère le QR code « appli mobile » dans Pronote, copie son contenu JSON et ton code PIN.

Importé : emploi du temps (−7 j → +5 semaines), devoirs → to-do, cours marqués « devoir surveillé » → DS, cours contenant « khôlle / colle » → khôlles, toutes les notes.

> Les khôlles sont rarement dans Pronote : ajoute ton colloscope dans **DS & khôlles** ou en créneaux récurrents.

## Données

Tout est stocké en local (localStorage). **Exporte une sauvegarde** de temps en temps (Réglages → Exporter) — vider le cache du navigateur efface tout.

## Dev

```bash
npm test           # tests de la logique (calibration, planning, moteur de jeu)
npm run typecheck
```

Structure : `src/lib/` (logique pure : `game.ts`, `insights.ts`, `store.ts`), `src/views/` (écrans), `server/` (passerelle Pronote).
