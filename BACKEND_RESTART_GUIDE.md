# 🔄 Guide de redémarrage du Backend

## ⚠️ IMPORTANT : Après modification du code backend

Suite aux modifications apportées à `voteService.js` (correction du calcul du taux de participation), **le serveur backend DOIT être redémarré** pour que les changements prennent effet.

---

## 🚀 Méthodes de redémarrage selon votre plateforme de déploiement

### Option 1️⃣ : Railway (Recommandé)

1. **Connexion à Railway** :
   ```
   Allez sur : https://railway.app/dashboard
   ```

2. **Sélectionner le projet** :
   - Trouvez votre projet `sys-ucao-backend`
   - Cliquez dessus pour ouvrir

3. **Redéploiement automatique** :
   - Railway détecte automatiquement les nouveaux commits sur `main`
   - Le redéploiement commence automatiquement
   - Attendez la fin du déploiement (5-10 minutes)

4. **Redéploiement manuel** :
   - Onglet `Deployments`
   - Cliquez sur `Deploy` → `Redeploy`
   - Ou cliquez sur les `⋯` → `Restart`

5. **Vérifier le statut** :
   ```
   Logs → Afficher les logs en temps réel
   ```

---

### Option 2️⃣ : Render

1. **Connexion à Render** :
   ```
   Allez sur : https://dashboard.render.com/
   ```

2. **Sélectionner le service** :
   - Trouvez votre service `sys-ucao-backend`
   - Cliquez pour ouvrir

3. **Redéploiement** :
   - Onglet `Manual Deploy`
   - Cliquez sur `Deploy latest commit`
   - Ou utilisez le bouton `Restart Service`

4. **Vérifier les logs** :
   - Onglet `Logs`
   - Vérifier que le serveur démarre correctement

---

### Option 3️⃣ : En local (Développement)

```powershell
# Arrêter le serveur (Ctrl + C)

# Redémarrer
cd D:\UCAO_TECH\Vote_UCAO\sys-ucao-backend
npm start

# Ou avec nodemon (redémarrage automatique)
npm run dev
```

---

## ✅ Vérification du bon fonctionnement

### 1️⃣ Vérifier que le backend répond

```powershell
# Tester l'endpoint de santé
curl https://votre-backend.up.railway.app/health
```

### 2️⃣ Vérifier le taux de participation

1. Ouvrez le frontend : `results.html`
2. Ouvrez la console du navigateur (`F12`)
3. Rechargez la page
4. Vérifiez le log :
   ```javascript
   📊 Données backend reçues: {
     tauxParticipation: 100,        // ✅ Doit être <= 100
     electeursAyantVote: 1,         // ✅ Nombre d'électeurs uniques
     totalInscrits: 1,
     totalVotes: 11                 // Nombre total de votes
   }
   ```

### 3️⃣ Vérifier visuellement

Sur la page `results.html` :
- ✅ **Taux de participation** : Doit afficher `100%` (et non 1100%)
- ✅ **Total des votes** : `11`
- ✅ **Électeurs inscrits** : `1`
- ✅ **Candidats** : Doivent afficher leur nom/filière correctement

---

## 🐛 Si le problème persiste

### Vider le cache du navigateur

```
1. Ouvrir DevTools (F12)
2. Clic droit sur le bouton Actualiser
3. "Vider le cache et actualiser la page"
```

### Forcer un nouveau déploiement

```powershell
cd D:\UCAO_TECH\Vote_UCAO\sys-ucao-backend

# Commit vide pour forcer le redéploiement
git commit --allow-empty -m "Force redeploy"
git push origin main
```

### Vérifier les variables d'environnement

Sur Railway/Render :
- Vérifiez que `DATABASE_URL` est correct
- Vérifiez que `PORT` est défini
- Vérifiez que `JWT_SECRET` existe

---

## 📝 Changements apportés

### Backend (`voteService.js`)

**Avant** :
```javascript
tauxParticipation: (voteRows.length / totalInscrits) * 100
// = (11 votes / 1 inscrit) = 1100% ❌
```

**Après** :
```javascript
const uniqueVoters = new Set(voteRows.map(vote => vote.userId)).size;
tauxParticipation: (uniqueVoters / totalInscrits) * 100
// = (1 électeur / 1 inscrit) = 100% ✅
```

### Frontend (`results.html`)

- ✅ Ajout debug console.log pour vérifier les données reçues
- ✅ Correction affichage "N/A" → affichage correct des filières/années
- ✅ Ajout sélecteur d'élections
- ✅ Ajout event listeners sur les filtres

---

## 🆘 Support

Si le problème persiste après redémarrage :
1. Vérifiez les logs du backend
2. Vérifiez la console du frontend (F12)
3. Testez l'API directement avec Postman/cURL
4. Contactez l'équipe technique

---

**Date de création** : 12 octobre 2025  
**Dernière modification** : 12 octobre 2025
