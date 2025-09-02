import express from 'express';
import pool from '../database.js';
import { authenticateToken } from '../middlewares/auth.js';

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

        if (electionRows.length === 0 || !electionRows[0].is_active) {
            return res.status(400).json({ message: "Cette élection n'est pas active" });
        }

        const election = electionRows[0];

        // Récupérer les informations complètes de l'étudiant
        const [userRows] = await connection.execute(`
            SELECT u.*, e.* 
            FROM users u
            LEFT JOIN etudiants e ON u.id = e.user_id
            WHERE u.id = ?
        `, [userId]);

        if (userRows.length === 0 || !userRows[0].user_id) {
            return res.status(403).json({ message: 'Accès refusé - profil étudiant incomplet' });
        }

        const etudiant = userRows[0];

        // Vérifier l'éligibilité
        if (!isEligibleForElection(etudiant, election)) {
            return res.status(403).json({
                message: 'Vous n\'êtes pas éligible pour cette élection'
            });
        }

        // Chercher un jeton de vote existant
        const [tokenRows] = await connection.execute(`
            SELECT * FROM vote_tokens 
            WHERE user_id = ? AND election_id = ? AND used = FALSE AND expires_at > NOW()
        `, [userId, parseInt(electionId)]);

        let voteToken;
        if (tokenRows.length > 0) {
            voteToken = tokenRows[0];
        } else {
            // Créer un nouveau jeton de vote
            const [result] = await connection.execute(`
                INSERT INTO vote_tokens (user_id, election_id, token, used, expires_at, created_at)
                VALUES (?, ?, UUID(), FALSE, DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())
            `, [userId, parseInt(electionId)]);

            const [newTokenRows] = await connection.execute(
                'SELECT * FROM vote_tokens WHERE id = ?',
                [result.insertId]
            );
            voteToken = newTokenRows[0];
        }

        res.json({
            token: voteToken.token,
            expiresAt: voteToken.expires_at,
            election: {
                id: election.id,
                titre: election.titre,
                type: election.type
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        if (connection) connection.release();
    }
});

// Soumettre un vote avec calcul du poids
router.post('/', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId, candidateId, voteToken } = req.body;

        if (!electionId || !candidateId || !voteToken) {
            return res.status(400).json({
                message: 'ElectionId, CandidateId et VoteToken requis'
            });
        }

        // Valider le jeton de vote
        const [tokenRows] = await connection.execute(`
            SELECT * FROM vote_tokens 
            WHERE token = ? AND election_id = ? AND used = FALSE AND expires_at > NOW()
        `, [voteToken, parseInt(electionId)]);

        if (tokenRows.length === 0) {
            return res.status(400).json({ message: 'Jeton de vote invalide ou expiré' });
        }

        const validatedToken = tokenRows[0];
        const userId = validatedToken.user_id;

        // Vérifier que l'élection est active
        const [electionRows] = await connection.execute(
            'SELECT * FROM elections WHERE id = ?',
            [parseInt(electionId)]
        );

        if (electionRows.length === 0 || !electionRows[0].is_active) {
            return res.status(400).json({ message: "Cette élection n'est pas active" });
        }

        const election = electionRows[0];

        // Vérifier si l'utilisateur a déjà voté
        const [voteRows] = await connection.execute(`
            SELECT * FROM votes 
            WHERE user_id = ? AND election_id = ?
        `, [userId, parseInt(electionId)]);

        if (voteRows.length > 0) {
            return res.status(400).json({ message: 'Vous avez déjà voté pour cette élection' });
        }

        // Vérifier que le candidat existe pour cette élection
        const [candidateRows] = await connection.execute(
            'SELECT * FROM candidates WHERE id = ? AND election_id = ?',
            [parseInt(candidateId), parseInt(electionId)]
        );

        if (candidateRows.length === 0) {
            return res.status(400).json({ message: 'Candidat invalide pour cette élection' });
        }

        // Calculer le poids du vote
        const poidsVote = await calculateVoteWeight(connection, userId, election);

        // Enregistrer le vote
        await connection.execute(`
            INSERT INTO votes (user_id, election_id, candidate_id, poids_vote, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `, [userId, parseInt(electionId), parseInt(candidateId), poidsVote]);

        // Marquer le jeton comme utilisé
        await connection.execute(
            'UPDATE vote_tokens SET used = TRUE, used_at = NOW() WHERE id = ?',
            [validatedToken.id]
        );

        res.json({ message: 'Vote enregistré avec succès' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        if (connection) connection.release();
    }
});

