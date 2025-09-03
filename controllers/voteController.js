import voteService from '../services/voteService.js';

class VoteController {

    // Récupérer un jeton de vote
    async getVoteToken(req, res) {
        try {
            const { electionId } = req.params;
            const result = await voteService.getVoteToken(req.user.id, electionId);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Erreur récupération token:', error);

            if (error.message.includes('non active') ||
                error.message.includes('éligible') ||
                error.message.includes('profil étudiant')) {
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

    // Soumettre un vote
    async submitVote(req, res) {
        try {
            const { electionId, candidateId, voteToken } = req.body;

            if (!electionId || !candidateId || !voteToken) {
                return res.status(400).json({
                    success: false,
                    message: 'ElectionId, CandidateId et VoteToken requis'
                });
            }

            await voteService.submitVote({ electionId, candidateId, voteToken }, req.user.id);

            res.json({
                success: true,
                message: 'Vote enregistré avec succès'
            });
        } catch (error) {
            console.error('Erreur enregistrement vote:', error);

            if (error.message.includes('invalide') ||
                error.message.includes('non autorisé') ||
                error.message.includes('déjà voté') ||
                error.message.includes('non active') ||
                error.message.includes('Candidat invalide')) {
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

    // Récupérer les résultats
    async getResults(req, res) {
        try {
            const { electionId } = req.params;
            const result = await voteService.getElectionResults(electionId);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Erreur calcul résultats:', error);

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

    // Récupérer les résultats détaillés
    async getDetailedResults(req, res) {
        try {
            const { electionId } = req.params;
            const result = await voteService.getDetailedResults(electionId);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Erreur calcul résultats détaillés:', error);

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

    // Vérifier le statut de vote
    async getVoteStatus(req, res) {
        try {
            const { electionId } = req.params;
            const result = await voteService.getVoteStatus(req.user.id, electionId);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Erreur vérification statut vote:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Valider un token
    async validateToken(req, res) {
        try {
            const { electionId, voteToken } = req.body;

            if (!electionId || !voteToken) {
                return res.status(400).json({
                    success: false,
                    message: 'ElectionId et voteToken requis'
                });
            }

            const result = await voteService.validateToken(voteToken, electionId, req.user.id);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Erreur validation token:', error);

            if (error.message.includes('invalide') || error.message.includes('non autorisé')) {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                    valid: false
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                valid: false,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

export default new VoteController();