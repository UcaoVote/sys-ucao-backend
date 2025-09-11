import pool from '../dbconfig.js';

class ValidationService {

    // Valider l'éligibilité pour Phase 2
    async validatePhase2Candidature(userId, election) {
        let connection;
        try {
            connection = await pool.getConnection();

            const { delegueType } = election;
            const anneeRequise = delegueType === 'PREMIER' ? 3 : 2;

            const [rows] = await connection.execute(`
        SELECT rs.* 
        FROM responsables_salle rs
        INNER JOIN etudiants e ON rs.etudiantId = e.id
        WHERE e.userId = ? AND rs.annee = ?
      `, [userId, anneeRequise]);

            return rows.length > 0;
        } catch (error) {
            console.error('Erreur validation Phase 2:', error);
            return false;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Valider l'éligibilité pour Phase 3
    async validatePhase3Candidature(userId, election) {
        let connection;
        try {
            connection = await pool.getConnection();

            const { delegueType } = election;

            const [rows] = await connection.execute(`
        SELECT de.* 
        FROM delegues_ecole de
        INNER JOIN responsables_salle rs ON de.responsableId = rs.id
        INNER JOIN etudiants e ON rs.etudiantId = e.id
        WHERE e.userId = ? AND de.typeDelegue = ?
      `, [userId, delegueType]);

            return rows.length > 0;
        } catch (error) {
            console.error('Erreur validation Phase 3:', error);
            return false;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Vérifier l'éligibilité générale
    async checkCandidatureEligibility(userId, electionId) {
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

            if (election.phase === 'PHASE1') {
                return true; // Tous éligibles en Phase 1
            }

            if (election.phase === 'PHASE2') {
                return await this.validatePhase2Candidature(userId, election);
            }

            if (election.phase === 'PHASE3') {
                return await this.validatePhase3Candidature(userId, election);
            }

            return false;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Vérifier si un étudiant peut voter
    async checkVotingEligibility(userId, electionId) {
        let connection;
        try {
            connection = await pool.getConnection();

            // Récupérer l'étudiant
            const [etudiantRows] = await connection.execute(`
        SELECT e.* FROM etudiants e WHERE e.userId = ?
      `, [userId]);

            if (etudiantRows.length === 0) {
                return false;
            }

            const etudiant = etudiantRows[0];

            // Récupérer l'élection
            const [electionRows] = await connection.execute(
                'SELECT * FROM elections WHERE id = ?',
                [electionId]
            );

            if (electionRows.length === 0) {
                return false;
            }

            const election = electionRows[0];

            // Vérifier selon le type d'élection
            if (election.type === 'SALLE') {
                return etudiant.filiere === election.filiere &&
                    etudiant.annee === election.annee &&
                    etudiant.ecole === election.ecole;
            }

            if (election.type === 'ECOLE') {
                return etudiant.ecole === election.ecole;
            }

            if (election.type === 'UNIVERSITE') {
                return true; // Tous peuvent voter
            }

            return false;
        } finally {
            if (connection) await connection.release();
        }
    }
}

export default new ValidationService();