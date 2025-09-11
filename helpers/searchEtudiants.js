// helpers/searchEtudiants.js

/**
 * Recherche des étudiants par mot-clé (nom, prénom, matricule)
 * @param {string} keyword - Mot-clé à rechercher
 * @returns {Promise<Array>} - Liste des étudiants correspondants
 */
import pool from '../dbconfig.js';

export async function searchEtudiantsByKeyword(keyword) {
    const sanitized = `%${keyword.trim()}%`;

    const [rows] = await pool.execute(`
        SELECT 
            e.id, e.nom, e.prenom, e.matricule, e.filiere, e.annee, e.ecole,
            u.email, u.actif
        FROM etudiants e
        INNER JOIN users u ON e.userId = u.id
        WHERE 
            e.nom LIKE ? OR 
            e.prenom LIKE ? OR 
            e.matricule LIKE ?
    `, [sanitized, sanitized, sanitized]);

    return rows;
}
