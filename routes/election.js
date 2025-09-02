import express from 'express';
import pool from '../database.js';
import { authenticateToken } from '../middlewares/auth.js';

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
            WHERE date_fin >= ? AND date_debut <= ? AND is_active = TRUE
            ORDER BY date_debut ASC 
            LIMIT 1
        `, [now, now]);

        if (electionRows.length === 0) return res.status(204).send();
        res.json({ id: electionRows[0].id });
    } catch (error) {
        console.error('Erreur récupération élection active:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        if (connection) connection.release();
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
            whereClause += ' AND is_active = TRUE AND date_debut <= ? AND date_fin >= ?';
            const now = new Date();
            params.push(now, now);
        } else if (status === 'upcoming') {
            whereClause += ' AND is_active = TRUE AND date_debut > ?';
            params.push(new Date());
        } else if (status === 'closed') {
            whereClause += ' AND (is_active = FALSE OR date_fin < ?)';
            params.push(new Date());
        }

        const [electionRows] = await connection.execute(`
            SELECT 
                e.*,
                COUNT(DISTINCT c.id) as candidates_count,
                COUNT(DISTINCT v.id) as votes_count
            FROM elections e
            LEFT JOIN candidates c ON e.id = c.election_id
            LEFT JOIN votes v ON e.id = v.election_id
            WHERE ${whereClause}
            GROUP BY e.id
            ORDER BY e.date_debut DESC
        `, params);

        // Récupérer les candidats pour chaque élection
        const electionsWithCandidates = await Promise.all(
            electionRows.map(async election => {
                const [candidateRows] = await connection.execute(`
                    SELECT id, nom, prenom, slogan, photo_url, statut
                    FROM candidates
                    WHERE election_id = ?
                `, [election.id]);

                return {
                    id: election.id,
                    type: election.type,
                    titre: election.titre,
                    description: election.description,
                    dateDebut: election.date_debut,
                    dateFin: election.date_fin,
                    dateDebutCandidature: election.date_debut_candidature,
                    dateFinCandidature: election.date_fin_candidature,
                    filiere: election.filiere,
                    annee: election.annee,
                    ecole: election.ecole,
                    niveau: election.niveau,
                    delegueType: election.delegue_type,
                    isActive: election.is_active,
                    createdAt: election.created_at,
                    candidates: candidateRows,
                    _count: {
                        votes: election.votes_count,
                        candidates: election.candidates_count
                    }
                };
            })
        );

        res.json(electionsWithCandidates);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        if (connection) connection.release();
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
                message: 'Type d\'élection invalide. Types valides: SALLE, ECOLE, UNIVERSITE'
            });
        }

        let whereClause = 'e.type = ?';
        let params = [type.toUpperCase()];

        if (status === 'active') {
            whereClause += ' AND e.is_active = TRUE AND e.date_debut <= ? AND e.date_fin >= ?';
            const now = new Date();
            params.push(now, now);
        } else if (status === 'upcoming') {
            whereClause += ' AND e.is_active = TRUE AND e.date_debut > ?';
            params.push(new Date());
        } else if (status === 'closed') {
            whereClause += ' AND (e.is_active = FALSE OR e.date_fin < ?)';
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
            LEFT JOIN candidates c ON e.id = c.election_id
            LEFT JOIN votes v ON e.id = v.election_id
            LEFT JOIN vote_tokens vt ON e.id = vt.election_id
            WHERE ${whereClause}
            GROUP BY e.id
            ORDER BY e.date_debut DESC
            LIMIT ? OFFSET ?
        `, params);

        // Compter le total
        const [countRows] = await connection.execute(`
            SELECT COUNT(*) as total 
            FROM elections e
            WHERE ${whereClause}
        `, params.slice(0, -2)); // Remove limit and offset for count

        const total = countRows[0].total;

        // Récupérer les candidats pour chaque élection
        const electionsWithCandidates = await Promise.all(
            electionRows.map(async election => {
                const [candidateRows] = await connection.execute(`
                    SELECT id, nom, prenom, slogan, photo_url, statut
                    FROM candidates
                    WHERE election_id = ?
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
                    dateDebut: election.date_debut,
                    dateFin: election.date_fin,
                    dateDebutCandidature: election.date_debut_candidature,
                    dateFinCandidature: election.date_fin_candidature,
                    filiere: election.filiere,
                    annee: election.annee,
                    ecole: election.ecole,
                    niveau: election.niveau,
                    delegueType: election.delegue_type,
                    isActive: election.is_active,
                    createdAt: election.created_at,
                    candidates: candidateRows,
                    stats: {
                        totalVotes: totalVotes,
                        totalTokens: totalTokens,
                        participationRate: `${participationRate}%`,
                        candidatesCount: election.candidates_count
                    }
                };
            })
        );

        const totalPages = Math.ceil(total / parseInt(limit));

        res.json({
            elections: electionsWithCandidates,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalElections: total,
                hasNext: parseInt(page) < totalPages,
                hasPrev: parseInt(page) > 1
            },
            filters: { type, filiere, annee, ecole, status }
        });

    } catch (error) {
        console.error('Error fetching elections by type:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la récupération des élections',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
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
            LEFT JOIN candidates c ON e.id = c.election_id
            LEFT JOIN votes v ON e.id = v.election_id
            LEFT JOIN vote_tokens vt ON e.id = vt.election_id
            WHERE e.id = ?
            GROUP BY e.id
        `, [parseInt(id)]);

        if (electionRows.length === 0) {
            return res.status(404).json({ message: 'Élection non trouvée' });
        }

        const election = electionRows[0];

        // Récupérer les candidats
        const [candidateRows] = await connection.execute(`
            SELECT 
                c.*,
                u.email,
                e.user_id
            FROM candidates c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.election_id = ?
        `, [parseInt(id)]);

        const totalVotes = election.votes_count;
        const totalTokens = election.tokens_count;
        const participationRate = totalTokens > 0 ? (totalVotes / totalTokens * 100).toFixed(2) : 0;

        const electionWithStats = {
            id: election.id,
            type: election.type,
            titre: election.titre,
            description: election.description,
            dateDebut: election.date_debut,
            dateFin: election.date_fin,
            dateDebutCandidature: election.date_debut_candidature,
            dateFinCandidature: election.date_fin_candidature,
            filiere: election.filiere,
            annee: election.annee,
            ecole: election.ecole,
            niveau: election.niveau,
            delegueType: election.delegue_type,
            isActive: election.is_active,
            createdAt: election.created_at,
            candidates: candidateRows,
            stats: {
                totalVotes,
                totalTokens,
                participationRate: `${participationRate}%`,
                totalCandidates: election.candidates_count
            }
        };

        res.json(electionWithStats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        if (connection) connection.release();
    }
});

// Récupérer les élections de l'étudiant connecté
router.get("/my-elections", authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Récupérer l'étudiant lié à l'utilisateur connecté
        const [etudiantRows] = await connection.execute(
            "SELECT * FROM etudiants WHERE user_id = ?",
            [req.user.id]
        );

        if (etudiantRows.length === 0) {
            return res.status(404).json({ message: "Étudiant introuvable" });
        }

        const etudiant = etudiantRows[0];

        // 2. Récupérer les élections correspondantes
        const [electionRows] = await connection.execute(`
            SELECT *
            FROM elections
            WHERE is_active = TRUE
            AND filiere = ?
            AND annee = ?
            AND ecole = ?
            AND date_debut <= ? 
            AND date_fin >= ?
            ORDER BY date_debut ASC
        `, [
            etudiant.filiere,
            etudiant.annee,
            etudiant.ecole,
            new Date(),
            new Date()
        ]);

        res.json(electionRows);
    } catch (error) {
        console.error("Erreur GET /my-elections:", error);
        res.status(500).json({ message: "Erreur interne du serveur" });
    } finally {
        if (connection) connection.release();
    }
});

