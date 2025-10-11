import pool from '../dbconfig.js';
import ActivityManager from '../controllers/activityManager.js';
import NotificationService from '../services/notificationService.js';

/*FONCTIONS CÔTÉ ÉTUDIANT */

async function getMyCandidatures(userId) {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                c.id,
                c.electionId,
                c.nom,
                c.prenom,
                c.slogan,
                c.programme,
                c.motivation,
                c.photoUrl,
                c.statut,
                c.createdAt,
                c.updatedAt,
                e.titre AS electionTitre,
                e.type AS electionType,
                e.dateDebut AS electionDateDebut,
                e.dateFin AS electionDateFin,
                e.annee AS electionAnnee,
                e.niveau AS electionNiveau,
                ec.nom AS electionEcole,
                f.nom AS electionFiliere
            FROM candidates c
            INNER JOIN elections e ON c.electionId = e.id
            LEFT JOIN ecoles ec ON e.ecoleId = ec.id
            LEFT JOIN filieres f ON e.filiereId = f.id
            WHERE c.userId = ?
            ORDER BY c.createdAt DESC
        `, [userId]);

        return {
            success: true,
            data: rows,
            count: rows.length
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des candidatures:', error);
        throw error;
    }
}

async function getCandidatesByElection(electionId) {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                c.id,
                c.userId,
                c.nom,
                c.prenom,
                c.slogan,
                c.programme,
                c.motivation,
                c.photoUrl,
                c.statut,
                c.createdAt,
                c.updatedAt,
                u.email,
                e.annee,
                ec.nom AS nomEcole,
                f.nom AS nomFiliere,
                el.titre AS electionTitre,
                el.type AS electionType
            FROM candidates c
            INNER JOIN users u ON c.userId = u.id
            INNER JOIN etudiants e ON u.id = e.userId
            LEFT JOIN ecoles ec ON e.ecoleId = ec.id
            LEFT JOIN filieres f ON e.filiereId = f.id
            INNER JOIN elections el ON c.electionId = el.id
            WHERE c.electionId = ?
            ORDER BY 
                CASE c.statut 
                    WHEN 'APPROUVE' THEN 1
                    WHEN 'EN_ATTENTE' THEN 2
                    WHEN 'REJETE' THEN 3
                END,
                c.createdAt DESC
        `, [electionId]);

        return {
            success: true,
            data: rows,
            count: rows.length
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des candidats:', error);
        throw error;
    }
}

