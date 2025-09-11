import pool from '../dbconfig.js';
import resultService from './resultService.js';

class ElectionRoundService {

    // Gérer les tours d'élection pour Phase 3
    async manageElectionRounds(electionId) {
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

            if (election.phase !== 'PHASE3') {
                throw new Error('Cette fonction est réservée aux élections Phase 3');
            }

            // Vérifier le tour actuel
            const [roundRows] = await connection.execute(`
        SELECT * FROM election_rounds 
        WHERE electionId = ? 
        ORDER BY roundNumber DESC 
        LIMIT 1
      `, [electionId]);

            let currentRound;

            if (roundRows.length === 0) {
                // Premier tour
                currentRound = await this.createFirstRound(electionId, connection);
            } else {
                currentRound = roundRows[0];
            }

            if (currentRound.status === 'ACTIVE') {
                // Vérifier si le tour est terminé
                if (new Date() > new Date(currentRound.dateFin)) {
                    await this.processRoundResults(currentRound.id, connection);
                }
            }

            return currentRound;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Créer le premier tour
    async createFirstRound(electionId, connection) {
        const [candidateRows] = await connection.execute(`
      SELECT c.* FROM candidates c WHERE c.electionId = ?
    `, [electionId]);

        const candidateIds = candidateRows.map(c => c.id);

        const [result] = await connection.execute(`
      INSERT INTO election_rounds 
      (electionId, roundNumber, dateDebut, dateFin, candidates, status)
      VALUES (?, 1, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), ?, 'ACTIVE')
    `, [electionId, JSON.stringify(candidateIds)]);

        const [roundRows] = await connection.execute(
            'SELECT * FROM election_rounds WHERE id = ?',
            [result.insertId]
        );

        return roundRows[0];
    }

    // Traiter les résultats d'un tour
    async processRoundResults(roundId, connection) {
        const [roundRows] = await connection.execute(
            'SELECT * FROM election_rounds WHERE id = ?',
            [roundId]
        );

        if (roundRows.length === 0) {
            throw new Error('Tour non trouvé');
        }

        const round = roundRows[0];
        const candidateIds = JSON.parse(round.candidates);

        // Calculer les résultats
        const results = await resultService.calculateNormalResults(
            await this.getVotesForRound(roundId, connection),
            await this.getCandidatesByIds(candidateIds, connection)
        );

        // Vérifier si majorité absolue
        const winner = results[0];
        if (winner.scoreFinal > 50) {
            // Victoire au premier tour
            await connection.execute(`
        UPDATE election_rounds 
        SET results = ?, status = 'COMPLETED', updatedAt = NOW()
        WHERE id = ?
      `, [JSON.stringify(results), roundId]);

            await resultService.proclaimResults(round.electionId, results);
        } else {
            // Préparer second tour avec les 2 premiers
            await this.createSecondRound(round, results.slice(0, 2), connection);
        }
    }

    // Créer un second tour
    async createSecondRound(previousRound, topCandidates, connection) {
        const candidateIds = topCandidates.map(c => c.candidateId);

        const [result] = await connection.execute(`
      INSERT INTO election_rounds 
      (electionId, roundNumber, parentRoundId, dateDebut, dateFin, candidates, status)
      VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), ?, 'ACTIVE')
    `, [previousRound.electionId, previousRound.roundNumber + 1, previousRound.id, JSON.stringify(candidateIds)]);

        // Marquer le tour précédent comme complété
        await connection.execute(`
      UPDATE election_rounds SET status = 'COMPLETED', updatedAt = NOW() WHERE id = ?
    `, [previousRound.id]);
    }

    // Méthodes utilitaires
    async getVotesForRound(roundId, connection) {
        const [roundRows] = await connection.execute(
            'SELECT * FROM election_rounds WHERE id = ?',
            [roundId]
        );

        if (roundRows.length === 0) return [];

        const round = roundRows[0];
        const candidateIds = JSON.parse(round.candidates);

        const [voteRows] = await connection.execute(`
      SELECT v.* FROM votes v
      WHERE v.electionId = ? AND v.candidateId IN (?)
    `, [round.electionId, candidateIds]);

        return voteRows;
    }

    async getCandidatesByIds(candidateIds, connection) {
        if (candidateIds.length === 0) return [];

        const [candidateRows] = await connection.execute(`
      SELECT * FROM candidates WHERE id IN (?)
    `, [candidateIds]);

        return candidateRows;
    }
}

export default new ElectionRoundService();