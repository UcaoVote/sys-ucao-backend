import pool from '../dbconfig.js';
import voteService from '../services/voteService.js';
import ActivityManager from '../controllers/activityManager.js';

class VoteController {

    async getElectionWins(req, res) {
        try {
            const [rows] = await pool.execute(`
      SELECT candidateId, COUNT(*) AS elections_won
      FROM election_results
      WHERE isWinner = TRUE
      GROUP BY candidateId
      ORDER BY elections_won DESC
    `);

            res.status(200).json({ success: true, data: rows });
        } catch (error) {
            console.error('Erreur récupération victoires :', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    }

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
                error.message.includes('profil étudiant') ||
                error.message.includes('déjà voté')) {
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

    async submitVote(req, res) {
        try {
            const { electionId, candidateId, voteToken } = req.body;
            const userId = req.user?.id;

            // Validation des paramètres
            if (!electionId || !candidateId || !voteToken || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'ElectionId, CandidateId, VoteToken et utilisateur requis'
                });
            }

            // Enregistrement du vote
            const result = await voteService.submitVote({ electionId, candidateId, voteToken }, userId);

            // Journal d'activité
            await ActivityManager.createActivityLog({
                action: 'Vote enregistré',
                userId,
                details: `Vote pour le candidat ${candidateId} dans l'élection ${electionId}`,
                actionType: 'VOTE',
                module: 'ELECTION'
            });

            return res.status(200).json(result);

        } catch (error) {
            console.error('Erreur enregistrement vote:', error);

            const clientErrors = [
                'invalide',
                'non autorisé',
                'déjà voté',
                'non active',
                'Candidat invalide',
                'Jeton de vote'
            ];

            const isClientError = clientErrors.some(msg => error.message.includes(msg));

            return res.status(isClientError ? 400 : 500).json({
                success: false,
                message: error.message,
                error: process.env.NODE_ENV === 'development' && !isClientError ? error.message : undefined
            });
        }
    }

    async getStudentResults(req, res) {
        try {
            const { electionId } = req.params;

            // Vérifier si les résultats peuvent être affichés aux étudiants
            const canDisplay = await voteService.canDisplayResults(electionId);
            if (!canDisplay) {
                return res.status(403).json({
                    success: false,
                    message: 'Les résultats de cette élection ne sont pas encore disponibles'
                });
            }

            // Récupérer les données complètes
            const fullResults = await voteService.getElectionResults(electionId);

            // Transformer pour le frontend étudiant
            const studentResults = this.transformForStudent(fullResults);

            res.json({
                success: true,
                data: studentResults
            });
        } catch (error) {
            console.error('Erreur résultats étudiants:', error);

            if (error.message === 'Élection non trouvée') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            if (error.message.includes('non disponibles')) {
                return res.status(403).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    }

    async getResults(req, res) {
        try {
            const { electionId } = req.params;

            // Vérifier si les résultats peuvent être affichés
            const canDisplay = await voteService.canDisplayResults(electionId);
            if (!canDisplay) {
                return res.status(403).json({
                    success: false,
                    message: 'Les résultats de cette élection ne sont pas encore disponibles'
                });
            }

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
                message: 'Erreur serveur'
            });
        }
    }

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
                message: 'Erreur serveur'
            });
        }
    }

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

    async publishResults(req, res) {
        try {
            const { electionId } = req.params;
            const userId = req.user.id;
            const result = await voteService.publishResults(electionId, userId);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Erreur publication résultats:', error);

            if (error.message.includes('non trouvée') ||
                error.message.includes('active') ||
                error.message.includes('déjà publiés') ||
                error.message.includes('automatique')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur serveur lors de la publication'
            });
        }
    }

    async unpublishResults(req, res) {
        try {
            const { electionId } = req.params;
            const userId = req.user.id;
            const result = await voteService.unpublishResults(electionId, userId);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Erreur masquage résultats:', error);

            if (error.message.includes('non trouvée') ||
                error.message.includes('ne sont pas publiés') ||
                error.message.includes('automatique')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur serveur lors du masquage'
            });
        }
    }

    async getCompletedElections(req, res) {
        try {
            const elections = await voteService.getCompletedElections();

            res.json({
                success: true,
                data: elections
            });
        } catch (error) {
            console.error('Erreur récupération élections terminées:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    }

    async getElectionStats(req, res) {
        try {
            const { electionId } = req.params;
            const stats = await voteService.getElectionStats(electionId);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Erreur récupération statistiques:', error);

            if (error.message.includes('non trouvée')) {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    }

    async getResultsVisibility(req, res) {
        try {
            const { electionId } = req.params;
            const canDisplay = await voteService.canDisplayResults(electionId);

            res.json({
                success: true,
                data: {
                    canDisplay: canDisplay
                }
            });
        } catch (error) {
            console.error('Erreur vérification visibilité:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    }

    transformForStudent(fullResults) {
        if (!fullResults || !fullResults.resultats) return fullResults;

        return {
            election: fullResults.election,
            statistiques: {
                totalVotes: fullResults.statistiques.totalVotes,
                totalInscrits: fullResults.statistiques.totalInscrits,
                tauxParticipation: fullResults.statistiques.tauxParticipation,
                nombreCandidats: fullResults.resultats.length
            },
            resultats: fullResults.resultats.map(candidate => ({
                id: candidate.candidateId,
                nom: candidate.nom,
                prenom: candidate.prenom,
                photoUrl: candidate.photoUrl,
                filiere: candidate.filiereId || 'Non spécifié',
                annee: candidate.annee || 'N/A',
                slogan: candidate.slogan || 'Aucun slogan',
                scoreFinal: candidate.scoreFinal,
                details: {
                    totalVotes: candidate.details.totalVotes
                }
            }))
        };
    }

}

export default new VoteController();