// FONCTION: Vérifier l'éligibilité
function isEligibleForElection(etudiant, election) {
    if (!etudiant || !election) return false;

    // Convertir en string pour éviter les problèmes de type
    const etudiantFiliere = String(etudiant.filiere || '');
    const etudiantAnnee = String(etudiant.annee || '');
    const etudiantEcole = String(etudiant.ecole || '');
    const electionFiliere = String(election.filiere || '');
    const electionAnnee = String(election.annee || '');
    const electionEcole = String(election.ecole || '');

    if (election.type === 'SALLE') {
        return etudiantFiliere === electionFiliere &&
            etudiantAnnee === electionAnnee &&
            etudiantEcole === electionEcole;
    } else if (election.type === 'ECOLE') {
        return etudiantEcole === electionEcole;
    } else if (election.type === 'UNIVERSITE') {
        return true;
    }
    return false;
}

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
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN etudiants e ON u.id = e.user_id
            WHERE c.election_id = ?
        `, [parseInt(id)]);

        res.json(candidateRows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        if (connection) connection.release();
    }
});

// Créer une nouvelle élection (admin seulement)
router.post('/', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        // Vérifier que l'utilisateur est admin
        const [userRows] = await connection.execute(
            'SELECT role FROM users WHERE id = ?',
            [req.user.id]
        );

        if (userRows.length === 0 || userRows[0].role !== 'ADMIN') {
            return res.status(403).json({ message: 'Accès refusé' });
        }

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
                message: 'La fin des candidatures doit être avant le début du vote'
            });
        }

        // Validation: dates de candidature cohérentes
        if (debutCandidature >= finCandidature) {
            return res.status(400).json({
                message: 'La date de début des candidatures doit être avant la date de fin'
            });
        }

        // Validation: dates de vote cohérentes
        if (debutVote >= finVote) {
            return res.status(400).json({
                message: 'La date de début du vote doit être avant la date de fin'
            });
        }

        // Validation: les dates ne doivent pas être dans le passé
        if (debutCandidature < now) {
            return res.status(400).json({
                message: 'La date de début des candidatures ne peut pas être dans le passé'
            });
        }

        // Validations spécifiques au type d'élection
        if (type === 'SALLE' && (!filiere || !annee)) {
            return res.status(400).json({
                message: 'Les élections par salle nécessitent filière et année'
            });
        }

        if (type === 'ECOLE' && !ecole) {
            return res.status(400).json({
                message: 'Les élections par école nécessitent le nom de l\'école'
            });
        }

        // Conversion du niveau si nécessaire
        let niveauPrisma = null;
        if (niveau) {
            niveauPrisma = niveau.toUpperCase();
            if (!['PHASE1', 'PHASE2', 'PHASE3'].includes(niveauPrisma)) {
                return res.status(400).json({
                    message: 'Niveau d\'élection invalide. Valeurs valides: PHASE1, PHASE2, PHASE3'
                });
            }
        }

        // Conversion du delegueType si nécessaire
        let delegueTypePrisma = null;
        if (delegueType) {
            delegueTypePrisma = delegueType.toUpperCase();
            if (!['PREMIER', 'DEUXIEME'].includes(delegueTypePrisma)) {
                return res.status(400).json({
                    message: 'Type de délégué invalide. Valeurs valides: PREMIER, DEUXIEME'
                });
            }
        }

        // Création de l'élection
        const [result] = await connection.execute(`
            INSERT INTO elections 
            (type, titre, description, date_debut, date_fin, date_debut_candidature, date_fin_candidature, filiere, annee, ecole, niveau, delegue_type, is_active, created_at)
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
            niveauPrisma,
            delegueTypePrisma
        ]);

        const electionId = result.insertId;

        // Générer les jetons de vote pour cette élection
        await generateVoteTokensForElection(connection, {
            id: electionId,
            type: type.toUpperCase(),
            filiere,
            annee: annee ? parseInt(annee) : null,
            ecole,
            titre
        });

        res.status(201).json({
            message: 'Élection créée avec succès',
            electionId: electionId
        });

    } catch (error) {
        console.error('Erreur création élection:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        if (connection) connection.release();
    }
});

