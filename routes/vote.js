import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

// Récupérer le jeton de vote pour une élection
router.get('/token/:electionId', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const userId = req.user.id;
        const { electionId } = req.params;

        // Vérifier que l'élection existe et est active
        const [electionRows] = await connection.execute(
            'SELECT * FROM elections WHERE id = ?',
            [parseInt(electionId)]
        );

        if (electionRows.length === 0 || !electionRows[0].isActive) {
            return res.status(400).json({
                success: false,
                message: "Cette élection n'est pas active"
            });
        }

        const election = electionRows[0];

        // Récupérer les informations complètes de l'étudiant
        const [userRows] = await connection.execute(`
            SELECT u.*, e.* 
            FROM users u
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE u.id = ?
        `, [userId]);

        if (userRows.length === 0 || !userRows[0].id) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé - profil étudiant incomplet'
            });
        }

        const etudiant = userRows[0];

        // Vérifier l'éligibilité
        if (!isEligibleForElection(etudiant, election)) {
            return res.status(403).json({
                success: false,
                message: 'Vous n\'êtes pas éligible pour cette élection'
            });
        }

        // Chercher un jeton de vote existant
        const [tokenRows] = await connection.execute(`
            SELECT * FROM vote_tokens 
            WHERE userId = ? AND electionId = ? AND isUsed = FALSE AND expiresAt > NOW()
        `, [userId, parseInt(electionId)]);

        let voteToken;
        if (tokenRows.length > 0) {
            voteToken = tokenRows[0];
        } else {
            // Créer un nouveau jeton de vote
            const [result] = await connection.execute(`
                INSERT INTO vote_tokens (userId, electionId, token, isUsed, expiresAt, createdAt)
                VALUES (?, ?, UUID(), FALSE, DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())
            `, [userId, parseInt(electionId)]);

            const [newTokenRows] = await connection.execute(
                'SELECT * FROM vote_tokens WHERE id = ?',
                [result.insertId]
            );
            voteToken = newTokenRows[0];
        }

        res.json({
            success: true,
            data: {
                token: voteToken.token,
                expiresAt: voteToken.expiresAt,
                election: {
                    id: election.id,
                    titre: election.titre,
                    type: election.type
                }
            }
        });

    } catch (error) {
        console.error('Erreur récupération token:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Soumettre un vote avec calcul du poids
router.post('/', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId, candidateId, voteToken } = req.body;
        const userId = req.user.id;

        if (!electionId || !candidateId || !voteToken) {
            return res.status(400).json({
                success: false,
                message: 'ElectionId, CandidateId et VoteToken requis'
            });
        }

        // Valider le jeton de vote
        const [tokenRows] = await connection.execute(`
            SELECT * FROM vote_tokens 
            WHERE token = ? AND electionId = ? AND isUsed = FALSE AND expiresAt > NOW()
        `, [voteToken, parseInt(electionId)]);

        if (tokenRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Jeton de vote invalide ou expiré'
            });
        }

        const validatedToken = tokenRows[0];

        // Vérifier que le token appartient à l'utilisateur
        if (validatedToken.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Jeton de vote non autorisé'
            });
        }

        // Vérifier que l'élection est active
        const [electionRows] = await connection.execute(
            'SELECT * FROM elections WHERE id = ?',
            [parseInt(electionId)]
        );

        if (electionRows.length === 0 || !electionRows[0].isActive) {
            return res.status(400).json({
                success: false,
                message: "Cette élection n'est pas active"
            });
        }

        const election = electionRows[0];

        // Vérifier si l'utilisateur a déjà voté
        const [voteRows] = await connection.execute(`
            SELECT * FROM votes 
            WHERE userId = ? AND electionId = ?
        `, [userId, parseInt(electionId)]);

        if (voteRows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Vous avez déjà voté pour cette élection'
            });
        }

        // Vérifier que le candidat existe pour cette élection
        const [candidateRows] = await connection.execute(
            'SELECT * FROM candidates WHERE id = ? AND electionId = ?',
            [parseInt(candidateId), parseInt(electionId)]
        );

        if (candidateRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Candidat invalide pour cette élection'
            });
        }

        // Calculer le poids du vote
        const poidsVote = await calculateVoteWeight(connection, userId, election);

        // Enregistrer le vote
        await connection.execute(`
            INSERT INTO votes (userId, electionId, candidateId, poidsVote, createdAt)
            VALUES (?, ?, ?, ?, NOW())
        `, [userId, parseInt(electionId), parseInt(candidateId), poidsVote]);

        // Marquer le jeton comme utilisé
        await connection.execute(
            'UPDATE vote_tokens SET isUsed = TRUE, usedAt = NOW() WHERE id = ?',
            [validatedToken.id]
        );

        res.json({
            success: true,
            message: 'Vote enregistré avec succès'
        });

    } catch (error) {
        console.error('Erreur enregistrement vote:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Calculer le poids du vote
async function calculateVoteWeight(connection, userId, election) {
    try {
        // Vérifier si l'utilisateur est un responsable de salle
        const [responsableRows] = await connection.execute(`
            SELECT rs.* 
            FROM responsables_salle rs
            LEFT JOIN etudiants e ON rs.etudiantId = e.id
            WHERE e.userId = ? 
            AND (? IS NULL OR rs.filiere = ?)
            AND (? IS NULL OR rs.annee = ?)
            AND (? IS NULL OR rs.ecole = ?)
        `, [
            userId,
            election.filiere, election.filiere,
            election.annee, election.annee,
            election.ecole, election.ecole
        ]);

        // Si c'est un responsable de salle, poids = 1.6
        if (responsableRows.length > 0) {
            return 1.6;
        }

        // Sinon, poids normal = 1
        return 1.0;
    } catch (error) {
        console.error('Erreur calcul poids vote:', error);
        return 1.0;
    }
}

// Récupérer les résultats d'une élection
router.get('/results/:electionId', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId } = req.params;

        // Récupérer l'élection
        const [electionRows] = await connection.execute(
            'SELECT * FROM elections WHERE id = ?',
            [parseInt(electionId)]
        );

        if (electionRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Élection non trouvée'
            });
        }

        const election = electionRows[0];

        // Récupérer les candidats
        const [candidateRows] = await connection.execute(`
            SELECT c.*, u.email, e.nom, e.prenom
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE c.electionId = ?
        `, [parseInt(electionId)]);

        // Récupérer les votes
        const [voteRows] = await connection.execute(`
            SELECT v.*, u.email, e.nom, e.prenom
            FROM votes v
            LEFT JOIN users u ON v.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE v.electionId = ?
        `, [parseInt(electionId)]);

        // Récupérer le nombre total de jetons
        const [tokenCountRows] = await connection.execute(
            'SELECT COUNT(*) as count FROM vote_tokens WHERE electionId = ?',
            [parseInt(electionId)]
        );

        const totalInscrits = tokenCountRows[0].count;

        // Calcul des résultats avec pondération
        const resultats = candidateRows.map(candidate => {
            const votes = voteRows.filter(vote => vote.candidateId === candidate.id);

            // Calcul du score pondéré
            let scorePondere = 0;
            votes.forEach(vote => {
                scorePondere += vote.poidsVote || 1.0;
            });

            // Pourcentage basé sur le total des poids de votes
            const totalPoids = voteRows.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0);
            const pourcentage = totalPoids > 0 ? (scorePondere / totalPoids) * 100 : 0;

            return {
                candidateId: candidate.id,
                nom: candidate.nom,
                prenom: candidate.prenom,
                scoreFinal: parseFloat(pourcentage.toFixed(2)),
                details: {
                    totalVotes: votes.length,
                    scorePondere: parseFloat(scorePondere.toFixed(2)),
                    poidsMoyen: votes.length > 0 ? parseFloat((scorePondere / votes.length).toFixed(2)) : 0
                }
            };
        });

        // Trier par score final
        resultats.sort((a, b) => b.scoreFinal - a.scoreFinal);

        const response = {
            success: true,
            data: {
                election: {
                    id: election.id,
                    titre: election.titre,
                    type: election.type,
                    ecole: election.ecole,
                    filiere: election.filiere,
                    annee: election.annee,
                    dateDebut: election.dateDebut,
                    dateFin: election.dateFin,
                    isActive: election.isActive
                },
                statistiques: {
                    totalVotes: voteRows.length,
                    totalPoids: voteRows.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0),
                    totalInscrits: totalInscrits,
                    tauxParticipation: totalInscrits > 0
                        ? parseFloat(((voteRows.length / totalInscrits) * 100).toFixed(2))
                        : 0
                },
                resultats: resultats
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Erreur calcul résultats:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Récupérer les résultats détaillés avec séparation responsables/étudiants
router.get('/results-detailed/:electionId', requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId } = req.params;

        // Récupérer l'élection
        const [electionRows] = await connection.execute(
            'SELECT * FROM elections WHERE id = ?',
            [parseInt(electionId)]
        );

        if (electionRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Élection non trouvée'
            });
        }

        const election = electionRows[0];

        // Récupérer les candidats
        const [candidateRows] = await connection.execute(`
            SELECT c.*, u.email, e.nom, e.prenom
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE c.electionId = ?
        `, [parseInt(electionId)]);

        // Récupérer les votes avec information des responsables
        const [voteRows] = await connection.execute(`
            SELECT 
                v.*, 
                u.email,
                e.nom,
                e.prenom,
                CASE WHEN rs.id IS NOT NULL THEN TRUE ELSE FALSE END as is_responsable
            FROM votes v
            LEFT JOIN users u ON v.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            LEFT JOIN responsables_salle rs ON e.id = rs.etudiantId
                AND (? IS NULL OR rs.filiere = ?)
                AND (? IS NULL OR rs.annee = ?)
                AND (? IS NULL OR rs.ecole = ?)
            WHERE v.electionId = ?
        `, [
            election.filiere, election.filiere,
            election.annee, election.annee,
            election.ecole, election.ecole,
            parseInt(electionId)
        ]);

        // Récupérer le nombre total de jetons
        const [tokenCountRows] = await connection.execute(
            'SELECT COUNT(*) as count FROM vote_tokens WHERE electionId = ?',
            [parseInt(electionId)]
        );

        const totalInscrits = tokenCountRows[0].count;

        // Séparation des votes
        const votesResponsables = voteRows.filter(vote => vote.is_responsable);
        const votesEtudiants = voteRows.filter(vote => !vote.is_responsable);

        // Calcul des résultats
        const calculerVotes = (votes) => {
            const resultats = {};
            candidateRows.forEach(candidate => {
                resultats[candidate.id] = 0;
            });
            votes.forEach(vote => {
                resultats[vote.candidateId] = (resultats[vote.candidateId] || 0) + (vote.poidsVote || 1.0);
            });
            return resultats;
        };

        const votesParCandidatResponsables = calculerVotes(votesResponsables);
        const votesParCandidatEtudiants = calculerVotes(votesEtudiants);

        const totalVotesResponsables = votesResponsables.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0);
        const totalVotesEtudiants = votesEtudiants.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0);

        // Calcul des résultats pondérés (60/40)
        const resultatsPonderes = candidateRows.map(candidate => {
            const votesRespo = votesParCandidatResponsables[candidate.id] || 0;
            const votesEtud = votesParCandidatEtudiants[candidate.id] || 0;

            const pourcentageRespo = totalVotesResponsables > 0
                ? (votesRespo / totalVotesResponsables) * 100
                : 0;
            const pourcentageEtud = totalVotesEtudiants > 0
                ? (votesEtud / totalVotesEtudiants) * 100
                : 0;

            const scoreFinal = (pourcentageRespo * 0.6) + (pourcentageEtud * 0.4);

            return {
                candidateId: candidate.id,
                nom: candidate.nom,
                prenom: candidate.prenom,
                scoreFinal: parseFloat(scoreFinal.toFixed(2)),
                details: {
                    votesResponsables: votesRespo,
                    votesEtudiants: votesEtud,
                    totalVotes: votesRespo + votesEtud,
                    pourcentageResponsables: parseFloat(pourcentageRespo.toFixed(2)),
                    pourcentageEtudiants: parseFloat(pourcentageEtud.toFixed(2))
                }
            };
        });

        // Trier par score final
        resultatsPonderes.sort((a, b) => b.scoreFinal - a.scoreFinal);

        const response = {
            success: true,
            data: {
                election: {
                    id: election.id,
                    titre: election.titre,
                    type: election.type,
                    ecole: election.ecole,
                    filiere: election.filiere,
                    annee: election.annee,
                    dateDebut: election.dateDebut,
                    dateFin: election.dateFin,
                    isActive: election.isActive
                },
                statistiques: {
                    totalVotes: voteRows.length,
                    votesResponsables: votesResponsables.length,
                    votesEtudiants: votesEtudiants.length,
                    totalPoidsResponsables: totalVotesResponsables,
                    totalPoidsEtudiants: totalVotesEtudiants,
                    totalInscrits: totalInscrits,
                    tauxParticipation: totalInscrits > 0
                        ? parseFloat(((voteRows.length / totalInscrits) * 100).toFixed(2))
                        : 0
                },
                resultats: resultatsPonderes
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Erreur calcul résultats détaillés:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Vérifier le statut de vote d'un utilisateur
router.get('/status/:electionId', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const userId = req.user.id;
        const { electionId } = req.params;

        const [voteRows] = await connection.execute(`
            SELECT * FROM votes 
            WHERE userId = ? AND electionId = ?
        `, [userId, parseInt(electionId)]);

        res.json({
            success: true,
            data: {
                hasVoted: voteRows.length > 0,
                electionId: parseInt(electionId)
            }
        });
    } catch (error) {
        console.error('Erreur vérification statut vote:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Valider un token de vote
router.post('/validate-token', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId, voteToken } = req.body;
        const userId = req.user.id;

        if (!electionId || !voteToken) {
            return res.status(400).json({
                success: false,
                message: 'ElectionId et voteToken requis'
            });
        }

        const [tokenRows] = await connection.execute(`
            SELECT * FROM vote_tokens 
            WHERE token = ? AND electionId = ? AND isUsed = FALSE AND expiresAt > NOW()
        `, [voteToken, parseInt(electionId)]);

        if (tokenRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Jeton de vote invalide ou expiré',
                valid: false
            });
        }

        // Vérifier que le token appartient à l'utilisateur
        if (tokenRows[0].userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Jeton de vote non autorisé',
                valid: false
            });
        }

        res.json({
            success: true,
            data: {
                valid: true,
                expiresAt: tokenRows[0].expiresAt
            }
        });
    } catch (error) {
        console.error('Erreur validation token:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            valid: false,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Fonction pour vérifier l'éligibilité
function isEligibleForElection(etudiant, election) {
    if (!etudiant || !election) return false;

    const etudiantFiliere = String(etudiant.filiere || '');
    const etudiantAnnee = String(etudiant.annee || '');
    const etudiantEcole = String(etudiant.ecole || '');
    const electionFiliere = String(election.filiere || '');
    const electionAnnee = String(election.annee || '');
    const electionEcole = String(election.ecole || '');

    if (election.type === 'SALLE') {
        return etudiantFiliere === electionFiliere &&
            etudiantAnnee === electionAnnee &&
            etudiantEcole === electionEcole;
    } else if (election.type === 'ECOLE') {
        return etudiantEcole === electionEcole;
    } else if (election.type === 'UNIVERSITE') {
        return true;
    }
    return false;
}

export default router;