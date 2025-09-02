import pool from '../database/connection.js';

const Candidate = {
    // Trouver un candidat par ID
    async findById(id) {
        const [rows] = await pool.execute(
            'SELECT * FROM candidates WHERE id = ?',
            [id]
        );
        return rows[0];
    },

    // Trouver les candidats d'une élection
    async findByElectionId(electionId, statut = null) {
        let query = 'SELECT * FROM candidates WHERE electionId = ?';
        const values = [electionId];

        if (statut) {
            query += ' AND statut = ?';
            values.push(statut);
        }

        query += ' ORDER BY nom, prenom';

        const [rows] = await pool.execute(query, values);
        return rows;
    },

    // Trouver les candidatures d'un utilisateur
    async findByUserId(userId) {
        const [rows] = await pool.execute(
            'SELECT * FROM candidates WHERE userId = ? ORDER BY createdAt DESC',
            [userId]
        );
        return rows;
    },

    // Créer une nouvelle candidature
    async create(candidateData) {
        const {
            nom,
            prenom,
            slogan,
            programme,
            motivation,
            photoUrl,
            userId,
            electionId
        } = candidateData;

        const [result] = await pool.execute(
            `INSERT INTO candidates 
      (nom, prenom, slogan, programme, motivation, photoUrl, userId, electionId) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [nom, prenom, slogan, programme, motivation, photoUrl, userId, electionId]
        );

        return { id: result.insertId, ...candidateData, statut: 'EN_ATTENTE' };
    },

    // Mettre à jour le statut d'une candidature
    async updateStatus(id, statut) {
        await pool.execute(
            'UPDATE candidates SET statut = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
            [statut, id]
        );
        return this.findById(id);
    },

    // Mettre à jour une candidature
    async update(id, candidateData) {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(candidateData)) {
            if (value !== undefined && key !== 'statut') {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (fields.length === 0) return null;

        fields.push('updatedAt = CURRENT_TIMESTAMP');
        values.push(id);

        const query = `UPDATE candidates SET ${fields.join(', ')} WHERE id = ?`;

        await pool.execute(query, values);
        return this.findById(id);
    },

    // Vérifier si un utilisateur est déjà candidat à une élection
    async isUserCandidate(userId, electionId) {
        const [rows] = await pool.execute(
            'SELECT COUNT(*) as count FROM candidates WHERE userId = ? AND electionId = ?',
            [userId, electionId]
        );
        return rows[0].count > 0;
    }
};

export default Candidate;