// Clôturer une élection (admin seulement)
router.put('/:id/close', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        // Vérifier que l'utilisateur est admin
        const [userRows] = await connection.execute(
            'SELECT role FROM users WHERE id = ?',
            [req.user.id]
        );

        if (userRows.length === 0 || userRows[0].role !== 'ADMIN') {
            return res.status(403).json({ message: 'Accès refusé' });
        }

        const { id } = req.params;

        await connection.execute(`
            UPDATE elections 
            SET is_active = FALSE, date_fin = NOW() 
            WHERE id = ?
        `, [parseInt(id)]);

        res.json({ message: 'Élection clôturée avec succès' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        if (connection) connection.release();
    }
});

// Supprimer une élection (admin seulement)
router.delete('/:id', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        // Vérifier que l'utilisateur est admin
        const [userRows] = await connection.execute(
            'SELECT role FROM users WHERE id = ?',
            [req.user.id]
        );

        if (userRows.length === 0 || userRows[0].role !== 'ADMIN') {
            return res.status(403).json({ message: 'Accès refusé' });
        }

        const { id } = req.params;
        const electionId = parseInt(id);

        // Commencer une transaction
        await connection.beginTransaction();

        try {
            // Supprimer les votes associés
            await connection.execute(
                'DELETE FROM votes WHERE election_id = ?',
                [electionId]
            );

            // Supprimer les candidats associés
            await connection.execute(
                'DELETE FROM candidates WHERE election_id = ?',
                [electionId]
            );

            // Supprimer les jetons de vote associés
            await connection.execute(
                'DELETE FROM vote_tokens WHERE election_id = ?',
                [electionId]
            );

            // Supprimer l'élection
            await connection.execute(
                'DELETE FROM elections WHERE id = ?',
                [electionId]
            );

            // Valider la transaction
            await connection.commit();

            res.json({ message: 'Élection supprimée avec succès' });
        } catch (error) {
            // Annuler la transaction en cas d'erreur
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Erreur suppression élection:', error);
        res.status(500).json({ message: error.message || 'Erreur serveur' });
    } finally {
        if (connection) connection.release();
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
            return res.status(400).json({ message: 'Type d\'élection invalide' });
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
            connection.execute(`SELECT COUNT(*) as count FROM elections e WHERE ${whereClause} AND e.is_active = TRUE AND e.date_debut <= ? AND e.date_fin >= ?`, [...params, new Date(), new Date()]),
            connection.execute(`SELECT COUNT(*) as count FROM elections e WHERE ${whereClause} AND e.is_active = TRUE AND e.date_debut > ?`, [...params, new Date()]),
            connection.execute(`SELECT COUNT(*) as count FROM elections e WHERE ${whereClause} AND (e.is_active = FALSE OR e.date_fin < ?)`, [...params, new Date()]),
            connection.execute(`SELECT COUNT(*) as count FROM votes v INNER JOIN elections e ON v.election_id = e.id WHERE ${whereClause}`, params),
            connection.execute(`SELECT COUNT(*) as count FROM candidates c INNER JOIN elections e ON c.election_id = e.id WHERE ${whereClause}`, params)
        ]);

        const totalElections = totalElectionsRow.count;
        const activeElections = activeElectionsRow.count;
        const upcomingElections = upcomingElectionsRow.count;
        const closedElections = closedElectionsRow.count;
        const totalVotes = totalVotesRow.count;
        const totalCandidates = totalCandidatesRow.count;

        res.json({
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
        });

    } catch (error) {
        console.error('Error fetching election stats by type:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la récupération des statistiques',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
});

