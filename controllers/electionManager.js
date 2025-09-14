import pool from '../dbconfig.js'
import { paginateResults } from '../helpers/paginate.js';
import NotificationService from '../services/notificationService.js';
import ActivityManager from '../controllers/activityManager.js';


function toMySQLDateTime(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toISOString().slice(0, 19).replace('T', ' ');
}


async function getStudentInfo(userId) {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                e.userId,
                e.annee,
                e.filiereId,
                f.nom AS nomFiliere,
                e.ecoleId,
                ec.nom AS nomEcole
            FROM etudiants e
            LEFT JOIN filieres f ON f.id = e.filiereId
            LEFT JOIN ecoles ec ON ec.id = e.ecoleId
            WHERE e.userId = ?
        `, [userId]);

        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('Erreur lors de la récupération des informations étudiant:', error);
        throw error;
    }
}

async function getElectionsForStudent(filiereId, annee, ecoleId) {
    try {
        const query = `
        SELECT 
            e.id,
            e.type,
            e.titre,
            e.description,
            e.dateDebut,
            e.dateFin,
            e.dateDebutCandidature,
            e.dateFinCandidature,
            e.filiereId,
            f.nom AS nomFiliere,
            e.annee,
            e.ecoleId,
            ec.nom AS nomEcole,
            e.niveau,
            e.delegueType,
            e.isActive,
            CASE 
                WHEN NOW() < e.dateDebutCandidature THEN 'À_VENIR'
                WHEN NOW() BETWEEN e.dateDebutCandidature AND e.dateFinCandidature THEN 'CANDIDATURE'
                WHEN NOW() BETWEEN e.dateDebut AND e.dateFin THEN 'EN_COURS'
                WHEN NOW() > e.dateFin THEN 'TERMINÉE'
                ELSE 'INCONNU'
            END AS statut
        FROM elections e
        LEFT JOIN filieres f ON f.id = e.filiereId
        LEFT JOIN ecoles ec ON ec.id = e.ecoleId
        WHERE e.isActive = TRUE
        AND (
            (e.type = 'SALLE' AND e.filiereId = ? AND e.annee = ? AND e.ecoleId = ?)
            OR (e.type = 'ECOLE' AND e.ecoleId = ?)
            OR (e.type = 'UNIVERSITE')
        )
        ORDER BY 
            CASE 
                WHEN NOW() BETWEEN e.dateDebut AND e.dateFin THEN 1
                WHEN NOW() BETWEEN e.dateDebutCandidature AND e.dateFinCandidature THEN 2
                WHEN NOW() < e.dateDebutCandidature THEN 3
                ELSE 4
            END,
            e.dateDebut DESC
        `;

        const [rows] = await pool.execute(query, [filiereId, annee, ecoleId, ecoleId]);
        return rows;
    } catch (error) {
        console.error('Erreur dans getElectionsForStudent:', error);
        throw error;
    }
}

async function getAllElections() {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                e.id,
                e.type,
                e.titre,
                e.description,
                e.dateDebut,
                e.dateFin,
                e.dateDebutCandidature,
                e.dateFinCandidature,
                e.filiereId,
                f.nom AS nomFiliere,
                e.annee,
                e.ecoleId,
                ec.nom AS nomEcole,
                e.niveau,
                e.delegueType,
                e.isActive,
                e.createdAt
            FROM elections e
            LEFT JOIN filieres f ON f.id = e.filiereId
            LEFT JOIN ecoles ec ON ec.id = e.ecoleId
            ORDER BY e.createdAt DESC
        `);

        return rows;
    } catch (error) {
        console.error('Erreur lors de la récupération des élections:', error);
        throw error;
    }
}

