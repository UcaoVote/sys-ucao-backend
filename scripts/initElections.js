import pool from '../dbconfig.js';
import resultService from '../services/resultService.js';
import electionRoundService from '../services/electionRoundService.js';

class ElectionInitializer {

    // Vérifier et traiter les élections terminées
    async processCompletedElections() {
        let connection;
        try {
            connection = await pool.getConnection();

            // Récupérer les élections actives terminées
            const [electionRows] = await connection.execute(`
        SELECT * FROM elections 
        WHERE isActive = TRUE AND dateFin < NOW()
      `);

            for (const election of electionRows) {
                try {
                    if (election.phase === 'PHASE3') {
                        // Gérer les tours pour Phase 3
                        await electionRoundService.manageElectionRounds(election.id);
                    } else {
                        // Calculer les résultats pour Phase 1 et 2
                        const results = await resultService.calculateWeightedResults(election.id);
                        await resultService.proclaimResults(election.id, results);
                    }
                } catch (error) {
                    console.error(`Erreur traitement élection ${election.id}:`, error);
                }
            }
        } finally {
            if (connection) await connection.release();
        }
    }

    // Lancer le traitement périodique
    startPeriodicProcessing() {
        setInterval(() => {
            this.processCompletedElections();
        }, 5 * 60 * 1000); // Toutes les 5 minutes
    }
}

export default new ElectionInitializer();