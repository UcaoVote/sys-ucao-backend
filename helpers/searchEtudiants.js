// helpers/searchEtudiants.js

/**
 * Recherche des étudiants par mot-clé (nom, prénom, matricule)
 * @param {string} keyword - Mot-clé à rechercher
 * @returns {Promise<Array>} - Liste des étudiants correspondants
 */
import pool from '../database/dbconfig.js';

export async function searchEtudiantsByKeyword(keyword) {
    const sanitized = `%${keyword.trim()}%`;

    const [rows] = await pool.execute(`
        SELECT 
            e.id, e.nom, e.prenom, e.matricule, e.annee, 
            e.ecoleId, e.filiereId, e.photoUrl, e.whatsapp,
            u.email, u.actif,
            ec.nom as ecole, f.nom as filiere
        FROM etudiants e
        LEFT JOIN users u ON e.userId = u.id
        LEFT JOIN ecoles ec ON e.ecoleId = ec.id
        LEFT JOIN filieres f ON e.filiereId = f.id
        WHERE 
            e.nom LIKE ? OR 
            e.prenom LIKE ? OR 
            e.matricule LIKE ?
    `, [sanitized, sanitized, sanitized]);

    return rows;
}