// Ajouter une candidature
async function addCandidature(data) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Vérifier si l'utilisateur a déjà candidaté pour cette élection
        const [existingCandidatures] = await connection.execute(
            `SELECT id FROM candidates WHERE userId = ? AND electionId = ?`,
            [data.userId, data.electionId]
        );

        if (existingCandidatures.length > 0) {
            throw new Error('Vous avez déjà soumis une candidature pour cette élection');
        }

        // Récupérer les informations de l'étudiant
        const [etudiantRows] = await connection.execute(
            `SELECT nom, prenom FROM etudiants WHERE userId = ?`,
            [data.userId]
        );


        if (etudiantRows.length === 0) {
            throw new Error('Aucun étudiant trouvé pour cet utilisateur');
        }

        const etudiant = etudiantRows[0];

        // Vérifier que l'élection existe et est ouverte
        const [electionRows] = await connection.execute(
            `SELECT titre, dateDebutCandidature, dateFinCandidature FROM elections WHERE id = ?`,
            [data.electionId]
        );

        if (electionRows.length === 0) {
            throw new Error('Élection non trouvée');
        }

        const election = electionRows[0];
        const now = new Date();
        const debutCandidature = new Date(election.dateDebutCandidature);
        const finCandidature = new Date(election.dateFinCandidature);

        if (now < debutCandidature) {
            throw new Error('Les candidatures ne sont pas encore ouvertes pour cette élection');
        }

        if (now > finCandidature) {
            throw new Error('Les candidatures sont closes pour cette élection');
        }

        // Insérer la candidature
        const [result] = await connection.execute(`
            INSERT INTO candidates 
            (userId, electionId, nom, prenom, slogan, programme, motivation, photoUrl, statut, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE', NOW())
        `, [
            data.userId,
            data.electionId,
            etudiant.nom,
            etudiant.prenom,
            data.slogan,
            data.programme,
            data.motivation,
            data.photoUrl
        ]);

        const candidatureId = result.insertId;

        // Log d’activité
        await ActivityManager.createActivityLog({
            action: 'Soumission de candidature',
            details: `Candidature soumise pour l'élection "${election.titre}"`,
            userId: data.userId,
            actionType: 'ETUDIANT'
        });

        // Notification à l’étudiant
        await NotificationService.notifyCandidaturePending({
            userId: data.userId,
            electionId: data.electionId,
            electionTitle: election.titre
        });

        await connection.commit();

        return {
            success: true,
            message: 'Candidature enregistrée avec succès',
            candidatureId
        };
    } catch (error) {
        await connection.rollback();
        console.error('Erreur lors de l\'ajout de la candidature:', error);
        throw error;
    } finally {
        connection.release();
    }
}
// Modifier une candidature
async function updateCandidature(candidatureId, updates) {
    try {
        const allowedFields = ['slogan', 'programme', 'motivation', 'photoUrl'];
        const filteredUpdates = Object.fromEntries(
            Object.entries(updates).filter(([key]) => allowedFields.includes(key))
        );

        if (Object.keys(filteredUpdates).length === 0) {
            throw new Error('Aucune donnée valide à mettre à jour');
        }

        const setClause = Object.keys(filteredUpdates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(filteredUpdates), candidatureId];

        await pool.execute(`UPDATE candidates SET ${setClause} WHERE id = ?`, values);

        return { success: true, message: 'Candidature modifiée avec succès' };
    } catch (error) {
        console.error('Erreur lors de la modification de la candidature:', error);
        throw error;
    }
}
// Supprimer une candidature
async function deleteCandidature(candidatureId) {
    try {
        // Récupérer les infos avant suppression
        const [rows] = await pool.execute(`
            SELECT userId, electionId FROM candidates WHERE id = ?
        `, [candidatureId]);

        if (rows.length === 0) {
            throw new Error('Candidature introuvable');
        }

        const { userId, electionId } = rows[0];

        await pool.execute('DELETE FROM candidates WHERE id = ?', [candidatureId]);

        await createActivityLog({
            action: 'Suppression de candidature',
            details: `Candidature supprimée pour l'élection ID ${electionId}`,
            userId,
            actionType: 'ADMIN'
        });

        return { success: true, message: 'Candidature supprimée avec succès' };
    } catch (error) {
        console.error('Erreur lors de la suppression de la candidature:', error);
        throw error;
    }
}

/* FONCTIONS CÔTÉ ADMIN */

