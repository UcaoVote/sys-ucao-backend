import electionService from '../services/electionService.js';

class ElectionController {

    // Récupérer l'élection active
    async getActiveElection(req, res) {
        try {
            const election = await electionService.getActiveElection();

            if (!election) {
                return res.status(204).json({
                    success: true,
                    message: 'Aucune élection active'
                });
            }

            res.json({
                success: true,
                data: election
            });
        } catch (error) {
            console.error('Erreur récupération élection active:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Récupérer toutes les élections
    async getElections(req, res) {
        try {
            const { status, page, limit, type, filiere, annee, ecole } = req.query;

            const result = await electionService.getElections({
                status, page, limit, type, filiere, annee, ecole
            });

            res.json({
                success: true,
                data: {
                    elections: result.elections,
                    pagination: {
                        currentPage: result.page,
                        totalPages: Math.ceil(result.total / result.limit),
                        totalElections: result.total,
                        hasNext: result.page < Math.ceil(result.total / result.limit),
                        hasPrev: result.page > 1
                    }
                }
            });
        } catch (error) {
            console.error('Erreur récupération élections:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Récupérer une élection spécifique
    async getElection(req, res) {
        try {
            const { id } = req.params;
            const election = await electionService.getElectionById(id);

            if (!election) {
                return res.status(404).json({
                    success: false,
                    message: 'Élection non trouvée'
                });
            }

            res.json({
                success: true,
                data: election
            });
        } catch (error) {
            console.error('Erreur récupération élection:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Récupérer les élections de l'étudiant
    async getMyElections(req, res) {
        try {
            const elections = await electionService.getElectionsForStudent(req.user.id);
            res.json(elections);
        } catch (error) {
            console.error('Erreur récupération élections étudiant:', error);
            res.status(500).json([]);
        }
    }

    // Créer une élection
    async createElection(req, res) {
        try {
            const electionId = await electionService.createElection(req.body);

            res.status(201).json({
                success: true,
                message: 'Élection créée avec succès',
                data: { electionId }
            });
        } catch (error) {
            console.error('Erreur création élection:', error);

            if (error.message.includes('doit être') || error.message.includes('nécessitent')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Clôturer une élection
    async closeElection(req, res) {
        try {
            const { id } = req.params;
            await electionService.closeElection(id);

            res.json({
                success: true,
                message: 'Élection clôturée avec succès'
            });
        } catch (error) {
            console.error('Erreur clôture élection:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Supprimer une élection
    async deleteElection(req, res) {
        try {
            const { id } = req.params;
            await electionService.deleteElection(id);

            res.json({
                success: true,
                message: 'Élection supprimée avec succès'
            });
        } catch (error) {
            console.error('Erreur suppression élection:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Statistiques par type
    async getStatsByType(req, res) {
        try {
            const { type } = req.params;
            const { filiere, annee, ecole } = req.query;

            const stats = await electionService.getStatsByType(type, { filiere, annee, ecole });

            res.json({
                success: true,
                data: {
                    type: type.toUpperCase(),
                    statistics: stats,
                    filters: { filiere, annee, ecole }
                }
            });
        } catch (error) {
            console.error('Erreur statistiques élections:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

export default new ElectionController();