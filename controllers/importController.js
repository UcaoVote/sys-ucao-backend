import { importService } from '../services/importService.js';

export const importController = {
    async importEtudiants(req, res) {
        // Augmenter le timeout pour cette route
        req.setTimeout(300000); // 5 minutes
        res.setTimeout(300000);

        try {
            const { etudiants, updateExisting = false } = req.body;

            if (!etudiants || !Array.isArray(etudiants) || etudiants.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Liste d\'étudiants invalide.'
                });
            }

            // Vérifier que l'utilisateur est un admin
            const isAdmin = await importService.verifyAdmin(req.user.id);
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé. Admin requis.'
                });
            }

            // Valider et normaliser les données des étudiants
            const etudiantsValides = await importService.validerEtudiants(etudiants);

            if (etudiantsValides.erreurs.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Erreurs de validation',
                    erreurs: etudiantsValides.erreurs,
                    etudiantsValides: etudiantsValides.donnees
                });
            }

            // Vérifier les doublons
            const doublons = await importService.verifierDoublons(etudiantsValides.donnees);

            if (doublons.length > 0 && !updateExisting) {
                return res.status(400).json({
                    success: false,
                    message: 'Doublons détectés',
                    doublons: doublons,
                    suggestion: 'Utilisez updateExisting=true pour mettre à jour les étudiants existants'
                });
            }

            // Importer les étudiants
            const resultat = await importService.importerEtudiants(
                etudiantsValides.donnees,
                updateExisting
            );

            return res.status(201).json({
                success: true,
                message: updateExisting ?
                    'Importation/Mise à jour terminée avec succès.' :
                    'Importation terminée avec succès.',
                data: {
                    importes: resultat.importes,
                    misAJour: resultat.misAJour || [],
                    echecs: resultat.echecs,
                    doublonsTrouves: doublons.length,
                    total: etudiants.length,
                    reussis: resultat.importes.length + (resultat.misAJour?.length || 0),
                    echoues: resultat.echecs.length
                }
            });

        } catch (err) {
            console.error('Erreur import étudiants:', err);
            return res.status(500).json({
                success: false,
                message: 'Erreur serveur lors de l\'importation.',
                error: err.message
            });
        }
    }
};