import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

// Récupérer tous les candidats d'une élection spécifique - VERSION FINALE CORRIGÉE
router.get('/election/:electionId', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId } = req.params;

        // Vérifier que l'élection existe
        const [electionRows] = await connection.execute(
            'SELECT id, titre, type FROM elections WHERE id = ?',
            [parseInt(electionId)]
        );

        if (electionRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Élection non trouvée'
            });
        }

        // Récupérer les candidats approuvés
        const [candidateRows] = await connection.execute(`
            SELECT 
                c.*,
                u.email,
                e.nom as etudiant_nom,
                e.prenom as etudiant_prenom,
                e.filiere,
                e.annee,
                e.ecole,
                e.photoUrl as etudiant_photoUrl,
                el.titre as election_titre,
                el.type as election_type,
                (SELECT COUNT(*) FROM votes v WHERE v.candidateId = c.id) as votes_count
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            LEFT JOIN elections el ON c.electionId = el.id
            WHERE c.electionId = ? AND c.statut = 'APPROUVE'
            ORDER BY c.createdAt DESC
        `, [parseInt(electionId)]); // UN SEUL PARAMÈTRE ICI

        const formattedCandidates = candidateRows.map(candidate => ({
            id: candidate.id,
            nom: candidate.nom,
            prenom: candidate.prenom,
            slogan: candidate.slogan,
            programme: candidate.programme,
            motivation: candidate.motivation,
            photoUrl: candidate.photoUrl,
            statut: candidate.statut,
            createdAt: candidate.createdAt,
            userDetails: candidate.etudiant_nom ? {
                filiere: candidate.filiere,
                annee: candidate.annee,
                ecole: candidate.ecole,
                photoUrl: candidate.etudiant_photoUrl
            } : null,
            electionDetails: {
                titre: candidate.election_titre,
                type: candidate.election_type
            },
            votesCount: candidate.votes_count
        }));

        res.json({
            success: true,
            election: {
                id: electionRows[0].id,
                titre: electionRows[0].titre,
                type: electionRows[0].type
            },
            candidates: formattedCandidates,
            totalCandidates: candidateRows.length
        });

    } catch (error) {
        console.error('Erreur récupération candidats:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération des candidats',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Vérifier si l'utilisateur est déjà candidat à une élection
router.get('/is-candidate/:electionId', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId } = req.params;

        // Vérifier que l'élection existe
        const [electionRows] = await connection.execute(
            'SELECT id, titre, type FROM elections WHERE id = ?',
            [parseInt(electionId)]
        );

        if (electionRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Élection non trouvée',
                isCandidate: false
            });
        }

        // Vérifier si l'utilisateur est déjà candidat
        const [candidateRows] = await connection.execute(`
            SELECT 
                c.*,
                el.titre as election_titre,
                el.type as election_type
            FROM candidates c
            LEFT JOIN elections el ON c.electionId = el.id
            WHERE c.userId = ? AND c.electionId = ?
        `, [req.user.id, parseInt(electionId)]);

        if (candidateRows.length > 0) {
            const candidate = candidateRows[0];
            res.json({
                success: true,
                isCandidate: true,
                candidate: {
                    id: candidate.id,
                    nom: candidate.nom,
                    prenom: candidate.prenom,
                    programme: candidate.programme,
                    photoUrl: candidate.photoUrl,
                    createdAt: candidate.createdAt
                },
                election: {
                    id: candidate.electionId,
                    titre: candidate.election_titre,
                    type: candidate.election_type
                }
            });
        } else {
            res.json({
                success: true,
                isCandidate: false,
                message: 'Vous n\'êtes pas candidat à cette élection'
            });
        }

    } catch (error) {
        console.error('Erreur vérification candidature:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            isCandidate: false,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Récupérer les candidatures de l'étudiant connecté 
router.get('/mes-candidatures', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const userId = req.user.id;

        // Récupérer les candidatures de l'utilisateur avec une requête optimisée
        const [candidatureRows] = await connection.execute(`
            SELECT 
                c.*,
                el.id as election_id,
                el.titre as election_titre,
                el.type as election_type,
                el.description as election_description,
                el.dateDebut as election_dateDebut,
                el.dateFin as election_dateFin,
                (SELECT COUNT(*) FROM votes v WHERE v.candidateId = c.id) as votes_count
            FROM candidates c
            LEFT JOIN elections el ON c.electionId = el.id
            WHERE c.userId = ?
            ORDER BY c.createdAt DESC
        `, [userId]);

        // Formater la réponse
        const formattedCandidatures = candidatureRows.map(candidature => ({
            id: candidature.id,
            nom: candidature.nom,
            prenom: candidature.prenom,
            slogan: candidature.slogan,
            programme: candidature.programme,
            motivation: candidature.motivation,
            photoUrl: candidature.photoUrl,
            statut: candidature.statut,
            createdAt: candidature.createdAt,
            updatedAt: candidature.updatedAt,
            election: {
                id: candidature.election_id,
                titre: candidature.election_titre,
                type: candidature.election_type,
                description: candidature.election_description,
                dateDebut: candidature.election_dateDebut,
                dateFin: candidature.election_dateFin
            },
            votesCount: candidature.votes_count
        }));

        res.json({
            success: true,
            data: {
                candidatures: formattedCandidatures,
                total: candidatureRows.length
            }
        });

    } catch (error) {
        console.error('Erreur récupération candidatures:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération des candidatures',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Récupérer un candidat spécifique
router.get('/:id', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const candidateId = parseInt(req.params.id);

        if (isNaN(candidateId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de candidat invalide'
            });
        }

        const [candidateRows] = await connection.execute(`
            SELECT 
                c.*,
                u.email,
                e.nom as etudiant_nom,
                e.prenom as etudiant_prenom,
                e.filiere,
                e.annee,
                e.ecole,
                e.photoUrl as etudiant_photoUrl,
                el.titre as election_titre,
                el.type as election_type,
                COUNT(v.id) as votes_count
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            LEFT JOIN elections el ON c.electionId = el.id
            LEFT JOIN votes v ON c.id = v.candidateId
            WHERE c.id = ?
            GROUP BY c.id
        `, [candidateId]);

        if (candidateRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Candidat non trouvé'
            });
        }

        const candidate = candidateRows[0];
        res.json({
            success: true,
            data: {
                id: candidate.id,
                nom: candidate.nom,
                prenom: candidate.prenom,
                slogan: candidate.slogan,
                programme: candidate.programme,
                motivation: candidate.motivation,
                photoUrl: candidate.photoUrl,
                statut: candidate.statut,
                createdAt: candidate.createdAt,
                user: {
                    email: candidate.email,
                    etudiant: candidate.etudiant_nom ? {
                        nom: candidate.etudiant_nom,
                        prenom: candidate.etudiant_prenom,
                        filiere: candidate.filiere,
                        annee: candidate.annee,
                        ecole: candidate.ecole,
                        photoUrl: candidate.etudiant_photoUrl
                    } : null
                },
                election: {
                    titre: candidate.election_titre,
                    type: candidate.election_type
                },
                votesCount: candidate.votes_count
            }
        });

    } catch (error) {
        console.error('Error fetching candidate:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Déposer une candidature à une élection
router.post('/', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId, slogan, photo, programme, motivation } = req.body;
        const userId = req.user.id;

        // Validation des champs requis
        if (!electionId || !slogan || !photo || !programme || !motivation) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs sont requis: electionId, slogan, photo, programme, motivation'
            });
        }

        // Vérifier que l'utilisateur existe
        const [userRows] = await connection.execute(`
            SELECT u.*, e.nom, e.prenom 
            FROM users u 
            LEFT JOIN etudiants e ON u.id = e.userId 
            WHERE u.id = ?
        `, [userId]);

        if (userRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Utilisateur inexistant'
            });
        }

        // Vérifier que l'élection existe
        const [electionRows] = await connection.execute(
            'SELECT id FROM elections WHERE id = ?',
            [parseInt(electionId)]
        );

        if (electionRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Élection inexistante'
            });
        }

        // Vérifier que l'utilisateur n'est pas déjà candidat
        const [existingCandidateRows] = await connection.execute(
            'SELECT id FROM candidates WHERE userId = ? AND electionId = ?',
            [userId, parseInt(electionId)]
        );

        if (existingCandidateRows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Vous êtes déjà candidat à cette élection.'
            });
        }

        // Récupérer nom et prénom
        const user = userRows[0];
        let nom = user.nom || 'Candidat';
        let prenom = user.prenom || 'Étudiant';

        // Valider les longueurs
        if (nom.length > 100) nom = nom.substring(0, 100);
        if (prenom.length > 100) prenom = prenom.substring(0, 100);
        if (slogan.length > 200) {
            return res.status(400).json({
                success: false,
                message: 'Le slogan ne doit pas dépasser 200 caractères'
            });
        }
        if (photo.length > 500) {
            return res.status(400).json({
                success: false,
                message: 'L\'URL de la photo est trop longue'
            });
        }

        // Créer la candidature avec les bons noms de colonnes
        const [result] = await connection.execute(`
            INSERT INTO candidates (nom, prenom, slogan, programme, motivation, photoUrl, userId, electionId, statut, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE', NOW(), NOW())
        `, [nom, prenom, slogan, programme, motivation, photo, userId, parseInt(electionId)]);

        res.status(201).json({
            success: true,
            message: 'Candidature déposée avec succès',
            data: {
                id: result.insertId,
                nom,
                prenom,
                slogan,
                programme,
                motivation,
                photoUrl: photo,
                statut: 'EN_ATTENTE'
            }
        });

    } catch (error) {
        console.error('❌ Erreur création candidature:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la création de la candidature',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Mise à jour du programme d'un candidat
router.put('/:candidateId/programme', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const candidateId = parseInt(req.params.candidateId);
        const { programme } = req.body;

        if (isNaN(candidateId) || !programme) {
            return res.status(400).json({
                success: false,
                message: 'Paramètres invalides'
            });
        }

        // Vérifier que le candidat existe et appartient à l'utilisateur
        const [candidateRows] = await connection.execute(
            'SELECT id, userId FROM candidates WHERE id = ?',
            [candidateId]
        );

        if (candidateRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Candidat introuvable'
            });
        }

        if (candidateRows[0].userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Non autorisé'
            });
        }

        // Mettre à jour le programme
        await connection.execute(
            'UPDATE candidates SET programme = ?, updatedAt = NOW() WHERE id = ?',
            [programme, candidateId]
        );

        res.json({
            success: true,
            message: 'Programme mis à jour'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Test sans pagination
router.get('/', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const query = `
            SELECT 
                c.*,
                u.email,
                e.nom as etudiant_nom,
                e.prenom as etudiant_prenom
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            LIMIT 10 OFFSET 0
        `;

        console.log('Requête test:', query);
        const [rows] = await connection.execute(query, []);

        res.json({ success: true, data: rows });

    } catch (error) {
        console.error('Error test:', error);
        res.status(500).json({ success: false, message: 'Erreur test' });
    } finally {
        if (connection) await connection.release();
    }
});

