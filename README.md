# Cadence

Planning de prépa pensé pour travailler tous les jours, sans réfléchir chaque matin à quoi faire.

- **Journée** : timeline, tâches à cocher (obligations fixes / important / facultatif), les 3 essentiels, ligne du coach,
  « Replanifier la suite » quand la journée a mal commencé, lever / coucher.
- **Mode Focus** : une séance plein écran, minuteur, compteur de décrochages, validation du temps réel, pause sans écran,
  notification de fin et bloc 🍅 dans Google Agenda.
- **Semaine** : grille 7 jours avec glisser-déposer, objectifs, **Bilan de la semaine** (prévu vs validé, résumé, sommeil,
  séances à reporter, historique figé chaque lundi).
- **Mois** / **Année** : calendrier, échéances, charge par matière, objectifs du mois, régularité jusqu'aux écrits EDHEC.
- **Vendredi** : quiz de l'actu de la semaine et des mots / personnages (alimenté chaque soir par Claude).

Une seule source de données ; seules les séances **validées** comptent comme faites.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # tests du modèle (récurrence, exceptions, report, bilan, replanification)
npm run build:ipad   # fichier unique publié sur claude.ai (dist-artifact/prepa-fc.html)
```