async function getElectionById(id) {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                e.id, e.type, e.titre, e.description,
                e.dateDebut, e.dateFin, e.dateDebutCandidature, e.dateFinCandidature,
                e.filiereId, f.nom AS nomFiliere,
                e.annee, e.ecoleId, ec.nom AS nomEcole,
                e.niveau, e.delegueType, e.isActive, e.createdAt
            FROM elections e
            LEFT JOIN filieres f ON f.id = e.filiereId
            LEFT JOIN ecoles ec ON ec.id = e.ecoleId
            WHERE e.id = ?
        `, [id]);

        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('Erreur lors de la récupération :', error);
        throw error;
    }
}

async function updateElection(id, electionData) {
    try {
        const {
            type, titre, description, dateDebut, dateFin,
            dateDebutCandidature, dateFinCandidature,
            filiereId, annee, ecoleId, niveau, delegueType, isActive
        } = electionData;

        const query = `
            UPDATE elections 
            SET type = ?, titre = ?, description = ?, dateDebut = ?, dateFin = ?,
                dateDebutCandidature = ?, dateFinCandidature = ?, filiereId = ?,
                annee = ?, ecoleId = ?, niveau = ?, delegueType = ?, isActive = ?
            WHERE id = ?
        `;

        const values = [
            type, titre, description, dateDebut, dateFin,
            dateDebutCandidature, dateFinCandidature, filiereId,
            annee, ecoleId, niveau, delegueType, isActive, id
        ];

        const [result] = await pool.execute(query, values);
        return result.affectedRows;
    } catch (error) {
        console.error('Erreur lors de la modification :', error);
        throw error;
    }
}

async function deleteElection(id) {
    try {
        // Vérifier d'abord s'il y a des données liées
        const checkQuery = `
    SELECT 
      (SELECT COUNT(*) FROM candidates WHERE electionId = ?) AS nb_candidates,
      (SELECT COUNT(*) FROM votes WHERE electionId = ?) AS nb_votes,
      (SELECT COUNT(*) FROM vote_tokens WHERE electionId = ?) AS nb_tokens
  `;

        const [results] = await pool.execute(checkQuery, [id, id, id]);
        const { nb_candidates, nb_votes, nb_tokens } = results[0];

        if (nb_candidates > 0 || nb_votes > 0 || nb_tokens > 0) {
            throw new Error('Impossible de supprimer cette élection car des données y sont associées');
        }

        // Supprimer l'élection
        const deleteQuery = `DELETE FROM elections WHERE id = ?`;
        const [result] = await pool.execute(deleteQuery, [id]);
        return result.affectedRows;

    } catch (error) {
        console.error('Erreur lors de la suppression :', error);
        throw error;
    }
}

async function getActiveElections() {
    try {
        const [rows] = await pool.execute(`
        SELECT 
            e.id,
            e.type,
            e.titre,
            e.description,
            e.dateDebut,
            e.dateFin,
            e.dateDebutCandidature,
            e.dateFinCandidature,
            e.filiereId,
            f.nom AS nomFiliere,
            e.annee,
            e.ecoleId,
            ec.nom AS nomEcole,
            e.niveau,
            e.delegueType,
            e.isActive,
            e.createdAt
        FROM elections e
        LEFT JOIN filieres f ON f.id = e.filiereId
        LEFT JOIN ecoles ec ON ec.id = e.ecoleId
        WHERE e.isActive = TRUE
        AND e.dateDebut <= NOW()
        AND e.dateFin >= NOW()
        ORDER BY e.dateDebut DESC
        `);

        return rows;
    } catch (error) {
        console.error('Erreur dans getActiveElections :', error);
        throw error;
    }
}

async function getElectionsWithFilters(filters) {
    try {
        const {
            type,
            ecoleId,
            filiereId,
            annee,
            niveau,
            statut,
            page = 1,
            limit = 10
        } = filters;

        let query = `
            SELECT 
                e.id,
                e.type,
                e.titre,
                e.description,
                e.dateDebut,
                e.dateFin,
                e.dateDebutCandidature,
                e.dateFinCandidature,
                e.filiereId,
                f.nom AS nomFiliere,
                e.annee,
                e.ecoleId,
                ec.nom AS nomEcole,
                e.niveau,
                e.delegueType,
                e.isActive,
                e.createdAt,
                CASE 
                    WHEN NOW() < e.dateDebutCandidature THEN 'À_VENIR'
                    WHEN NOW() BETWEEN e.dateDebutCandidature AND e.dateFinCandidature THEN 'CANDIDATURE'
                    WHEN NOW() BETWEEN e.dateDebut AND e.dateFin THEN 'EN_COURS'
                    WHEN NOW() > e.dateFin THEN 'TERMINÉE'
                    ELSE 'INCONNU'
                END AS statut,
                (SELECT COUNT(*) FROM candidates c WHERE c.electionId = e.id AND c.statut = 'APPROUVE') AS nb_candidats,
                (SELECT COUNT(*) FROM votes v WHERE v.electionId = e.id) AS nb_votes
            FROM elections e
            LEFT JOIN filieres f ON f.id = e.filiereId
            LEFT JOIN ecoles ec ON ec.id = e.ecoleId
            WHERE e.isActive = TRUE
        `;

        const params = [];

        if (type) {
            query += ' AND e.type = ?';
            params.push(type);
        }
        if (ecoleId) {
            query += ' AND e.ecoleId = ?';
            params.push(ecoleId);
        }
        if (filiereId) {
            query += ' AND e.filiereId = ?';
            params.push(filiereId);
        }
        if (annee) {
            query += ' AND e.annee = ?';
            params.push(annee);
        }
        if (niveau) {
            query += ' AND e.niveau = ?';
            params.push(niveau);
        }
        if (statut) {
            switch (statut) {
                case 'À_VENIR':
                    query += ' AND NOW() < e.dateDebutCandidature';
                    break;
                case 'CANDIDATURE':
                    query += ' AND NOW() BETWEEN e.dateDebutCandidature AND e.dateFinCandidature';
                    break;
                case 'EN_COURS':
                    query += ' AND NOW() BETWEEN e.dateDebut AND e.dateFin';
                    break;
                case 'TERMINÉE':
                    query += ' AND NOW() > e.dateFin';
                    break;
            }
        }

        query += ' ORDER BY e.dateDebut DESC';

        const [rows] = await pool.execute(query, params);
        const paginated = paginateResults(rows, page, limit);

        return {
            elections: paginated.results,
            pagination: {
                page: paginated.page,
                limit: paginated.limit,
                total: paginated.total,
                pages: paginated.pages
            }
        };
    } catch (error) {
        console.error('Erreur dans getElectionsWithFilters:', error);
        throw error;
    }
}

async function createElection(req, res) {
    try {
        const {
            type, titre, description, dateDebut, dateFin,
            dateDebutCandidature, dateFinCandidature, filiereId,
            annee, ecoleId, niveau, delegueType, resultsVisibility, tour
        } = req.body;

        // Validation des données obligatoires
        if (!type || !titre || !dateDebut || !dateFin ||
            !dateDebutCandidature || !dateFinCandidature || !niveau) {
            return res.status(400).json({ error: 'Données manquantes' });
        }

        // Utilitaire safe avec valeur par défaut
        const safeValue = (value, def = null) =>
            value === undefined || value === '' ? def : value;

        const safeFiliereId = (type === 'ECOLE') ? null : safeValue(filiereId);


        // Préparation de l'insertion
        const query = `
    INSERT INTO elections (
        type, titre, description, dateDebut, dateFin, 
        dateDebutCandidature, dateFinCandidature, filiereId, 
        annee, ecoleId, niveau, delegueType, resultsVisibility, tour, responsableType
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;


        const values = [
            safeValue(type),
            safeValue(titre),
            safeValue(description, ''),
            toMySQLDateTime(dateDebut),
            toMySQLDateTime(dateFin),
            toMySQLDateTime(dateDebutCandidature),
            toMySQLDateTime(dateFinCandidature),
            safeFiliereId,
            safeValue(annee),
            safeValue(ecoleId),
            safeValue(niveau),
            safeValue(delegueType),
            safeValue(resultsVisibility),
            safeValue(tour, 1),
            safeValue(responsableType)
        ];


        const [result] = await pool.execute(query, values);
        const electionId = result.insertId;

        // Création du log d'activité
        try {
            await ActivityManager.insertActivityLog({
                action: 'Création d\'une élection',
                details: `Élection "${titre}" créée`,
                userId: req.user?.id ?? null,
                actionType: 'ADMIN'
            });
        } catch (logError) {
            console.error('Erreur lors de la création du log:', logError);
        }

        // Récupérer les étudiants concernés
        let studentsQuery = `
            SELECT userId 
            FROM etudiants e
            JOIN users u ON e.userId = u.id
            WHERE u.actif = TRUE
        `;
        let studentsParams = [];

        if (type === 'SALLE') {
            studentsQuery += ' AND e.filiereId = ? AND e.annee = ? AND e.ecoleId = ?';
            studentsParams = [filiereId, annee, ecoleId];
        } else if (type === 'ECOLE') {
            studentsQuery += ' AND e.ecoleId = ?';
            studentsParams = [ecoleId];
        }

        const [students] = await pool.execute(studentsQuery, studentsParams);
        console.log('Étudiants ciblés pour notification:', students);

        const destinataires = students
            .map(s => s.userId)
            .filter(id => id !== undefined && id !== null);

        // Notifications
        try {
            if (destinataires.length > 0) {
                await NotificationService.notifyNewElection(
                    { id: electionId, titre, description },
                    destinataires
                );
            } else {
                console.warn(`Aucun étudiant actif trouvé pour l'élection "${titre}"`);
            }
        } catch (notifyError) {
            console.error('Erreur lors de l\'envoi des notifications:', notifyError);
        }

        res.status(201).json({
            message: 'Élection créée avec succès',
            electionId: electionId
        });
    } catch (error) {
        console.error('Erreur lors de la création de l\'élection:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
}


export default {
    getStudentInfo,
    getAllElections,
    getElectionById,
    createElection,
    updateElection,
    deleteElection,
    getActiveElections,
    getElectionsForStudent,
    getElectionsWithFilters
};