import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

// Récupérer l'élection active
router.get('/active', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const now = new Date();

        const [electionRows] = await connection.execute(`
            SELECT id 
            FROM elections 
            WHERE dateFin >= ? AND dateDebut <= ? AND isActive = TRUE
            ORDER BY dateDebut ASC 
            LIMIT 1
        `, [now, now]);

        if (electionRows.length === 0) {
            return res.status(204).json({
                success: true,
                message: 'Aucune élection active'
            });
        }

        res.json({
            success: true,
            data: { id: electionRows[0].id }
        });
    } catch (error) {
        console.error('Erreur récupération élection active:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Récupérer toutes les élections
router.get('/', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { status } = req.query;

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

        const [electionRows] = await connection.execute(`
            SELECT 
                e.*,
                COUNT(DISTINCT c.id) as candidates_count,
                COUNT(DISTINCT v.id) as votes_count
            FROM elections e
            LEFT JOIN candidates c ON e.id = c.electionId
            LEFT JOIN votes v ON e.id = v.electionId
            WHERE ${whereClause}
            GROUP BY e.id
            ORDER BY e.dateDebut DESC
        `, params);

        // Récupérer les candidats pour chaque élection
        const electionsWithCandidates = await Promise.all(
            electionRows.map(async election => {
                const [candidateRows] = await connection.execute(`
                    SELECT id, nom, prenom, slogan, photoUrl, statut
                    FROM candidates
                    WHERE electionId = ?
                `, [election.id]);

                return {
                    id: election.id,
                    type: election.type,
                    titre: election.titre,
                    description: election.description,
                    dateDebut: election.dateDebut,
                    dateFin: election.dateFin,
                    dateDebutCandidature: election.dateDebutCandidature,
                    dateFinCandidature: election.dateFinCandidature,
                    filiere: election.filiere,
                    annee: election.annee,
                    ecole: election.ecole,
                    niveau: election.niveau,
                    delegueType: election.delegueType,
                    isActive: election.isActive,
                    createdAt: election.createdAt,
                    candidates: candidateRows,
                    _count: {
                        votes: election.votes_count,
                        candidates: election.candidates_count
                    }
                };
            })
        );

        res.json({
            success: true,
            data: electionsWithCandidates
        });
    } catch (error) {
        console.error('Erreur récupération élections:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Récupérer les élections par type et niveau
router.get('/by-type/:type', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { type } = req.params;
        const { filiere, annee, ecole, page = 1, limit = 10, status = 'active' } = req.query;

        const validTypes = ['SALLE', 'ECOLE', 'UNIVERSITE'];
        if (!validTypes.includes(type.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: 'Type d\'élection invalide. Types valides: SALLE, ECOLE, UNIVERSITE'
            });
        }

        let whereClause = 'e.type = ?';
        let params = [type.toUpperCase()];

        if (status === 'active') {
            whereClause += ' AND e.isActive = TRUE AND e.dateDebut <= ? AND e.dateFin >= ?';
            const now = new Date();
            params.push(now, now);
        } else if (status === 'upcoming') {
            whereClause += ' AND e.isActive = TRUE AND e.dateDebut > ?';
            params.push(new Date());
        } else if (status === 'closed') {
            whereClause += ' AND (e.isActive = FALSE OR e.dateFin < ?)';
            params.push(new Date());
        }

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

        const offset = (parseInt(page) - 1) * parseInt(limit);
        params.push(parseInt(limit), offset);

        // Récupérer les élections
        const [electionRows] = await connection.execute(`
            SELECT 
                e.*,
                COUNT(DISTINCT c.id) as candidates_count,
                COUNT(DISTINCT v.id) as votes_count,
                COUNT(DISTINCT vt.id) as tokens_count
            FROM elections e
            LEFT JOIN candidates c ON e.id = c.electionId
            LEFT JOIN votes v ON e.id = v.electionId
            LEFT JOIN vote_tokens vt ON e.id = vt.electionId
            WHERE ${whereClause}
            GROUP BY e.id
            ORDER BY e.dateDebut DESC
            LIMIT ? OFFSET ?
        `, params);

        // Compter le total
        const [countRows] = await connection.execute(`
            SELECT COUNT(*) as total 
            FROM elections e
            WHERE ${whereClause}
        `, params.slice(0, -2));

        const total = countRows[0].total;

        // Récupérer les candidats pour chaque élection
        const electionsWithCandidates = await Promise.all(
            electionRows.map(async election => {
                const [candidateRows] = await connection.execute(`
                    SELECT id, nom, prenom, slogan, photoUrl, statut
                    FROM candidates
                    WHERE electionId = ?
                `, [election.id]);

                const totalVotes = election.votes_count;
                const totalTokens = election.tokens_count;
                const participationRate = totalTokens > 0
                    ? Math.round((totalVotes / totalTokens) * 100)
                    : 0;

                return {
                    id: election.id,
                    type: election.type,
                    titre: election.titre,
                    description: election.description,
                    dateDebut: election.dateDebut,
                    dateFin: election.dateFin,
                    dateDebutCandidature: election.dateDebutCandidature,
                    dateFinCandidature: election.dateFinCandidature,
                    filiere: election.filiere,
                    annee: election.annee,
                    ecole: election.ecole,
                    niveau: election.niveau,
                    delegueType: election.delegueType,
                    isActive: election.isActive,
                    createdAt: election.createdAt,
                    candidates: candidateRows,
                    stats: {
                        totalVotes: totalVotes,
                        totalTokens: totalTokens,
                        participationRate: participationRate,
                        candidatesCount: election.candidates_count
                    }
                };
            })
        );

        const totalPages = Math.ceil(total / parseInt(limit));

        res.json({
            success: true,
            data: {
                elections: electionsWithCandidates,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalElections: total,
                    hasNext: parseInt(page) < totalPages,
                    hasPrev: parseInt(page) > 1
                },
                filters: { type, filiere, annee, ecole, status }
            }
        });

    } catch (error) {
        console.error('Error fetching elections by type:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération des élections',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Récupérer une élection spécifique
router.get('/:id', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { id } = req.params;

        // Récupérer l'élection
        const [electionRows] = await connection.execute(`
            SELECT 
                e.*,
                COUNT(DISTINCT c.id) as candidates_count,
                COUNT(DISTINCT v.id) as votes_count,
                COUNT(DISTINCT vt.id) as tokens_count
            FROM elections e
            LEFT JOIN candidates c ON e.id = c.electionId
            LEFT JOIN votes v ON e.id = v.electionId
            LEFT JOIN vote_tokens vt ON e.id = vt.electionId
            WHERE e.id = ?
            GROUP BY e.id
        `, [parseInt(id)]);

        if (electionRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Élection non trouvée'
            });
        }

        const election = electionRows[0];

        // Récupérer les candidats
        const [candidateRows] = await connection.execute(`
            SELECT 
                c.*,
                u.email,
                e.userId
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE c.electionId = ?
        `, [parseInt(id)]);

        const totalVotes = election.votes_count;
        const totalTokens = election.tokens_count;
        const participationRate = totalTokens > 0 ? (totalVotes / totalTokens * 100).toFixed(2) : 0;

        const electionWithStats = {
            id: election.id,
            type: election.type,
            titre: election.titre,
            description: election.description,
            dateDebut: election.dateDebut,
            dateFin: election.dateFin,
            dateDebutCandidature: election.dateDebutCandidature,
            dateFinCandidature: election.dateFinCandidature,
            filiere: election.filiere,
            annee: election.annee,
            ecole: election.ecole,
            niveau: election.niveau,
            delegueType: election.delegueType,
            isActive: election.isActive,
            createdAt: election.createdAt,
            candidates: candidateRows,
            stats: {
                totalVotes,
                totalTokens,
                participationRate: parseFloat(participationRate),
                totalCandidates: election.candidates_count
            }
        };

        res.json({
            success: true,
            data: electionWithStats
        });
    } catch (error) {
        console.error('Erreur récupération élection:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});


// Récupérer les élections de l'étudiant connecté
router.get("/vote/my-elections", authenticateToken, async (req, res) => {
    let connection;
    try {
        console.log("=== DEBUG MY-ELECTIONS ===");
        console.log("User ID:", req.user.id);

        connection = await pool.getConnection();

        // 1. Récupérer l'étudiant lié à l'utilisateur connecté
        const [etudiantRows] = await connection.execute(
            "SELECT * FROM etudiants WHERE userId = ?",
            [req.user.id]
        );

        console.log("Étudiant trouvé:", etudiantRows.length);
        console.log("Détails étudiant:", etudiantRows[0]);

        if (etudiantRows.length === 0) {
            console.log("❌ Aucun étudiant trouvé pour cet utilisateur");
            return res.status(404).json([]); // Retourner un tableau vide
        }

        const etudiant = etudiantRows[0];
        const now = new Date();

        console.log("Filtres application:");
        console.log("- Filière:", etudiant.filiere);
        console.log("- Année:", etudiant.annee);
        console.log("- École:", etudiant.ecole);
        console.log("- Date maintenant:", now);

        // 2. Récupérer les élections correspondantes
        // Modification de la requête SQL dans le backend
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
        (e.filiere = ? AND e.annee = ? AND e.ecole = ?) -- Critères exacts
        OR (e.filiere IS NULL AND e.annee IS NULL AND e.ecole = ?) -- Élections
        OR (e.filiere IS NULL AND e.annee = ? AND e.ecole = ?) -- Élections par année/école
        OR (e.filiere IS NULL AND e.annee IS NULL AND e.ecole IS NULL) -- Élections générales
    )
    AND e.dateDebut <= ? 
    AND e.dateFin >= ?
    ORDER BY 
        CASE 
            WHEN e.filiere = ? AND e.annee = ? AND e.ecole = ? THEN 1 -- Exact match first
            WHEN e.filiere IS NULL AND e.annee IS NULL AND e.ecole = ? THEN 2
            WHEN e.filiere IS NULL AND e.annee = ? AND e.ecole = ? THEN 3
            ELSE 4
        END,
        e.dateDebut ASC
`, [
            // Paramètres pour le CASE
            now, now,
            // Critères exacts
            etudiant.filiere, etudiant.annee, etudiant.ecole,
            // Élections
            etudiant.ecole,
            // Élections par année/école  
            etudiant.annee, etudiant.ecole,
            // Dates
            now, now,
            // Tri - critères exacts
            etudiant.filiere, etudiant.annee, etudiant.ecole,
            // Tri - élections
            etudiant.ecole,
            // Tri - élections par année/école
            etudiant.annee, etudiant.ecole
        ]);

        console.log("Élections trouvées:", electionRows.length);
        console.log("Détails élections:", electionRows);

        res.json(electionRows);

    } catch (error) {
        console.error("❌ Erreur GET /api/election/vote/my-elections:", error);
        res.status(500).json([]); // Retourner un tableau vide en cas d'erreur
    } finally {
        if (connection) await connection.release();
    }
});

// Récupérer les détails complets des candidats d'une élection
router.get('/:id/candidates-details', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { id } = req.params;

        const [candidateRows] = await connection.execute(`
            SELECT 
                c.*,
                u.email,
                e.matricule,
                e.filiere,
                e.annee,
                e.ecole
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE c.electionId = ?
        `, [parseInt(id)]);

        res.json({
            success: true,
            data: candidateRows
        });
    } catch (error) {
        console.error('Erreur récupération candidats:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Créer une nouvelle élection (admin seulement)
router.post('/', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

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
        } = req.body;

        // VALIDATION DES DATES
        const now = new Date();
        const debutCandidature = new Date(dateDebutCandidature);
        const finCandidature = new Date(dateFinCandidature);
        const debutVote = new Date(dateDebut);
        const finVote = new Date(dateFin);

        // Validation: dates de candidature doivent être avant le vote
        if (finCandidature >= debutVote) {
            return res.status(400).json({
                success: false,
                message: 'La fin des candidatures doit être avant le début du vote'
            });
        }

        // Validation: dates de candidature cohérentes
        if (debutCandidature >= finCandidature) {
            return res.status(400).json({
                success: false,
                message: 'La date de début des candidatures doit être avant la date de fin'
            });
        }

        // Validation: dates de vote cohérentes
        if (debutVote >= finVote) {
            return res.status(400).json({
                success: false,
                message: 'La date de début du vote doit être avant la date de fin'
            });
        }

        // Validation: les dates ne doivent pas être dans le passé
        if (debutCandidature < now) {
            return res.status(400).json({
                success: false,
                message: 'La date de début des candidatures ne peut pas être dans le passé'
            });
        }

        // Validations spécifiques au type d'élection
        if (type === 'SALLE' && (!filiere || !annee)) {
            return res.status(400).json({
                success: false,
                message: 'Les élections par salle nécessitent filière et année'
            });
        }

        if (type === 'ECOLE' && !ecole) {
            return res.status(400).json({
                success: false,
                message: 'Les élections par école nécessitent le nom de l\'école'
            });
        }

        // Validation du niveau
        if (niveau && !['PHASE1', 'PHASE2', 'PHASE3'].includes(niveau)) {
            return res.status(400).json({
                success: false,
                message: 'Niveau d\'élection invalide. Valeurs valides: PHASE1, PHASE2, PHASE3'
            });
        }

        // Validation du type de délégué
        if (delegueType && !['PREMIER', 'DEUXIEME'].includes(delegueType)) {
            return res.status(400).json({
                success: false,
                message: 'Type de délégué invalide. Valeurs valides: PREMIER, DEUXIEME'
            });
        }

        // Création de l'élection
        const [result] = await connection.execute(`
            INSERT INTO elections 
            (type, titre, description, dateDebut, dateFin, dateDebutCandidature, dateFinCandidature, 
             filiere, annee, ecole, niveau, delegueType, isActive, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())
        `, [
            type.toUpperCase(),
            titre,
            description,
            debutVote,
            finVote,
            debutCandidature,
            finCandidature,
            filiere,
            annee ? parseInt(annee) : null,
            ecole,
            niveau,
            delegueType,
        ]);

        const electionId = result.insertId;

        res.status(201).json({
            success: true,
            message: 'Élection créée avec succès',
            data: {
                electionId: electionId
            }
        });

    } catch (error) {
        console.error('Erreur création élection:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Clôturer une élection (admin seulement)
router.put('/:id/close', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const { id } = req.params;

        await connection.execute(`
            UPDATE elections 
            SET isActive = FALSE, dateFin = NOW() 
            WHERE id = ?
        `, [parseInt(id)]);

        res.json({
            success: true,
            message: 'Élection clôturée avec succès'
        });
    } catch (error) {
        console.error('Erreur clôture élection:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Supprimer une élection (admin seulement)
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const { id } = req.params;
        const electionId = parseInt(id);

        // Commencer une transaction
        await connection.beginTransaction();

        try {
            // Supprimer les votes associés
            await connection.execute(
                'DELETE FROM votes WHERE electionId = ?',
                [electionId]
            );

            // Supprimer les candidats associés
            await connection.execute(
                'DELETE FROM candidates WHERE electionId = ?',
                [electionId]
            );

            // Supprimer les jetons de vote associés
            await connection.execute(
                'DELETE FROM vote_tokens WHERE electionId = ?',
                [electionId]
            );

            // Supprimer l'élection
            await connection.execute(
                'DELETE FROM elections WHERE id = ?',
                [electionId]
            );

            // Valider la transaction
            await connection.commit();

            res.json({
                success: true,
                message: 'Élection supprimée avec succès'
            });
        } catch (error) {
            // Annuler la transaction en cas d'erreur
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Erreur suppression élection:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Statistiques par type d'élection
router.get('/stats/by-type/:type', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { type } = req.params;
        const { filiere, annee, ecole } = req.query;

        const validTypes = ['SALLE', 'ECOLE', 'UNIVERSITE'];
        if (!validTypes.includes(type.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: 'Type d\'élection invalide'
            });
        }

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

        const [
            [totalElectionsRow],
            [activeElectionsRow],
            [upcomingElectionsRow],
            [closedElectionsRow],
            [totalVotesRow],
            [totalCandidatesRow]
        ] = await Promise.all([
            connection.execute(`SELECT COUNT(*) as count FROM elections e WHERE ${whereClause}`, params),
            connection.execute(`SELECT COUNT(*) as count FROM elections e WHERE ${whereClause} AND e.isActive = TRUE AND e.dateDebut <= ? AND e.dateFin >= ?`, [...params, new Date(), new Date()]),
            connection.execute(`SELECT COUNT(*) as count FROM elections e WHERE ${whereClause} AND e.isActive = TRUE AND e.dateDebut > ?`, [...params, new Date()]),
            connection.execute(`SELECT COUNT(*) as count FROM elections e WHERE ${whereClause} AND (e.isActive = FALSE OR e.dateFin < ?)`, [...params, new Date()]),
            connection.execute(`SELECT COUNT(*) as count FROM votes v INNER JOIN elections e ON v.electionId = e.id WHERE ${whereClause}`, params),
            connection.execute(`SELECT COUNT(*) as count FROM candidates c INNER JOIN elections e ON c.electionId = e.id WHERE ${whereClause}`, params)
        ]);

        const totalElections = totalElectionsRow[0].count;
        const activeElections = activeElectionsRow[0].count;
        const upcomingElections = upcomingElectionsRow[0].count;
        const closedElections = closedElectionsRow[0].count;
        const totalVotes = totalVotesRow[0].count;
        const totalCandidates = totalCandidatesRow[0].count;

        res.json({
            success: true,
            data: {
                type: type.toUpperCase(),
                statistics: {
                    totalElections,
                    activeElections,
                    upcomingElections,
                    closedElections,
                    totalVotes,
                    totalCandidates,
                    averageCandidatesPerElection: totalElections > 0
                        ? (totalCandidates / totalElections).toFixed(1)
                        : 0,
                    averageVotesPerElection: totalElections > 0
                        ? (totalVotes / totalElections).toFixed(1)
                        : 0
                },
                filters: { filiere, annee, ecole },
                lastUpdated: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error fetching election stats by type:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération des statistiques',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

export default router;