// Changer le statut d'une candidature
async function updateCandidatureStatus(req, res) {
    try {
        const { id } = req.params;
        const { statut } = req.body;
        const adminUser = req.user;

        if (adminUser.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Accès interdit' });
        }


        if (!id || !statut) {
            return res.status(400).json({ error: 'Paramètres requis manquants' });
        }

        await pool.execute('UPDATE candidates SET statut = ? WHERE id = ?', [statut, id]);

        const [rows] = await pool.execute(
            `SELECT c.id, c.userId, c.electionId, e.titre AS electionTitle
             FROM candidates c
             JOIN elections e ON c.electionId = e.id
             WHERE c.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Candidature introuvable' });
        }

        const { userId, electionId, electionTitle } = rows[0];

        await ActivityManager.createActivityLog({
            action: 'Changement de statut de candidature',
            details: `Statut changé en "${statut}" pour l'élection "${electionTitle}"`,
            userId: adminUser.id,
            actionType: 'ADMIN'
        });

        if (statut === 'APPROUVE') {
            await NotificationService.notifyCandidatureApproval({ userId, electionId, electionTitle });
        } else if (statut === 'REJETÉ') {
            await NotificationService.notifyCandidatureRejection({ userId, electionId, electionTitle });
        }

        res.status(200).json({
            success: true,
            message: `Statut mis à jour vers "${statut}"`,
            candidatureId: id
        });

    } catch (error) {
        console.error('Erreur lors du changement de statut:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
}


// Statistiques 

async function getCandidatureStats(filters = {}) {
    try {
        const conditions = [];
        const values = [];

        if (filters.electionId) {
            conditions.push('c.electionId = ?');
            values.push(filters.electionId);
        }
        if (filters.ecoleId) {
            conditions.push('e.ecoleId = ?');
            values.push(filters.ecoleId);
        }
        if (filters.filiereId) {
            conditions.push('e.filiereId = ?');
            values.push(filters.filiereId);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await pool.execute(`
            SELECT 
                c.statut,
                COUNT(*) as count
            FROM candidates c
            INNER JOIN users u ON c.userId = u.id
            INNER JOIN etudiants e ON u.id = e.userId
            ${whereClause}
            GROUP BY c.statut
        `, values);

        const stats = {
            EN_ATTENTE: 0,
            APPROUVE: 0,
            REJETE: 0,
            TOTAL: 0
        };

        rows.forEach(row => {
            stats[row.statut] = row.count;
            stats.TOTAL += row.count;
        });

        return {
            success: true,
            stats,
            filters
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        throw error;
    }
}

async function getFilteredCandidatures({ filiereId, ecoleId, statut }) {
    try {
        const conditions = [];
        const values = [];

        if (filiereId) {
            conditions.push('e.filiereId = ?');
            values.push(filiereId);
        }
        if (ecoleId) {
            conditions.push('e.ecoleId = ?');
            values.push(ecoleId);
        }
        if (statut) {
            conditions.push('c.statut = ?');
            values.push(statut);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await pool.execute(`
            SELECT 
                c.id,
                e.nom,
                e.prenom,
                f.nom AS nomFiliere,
                ec.nom AS nomEcole,
                c.statut,
                c.createdAt AS dateSoumission,
                u.email,
                c.photoUrl,
                c.slogan,
                c.programme,
                c.motivation
            FROM candidates c
            INNER JOIN users u ON c.userId = u.id
            INNER JOIN etudiants e ON u.id = e.userId
            LEFT JOIN filieres f ON e.filiereId = f.id
            LEFT JOIN ecoles ec ON e.ecoleId = ec.id
            ${whereClause}
            ORDER BY c.createdAt DESC
        `, values);

        return rows;
    } catch (error) {
        console.error('Erreur lors du filtrage des candidatures:', error);
        throw error;
    }
}


async function getAllCandidatures() {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                c.id AS candidateId,
                c.userId,
                c.electionId,
                e.nom,
                e.prenom,
                e.annee,
                f.nom AS nomFiliere,
                ec.nom AS nomEcole,
                c.statut,
                c.createdAt AS dateSoumission,
                u.email,
                u.actif,
                c.photoUrl,
                c.slogan,
                c.programme,
                c.motivation,
                el.dateDebutCandidature,
                el.dateFinCandidature,
                el.niveau AS electionNiveau,
                el.titre AS electionTitre,
                el.isActive AS electionActive
            FROM candidates c
            INNER JOIN users u ON c.userId = u.id
            INNER JOIN etudiants e ON c.userId = e.userId
            LEFT JOIN filieres f ON e.filiereId = f.id
            LEFT JOIN ecoles ec ON e.ecoleId = ec.id
            LEFT JOIN elections el ON c.electionId = el.id
            ORDER BY c.createdAt DESC
        `);
        return rows;
    } catch (error) {
        console.error('Erreur lors de la récupération des candidatures:', error);
        throw error;
    }
}

async function searchCandidatures(searchTerm) {
    try {
        const term = `%${String(searchTerm).trim()}%`;
        const [rows] = await pool.execute(`
            SELECT 
                c.id AS candidateId,
                e.nom,
                e.prenom,
                f.nom AS nomFiliere,
                ec.nom AS nomEcole,
                c.statut,
                c.createdAt AS dateSoumission,
                u.email,
                c.photoUrl,
                c.slogan,
                c.programme,
                c.motivation
            FROM candidates c
            INNER JOIN etudiants e ON c.userId = e.userId
            INNER JOIN users u ON e.userId = u.id
            LEFT JOIN filieres f ON e.filiereId = f.id
            LEFT JOIN ecoles ec ON e.ecoleId = ec.id
            WHERE e.nom LIKE ? 
               OR e.prenom LIKE ? 
               OR u.email LIKE ?
            ORDER BY c.createdAt DESC
        `, [term, term, term]);
        return rows;
    } catch (error) {
        console.error('Erreur lors de la recherche de candidatures:', error);
        throw error;
    }
}

export default {
    // Étudiant
    getAllCandidatures,
    searchCandidatures,
    getFilteredCandidatures,
    addCandidature,
    updateCandidature,
    deleteCandidature,
    getMyCandidatures,
    getCandidatesByElection,

    // Admin
    updateCandidatureStatus,
    getCandidatureStats
};
