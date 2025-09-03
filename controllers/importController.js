// controllers/importController.js
import { importService } from '../services/importService.js';

export const importController = {
    async importMatricules(req, res) {
        try {
            const { matricules } = req.body;

            if (!matricules || !Array.isArray(matricules) || matricules.length === 0) {
                return res.status(400).json({ message: 'Liste de matricules invalide.' });
            }

            // Vérifier que l'utilisateur est un admin
            const isAdmin = await importService.verifyAdmin(req.user.id);
            if (!isAdmin) {
                return res.status(403).json({ message: 'Accès refusé. Admin requis.' });
            }

            // Vérifier les matricules existants
            const existingMatricules = await importService.checkExistingMatricules(matricules);
            const newMatricules = matricules.filter(mat => !existingMatricules.includes(mat));

            // Importer les nouveaux matricules
            const createdMatricules = await importService.importMatricules(newMatricules);

            return res.status(201).json({
                message: 'Importation terminée.',
                created: createdMatricules,
                skipped: existingMatricules
            });
        } catch (err) {
            console.error('Erreur import matricules:', err);
            return res.status(500).json({ message: 'Erreur serveur.' });
        }
    }
};