// FONCTION: Générer les jetons pour une élection
async function generateVoteTokensForElection(connection, election) {
    try {
        let eligibleStudents = [];

        if (election.type === 'SALLE') {
            // Pour les élections de salle, tous les étudiants de la filière et année
            const [studentRows] = await connection.execute(`
                SELECT e.*, u.id as user_id
                FROM etudiants e
                LEFT JOIN users u ON e.user_id = u.id
                WHERE e.filiere = ? AND e.annee = ?
            `, [election.filiere, election.annee]);
            eligibleStudents = studentRows;
        } else if (election.type === 'ECOLE') {
            // Pour les élections d'école, les responsables de salle de cette école
            const [responsableRows] = await connection.execute(`
                SELECT rs.*, e.*, u.id as user_id
                FROM responsable_salle rs
                LEFT JOIN etudiants e ON rs.etudiant_id = e.id
                LEFT JOIN users u ON e.user_id = u.id
                WHERE rs.ecole = ?
            `, [election.ecole]);
            eligibleStudents = responsableRows.map(r => r.etudiant_id ? {
                id: r.etudiant_id,
                user_id: r.user_id,
                nom: r.nom,
                prenom: r.prenom,
                filiere: r.filiere,
                annee: r.annee,
                ecole: r.ecole
            } : null).filter(Boolean);
        } else if (election.type === 'UNIVERSITE') {
            // Pour les élections universitaires, les délégués d'école
            const [delegueRows] = await connection.execute(`
                SELECT de.*, e.*, u.id as user_id
                FROM delegue_ecole de
                LEFT JOIN responsable_salle rs ON de.responsable_id = rs.id
                LEFT JOIN etudiants e ON rs.etudiant_id = e.id
                LEFT JOIN users u ON e.user_id = u.id
            `);
            eligibleStudents = delegueRows.map(d => d.etudiant_id ? {
                id: d.etudiant_id,
                user_id: d.user_id,
                nom: d.nom,
                prenom: d.prenom,
                filiere: d.filiere,
                annee: d.annee,
                ecole: d.ecole
            } : null).filter(Boolean);
        }

        console.log(`Génération de ${eligibleStudents.length} jetons pour l'élection ${election.titre}`);

        // Générer les jetons de vote pour chaque étudiant éligible
        for (const student of eligibleStudents) {
            if (student.user_id) {
                await connection.execute(`
                    INSERT INTO vote_tokens (user_id, election_id, token, used, created_at)
                    VALUES (?, ?, UUID(), FALSE, NOW())
                `, [student.user_id, election.id]);
            }
        }

        console.log('Jetons de vote générés avec succès');
    } catch (error) {
        console.error('Erreur lors de la génération des jetons:', error);
        throw error;
    }
}

export default router;