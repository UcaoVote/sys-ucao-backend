import pool from '../config/database.js';
import validationService from './validationService.js';

class ResultService {

    // Calculer les résultats avec pondération
    async calculateWeightedResults(electionId) {
        let connection;
        try {
            connection = await pool.getConnection();

            // Récupérer l'élection
            const [electionRows] = await connection.execute(
                'SELECT * FROM elections WHERE id = ?',
                [electionId]
            );

            if (electionRows.length === 0) {
                throw new Error('Élection non trouvée');
            }

            const election = electionRows[0];

            // Récupérer les votes
            const [voteRows] = await connection.execute(`
        SELECT v.*, e.userId as voterUserId
        FROM votes v
        INNER JOIN etudiants e ON v.userId = e.userId
        WHERE v.electionId = ?
      `, [electionId]);

            // Récupérer les candidats
            const [candidateRows] = await connection.execute(`
        SELECT c.* FROM candidates c WHERE c.electionId = ?
      `, [electionId]);

            if (election.phase === 'PHASE2') {
                return await this.calculatePhase2Results(election, voteRows, candidateRows, connection);
            }

            // Pour Phase 1 et Phase 3 (premier tour), calcul normal
            return await this.calculateNormalResults(voteRows, candidateRows);

        } finally {
            if (connection) await connection.release();
        }
    }

    // Calcul pour Phase 2 avec pondération 60/40
    async calculatePhase2Results(election, votes, candidates, connection) {
        // Séparer les votes des responsables et des étudiants normaux
        const votesResponsables = [];
        const votesEtudiants = [];

        for (const vote of votes) {
            const isResponsable = await validationService.validatePhase2Candidature(vote.voterUserId, election);
            if (isResponsable) {
                votesResponsables.push(vote);
            } else {
                votesEtudiants.push(vote);
            }
        }

        // Calcul des scores
        const results = candidates.map(candidate => {
            const votesRespo = votesResponsables.filter(v => v.candidateId === candidate.id);
            const votesEtud = votesEtudiants.filter(v => v.candidateId === candidate.id);

            const totalVotesRespo = votesResponsables.length;
            const totalVotesEtud = votesEtudiants.length;

            // Pondération 60% responsables, 40% étudiants
            const score = totalVotesRespo > 0 && totalVotesEtud > 0
                ? (votesRespo.length / totalVotesRespo * 0.6) + (votesEtud.length / totalVotesEtud * 0.4)
                : votesRespo.length + votesEtud.length; // Fallback si un groupe n'a pas voté

            return {
                candidateId: candidate.id,
                nom: candidate.nom,
                prenom: candidate.prenom,
                scoreFinal: parseFloat((score * 100).toFixed(2)),
                details: {
                    votesResponsables: votesRespo.length,
                    votesEtudiants: votesEtud.length,
                    totalVotes: votesRespo.length + votesEtud.length,
                    pourcentageResponsables: totalVotesRespo > 0 ? parseFloat((votesRespo.length / totalVotesRespo * 100).toFixed(2)) : 0,
                    pourcentageEtudiants: totalVotesEtud > 0 ? parseFloat((votesEtud.length / totalVotesEtud * 100).toFixed(2)) : 0
                }
            };
        });

        // Trier par score décroissant
        results.sort((a, b) => b.scoreFinal - a.scoreFinal);

        return results;
    }

    // Calcul normal pour Phase 1 et Phase 3
    async calculateNormalResults(votes, candidates) {
        const results = candidates.map(candidate => {
            const candidateVotes = votes.filter(v => v.candidateId === candidate.id);
            const totalVotes = votes.length;
            const pourcentage = totalVotes > 0 ? (candidateVotes.length / totalVotes * 100) : 0;

            return {
                candidateId: candidate.id,
                nom: candidate.nom,
                prenom: candidate.prenom,
                scoreFinal: parseFloat(pourcentage.toFixed(2)),
                details: {
                    totalVotes: candidateVotes.length,
                    pourcentage: parseFloat(pourcentage.toFixed(2))
                }
            };
        });

        results.sort((a, b) => b.scoreFinal - a.scoreFinal);
        return results;
    }

    // Proclamer les résultats et créer les élus
    async proclaimResults(electionId, results) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [electionRows] = await connection.execute(
                'SELECT * FROM elections WHERE id = ?',
                [electionId]
            );

            if (electionRows.length === 0) {
                throw new Error('Élection non trouvée');
            }

            const election = electionRows[0];
            const winners = results.slice(0, election.phase === 'PHASE1' ? 2 : 1);

            for (const winner of winners) {
                const [candidateRows] = await connection.execute(
                    'SELECT * FROM candidates WHERE id = ?',
                    [winner.candidateId]
                );

                if (candidateRows.length > 0) {
                    const candidate = candidateRows[0];
                    const [etudiantRows] = await connection.execute(
                        'SELECT * FROM etudiants WHERE userId = ?',
                        [candidate.userId]
                    );

                    if (etudiantRows.length > 0) {
                        const etudiant = etudiantRows[0];

                        if (election.phase === 'PHASE1') {
                            // Créer responsable de salle
                            await connection.execute(`
                INSERT INTO responsables_salle (etudiantId, filiere, annee, ecole, createdAt)
                VALUES (?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE updatedAt = NOW()
              `, [etudiant.id, election.filiere, election.annee, election.ecole]);
                        }
                        else if (election.phase === 'PHASE2') {
                            // Créer délégué d'école
                            // D'abord trouver le responsable de salle correspondant
                            const [responsableRows] = await connection.execute(`
                SELECT id FROM responsables_salle 
                WHERE etudiantId = ? AND annee = ?
              `, [etudiant.id, election.delegueType === 'PREMIER' ? 3 : 2]);

                            if (responsableRows.length > 0) {
                                await connection.execute(`
                  INSERT INTO delegues_ecole (responsableId, typeDelegue, ecole, createdAt)
                  VALUES (?, ?, ?, NOW())
                  ON DUPLICATE KEY UPDATE updatedAt = NOW()
                `, [responsableRows[0].id, election.delegueType, election.ecole]);
                            }
                        }
                        else if (election.phase === 'PHASE3') {
                            // Créer délégué universitaire
                            const [delegueEcoleRows] = await connection.execute(`
                SELECT de.id FROM delegues_ecole de
                INNER JOIN responsables_salle rs ON de.responsableId = rs.id
                WHERE rs.etudiantId = ? AND de.typeDelegue = ?
              `, [etudiant.id, election.delegueType]);

                            if (delegueEcoleRows.length > 0) {
                                await connection.execute(`
                  INSERT INTO delegues_universite (delegueEcoleId, typeDelegue, createdAt)
                  VALUES (?, ?, NOW())
                  ON DUPLICATE KEY UPDATE updatedAt = NOW()
                `, [delegueEcoleRows[0].id, election.delegueType]);
                            }
                        }
                    }
                }
            }

            // Marquer l'élection comme terminée
            await connection.execute(
                'UPDATE elections SET isActive = FALSE, dateFin = NOW() WHERE id = ?',
                [electionId]
            );

            return winners;
        } finally {
            if (connection) await connection.release();
        }
    }
}

export default new ResultService();