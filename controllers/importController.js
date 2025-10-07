import { importService } from '../services/importService.js';

export const importController = {
    async importEtudiants(req, res) {
        try {
            const { etudiants, updateExisting = false } = req.body; // Nouveau paramètre

            if (!etudiants || !Array.isArray(etudiants) || etudiants.length === 0) {
                return res.status(400).json({
                    message: 'Liste d\'étudiants invalide.'
                });
            }

            // Vérifier que l'utilisateur est un admin
            const isAdmin = await importService.verifyAdmin(req.user.id);
            if (!isAdmin) {
                return res.status(403).json({
                    message: 'Accès refusé. Admin requis.'
                });
            }

            // Valider et normaliser les données des étudiants
            const etudiantsValides = await importService.validerEtudiants(etudiants);

            if (etudiantsValides.erreurs.length > 0) {
                return res.status(400).json({
                    message: 'Erreurs de validation',
                    erreurs: etudiantsValides.erreurs,
                    etudiantsValides: etudiantsValides.donnees
                });
            }

            // Vérifier les doublons (mais ne pas bloquer si updateExisting = true)
            const doublons = await importService.verifierDoublons(etudiantsValides.donnees);

            if (doublons.length > 0 && !updateExisting) {
                return res.status(400).json({
                    message: 'Doublons détectés',
                    doublons: doublons,
                    suggestion: 'Utilisez updateExisting=true pour mettre à jour les étudiants existants'
                });
            }

            // Importer les étudiants avec l'option de mise à jour
            const resultat = await importService.importerEtudiants(
                etudiantsValides.donnees,
                updateExisting
            );

            return res.status(201).json({
                message: updateExisting ?
                    'Importation/Mise à jour terminée avec succès.' :
                    'Importation terminée avec succès.',
                importes: resultat.importes,
                misAJour: resultat.misAJour || [], // Nouveau champ
                echecs: resultat.echecs,
                doublonsTrouves: doublons.length,
                total: etudiants.length,
                reussis: resultat.importes.length + (resultat.misAJour?.length || 0),
                echoues: resultat.echecs.length
            });

        } catch (err) {
            console.error('Erreur import étudiants:', err);
            return res.status(500).json({
                message: 'Erreur serveur lors de l\'importation.'
            });
        }
    }
};