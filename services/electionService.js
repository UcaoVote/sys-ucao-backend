import pool from '../config/database.js';

class ElectionService {

    // Récupérer l'élection active
    async getActiveElection() {
        let connection;
        try {
            connection = await pool.getConnection();
            const now = new Date();

            const [rows] = await connection.execute(`
        SELECT id FROM elections 
        WHERE dateFin >= ? AND dateDebut <= ? AND isActive = TRUE
        ORDER BY dateDebut ASC LIMIT 1
      `, [now, now]);

            return rows.length > 0 ? { id: rows[0].id } : null;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Récupérer toutes les élections avec filtres
    async getElections(filters = {}) {
        let connection;
        try {
            connection = await pool.getConnection();
            const { status, page = 1, limit = 10, type, filiere, annee, ecole } = filters;

            let whereClause = '1=1';
            let params = [];

            if (status === 'active') {
                whereClause += ' AND isActive = TRUE AND dateDebut <= ? AND dateFin >= ?';
                const now = new Date();
                params.push(now, now);
            } else if (status === 'upcoming') {
                whereClause += ' AND isActive = TRUE AND dateDebut > ?';
                params.push(new Date());
            } else if (status === 'closed') {
                whereClause += ' AND (isActive = FALSE OR dateFin < ?)';
                params.push(new Date());
            }

            if (type) {
                whereClause += ' AND type = ?';
                params.push(type.toUpperCase());
            }

            if (filiere) {
                whereClause += ' AND filiere = ?';
                params.push(filiere);
            }

            if (annee) {
                whereClause += ' AND annee = ?';
                params.push(parseInt(annee));
            }

            if (ecole) {
                whereClause += ' AND ecole = ?';
                params.push(ecole);
            }

            const offset = (parseInt(page) - 1) * parseInt(limit);
            const queryParams = [...params, parseInt(limit), offset];

            const [electionRows] = await connection.execute(`
        SELECT e.*, COUNT(DISTINCT c.id) as candidates_count,
               COUNT(DISTINCT v.id) as votes_count
        FROM elections e
        LEFT JOIN candidates c ON e.id = c.electionId
        LEFT JOIN votes v ON e.id = v.electionId
        WHERE ${whereClause}
        GROUP BY e.id
        ORDER BY e.dateDebut DESC
        LIMIT ? OFFSET ?
      `, queryParams);

            // Compter le total
            const [countRows] = await connection.execute(`
        SELECT COUNT(*) as total FROM elections WHERE ${whereClause}
      `, params);

            return {
                elections: electionRows,
                total: countRows[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Récupérer une élection spécifique
    async getElectionById(id) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [electionRows] = await connection.execute(`
        SELECT e.*, COUNT(DISTINCT c.id) as candidates_count,
               COUNT(DISTINCT v.id) as votes_count,
               COUNT(DISTINCT vt.id) as tokens_count
        FROM elections e
        LEFT JOIN candidates c ON e.id = c.electionId
        LEFT JOIN votes v ON e.id = v.electionId
        LEFT JOIN vote_tokens vt ON e.id = vt.electionId
        WHERE e.id = ?
        GROUP BY e.id
      `, [parseInt(id)]);

            if (electionRows.length === 0) return null;

            const election = electionRows[0];

            // Récupérer les candidats
            const [candidateRows] = await connection.execute(`
        SELECT c.*, u.email, et.userId
        FROM candidates c
        LEFT JOIN users u ON c.userId = u.id
        LEFT JOIN etudiants et ON u.id = et.userId
        WHERE c.electionId = ?
      `, [parseInt(id)]);

            return {
                ...election,
                candidates: candidateRows
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Récupérer les élections accessibles à un étudiant
    async getElectionsForStudent(userId) {
        let connection;
        try {
            connection = await pool.getConnection();

            // Récupérer les infos de l'étudiant
            const [etudiantRows] = await connection.execute(
                "SELECT * FROM etudiants WHERE userId = ?",
                [userId]
            );

            if (etudiantRows.length === 0) return [];

            const etudiant = etudiantRows[0];
            const now = new Date();

            const [electionRows] = await connection.execute(`
        SELECT e.*, 
               CASE 
                 WHEN e.dateDebut > ? THEN 'upcoming'
                 WHEN e.dateFin < ? THEN 'completed'
                 ELSE 'active'
               END as status
        FROM elections e
        WHERE e.isActive = TRUE
        AND (
          (e.filiere = ? AND e.annee = ? AND e.ecole = ?)
          OR (e.filiere IS NULL AND e.annee IS NULL AND e.ecole = ?)
          OR (e.filiere IS NULL AND e.annee = ? AND e.ecole = ?)
          OR (e.filiere IS NULL AND e.annee IS NULL AND e.ecole IS NULL)
        )
        AND e.dateDebut <= ? AND e.dateFin >= ?
        ORDER BY e.dateDebut ASC
      `, [
                now, now,
                etudiant.filiere, etudiant.annee, etudiant.ecole,
                etudiant.ecole,
                etudiant.annee, etudiant.ecole,
                now, now
            ]);

            return electionRows;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Créer une nouvelle élection
    async createElection(electionData) {
        let connection;
        try {
            connection = await pool.getConnection();

            const {
                type, titre, description, dateDebut, dateFin,
                dateDebutCandidature, dateFinCandidature, filiere,
                annee, ecole, niveau, delegueType
            } = electionData;

            // Validation des dates
            const now = new Date();
            const debutCandidature = new Date(dateDebutCandidature);
            const finCandidature = new Date(dateFinCandidature);
            const debutVote = new Date(dateDebut);
            const finVote = new Date(dateFin);

            if (finCandidature >= debutVote) {
                throw new Error('La fin des candidatures doit être avant le début du vote');
            }

            if (debutCandidature >= finCandidature) {
                throw new Error('La date de début des candidatures doit être avant la date de fin');
            }

            if (debutVote >= finVote) {
                throw new Error('La date de début du vote doit être avant la date de fin');
            }

            if (debutCandidature < now) {
                throw new Error('La date de début des candidatures ne peut pas être dans le passé');
            }

            // Validations spécifiques
            if (type === 'SALLE' && (!filiere || !annee)) {
                throw new Error('Les élections par salle nécessitent filière et année');
            }

            if (type === 'ECOLE' && !ecole) {
                throw new Error('Les élections par école nécessitent le nom de l\'école');
            }

            // Insertion
            const [result] = await connection.execute(`
        INSERT INTO elections 
        (type, titre, description, dateDebut, dateFin, dateDebutCandidature, 
         dateFinCandidature, filiere, annee, ecole, niveau, delegueType, isActive, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())
      `, [
                type.toUpperCase(), titre, description, debutVote, finVote,
                debutCandidature, finCandidature, filiere, annee ? parseInt(annee) : null,
                ecole, niveau, delegueType
            ]);

            return result.insertId;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Clôturer une élection
    async closeElection(id) {
        let connection;
        try {
            connection = await pool.getConnection();
            await connection.execute(
                'UPDATE elections SET isActive = FALSE, dateFin = NOW() WHERE id = ?',
                [parseInt(id)]
            );
            return true;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Supprimer une élection
    async deleteElection(id) {
        let connection;
        try {
            connection = await pool.getConnection();
            const electionId = parseInt(id);

            await connection.beginTransaction();

            try {
                await connection.execute('DELETE FROM votes WHERE electionId = ?', [electionId]);
                await connection.execute('DELETE FROM candidates WHERE electionId = ?', [electionId]);
                await connection.execute('DELETE FROM vote_tokens WHERE electionId = ?', [electionId]);
                await connection.execute('DELETE FROM elections WHERE id = ?', [electionId]);

                await connection.commit();
                return true;
            } catch (error) {
                await connection.rollback();
                throw error;
            }
        } finally {
            if (connection) await connection.release();
        }
    }

    // Statistiques par type
    async getStatsByType(type, filters = {}) {
        let connection;
        try {
            connection = await pool.getConnection();
            const { filiere, annee, ecole } = filters;

            let whereClause = 'e.type = ?';
            let params = [type.toUpperCase()];

            if (type.toUpperCase() === 'SALLE') {
                if (filiere) {
                    whereClause += ' AND e.filiere = ?';
                    params.push(filiere);
                }
                if (annee) {
                    whereClause += ' AND e.annee = ?';
                    params.push(parseInt(annee));
                }
            } else if (type.toUpperCase() === 'ECOLE') {
                if (ecole) {
                    whereClause += ' AND e.ecole = ?';
                    params.push(ecole);
                }
            }

            const queries = [
                `SELECT COUNT(*) as count FROM elections e WHERE ${whereClause}`,
                `SELECT COUNT(*) as count FROM elections e WHERE ${whereClause} AND e.isActive = TRUE AND e.dateDebut <= ? AND e.dateFin >= ?`,
                `SELECT COUNT(*) as count FROM elections e WHERE ${whereClause} AND e.isActive = TRUE AND e.dateDebut > ?`,
                `SELECT COUNT(*) as count FROM elections e WHERE ${whereClause} AND (e.isActive = FALSE OR e.dateFin < ?)`,
                `SELECT COUNT(*) as count FROM votes v INNER JOIN elections e ON v.electionId = e.id WHERE ${whereClause}`,
                `SELECT COUNT(*) as count FROM candidates c INNER JOIN elections e ON c.electionId = e.id WHERE ${whereClause}`
            ];

            const queryParams = [
                params,
                [...params, new Date(), new Date()],
                [...params, new Date()],
                [...params, new Date()],
                params,
                params
            ];

            const results = await Promise.all(
                queries.map((query, index) =>
                    connection.execute(query, queryParams[index])
                )
            );

            return {
                totalElections: results[0][0][0].count,
                activeElections: results[1][0][0].count,
                upcomingElections: results[2][0][0].count,
                closedElections: results[3][0][0].count,
                totalVotes: results[4][0][0].count,
                totalCandidates: results[5][0][0].count
            };
        } finally {
            if (connection) await connection.release();
        }
    }
}

export default new ElectionService();