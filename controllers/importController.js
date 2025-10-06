import { importService } from '../services/importService.js';

export const importController = {
    async importEtudiants(req, res) {
        try {
            const { etudiants } = req.body;

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

            // Vérifier les doublons
            const doublons = await importService.verifierDoublons(etudiantsValides.donnees);
            if (doublons.length > 0) {
                return res.status(400).json({
                    message: 'Doublons détectés',
                    doublons: doublons
                });
            }

            // Importer les étudiants
            const resultat = await importService.importerEtudiants(etudiantsValides.donnees);

            return res.status(201).json({
                message: 'Importation terminée avec succès.',
                importes: resultat.importes,
                echecs: resultat.echecs,
                total: etudiants.length,
                reussis: resultat.importes.length,
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