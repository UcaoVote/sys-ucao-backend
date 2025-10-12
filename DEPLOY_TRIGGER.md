# Force Deploy - Taux Participation Fix

Date: 2025-10-12  
Commit: 8a05608

Ce fichier force Render à redéployer avec les modifications du calcul du taux de participation.

## Modifications appliquées

✅ voteService.js - Calcul électeurs uniques (uniqueVoters)
✅ Ajout champ `electeursAyantVote` dans statistiques
✅ Formule correcte: (uniqueVoters / totalInscrits) * 100

## Test après déploiement

Le taux de participation doit être <= 100%