// Modifier un candidat (Admin seulement)
router.put('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const candidateId = parseInt(req.params.id);
        const { nom, prenom, programme, photoUrl } = req.body;

        if (isNaN(candidateId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de candidat invalide'
            });
        }

        // Construire la requête de mise à jour dynamiquement
        let updateFields = [];
        let updateValues = [];

        if (nom) {
            updateFields.push('nom = ?');
            updateValues.push(nom);
        }

        if (prenom) {
            updateFields.push('prenom = ?');
            updateValues.push(prenom);
        }

        if (programme !== undefined) {
            updateFields.push('programme = ?');
            updateValues.push(programme);
        }

        if (photoUrl !== undefined) {
            updateFields.push('photoUrl = ?');
            updateValues.push(photoUrl);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucun champ à mettre à jour'
            });
        }

        updateValues.push(candidateId);

        await connection.execute(`
            UPDATE candidates SET ${updateFields.join(', ')}, updatedAt = NOW() WHERE id = ?
        `, updateValues);

        // Récupérer le candidat mis à jour
        const [updatedCandidateRows] = await connection.execute(`
            SELECT c.*, u.email, e.* 
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE c.id = ?
        `, [candidateId]);

        res.json({
            success: true,
            message: 'Candidat mis à jour avec succès',
            data: {
                candidate: updatedCandidateRows[0]
            }
        });

    } catch (error) {
        console.error('Error updating candidate:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Supprimer un candidat (Admin seulement)
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const candidateId = parseInt(req.params.id);

        if (isNaN(candidateId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de candidat invalide'
            });
        }

        await connection.execute(
            'DELETE FROM candidates WHERE id = ?',
            [candidateId]
        );

        res.json({
            success: true,
            message: 'Candidat supprimé avec succès'
        });

    } catch (error) {
        console.error('Error deleting candidate:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Liste des candidats pour l'admin avec filtres
router.get('/admin/list', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const {
            electionId,
            statut,
            search,
            page = 1,
            limit = 10
        } = req.query;

        // Construction de la clause WHERE
        let whereConditions = ['1=1'];
        let params = [];

        if (electionId && electionId !== 'all') {
            whereConditions.push('c.electionId = ?');
            params.push(parseInt(electionId));
        }

        if (statut && statut !== 'all') {
            whereConditions.push('c.statut = ?');
            params.push(statut);
        }

        if (search) {
            whereConditions.push(`(
                c.nom LIKE ? OR 
                c.prenom LIKE ? OR 
                u.email LIKE ? OR 
                e.matricule LIKE ? OR 
                e.filiere LIKE ? OR 
                el.titre LIKE ?
            )`);
            const searchPattern = `%${search}%`;
            for (let i = 0; i < 6; i++) params.push(searchPattern);
        }

        const whereClause = whereConditions.join(' AND ');

        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const queryParams = [...params, parseInt(limit), offset];

        const [candidateRows] = await connection.execute(`
            SELECT 
                c.*,
                u.email,
                e.matricule,
                e.filiere,
                e.annee,
                e.ecole,
                e.photoUrl as etudiant_photoUrl,
                el.id as election_id,
                el.titre as election_titre,
                el.type as election_type,
                el.dateDebut as election_dateDebut,
                el.dateFin as election_dateFin,
                COUNT(v.id) as votes_count
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            LEFT JOIN elections el ON c.electionId = el.id
            LEFT JOIN votes v ON c.id = v.candidateId
            WHERE ${whereClause}
            GROUP BY c.id
            ORDER BY c.createdAt DESC
            LIMIT ? OFFSET ?
        `, queryParams);

        // Compter le total
        const [countRows] = await connection.execute(`
            SELECT COUNT(*) as total 
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            LEFT JOIN elections el ON c.electionId = el.id
            WHERE ${whereClause}
        `, params);

        const total = countRows[0].total;
        const totalPages = Math.ceil(total / parseInt(limit));

        // Formater la réponse
        const formattedCandidates = candidateRows.map(candidate => ({
            id: candidate.id,
            nom: candidate.nom,
            prenom: candidate.prenom,
            slogan: candidate.slogan,
            programme: candidate.programme,
            motivation: candidate.motivation,
            photoUrl: candidate.photoUrl,
            statut: candidate.statut,
            createdAt: candidate.createdAt,
            updatedAt: candidate.updatedAt,
            user: {
                id: candidate.userId,
                email: candidate.email,
                etudiant: candidate.matricule ? {
                    matricule: candidate.matricule,
                    filiere: candidate.filiere,
                    annee: candidate.annee,
                    ecole: candidate.ecole,
                    photoUrl: candidate.etudiant_photoUrl
                } : null
            },
            election: {
                id: candidate.election_id,
                titre: candidate.election_titre,
                type: candidate.election_type,
                dateDebut: candidate.election_dateDebut,
                dateFin: candidate.election_dateFin
            },
            votesCount: candidate.votes_count
        }));

        res.json({
            success: true,
            data: {
                candidates: formattedCandidates,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalCandidates: total,
                    hasNext: parseInt(page) < totalPages,
                    hasPrev: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error('Erreur récupération candidats admin:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération des candidats',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Statistiques pour l'admin
router.get('/admin/stats', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const [totalRows] = await connection.execute('SELECT COUNT(*) as total FROM candidates');
        const [enAttenteRows] = await connection.execute('SELECT COUNT(*) as count FROM candidates WHERE statut = "EN_ATTENTE"');
        const [approuvesRows] = await connection.execute('SELECT COUNT(*) as count FROM candidates WHERE statut = "APPROUVE"');
        const [rejetesRows] = await connection.execute('SELECT COUNT(*) as count FROM candidates WHERE statut = "REJETE"');

        res.json({
            success: true,
            data: {
                stats: {
                    total: totalRows[0].total,
                    enAttente: enAttenteRows[0].count,
                    approuves: approuvesRows[0].count,
                    rejetes: rejetesRows[0].count
                }
            }
        });

    } catch (error) {
        console.error('Erreur récupération stats:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération des statistiques',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Mettre à jour le statut d'un candidat (Admin seulement)
router.patch('/:id/status', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const candidateId = parseInt(req.params.id);
        const { statut } = req.body;

        if (isNaN(candidateId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de candidat invalide'
            });
        }

        if (!statut || !['EN_ATTENTE', 'APPROUVE', 'REJETE'].includes(statut)) {
            return res.status(400).json({
                success: false,
                message: 'Statut invalide. Valeurs acceptées: EN_ATTENTE, APPROUVE, REJETE'
            });
        }

        // Vérifier que le candidat existe
        const [candidateRows] = await connection.execute(`
            SELECT c.*, u.email, e.nom, e.prenom, e.matricule, e.filiere, e.annee, e.ecole
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE c.id = ?
        `, [candidateId]);

        if (candidateRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Candidat non trouvé'
            });
        }

        // Mettre à jour le statut
        await connection.execute(
            'UPDATE candidates SET statut = ?, updatedAt = NOW() WHERE id = ?',
            [statut, candidateId]
        );

        const candidate = candidateRows[0];
        console.log(`Statut candidature mis à jour: ${candidateId} -> ${statut}`);

        res.json({
            success: true,
            message: `Statut de la candidature mis à jour avec succès`,
            data: {
                candidate: {
                    id: candidate.id,
                    nom: candidate.nom,
                    prenom: candidate.prenom,
                    statut: statut,
                    user: {
                        email: candidate.email,
                        etudiant: candidate.nom ? {
                            nom: candidate.nom,
                            prenom: candidate.prenom,
                            matricule: candidate.matricule,
                            filiere: candidate.filiere,
                            annee: candidate.annee,
                            ecole: candidate.ecole
                        } : null
                    }
                }
            }
        });

    } catch (error) {
        console.error('Erreur mise à jour statut:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la mise à jour du statut',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Récupérer un candidat avec tous les détails pour l'admin
router.get('/admin/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const candidateId = parseInt(req.params.id);

        if (isNaN(candidateId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de candidat invalide'
            });
        }

        // Récupérer les détails du candidat
        const [candidateRows] = await connection.execute(`
            SELECT 
                c.*,
                u.email,
                u.createdAt as user_createdAt,
                e.id as etudiant_id,
                e.matricule,
                e.nom as etudiant_nom,
                e.prenom as etudiant_prenom,
                e.filiere,
                e.annee,
                e.ecole,
                e.photoUrl as etudiant_photoUrl,
                el.id as election_id,
                el.titre as election_titre,
                el.type as election_type,
                el.description as election_description,
                el.dateDebut as election_dateDebut,
                el.dateFin as election_dateFin,
                el.dateDebutCandidature as election_dateDebutCandidature,
                el.dateFinCandidature as election_dateFinCandidature,
                COUNT(v.id) as votes_count
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            LEFT JOIN elections el ON c.electionId = el.id
            LEFT JOIN votes v ON c.id = v.candidateId
            WHERE c.id = ?
            GROUP BY c.id
        `, [candidateId]);

        if (candidateRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Candidat non trouvé'
            });
        }

        // Récupérer les derniers votes
        const [voteRows] = await connection.execute(`
            SELECT 
                v.*,
                u.email,
                e.matricule,
                e.filiere,
                e.annee
            FROM votes v
            LEFT JOIN users u ON v.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE v.candidateId = ?
            ORDER BY v.createdAt DESC
            LIMIT 10
        `, [candidateId]);

        const candidate = candidateRows[0];

        // Formater la réponse
        const formattedCandidate = {
            id: candidate.id,
            nom: candidate.nom,
            prenom: candidate.prenom,
            slogan: candidate.slogan,
            programme: candidate.programme,
            motivation: candidate.motivation,
            photoUrl: candidate.photoUrl,
            statut: candidate.statut,
            createdAt: candidate.createdAt,
            updatedAt: candidate.updatedAt,
            user: {
                id: candidate.userId,
                email: candidate.email,
                createdAt: candidate.user_createdAt,
                etudiant: candidate.etudiant_id ? {
                    id: candidate.etudiant_id,
                    matricule: candidate.matricule,
                    nom: candidate.etudiant_nom,
                    prenom: candidate.etudiant_prenom,
                    filiere: candidate.filiere,
                    annee: candidate.annee,
                    ecole: candidate.ecole,
                    photoUrl: candidate.etudiant_photoUrl
                } : null
            },
            election: {
                id: candidate.election_id,
                titre: candidate.election_titre,
                type: candidate.election_type,
                description: candidate.election_description,
                dateDebut: candidate.election_dateDebut,
                dateFin: candidate.election_dateFin,
                dateDebutCandidature: candidate.election_dateDebutCandidature,
                dateFinCandidature: candidate.election_dateFinCandidature
            },
            votes: voteRows.map(vote => ({
                id: vote.id,
                createdAt: vote.createdAt,
                user: {
                    email: vote.email,
                    etudiant: vote.matricule ? {
                        matricule: vote.matricule,
                        filiere: vote.filiere,
                        annee: vote.annee
                    } : null
                }
            })),
            votesCount: candidate.votes_count
        };

        res.json({
            success: true,
            data: {
                candidate: formattedCandidate
            }
        });

    } catch (error) {
        console.error('Erreur récupération détails candidat:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération des détails du candidat',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

export default router;