import pool from '../database/dbconfig.js'
import { paginateResults } from '../helpers/paginate.js';
import NotificationService from '../services/notificationService.js';
import ActivityManager from '../controllers/activityManager.js';


function toMySQLDateTime(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Copie automatiquement les candidats approuvés d'une élection Tour 1 vers une élection Tour 2
 * @param {number} tour2ElectionId - ID de l'élection Tour 2
 * @param {number} tour1ElectionId - ID de l'élection Tour 1 parent
 */
async function copyCandidatesFromParent(tour2ElectionId, tour1ElectionId) {
    try {
        // Récupérer tous les candidats APPROUVÉS du Tour 1
        const [tour1Candidates] = await pool.execute(`
            SELECT 
                userId, 
                photoUrl, 
                description, 
                program,
                dateCreation
            FROM candidates 
            WHERE electionId = ? 
            AND status = 'APPROUVEE'
        `, [tour1ElectionId]);

        if (tour1Candidates.length === 0) {
            console.log('ℹ️ Aucun candidat approuvé à copier depuis le Tour 1');
            return 0;
        }

        // Insérer les candidats dans le Tour 2 avec statut APPROUVEE
        let copiedCount = 0;
        for (const candidate of tour1Candidates) {
            try {
                await pool.execute(`
                    INSERT INTO candidates (
                        electionId, 
                        userId, 
                        photoUrl, 
                        description, 
                        program, 
                        status, 
                        dateCreation
                    ) VALUES (?, ?, ?, ?, ?, 'APPROUVEE', NOW())
                `, [
                    tour2ElectionId,
                    candidate.userId,
                    candidate.photoUrl || null,
                    candidate.description || null,
                    candidate.program || null
                ]);
                copiedCount++;
            } catch (insertError) {
                // Si le candidat existe déjà (contrainte unique), on l'ignore
                if (insertError.code === 'ER_DUP_ENTRY') {
                    console.log(`⚠️ Candidat userId=${candidate.userId} déjà présent dans Tour 2`);
                } else {
                    throw insertError;
                }
            }
        }

        console.log(`✅ ${copiedCount} candidat(s) copié(s) du Tour 1 (ID: ${tour1ElectionId}) vers Tour 2 (ID: ${tour2ElectionId})`);
        return copiedCount;

    } catch (error) {
        console.error('❌ Erreur lors de la copie des candidats:', error);
        throw error;
    }
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
            END AS statut,
            (SELECT COUNT(*) FROM candidates c WHERE c.electionId = e.id AND c.statut = 'APPROUVE') AS nb_candidats,
            (SELECT COUNT(*) FROM votes v WHERE v.electionId = e.id) AS nb_votes
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
        console.log('🔍 getAllElections - Début requête');

        const [rows] = await pool.execute(`
            SELECT 
                e.id, e.type, e.titre, e.description,
                e.dateDebut, e.dateFin, e.dateDebutCandidature, e.dateFinCandidature,
                e.filiereId, f.nom AS filiere,
                e.annee, e.ecoleId, ec.nom AS ecole,
                e.niveau, e.delegueType, e.isActive, e.createdAt,
                (SELECT COUNT(*) FROM candidates c WHERE c.electionId = e.id AND c.statut = 'APPROUVE') AS nb_candidats,
                (SELECT COUNT(*) FROM votes v WHERE v.electionId = e.id) AS nb_votes,
                CASE 
                    WHEN (SELECT COUNT(*) FROM etudiants WHERE 
                        (e.type = 'SALLE' AND filiereId = e.filiereId AND annee = e.annee AND ecoleId = e.ecoleId)
                        OR (e.type = 'ECOLE' AND ecoleId = e.ecoleId)
                        OR (e.type = 'UNIVERSITE')
                    ) > 0 THEN
                        ROUND((SELECT COUNT(*) FROM votes v WHERE v.electionId = e.id) * 100.0 / 
                        (SELECT COUNT(*) FROM etudiants WHERE 
                            (e.type = 'SALLE' AND filiereId = e.filiereId AND annee = e.annee AND ecoleId = e.ecoleId)
                            OR (e.type = 'ECOLE' AND ecoleId = e.ecoleId)
                            OR (e.type = 'UNIVERSITE')
                        ), 2)
                    ELSE 0
                END AS participation_rate
            FROM elections e
            LEFT JOIN filieres f ON f.id = e.filiereId
            LEFT JOIN ecoles ec ON ec.id = e.ecoleId
            ORDER BY e.createdAt DESC
        `);

        console.log(`✅ getAllElections - ${rows.length} élections trouvées avec stats`);
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
                e.niveau, e.delegueType, e.isActive, e.createdAt,
                (SELECT COUNT(*) FROM candidates c WHERE c.electionId = e.id AND c.statut = 'APPROUVE') AS nb_candidats,
                (SELECT COUNT(*) FROM votes v WHERE v.electionId = e.id) AS nb_votes
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

async function updateElection(id, electionData, userId = null) {
    try {
        // Log pour débogage
        console.log('Données reçues pour mise à jour:', electionData);

        // Récupérer l'élection existante d'abord
        const existingElection = await getElectionById(id);
        if (!existingElection) {
            throw new Error('Élection non trouvée');
        }

        // Fusionner les données existantes avec les nouvelles (les nouvelles écrasent les anciennes)
        let {
            type = existingElection.type,
            titre = existingElection.titre,
            description = existingElection.description,
            dateDebut = existingElection.dateDebut,
            dateFin = existingElection.dateFin,
            dateDebutCandidature = existingElection.dateDebutCandidature,
            dateFinCandidature = existingElection.dateFinCandidature,
            filiereId = existingElection.filiereId,
            annee = existingElection.annee,
            ecoleId = existingElection.ecoleId,
            niveau = existingElection.niveau,
            delegueType = existingElection.delegueType,
            isActive = existingElection.isActive
        } = electionData;

        // Si on clôture l'élection (isActive passe de true à false)
        // ET que la dateFin n'est pas encore passée, on la met à maintenant
        if (existingElection.isActive && !isActive) {
            const now = new Date();
            const currentDateFin = new Date(dateFin);

            // Si dateFin est dans le futur, on la met à maintenant
            if (currentDateFin > now) {
                dateFin = now.toISOString().slice(0, 19).replace('T', ' ');
                console.log('🔒 Clôture anticipée - dateFin mise à jour:', dateFin);
            }
        }

        const query = `
            UPDATE elections 
            SET type = ?, titre = ?, description = ?, dateDebut = ?, dateFin = ?,
                dateDebutCandidature = ?, dateFinCandidature = ?, filiereId = ?,
                annee = ?, ecoleId = ?, niveau = ?, delegueType = ?, isActive = ?
            WHERE id = ?
        `;

        const values = [
            type,
            titre,
            description,
            dateDebut,
            dateFin,
            dateDebutCandidature,
            dateFinCandidature,
            filiereId,
            annee,
            ecoleId,
            niveau,
            delegueType,
            isActive,
            id
        ];

        console.log('Valeurs SQL après fusion:', values);

        const [result] = await pool.execute(query, values);

        if (userId) {
            await ActivityManager.createActivityLog({
                action: 'Élection modifiée',
                userId,
                details: `Élection ${id} mise à jour avec succès`,
                actionType: 'SUCCESS',
                module: 'ADMIN'
            });
        }

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

        await ActivityManager.createActivityLog({
            action: 'Élection supprimée',
            userId,
            details: `Élection ${id} supprimée avec succès`,
            actionType: 'SUCCESS',
            module: 'ADMIN'
        });

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
            e.createdAt,
            (SELECT COUNT(*) FROM candidates c WHERE c.electionId = e.id AND c.statut = 'APPROUVE') AS nb_candidats,
            (SELECT COUNT(*) FROM votes v WHERE v.electionId = e.id) AS nb_votes
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
            annee, ecoleId, niveau, delegueType, resultsVisibility, tour, responsableType, parentElectionId
        } = req.body;

        // Validation des données obligatoires
        if (!type || !titre || !dateDebut || !dateFin ||
            !dateDebutCandidature || !dateFinCandidature || !niveau) {
            return res.status(400).json({ error: 'Données manquantes' });
        }

        // Validation spécifique pour Tour 2 UNIVERSITE
        if (type === 'UNIVERSITE' && tour === 2) {
            if (!parentElectionId) {
                return res.status(400).json({
                    error: 'parentElectionId requis pour une élection UNIVERSITE Tour 2'
                });
            }

            // Vérifier que l'élection parent existe et est bien un Tour 1 UNIVERSITE
            const [parentElection] = await pool.execute(
                'SELECT id, tour, type FROM elections WHERE id = ?',
                [parentElectionId]
            );

            if (parentElection.length === 0) {
                return res.status(404).json({
                    error: 'Élection parent introuvable'
                });
            }

            if (parentElection[0].type !== 'UNIVERSITE' || parentElection[0].tour !== 1) {
                return res.status(400).json({
                    error: 'L\'élection parent doit être une élection UNIVERSITE Tour 1'
                });
            }
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
        annee, ecoleId, niveau, delegueType, resultsVisibility, tour, responsableType, parentElectionId
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            safeValue(responsableType),
            safeValue(parentElectionId)
        ];


        const [result] = await pool.execute(query, values);
        const electionId = result.insertId;

        // Si c'est un Tour 2, copier automatiquement les candidats du Tour 1
        if (type === 'UNIVERSITE' && tour === 2 && parentElectionId) {
            try {
                await copyCandidatesFromParent(electionId, parentElectionId);
                console.log(`✅ Candidats copiés du Tour 1 (ID: ${parentElectionId}) vers Tour 2 (ID: ${electionId})`);
            } catch (copyError) {
                console.error('❌ Erreur lors de la copie des candidats:', copyError);
                // On continue quand même car l'élection est créée
            }
        }

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


async function bulkCreateElections(req, res) {
    const connection = await pool.getConnection();
    
    try {
        const {
            titre, description, dateDebut, dateFin,
            dateDebutCandidature, dateFinCandidature,
            ecoleId, annees, responsableType, resultsVisibility
        } = req.body;

        // Validation
        if (!titre || !dateDebut || !dateFin || !dateDebutCandidature || 
            !dateFinCandidature || !ecoleId || !annees || !Array.isArray(annees)) {
            return res.status(400).json({ error: 'Données manquantes ou invalides' });
        }

        // Récupérer toutes les filières actives de l'école
        const [filieres] = await connection.execute(
            'SELECT id, nom FROM filieres WHERE ecoleId = ? AND actif = TRUE',
            [ecoleId]
        );

        if (filieres.length === 0) {
            return res.status(404).json({ error: 'Aucune filière active trouvée pour cette école' });
        }

        await connection.beginTransaction();

        const createdElections = [];
        const errors = [];

        // Créer une élection pour chaque combinaison filière × année
        for (const filiere of filieres) {
            for (const annee of annees) {
                try {
                    const electionTitre = `${titre} - ${filiere.nom} L${annee}`;
                    
                    const query = `
                        INSERT INTO elections (
                            type, titre, description, dateDebut, dateFin,
                            dateDebutCandidature, dateFinCandidature, filiereId,
                            annee, ecoleId, niveau, responsableType, resultsVisibility
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    const values = [
                        'SALLE',
                        electionTitre,
                        description || '',
                        toMySQLDateTime(dateDebut),
                        toMySQLDateTime(dateFin),
                        toMySQLDateTime(dateDebutCandidature),
                        toMySQLDateTime(dateFinCandidature),
                        filiere.id,
                        annee,
                        ecoleId,
                        'PHASE1',
                        responsableType || 'PREMIER',
                        resultsVisibility || 'IMMEDIATE'
                    ];

                    const [result] = await connection.execute(query, values);
                    
                    createdElections.push({
                        id: result.insertId,
                        titre: electionTitre,
                        filiere: filiere.nom,
                        annee: annee
                    });
                } catch (error) {
                    errors.push({
                        filiere: filiere.nom,
                        annee: annee,
                        error: error.message
                    });
                }
            }
        }

        if (errors.length > 0 && createdElections.length === 0) {
            await connection.rollback();
            return res.status(500).json({ 
                error: 'Échec de la création de toutes les élections',
                details: errors 
            });
        }

        await connection.commit();

        // Log d'activité
        try {
            await ActivityManager.insertActivityLog({
                action: 'Création groupée d\'élections',
                details: `${createdElections.length} élections créées pour l'école ${ecoleId}`,
                userId: req.user?.id ?? null,
                actionType: 'ADMIN'
            });
        } catch (logError) {
            console.error('Erreur log:', logError);
        }

        // Notifications aux étudiants concernés
        try {
            const [students] = await connection.execute(
                'SELECT DISTINCT userId FROM etudiants WHERE ecoleId = ? AND actif = TRUE',
                [ecoleId]
            );

            const destinataires = students.map(s => s.userId).filter(id => id);

            if (destinataires.length > 0) {
                await NotificationService.notifyNewElection(
                    { 
                        id: createdElections[0].id, 
                        titre: `${createdElections.length} nouvelles élections disponibles`,
                        description: description || 'Consultez les élections disponibles' 
                    },
                    destinataires
                );
            }
        } catch (notifyError) {
            console.error('Erreur notifications:', notifyError);
        }

        res.status(201).json({
            message: `${createdElections.length} élection(s) créée(s) avec succès`,
            created: createdElections.length,
            elections: createdElections,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erreur création groupée:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la création groupée' });
    } finally {
        connection.release();
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
    getElectionsWithFilters,
    bulkCreateElections
};