import pool from '../database/connection.js';

const Election = {
    // Trouver une élection par ID
    async findById(id) {
        const [rows] = await pool.execute(
            'SELECT * FROM elections WHERE id = ?',
            [id]
        );
        return rows[0];
    },

    // Trouver les élections actives
    async findActive() {
        const [rows] = await pool.execute(
            'SELECT * FROM elections WHERE isActive = TRUE AND dateFin > NOW() ORDER BY dateDebut DESC'
        );
        return rows;
    },

    // Créer une nouvelle élection
    async create(electionData) {
        const {
            type,
            titre,
            description,
            dateDebut,
            dateFin,
            dateDebutCandidature,
            dateFinCandidature,
            filiere,
            annee,
            ecole,
            niveau,
            delegueType
        } = electionData;

        const [result] = await pool.execute(
            `INSERT INTO elections 
      (type, titre, description, dateDebut, dateFin, dateDebutCandidature, dateFinCandidature, filiere, annee, ecole, niveau, delegueType) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [type, titre, description, dateDebut, dateFin, dateDebutCandidature, dateFinCandidature, filiere, annee, ecole, niveau, delegueType]
        );

        return { id: result.insertId, ...electionData };
    },

    // Mettre à jour une élection
    async update(id, electionData) {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(electionData)) {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (fields.length === 0) return null;

        values.push(id);
        const query = `UPDATE elections SET ${fields.join(', ')} WHERE id = ?`;

        await pool.execute(query, values);
        return this.findById(id);
    },

    // Changer le statut actif d'une élection
    async setActiveStatus(id, isActive) {
        await pool.execute(
            'UPDATE elections SET isActive = ? WHERE id = ?',
            [isActive, id]
        );
        return this.findById(id);
    },

    // Trouver les élections avec filtres
    async findAll(filters = {}, limit = 10, offset = 0) {
        let query = 'SELECT * FROM elections WHERE 1=1';
        const values = [];

        if (filters.type) {
            query += ' AND type = ?';
            values.push(filters.type);
        }

        if (filters.filiere) {
            query += ' AND filiere = ?';
            values.push(filters.filiere);
        }

        if (filters.ecole) {
            query += ' AND ecole = ?';
            values.push(filters.ecole);
        }

        if (filters.isActive !== undefined) {
            query += ' AND isActive = ?';
            values.push(filters.isActive);
        }

        query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
        values.push(limit, offset);

        const [rows] = await pool.execute(query, values);
        return rows;
    },

    // Compter le nombre d'élections avec filtres
    async count(filters = {}) {
        let query = 'SELECT COUNT(*) as total FROM elections WHERE 1=1';
        const values = [];

        if (filters.type) {
            query += ' AND type = ?';
            values.push(filters.type);
        }

        if (filters.filiere) {
            query += ' AND filiere = ?';
            values.push(filters.filiere);
        }

        if (filters.ecole) {
            query += ' AND ecole = ?';
            values.push(filters.ecole);
        }

        if (filters.isActive !== undefined) {
            query += ' AND isActive = ?';
            values.push(filters.isActive);
        }

        const [rows] = await pool.execute(query, values);
        return rows[0].total;
    }
};

export default Election;