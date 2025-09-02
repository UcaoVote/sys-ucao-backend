import pool from '../database/connection.js';

const Etudiant = {
    // Trouver un étudiant par son ID
    async findById(id) {
        const [rows] = await pool.execute(
            'SELECT * FROM etudiants WHERE id = ?',
            [id]
        );
        return rows[0];
    },

    // Trouver un étudiant par son userId
    async findByUserId(userId) {
        const [rows] = await pool.execute(
            'SELECT * FROM etudiants WHERE userId = ?',
            [userId]
        );
        return rows[0];
    },

    // Trouver par matricule
    async findByMatricule(matricule) {
        const [rows] = await pool.execute(
            'SELECT * FROM etudiants WHERE matricule = ?',
            [matricule]
        );
        return rows[0];
    },

    // Créer un nouvel étudiant
    async create(etudiantData) {
        const {
            userId,
            matricule,
            codeInscription,
            identifiantTemporaire,
            nom,
            prenom,
            filiere,
            annee,
            photoUrl,
            ecole
        } = etudiantData;

        const [result] = await pool.execute(
            `INSERT INTO etudiants 
      (userId, matricule, codeInscription, identifiantTemporaire, nom, prenom, filiere, annee, photoUrl, ecole) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, matricule, codeInscription, identifiantTemporaire, nom, prenom, filiere, annee, photoUrl, ecole]
        );

        return { id: result.insertId, ...etudiantData };
    },

    // Mettre à jour un étudiant
    async update(id, etudiantData) {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(etudiantData)) {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (fields.length === 0) return null;

        values.push(id);
        const query = `UPDATE etudiants SET ${fields.join(', ')} WHERE id = ?`;

        await pool.execute(query, values);
        return this.findById(id);
    },

    // Trouver tous les étudiants avec filtre optionnel
    async findAll(filters = {}, limit = 10, offset = 0) {
        let query = 'SELECT * FROM etudiants WHERE 1=1';
        const values = [];

        if (filters.filiere) {
            query += ' AND filiere = ?';
            values.push(filters.filiere);
        }

        if (filters.ecole) {
            query += ' AND ecole = ?';
            values.push(filters.ecole);
        }

        if (filters.annee) {
            query += ' AND annee = ?';
            values.push(filters.annee);
        }

        query += ' ORDER BY nom, prenom LIMIT ? OFFSET ?';
        values.push(limit, offset);

        const [rows] = await pool.execute(query, values);
        return rows;
    },

    // Compter le nombre d'étudiants avec filtres
    async count(filters = {}) {
        let query = 'SELECT COUNT(*) as total FROM etudiants WHERE 1=1';
        const values = [];

        if (filters.filiere) {
            query += ' AND filiere = ?';
            values.push(filters.filiere);
        }

        if (filters.ecole) {
            query += ' AND ecole = ?';
            values.push(filters.ecole);
        }

        if (filters.annee) {
            query += ' AND annee = ?';
            values.push(filters.annee);
        }

        const [rows] = await pool.execute(query, values);
        return rows[0].total;
    }
};

export default Etudiant;