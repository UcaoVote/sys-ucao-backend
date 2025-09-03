import pool from '../config/database.js';

class VoteService {

    // Récupérer un jeton de vote
    async getVoteToken(userId, electionId) {
        let connection;
        try {
            connection = await pool.getConnection();

            // Vérifier que l'élection existe et est active
            const [electionRows] = await connection.execute(
                'SELECT * FROM elections WHERE id = ?',
                [parseInt(electionId)]
            );

            if (electionRows.length === 0 || !electionRows[0].isActive) {
                throw new Error("Cette élection n'est pas active");
            }

            const election = electionRows[0];

            // Récupérer les informations de l'étudiant
            const [userRows] = await connection.execute(`
        SELECT u.*, e.* 
        FROM users u
        LEFT JOIN etudiants e ON u.id = e.userId
        WHERE u.id = ?
      `, [userId]);

            if (userRows.length === 0 || !userRows[0].id) {
                throw new Error('Accès refusé - profil étudiant incomplet');
            }

            const etudiant = userRows[0];

            // Vérifier l'éligibilité
            if (!this.isEligibleForElection(etudiant, election)) {
                throw new Error('Vous n\'êtes pas éligible pour cette élection');
            }

            // Chercher un jeton existant
            const [tokenRows] = await connection.execute(`
        SELECT * FROM vote_tokens 
        WHERE userId = ? AND electionId = ? AND isUsed = FALSE AND expiresAt > NOW()
      `, [userId, parseInt(electionId)]);

            let voteToken;
            if (tokenRows.length > 0) {
                voteToken = tokenRows[0];
            } else {
                // Créer un nouveau jeton
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

            return {
                token: voteToken.token,
                expiresAt: voteToken.expiresAt,
                election: {
                    id: election.id,
                    titre: election.titre,
                    type: election.type
                }
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Soumettre un vote
    async submitVote(voteData, userId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const { electionId, candidateId, voteToken } = voteData;

            // Valider le jeton
            const [tokenRows] = await connection.execute(`
        SELECT * FROM vote_tokens 
        WHERE token = ? AND electionId = ? AND isUsed = FALSE AND expiresAt > NOW()
      `, [voteToken, parseInt(electionId)]);

            if (tokenRows.length === 0) {
                throw new Error('Jeton de vote invalide ou expiré');
            }

            const validatedToken = tokenRows[0];

            // Vérifier propriété du jeton
            if (validatedToken.userId !== userId) {
                throw new Error('Jeton de vote non autorisé');
            }

            // Vérifier l'élection
            const [electionRows] = await connection.execute(
                'SELECT * FROM elections WHERE id = ?',
                [parseInt(electionId)]
            );

            if (electionRows.length === 0 || !electionRows[0].isActive) {
                throw new Error("Cette élection n'est pas active");
            }

            const election = electionRows[0];

            // Vérifier si déjà voté
            const [voteRows] = await connection.execute(`
        SELECT * FROM votes 
        WHERE userId = ? AND electionId = ?
      `, [userId, parseInt(electionId)]);

            if (voteRows.length > 0) {
                throw new Error('Vous avez déjà voté pour cette élection');
            }

            // Vérifier le candidat
            const [candidateRows] = await connection.execute(
                'SELECT * FROM candidates WHERE id = ? AND electionId = ?',
                [parseInt(candidateId), parseInt(electionId)]
            );

            if (candidateRows.length === 0) {
                throw new Error('Candidat invalide pour cette élection');
            }

            // Calculer le poids du vote
            const poidsVote = await this.calculateVoteWeight(connection, userId, election);

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

            return true;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Calculer le poids du vote
    async calculateVoteWeight(connection, userId, election) {
        try {
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

            return responsableRows.length > 0 ? 1.6 : 1.0;
        } catch (error) {
            console.error('Erreur calcul poids vote:', error);
            return 1.0;
        }
    }

    // Récupérer les résultats d'une élection
    async getElectionResults(electionId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [electionRows] = await connection.execute(
                'SELECT * FROM elections WHERE id = ?',
                [parseInt(electionId)]
            );

            if (electionRows.length === 0) {
                throw new Error('Élection non trouvée');
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

            // Calcul des résultats
            const resultats = candidateRows.map(candidate => {
                const votes = voteRows.filter(vote => vote.candidateId === candidate.id);
                const scorePondere = votes.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0);
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

            resultats.sort((a, b) => b.scoreFinal - a.scoreFinal);

            return {
                election: election,
                statistiques: {
                    totalVotes: voteRows.length,
                    totalPoids: voteRows.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0),
                    totalInscrits: totalInscrits,
                    tauxParticipation: totalInscrits > 0
                        ? parseFloat(((voteRows.length / totalInscrits) * 100).toFixed(2))
                        : 0
                },
                resultats: resultats
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Récupérer les résultats détaillés
    async getDetailedResults(electionId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [electionRows] = await connection.execute(
                'SELECT * FROM elections WHERE id = ?',
                [parseInt(electionId)]
            );

            if (electionRows.length === 0) {
                throw new Error('Élection non trouvée');
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

            resultatsPonderes.sort((a, b) => b.scoreFinal - a.scoreFinal);

            return {
                election: election,
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
        } finally {
            if (connection) await connection.release();
        }
    }

    // Vérifier le statut de vote
    async getVoteStatus(userId, electionId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [voteRows] = await connection.execute(`
        SELECT * FROM votes 
        WHERE userId = ? AND electionId = ?
      `, [userId, parseInt(electionId)]);

            return {
                hasVoted: voteRows.length > 0,
                electionId: parseInt(electionId)
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Valider un token
    async validateToken(voteToken, electionId, userId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [tokenRows] = await connection.execute(`
        SELECT * FROM vote_tokens 
        WHERE token = ? AND electionId = ? AND isUsed = FALSE AND expiresAt > NOW()
      `, [voteToken, parseInt(electionId)]);

            if (tokenRows.length === 0) {
                throw new Error('Jeton de vote invalide ou expiré');
            }

            if (tokenRows[0].userId !== userId) {
                throw new Error('Jeton de vote non autorisé');
            }

            return {
                valid: true,
                expiresAt: tokenRows[0].expiresAt
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Vérifier l'éligibilité
    isEligibleForElection(etudiant, election) {
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
}

export default new VoteService();