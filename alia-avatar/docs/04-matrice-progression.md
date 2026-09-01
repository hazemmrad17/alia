# Matrice de Progression ALIA V1

> Fichier source : `Matrice_progression_ALIA_V1.xlsx`
> Contient 3 onglets : Matrice, Évaluation, Checklist, Seuils de passage

---

## 1. Matrice de compétences par niveau

| # | Compétence | Débutant | Junior | Confirmé | Expert |
|---|-----------|----------|--------|----------|--------|
| 1 | **Préparation (objectif & plan)** | Objectif simple (1 produit) + message noté | Objectif = 1 produit + 1 message + 1 engagement | Objectif + plan B (si temps court) + 2 objections anticipées | Objectif stratégique (cycle long) + plan multi-visites + priorisation |
| 2 | **Ouverture / Permission (Instant Zéro)** | Se présente + demande le temps (script) | Gère refus/urgence (flash ou replanif) | S'adapte au contexte (stress, secrétaire, timing) | Crée un climat positif même en situation tendue |
| 3 | **Gestion du temps** | Tient 1–2 minutes sans se disperser | Bascule Flash/Standard selon temps | Raccourcit proprement après interruption | Optimise le temps : valeur/seconde + mini-plan de suivi |
| 4 | **Sondage (questions)** | 1–2 questions basiques | 2–4 questions pertinentes + 1 relance | Questions structurées (situation → problème → critère) | Questions "diagnostic" très ciblées, sans fatiguer le médecin |
| 5 | **Écoute active** | Laisse parler mais coupe parfois | Reformule une fois + silence utile | Écoute maîtrisée, relances fines, pas d'interruption | Écoute "expert" : capte l'implicite, désamorce tensions |
| 6 | **Synthèse (QARE)** | Reformulation simple | Synthèse claire + validation | QARE : reformulation qui réduit objections | Synthèse stratégique : verrouille besoin et prépare closing |
| 7 | **Argumentation (structure)** | 1–2 arguments "liste" | Besoin → avantages → usage | Segmentation profils patients + priorisation | Haut niveau : bénéfice, place, limites, usage |
| 8 | **Preuves / crédibilité** | 1 preuve courte, générale | 1–2 preuves simples (sans excès) | 1 preuve + 1 chiffre utile + prudence | Compare niveaux de preuve + propose partage source |
| 9 | **Gestion objections** | 1 objection fréquente, réponse script | 2 objections fréquentes via A-C-R-V | 3 objections variées + différencie types | Cas difficiles : objections multiples, recadrage calme |
| 10 | **Adaptation au profil médecin** | Faible adaptation | Début d'adaptation (4 styles/SONCAS basiques) | Adaptation fluide + choix des arguments selon profil | Adaptation "chirurgicale" + personnalités complexes |
| 11 | **Closing & engagement** | Micro-engagement standard | Détecte 1–2 signaux BIP et conclut | Conclut après interruption + engagement mesurable | Conclut au moment parfait + cycle long |
| 12 | **CRM / traçabilité** | Compte rendu minimal | CRM structuré + action suivante | CRM riche + relance | CRM pilotage : actions, alertes, analyse tendances |
| 13 | **Conformité & prudence** | Évite promesses mais hésite | Sait dire "je vérifie" | Zéro invention, cadre clair | Très strict : limites, sécurité, renvoi sources |
| 14 | **Résilience terrain** | Perturbé par interruption | Se reprend après perturbation | Gère interruptions, médecin froid, pression | Retourne situations difficiles, maintient relation |

---

## 2. Évaluation — Calcul automatique du niveau

| Indicateur | Valeur | Unité / Format | Seuil Junior | Seuil Confirmé | Seuil Expert |
|-----------|--------|----------------|-------------|----------------|--------------|
| Score global moyen | 0 | 0–10 | 7 | 8 | 9 |
| % structure 6 étapes OK | 0 | 0–1 (ex: 0,80) | 0.80 | — | — |
| % visites avec engagement | 0 | 0–1 (ex: 0,60) | 0.60 | — | — |
| Erreurs de conformité (nb) | 0 | nombre (doit être 0) | 0 | 0 | 0 |
| % objections A-C-R-V validées | 0 | 0–1 | — | 0.70 | — |
| % adaptation profil médecin | 0 | 0–1 | — | 0.60 | — |
| % CRM complet + prochaine action | 0 | 0–1 | — | 0.80 | — |
| % réussite visites difficiles | 0 | 0–1 | — | — | 0.70 |
| % cycle long (test→retour→ajust.) | 0 | 0–1 | — | — | 0.60 |
| % langage "clean" (sans surpromesse) | 0 | 0–1 | — | — | 0.95 |

### Formule de calcul automatique

```
=IF(AND(Score>=9, Conformite=0, Difficiles>=0.7, CycleLong>=0.6, Langage>=0.95), "Expert",
  IF(AND(Score>=8, Conformite=0, Objections>=0.7, Adaptation>=0.6, CRM>=0.8), "Confirmé",
    IF(AND(Score>=7, Conformite=0, Structure>=0.8, Engagement>=0.6), "Junior",
      "Débutant")))
```

---

## 3. Checklist de simulation (à cocher)

Pour chaque simulation, cocher les cases suivantes :

| Simulation # | Ouverture OK | Sondage OK | Objections OK | Closing OK | CRM OK |
|--------------|-------------|-----------|--------------|-----------|--------|
| 1 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 7 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 8 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 9 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 11 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 12 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 13 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 14 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 15 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 16 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 17 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 18 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 19 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 20 | ☐ | ☐ | ☐ | ☐ | ☐ |

**Taux OK (%)** = Nombre cochées / 20

---

## 4. Seuils de passage (règles simples et mesurables)

### Passage Débutant → Junior

| Critère | Seuil |
|---------|-------|
| Score grille globale | ≥ **7/10** sur 5 simulations |
| Permission + structure 6 étapes OK | dans ≥ **80%** |
| Visites avec micro-engagement obtenu | ≥ **60%** |
| Erreurs de conformité | **0** (données inventées / promesse absolue) |

### Passage Junior → Confirmé

| Critère | Seuil |
|---------|-------|
| Score global | ≥ **8/10** sur 10 simulations |
| Objections traitées A-C-R-V avec validation | ≥ **70%** |
| Adaptation profil médecin correcte | ≥ **60%** |
| CRM complet + prochaine action | ≥ **80%** |

### Passage Confirmé → Expert

| Critère | Seuil |
|---------|-------|
| Score global | ≥ **9/10** sur 10 simulations difficiles |
| Réussite "visites difficiles" (hostile/interruption/objections multiples) | ≥ **70%** |
| Cycle long : test → retour → ajustement réalisé | ≥ **60%** |
| Zéro surpromesse, langage "clean" | ≥ **95%** |

### Format "check rapide" (pour manager / scoring)

| Couleur | Signification |
|---------|--------------|
| 🟢 Vert | Atteint le niveau |
| 🟠 Orange | Encore instable (à renforcer) |
| 🔴 Rouge | Non acquis (bloquant) |
