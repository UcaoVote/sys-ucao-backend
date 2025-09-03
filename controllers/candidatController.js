import candidatService from '../services/candidatService.js';

class CandidatController {

    // Récupérer les candidats d'une élection
    async getCandidatesByElection(req, res) {
        try {
            const { electionId } = req.params;
            const result = await candidatService.getCandidatesByElection(electionId);

            res.json({
                success: true,
                election: result.election,
                candidates: result.candidates,
                totalCandidates: result.totalCandidates
            });
        } catch (error) {
            console.error('Erreur récupération candidats:', error);

            if (error.message === 'Élection non trouvée') {
                return res.status(404).json({
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

    // Vérifier si l'utilisateur est candidat
    async isUserCandidate(req, res) {
        try {
            const { electionId } = req.params;
            const result = await candidatService.isUserCandidate(req.user.id, electionId);

            if (result.isCandidate) {
                res.json({
                    success: true,
                    isCandidate: true,
                    candidate: result.candidate,
                    election: result.election
                });
            } else {
                res.json({
                    success: true,
                    isCandidate: false,
                    message: 'Vous n\'êtes pas candidat à cette élection'
                });
            }
        } catch (error) {
            console.error('Erreur vérification candidature:', error);

            if (error.message === 'Élection non trouvée') {
                return res.status(404).json({
                    success: false,
                    message: error.message,
                    isCandidate: false
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                isCandidate: false,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Récupérer les candidatures de l'utilisateur
    async getUserCandidatures(req, res) {
        try {
            const result = await candidatService.getUserCandidatures(req.user.id);

            res.json({
                success: true,
                data: {
                    candidatures: result.candidatures,
                    total: result.total
                }
            });
        } catch (error) {
            console.error('Erreur récupération candidatures:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Récupérer un candidat spécifique
    async getCandidate(req, res) {
        try {
            const { id } = req.params;
            const candidate = await candidatService.getCandidateById(id);

            res.json({
                success: true,
                data: candidate
            });
        } catch (error) {
            console.error('Erreur récupération candidat:', error);

            if (error.message === 'Candidat non trouvé') {
                return res.status(404).json({
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

    // Créer une candidature
    async createCandidature(req, res) {
        try {
            const candidatureId = await candidatService.createCandidature(req.body, req.user.id);

            res.status(201).json({
                success: true,
                message: 'Candidature déposée avec succès',
                data: { id: candidatureId }
            });
        } catch (error) {
            console.error('Erreur création candidature:', error);

            if (error.message.includes('requis') ||
                error.message.includes('trop long') ||
                error.message.includes('Déjà candidat') ||
                error.message.includes('inexistant')) {
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

    // Mettre à jour le programme
    async updateProgramme(req, res) {
        try {
            const { candidateId } = req.params;
            const { programme } = req.body;

            await candidatService.updateProgramme(candidateId, programme, req.user.id);

            res.json({
                success: true,
                message: 'Programme mis à jour'
            });
        } catch (error) {
            console.error('Erreur mise à jour programme:', error);

            if (error.message === 'Candidat introuvable' || error.message === 'Non autorisé') {
                return res.status(error.message === 'Non autorisé' ? 403 : 404).json({
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

    // Mettre à jour un candidat (admin)
    async updateCandidate(req, res) {
        try {
            const { id } = req.params;
            const candidate = await candidatService.updateCandidate(id, req.body);

            res.json({
                success: true,
                message: 'Candidat mis à jour',
                data: { candidate }
            });
        } catch (error) {
            console.error('Erreur mise à jour candidat:', error);

            if (error.message === 'Aucun champ à mettre à jour') {
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

    // Supprimer un candidat (admin)
    async deleteCandidate(req, res) {
        try {
            const { id } = req.params;
            await candidatService.deleteCandidate(id);

            res.json({
                success: true,
                message: 'Candidat supprimé'
            });
        } catch (error) {
            console.error('Erreur suppression candidat:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Lister les candidats avec filtres (admin)
    async listCandidates(req, res) {
        try {
            const { electionId, statut, search, page, limit } = req.query;
            const result = await candidatService.listCandidates({ electionId, statut, search, page, limit });

            res.json({
                success: true,
                data: {
                    candidates: result.candidates,
                    pagination: {
                        currentPage: result.page,
                        totalPages: Math.ceil(result.total / result.limit),
                        totalCandidates: result.total,
                        hasNext: result.page < Math.ceil(result.total / result.limit),
                        hasPrev: result.page > 1
                    }
                }
            });
        } catch (error) {
            console.error('Erreur liste candidats admin:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Statistiques candidats (admin)
    async getCandidateStats(req, res) {
        try {
            const stats = await candidatService.getCandidateStats();

            res.json({
                success: true,
                data: { stats }
            });
        } catch (error) {
            console.error('Erreur statistiques candidats:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Mettre à jour le statut (admin)
    async updateCandidateStatus(req, res) {
        try {
            const { id } = req.params;
            const { statut } = req.body;

            if (!statut || !['EN_ATTENTE', 'APPROUVE', 'REJETE'].includes(statut)) {
                return res.status(400).json({
                    success: false,
                    message: 'Statut invalide'
                });
            }

            const candidate = await candidatService.updateCandidateStatus(id, statut);

            res.json({
                success: true,
                message: 'Statut mis à jour',
                data: { candidate }
            });
        } catch (error) {
            console.error('Erreur mise à jour statut:', error);

            if (error.message === 'Candidat non trouvé') {
                return res.status(404).json({
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

    // Récupérer les détails complets (admin)
    async getCandidateDetails(req, res) {
        try {
            const { id } = req.params;
            const result = await candidatService.getCandidateDetails(id);

            res.json({
                success: true,
                data: { candidate: result.candidate, votes: result.votes }
            });
        } catch (error) {
            console.error('Erreur détails candidat:', error);

            if (error.message === 'Candidat non trouvé') {
                return res.status(404).json({
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
}

export default new CandidatController();