import pool from '../database/dbconfig.js';
import resultService from '../services/resultService.js';
import electionRoundService from '../services/electionRoundService.js';
import voteService from '../services/voteService.js';

class ElectionInitializer {

    // Vérifier et traiter les élections terminées
    async processCompletedElections() {
        let connection;
        try {
            connection = await pool.getConnection();
            console.log('🔄 Vérification des élections terminées...');

            // Récupérer les élections actives terminées
            const [electionRows] = await connection.execute(`
                SELECT * FROM elections
                WHERE isActive = TRUE AND dateFin < NOW()
            `);

            if (electionRows.length === 0) {
                console.log('✅ Aucune élection terminée à traiter');
                return;
            }

            console.log(`📊 ${electionRows.length} élection(s) terminée(s) à traiter`);

            for (const election of electionRows) {
                try {
                    console.log(`⚙️ Traitement élection ${election.id}: "${election.titre}" (Type: ${election.type})`);

                    // Calculer les résultats pondérés
                    const results = await resultService.calculateWeightedResults(election.id);

                    if (!results || results.length === 0) {
                        console.warn(`⚠️ Aucun résultat pour élection ${election.id}`);
                        continue;
                    }

                    // Proclamer les résultats (sauvegarde automatique dans election_results)
                    await resultService.proclaimResults(election.id, results);

                    console.log(`✅ Élection ${election.id} traitée: ${results.length} résultats sauvegardés`);

                } catch (error) {
                    console.error(`❌ Erreur traitement élection ${election.id}:`, error.message);
                }
            }

            // Publier automatiquement les élections en mode IMMEDIATE
            console.log('🔄 Vérification des publications automatiques...');
            await voteService.publishAutomaticElections();

        } catch (error) {
            console.error('❌ Erreur processCompletedElections:', error.message);
        } finally {
            if (connection) await connection.release();
        }
    }

    // Lancer le traitement périodique
    startPeriodicProcessing() {
        console.log('🚀 Démarrage du traitement périodique des élections (toutes les 5 minutes)');

        // Exécuter immédiatement au démarrage
        this.processCompletedElections();

        // Puis toutes les 5 minutes
        setInterval(() => {
            this.processCompletedElections();
        }, 5 * 60 * 1000); // Toutes les 5 minutes
    }
}

export default new ElectionInitializer();