// Calculer le poids du vote
async function calculateVoteWeight(connection, userId, election) {
    try {
        // Vérifier si l'utilisateur est un responsable de salle
        const [responsableRows] = await connection.execute(`
            SELECT rs.* 
            FROM responsable_salle rs
            LEFT JOIN etudiants e ON rs.etudiant_id = e.id
            WHERE e.user_id = ? 
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
            return res.status(404).json({ message: 'Élection non trouvée' });
        }

        const election = electionRows[0];

        // Récupérer les candidats
        const [candidateRows] = await connection.execute(`
            SELECT c.*, u.email, e.nom, e.prenom
            FROM candidates c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN etudiants e ON u.id = e.user_id
            WHERE c.election_id = ?
        `, [parseInt(electionId)]);

        // Récupérer les votes
        const [voteRows] = await connection.execute(`
            SELECT v.*, u.email, e.nom, e.prenom
            FROM votes v
            LEFT JOIN users u ON v.user_id = u.id
            LEFT JOIN etudiants e ON u.id = e.user_id
            WHERE v.election_id = ?
        `, [parseInt(electionId)]);

        // Récupérer le nombre total de jetons
        const [tokenCountRows] = await connection.execute(
            'SELECT COUNT(*) as count FROM vote_tokens WHERE election_id = ?',
            [parseInt(electionId)]
        );

        const totalInscrits = tokenCountRows[0].count;

        // Calcul des résultats avec pondération
        const resultats = candidateRows.map(candidate => {
            const votes = voteRows.filter(vote => vote.candidate_id === candidate.id);

            // Calcul du score pondéré
            let scorePondere = 0;
            votes.forEach(vote => {
                scorePondere += vote.poids_vote || 1.0;
            });

            // Pourcentage basé sur le total des poids de votes
            const totalPoids = voteRows.reduce((sum, vote) => sum + (vote.poids_vote || 1.0), 0);
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
            election: {
                id: election.id,
                titre: election.titre,
                type: election.type,
                ecole: election.ecole,
                filiere: election.filiere,
                annee: election.annee,
                dateDebut: election.date_debut,
                dateFin: election.date_fin,
                isActive: election.is_active
            },
            statistiques: {
                totalVotes: voteRows.length,
                totalPoids: voteRows.reduce((sum, vote) => sum + (vote.poids_vote || 1.0), 0),
                totalInscrits: totalInscrits,
                tauxParticipation: totalInscrits > 0
                    ? parseFloat(((voteRows.length / totalInscrits) * 100).toFixed(2))
                    : 0
            },
            resultats: resultats
        };

        res.json(response);
    } catch (error) {
        console.error('Erreur calcul résultats:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        if (connection) connection.release();
    }
});

// Récupérer les résultats détaillés avec séparation responsables/étudiants
router.get('/results-detailed/:electionId', async (req, res) => {
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
            return res.status(404).json({ message: 'Élection non trouvée' });
        }

        const election = electionRows[0];

        // Récupérer les candidats
        const [candidateRows] = await connection.execute(`
            SELECT c.*, u.email, e.nom, e.prenom
            FROM candidates c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN etudiants e ON u.id = e.user_id
            WHERE c.election_id = ?
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
            LEFT JOIN users u ON v.user_id = u.id
            LEFT JOIN etudiants e ON u.id = e.user_id
            LEFT JOIN responsable_salle rs ON e.id = rs.etudiant_id
                AND (? IS NULL OR rs.filiere = ?)
                AND (? IS NULL OR rs.annee = ?)
                AND (? IS NULL OR rs.ecole = ?)
            WHERE v.election_id = ?
        `, [
            election.filiere, election.filiere,
            election.annee, election.annee,
            election.ecole, election.ecole,
            parseInt(electionId)
        ]);

        // Récupérer le nombre total de jetons
        const [tokenCountRows] = await connection.execute(
            'SELECT COUNT(*) as count FROM vote_tokens WHERE election_id = ?',
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
                resultats[vote.candidate_id] = (resultats[vote.candidate_id] || 0) + (vote.poids_vote || 1.0);
            });
            return resultats;
        };

        const votesParCandidatResponsables = calculerVotes(votesResponsables);
        const votesParCandidatEtudiants = calculerVotes(votesEtudiants);

        const totalVotesResponsables = votesResponsables.reduce((sum, vote) => sum + (vote.poids_vote || 1.0), 0);
        const totalVotesEtudiants = votesEtudiants.reduce((sum, vote) => sum + (vote.poids_vote || 1.0), 0);

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
            election: {
                id: election.id,
                titre: election.titre,
                type: election.type,
                ecole: election.ecole,
                filiere: election.filiere,
                annee: election.annee,
                dateDebut: election.date_debut,
                dateFin: election.date_fin,
                isActive: election.is_active
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
        };

        res.json(response);
    } catch (error) {
        console.error('Erreur calcul résultats détaillés:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        if (connection) connection.release();
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
            WHERE user_id = ? AND election_id = ?
        `, [userId, parseInt(electionId)]);

        res.json({
            hasVoted: voteRows.length > 0,
            electionId: parseInt(electionId)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        if (connection) connection.release();
    }
});

// Valider un token de vote
router.post('/validate-token', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId, voteToken } = req.body;

        if (!electionId || !voteToken) {
            return res.status(400).json({
                message: 'ElectionId et voteToken requis'
            });
        }

        const [tokenRows] = await connection.execute(`
            SELECT * FROM vote_tokens 
            WHERE token = ? AND election_id = ? AND used = FALSE AND expires_at > NOW()
        `, [voteToken, parseInt(electionId)]);

        if (tokenRows.length === 0) {
            return res.status(400).json({
                message: 'Jeton de vote invalide ou expiré',
                valid: false
            });
        }

        res.json({
            valid: true,
            expiresAt: tokenRows[0].expires_at
        });
    } catch (error) {
        console.error('Erreur validation token:', error);
        res.status(500).json({ message: 'Erreur serveur', valid: false });
    } finally {
        if (connection) connection.release();
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