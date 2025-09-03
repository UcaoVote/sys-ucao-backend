import pool from '../config/database.js';

class CandidatService {

    // Récupérer les candidats d'une élection
    async getCandidatesByElection(electionId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [electionRows] = await connection.execute(
                'SELECT id, titre, type FROM elections WHERE id = ?',
                [parseInt(electionId)]
            );

            if (electionRows.length === 0) {
                throw new Error('Élection non trouvée');
            }

            const [candidateRows] = await connection.execute(`
        SELECT 
          c.*,
          u.email,
          e.nom as etudiant_nom,
          e.prenom as etudiant_prenom,
          e.filiere,
          e.annee,
          e.ecole,
          e.photoUrl as etudiant_photoUrl,
          el.titre as election_titre,
          el.type as election_type,
          (SELECT COUNT(*) FROM votes v WHERE v.candidateId = c.id) as votes_count
        FROM candidates c
        LEFT JOIN users u ON c.userId = u.id
        LEFT JOIN etudiants e ON u.id = e.userId
        LEFT JOIN elections el ON c.electionId = el.id
        WHERE c.electionId = ? AND c.statut = 'APPROUVE'
        ORDER BY c.createdAt DESC
      `, [parseInt(electionId)]);

            return {
                election: electionRows[0],
                candidates: candidateRows,
                totalCandidates: candidateRows.length
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Vérifier si un utilisateur est candidat
    async isUserCandidate(userId, electionId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [electionRows] = await connection.execute(
                'SELECT id, titre, type FROM elections WHERE id = ?',
                [parseInt(electionId)]
            );

            if (electionRows.length === 0) {
                throw new Error('Élection non trouvée');
            }

            const [candidateRows] = await connection.execute(`
        SELECT 
          c.*,
          el.titre as election_titre,
          el.type as election_type
        FROM candidates c
        LEFT JOIN elections el ON c.electionId = el.id
        WHERE c.userId = ? AND c.electionId = ?
      `, [userId, parseInt(electionId)]);

            return {
                isCandidate: candidateRows.length > 0,
                candidate: candidateRows[0] || null,
                election: electionRows[0]
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Récupérer les candidatures d'un utilisateur
    async getUserCandidatures(userId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [candidatureRows] = await connection.execute(`
        SELECT 
          c.*,
          el.id as election_id,
          el.titre as election_titre,
          el.type as election_type,
          el.description as election_description,
          el.dateDebut as election_dateDebut,
          el.dateFin as election_dateFin,
          (SELECT COUNT(*) FROM votes v WHERE v.candidateId = c.id) as votes_count
        FROM candidates c
        LEFT JOIN elections el ON c.electionId = el.id
        WHERE c.userId = ?
        ORDER BY c.createdAt DESC
      `, [userId]);

            return {
                candidatures: candidatureRows,
                total: candidatureRows.length
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Récupérer un candidat spécifique
    async getCandidateById(candidateId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [candidateRows] = await connection.execute(`
        SELECT 
          c.*,
          u.email,
          e.nom as etudiant_nom,
          e.prenom as etudiant_prenom,
          e.filiere,
          e.annee,
          e.ecole,
          e.photoUrl as etudiant_photoUrl,
          el.titre as election_titre,
          el.type as election_type,
          COUNT(v.id) as votes_count
        FROM candidates c
        LEFT JOIN users u ON c.userId = u.id
        LEFT JOIN etudiants e ON u.id = e.userId
        LEFT JOIN elections el ON c.electionId = el.id
        LEFT JOIN votes v ON c.id = v.candidateId
        WHERE c.id = ?
        GROUP BY c.id
      `, [parseInt(candidateId)]);

            if (candidateRows.length === 0) {
                throw new Error('Candidat non trouvé');
            }

            return candidateRows[0];
        } finally {
            if (connection) await connection.release();
        }
    }

    // Créer une candidature
    async createCandidature(candidatureData, userId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const { electionId, slogan, photo, programme, motivation } = candidatureData;

            // Validation des champs
            if (!electionId || !slogan || !photo || !programme || !motivation) {
                throw new Error('Tous les champs sont requis');
            }

            // Vérifier l'utilisateur
            const [userRows] = await connection.execute(`
        SELECT u.*, e.nom, e.prenom 
        FROM users u 
        LEFT JOIN etudiants e ON u.id = e.userId 
        WHERE u.id = ?
      `, [userId]);

            if (userRows.length === 0) {
                throw new Error('Utilisateur inexistant');
            }

            // Vérifier l'élection
            const [electionRows] = await connection.execute(
                'SELECT id FROM elections WHERE id = ?',
                [parseInt(electionId)]
            );

            if (electionRows.length === 0) {
                throw new Error('Élection inexistante');
            }

            // Vérifier candidature existante
            const [existingCandidateRows] = await connection.execute(
                'SELECT id FROM candidates WHERE userId = ? AND electionId = ?',
                [userId, parseInt(electionId)]
            );

            if (existingCandidateRows.length > 0) {
                throw new Error('Déjà candidat à cette élection');
            }

            // Récupérer nom et prénom
            const user = userRows[0];
            let nom = user.nom || 'Candidat';
            let prenom = user.prenom || 'Étudiant';

            // Validation des longueurs
            if (nom.length > 100) nom = nom.substring(0, 100);
            if (prenom.length > 100) prenom = prenom.substring(0, 100);
            if (slogan.length > 200) throw new Error('Slogan trop long (max 200 caractères)');
            if (photo.length > 500) throw new Error('URL photo trop longue');

            // Création
            const [result] = await connection.execute(`
        INSERT INTO candidates (nom, prenom, slogan, programme, motivation, photoUrl, userId, electionId, statut, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE', NOW(), NOW())
      `, [nom, prenom, slogan, programme, motivation, photo, userId, parseInt(electionId)]);

            return result.insertId;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Mettre à jour le programme
    async updateProgramme(candidateId, programme, userId) {
        let connection;
        try {
            connection = await pool.getConnection();

            // Vérifier propriété
            const [candidateRows] = await connection.execute(
                'SELECT id, userId FROM candidates WHERE id = ?',
                [parseInt(candidateId)]
            );

            if (candidateRows.length === 0) {
                throw new Error('Candidat introuvable');
            }

            if (candidateRows[0].userId !== userId) {
                throw new Error('Non autorisé');
            }

            await connection.execute(
                'UPDATE candidates SET programme = ?, updatedAt = NOW() WHERE id = ?',
                [programme, parseInt(candidateId)]
            );

            return true;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Mettre à jour un candidat (admin)
    async updateCandidate(candidateId, updateData) {
        let connection;
        try {
            connection = await pool.getConnection();

            const { nom, prenom, programme, photoUrl } = updateData;

            const updateFields = [];
            const updateValues = [];

            if (nom) {
                updateFields.push('nom = ?');
                updateValues.push(nom);
            }
            if (prenom) {
                updateFields.push('prenom = ?');
                updateValues.push(prenom);
            }
            if (programme !== undefined) {
                updateFields.push('programme = ?');
                updateValues.push(programme);
            }
            if (photoUrl !== undefined) {
                updateFields.push('photoUrl = ?');
                updateValues.push(photoUrl);
            }

            if (updateFields.length === 0) {
                throw new Error('Aucun champ à mettre à jour');
            }

            updateValues.push(parseInt(candidateId));

            await connection.execute(
                `UPDATE candidates SET ${updateFields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
                updateValues
            );

            // Récupérer le candidat mis à jour
            const [updatedCandidateRows] = await connection.execute(`
        SELECT c.*, u.email, e.* 
        FROM candidates c
        LEFT JOIN users u ON c.userId = u.id
        LEFT JOIN etudiants e ON u.id = e.userId
        WHERE c.id = ?
      `, [parseInt(candidateId)]);

            return updatedCandidateRows[0];
        } finally {
            if (connection) await connection.release();
        }
    }

    // Supprimer un candidat (admin)
    async deleteCandidate(candidateId) {
        let connection;
        try {
            connection = await pool.getConnection();

            await connection.execute(
                'DELETE FROM candidates WHERE id = ?',
                [parseInt(candidateId)]
            );

            return true;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Lister les candidats avec filtres (admin)
    async listCandidates(filters = {}) {
        let connection;
        try {
            connection = await pool.getConnection();

            const { electionId, statut, search, page = 1, limit = 10 } = filters;

            let whereConditions = ['1=1'];
            let params = [];

            if (electionId && electionId !== 'all') {
                whereConditions.push('c.electionId = ?');
                params.push(parseInt(electionId));
            }

            if (statut && statut !== 'all') {
                whereConditions.push('c.statut = ?');
                params.push(statut);
            }

            if (search) {
                whereConditions.push(`(
          c.nom LIKE ? OR 
          c.prenom LIKE ? OR 
          u.email LIKE ? OR 
          e.matricule LIKE ? OR 
          e.filiere LIKE ? OR 
          el.titre LIKE ?
        )`);
                const searchPattern = `%${search}%`;
                for (let i = 0; i < 6; i++) params.push(searchPattern);
            }

            const whereClause = whereConditions.join(' AND ');
            const offset = (parseInt(page) - 1) * parseInt(limit);
            const queryParams = [...params, parseInt(limit), offset];

            const [candidateRows] = await connection.execute(`
        SELECT 
          c.*,
          u.email,
          e.matricule,
          e.filiere,
          e.annee,
          e.ecole,
          e.photoUrl as etudiant_photoUrl,
          el.id as election_id,
          el.titre as election_titre,
          el.type as election_type,
          el.dateDebut as election_dateDebut,
          el.dateFin as election_dateFin,
          COUNT(v.id) as votes_count
        FROM candidates c
        LEFT JOIN users u ON c.userId = u.id
        LEFT JOIN etudiants e ON u.id = e.userId
        LEFT JOIN elections el ON c.electionId = el.id
        LEFT JOIN votes v ON c.id = v.candidateId
        WHERE ${whereClause}
        GROUP BY c.id
        ORDER BY c.createdAt DESC
        LIMIT ? OFFSET ?
      `, queryParams);

            // Compter le total
            const [countRows] = await connection.execute(`
        SELECT COUNT(*) as total 
        FROM candidates c
        LEFT JOIN users u ON c.userId = u.id
        LEFT JOIN etudiants e ON u.id = e.userId
        LEFT JOIN elections el ON c.electionId = el.id
        WHERE ${whereClause}
      `, params);

            return {
                candidates: candidateRows,
                total: countRows[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Statistiques candidats (admin)
    async getCandidateStats() {
        let connection;
        try {
            connection = await pool.getConnection();

            const [totalRows] = await connection.execute('SELECT COUNT(*) as total FROM candidates');
            const [enAttenteRows] = await connection.execute('SELECT COUNT(*) as count FROM candidates WHERE statut = "EN_ATTENTE"');
            const [approuvesRows] = await connection.execute('SELECT COUNT(*) as count FROM candidates WHERE statut = "APPROUVE"');
            const [rejetesRows] = await connection.execute('SELECT COUNT(*) as count FROM candidates WHERE statut = "REJETE"');

            return {
                total: totalRows[0].total,
                enAttente: enAttenteRows[0].count,
                approuves: approuvesRows[0].count,
                rejetes: rejetesRows[0].count
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Mettre à jour le statut (admin)
    async updateCandidateStatus(candidateId, statut) {
        let connection;
        try {
            connection = await pool.getConnection();

            // Vérifier le candidat
            const [candidateRows] = await connection.execute(`
        SELECT c.*, u.email, e.nom, e.prenom, e.matricule, e.filiere, e.annee, e.ecole
        FROM candidates c
        LEFT JOIN users u ON c.userId = u.id
        LEFT JOIN etudiants e ON u.id = e.userId
        WHERE c.id = ?
      `, [parseInt(candidateId)]);

            if (candidateRows.length === 0) {
                throw new Error('Candidat non trouvé');
            }

            await connection.execute(
                'UPDATE candidates SET statut = ?, updatedAt = NOW() WHERE id = ?',
                [statut, parseInt(candidateId)]
            );

            return candidateRows[0];
        } finally {
            if (connection) await connection.release();
        }
    }

    // Récupérer les détails complets (admin)
    async getCandidateDetails(candidateId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [candidateRows] = await connection.execute(`
        SELECT 
          c.*,
          u.email,
          u.createdAt as user_createdAt,
          e.id as etudiant_id,
          e.matricule,
          e.nom as etudiant_nom,
          e.prenom as etudiant_prenom,
          e.filiere,
          e.annee,
          e.ecole,
          e.photoUrl as etudiant_photoUrl,
          el.id as election_id,
          el.titre as election_titre,
          el.type as election_type,
          el.description as election_description,
          el.dateDebut as election_dateDebut,
          el.dateFin as election_dateFin,
          el.dateDebutCandidature as election_dateDebutCandidature,
          el.dateFinCandidature as election_dateFinCandidature,
          COUNT(v.id) as votes_count
        FROM candidates c
        LEFT JOIN users u ON c.userId = u.id
        LEFT JOIN etudiants e ON u.id = e.userId
        LEFT JOIN elections el ON c.electionId = el.id
        LEFT JOIN votes v ON c.id = v.candidateId
        WHERE c.id = ?
        GROUP BY c.id
      `, [parseInt(candidateId)]);

            if (candidateRows.length === 0) {
                throw new Error('Candidat non trouvé');
            }

            const candidate = candidateRows[0];

            // Récupérer les votes récents
            const [voteRows] = await connection.execute(`
        SELECT 
          v.*,
          u.email,
          e.matricule,
          e.filiere,
          e.annee
        FROM votes v
        LEFT JOIN users u ON v.userId = u.id
        LEFT JOIN etudiants e ON u.id = e.userId
        WHERE v.candidateId = ?
        ORDER BY v.createdAt DESC
        LIMIT 10
      `, [parseInt(candidateId)]);

            return {
                candidate: candidate,
                votes: voteRows
            };
        } finally {
            if (connection) await connection.release();
        }
    }
}

export default new CandidatService();