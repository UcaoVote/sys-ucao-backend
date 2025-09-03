import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

// GET /eligibility/check/:electionId - Vérifier l'éligibilité générale
router.get('/check/:electionId', authenticateToken, requireRole, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId } = req.params;
        const userId = req.user.id;

        // 1. Vérifier que l'élection existe
        const [electionRows] = await connection.execute(
            'SELECT * FROM elections WHERE id = ?',
            [parseInt(electionId)]
        );

        if (electionRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Élection non trouvée'
            });
        }

        const election = electionRows[0];

        // 2. Vérifier que l'utilisateur est un étudiant
        const [userRows] = await connection.execute(
            'SELECT role FROM users WHERE id = ?',
            [userId]
        );

        if (userRows.length === 0 || userRows[0].role !== 'ETUDIANT') {
            return res.json({
                success: true,
                eligible: false,
                message: 'Réservé aux étudiants'
            });
        }

        // 3. Récupérer les infos de l'étudiant
        const [studentRows] = await connection.execute(
            `SELECT e.* FROM etudiants e 
             WHERE e.userId = ?`,
            [userId]
        );

        if (studentRows.length === 0) {
            return res.json({
                success: true,
                eligible: false,
                message: 'Profil étudiant incomplet'
            });
        }

        const student = studentRows[0];

        // 4. Vérifications spécifiques selon le type d'élection
        let eligible = false;
        let reason = '';

        switch (election.type) {
            case 'SALLE':
                // Pour responsable de salle: même filière, année, école
                eligible = student.filiere === election.filiere &&
                    student.annee === election.annee &&
                    student.ecole === election.ecole;
                reason = eligible ? '' : 'Non éligible pour cette salle';
                break;

            case 'ECOLE':
                // Pour délégué d'école: vérifier si c'est un responsable de salle de la même école
                const [responsableRows] = await connection.execute(
                    `SELECT * FROM responsables_salle rs
                     WHERE rs.etudiantId = ? AND rs.ecole = ?`,
                    [student.id, election.ecole]
                );
                eligible = responsableRows.length > 0;
                reason = eligible ? '' : 'Non responsable de salle dans cette école';
                break;

            case 'UNIVERSITE':
                // Pour délégué universitaire: vérifier si c'est un délégué d'école
                const [delegueRows] = await connection.execute(
                    `SELECT * FROM delegues_ecole de
                     JOIN responsables_salle rs ON de.responsableId = rs.id
                     WHERE rs.etudiantId = ?`,
                    [student.id]
                );
                eligible = delegueRows.length > 0;
                reason = eligible ? '' : 'Non délégué d\'école';
                break;

            default:
                eligible = false;
                reason = 'Type d\'élection non supporté';
        }

        // 5. Vérifier les dates de candidature
        const now = new Date();
        const debutCandidature = new Date(election.dateDebutCandidature);
        const finCandidature = new Date(election.dateFinCandidature);

        const inCandidaturePeriod = now >= debutCandidature && now <= finCandidature;
        if (!inCandidaturePeriod) {
            eligible = false;
            reason = 'Hors période de candidature';
        }

        res.json({
            success: true,
            eligible,
            message: reason,
            election: {
                id: election.id,
                titre: election.titre,
                type: election.type,
                dateDebutCandidature: election.dateDebutCandidature,
                dateFinCandidature: election.dateFinCandidature
            },
            student: {
                filiere: student.filiere,
                annee: student.annee,
                ecole: student.ecole
            }
        });

    } catch (error) {
        console.error('Erreur vérification éligibilité:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la vérification d\'éligibilité'
        });
    } finally {
        if (connection) await connection.release();
    }
});

// GET /eligibility/can-candidate/:electionId - Vérifier si peut candidater
router.get('/can-candidate/:electionId', authenticateToken, requireRole, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId } = req.params;
        const userId = req.user.id;

        // 1. Vérifier l'éligibilité générale
        const [electionRows] = await connection.execute(
            'SELECT * FROM elections WHERE id = ?',
            [parseInt(electionId)]
        );

        if (electionRows.length === 0) {
            return res.json({
                success: true,
                canCandidate: false,
                message: 'Élection non trouvée'
            });
        }

        const election = electionRows[0];

        // 2. Vérifier les dates de candidature
        const now = new Date();
        const debutCandidature = new Date(election.dateDebutCandidature);
        const finCandidature = new Date(election.dateFinCandidature);

        if (now < debutCandidature) {
            return res.json({
                success: true,
                canCandidate: false,
                message: 'Période de candidature pas encore commencée'
            });
        }

        if (now > finCandidature) {
            return res.json({
                success: true,
                canCandidate: false,
                message: 'Période de candidature terminée'
            });
        }

        // 3. Vérifier si déjà candidat
        const [candidateRows] = await connection.execute(
            'SELECT id FROM candidates WHERE userId = ? AND electionId = ?',
            [userId, parseInt(electionId)]
        );

        if (candidateRows.length > 0) {
            return res.json({
                success: true,
                canCandidate: false,
                message: 'Déjà candidat à cette élection'
            });
        }

        // 4. Vérifier l'éligibilité spécifique
        const [studentRows] = await connection.execute(
            `SELECT e.* FROM etudiants e WHERE e.userId = ?`,
            [userId]
        );

        if (studentRows.length === 0) {
            return res.json({
                success: true,
                canCandidate: false,
                message: 'Profil étudiant incomplet'
            });
        }

        const student = studentRows[0];
        let canCandidate = false;
        let message = '';

        switch (election.type) {
            case 'SALLE':
                canCandidate = student.filiere === election.filiere &&
                    student.annee === election.annee &&
                    student.ecole === election.ecole;
                message = canCandidate ? '' : 'Non éligible pour cette salle';
                break;

            case 'ECOLE':
                const [responsableRows] = await connection.execute(
                    `SELECT * FROM responsables_salle rs
                     WHERE rs.etudiantId = ? AND rs.ecole = ?`,
                    [student.id, election.ecole]
                );
                canCandidate = responsableRows.length > 0;
                message = canCandidate ? '' : 'Non responsable de salle';
                break;

            case 'UNIVERSITE':
                const [delegueRows] = await connection.execute(
                    `SELECT * FROM delegues_ecole de
                     JOIN responsables_salle rs ON de.responsableId = rs.id
                     WHERE rs.etudiantId = ?`,
                    [student.id]
                );
                canCandidate = delegueRows.length > 0;
                message = canCandidate ? '' : 'Non délégué d\'école';
                break;

            default:
                canCandidate = false;
                message = 'Type d\'élection non supporté';
        }

        res.json({
            success: true,
            canCandidate,
            message
        });

    } catch (error) {
        console.error('Erreur vérification candidature:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    } finally {
        if (connection) await connection.release();
    }
});

// GET /eligibility/can-vote/:electionId - Vérifier si peut voter
router.get('/can-vote/:electionId', authenticateToken, requireRole, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId } = req.params;
        const userId = req.user.id;

        // 1. Vérifier que l'élection existe et est active
        const [electionRows] = await connection.execute(
            'SELECT * FROM elections WHERE id = ?',
            [parseInt(electionId)]
        );

        if (electionRows.length === 0) {
            return res.json({
                success: true,
                canVote: false,
                message: 'Élection non trouvée'
            });
        }

        const election = electionRows[0];

        // 2. Vérifier les dates de vote
        const now = new Date();
        const debutVote = new Date(election.dateDebut);
        const finVote = new Date(election.dateFin);

        if (now < debutVote) {
            return res.json({
                success: true,
                canVote: false,
                message: 'Période de vote pas encore commencée'
            });
        }

        if (now > finVote) {
            return res.json({
                success: true,
                canVote: false,
                message: 'Période de vote terminée'
            });
        }

        // 3. Vérifier si a déjà voté
        const [voteRows] = await connection.execute(
            'SELECT id FROM votes WHERE userId = ? AND electionId = ?',
            [userId, parseInt(electionId)]
        );

        if (voteRows.length > 0) {
            return res.json({
                success: true,
                canVote: false,
                message: 'A déjà voté à cette élection'
            });
        }

        // 4. Vérifier l'éligibilité au vote
        const [studentRows] = await connection.execute(
            `SELECT e.* FROM etudiants e WHERE e.userId = ?`,
            [userId]
        );

        if (studentRows.length === 0) {
            return res.json({
                success: true,
                canVote: false,
                message: 'Profil étudiant incomplet'
            });
        }

        const student = studentRows[0];
        let canVote = false;
        let message = '';

        switch (election.type) {
            case 'SALLE':
                canVote = student.filiere === election.filiere &&
                    student.annee === election.annee &&
                    student.ecole === election.ecole;
                message = canVote ? '' : 'Non éligible pour voter dans cette salle';
                break;

            case 'ECOLE':
                canVote = student.ecole === election.ecole;
                message = canVote ? '' : 'Non éligible pour voter dans cette école';
                break;

            case 'UNIVERSITE':
                canVote = true; // Tous les étudiants peuvent voter aux élections universitaires
                message = '';
                break;

            default:
                canVote = false;
                message = 'Type d\'élection non supporté';
        }

        res.json({
            success: true,
            canVote,
            message
        });

    } catch (error) {
        console.error('Erreur vérification vote:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    } finally {
        if (connection) await connection.release();
    }
});

// GET /eligibility/requirements/:electionId - Obtenir les conditions d'éligibilité
router.get('/requirements/:electionId', authenticateToken, requireRole, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId } = req.params;

        const [electionRows] = await connection.execute(
            'SELECT * FROM elections WHERE id = ?',
            [parseInt(electionId)]
        );

        if (electionRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Élection non trouvée'
            });
        }

        const election = electionRows[0];
        let requirements = [];

        switch (election.type) {
            case 'SALLE':
                requirements = [
                    `Être étudiant en ${election.filiere}`,
                    `Être en ${election.annee}ème année`,
                    `Appartenir à l'école ${election.ecole}`
                ];
                break;

            case 'ECOLE':
                requirements = [
                    `Être responsable de salle`,
                    `Appartenir à l'école ${election.ecole}`,
                    election.delegueType === 'PREMIER' ? 'Être en 3ème année' : 'Être en 2ème année'
                ];
                break;

            case 'UNIVERSITE':
                requirements = [
                    'Être délégué d\'école',
                    election.delegueType === 'PREMIER' ? 'Être premier délégué' : 'Être deuxième délégué'
                ];
                break;
        }

        res.json({
            success: true,
            requirements,
            election: {
                type: election.type,
                filiere: election.filiere,
                annee: election.annee,
                ecole: election.ecole,
                delegueType: election.delegueType
            }
        });

    } catch (error) {
        console.error('Erreur récupération conditions:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    } finally {
        if (connection) await connection.release();
    }
});

// GET /eligibility/responsable-status - Vérifier le statut de responsable
router.get('/responsable-status', authenticateToken, requireRole, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const userId = req.user.id;

        const [studentRows] = await connection.execute(
            `SELECT e.id FROM etudiants e WHERE e.userId = ?`,
            [userId]
        );

        if (studentRows.length === 0) {
            return res.json({
                success: true,
                isResponsable: false,
                message: 'Profil étudiant non trouvé'
            });
        }

        const studentId = studentRows[0].id;

        const [responsableRows] = await connection.execute(
            `SELECT * FROM responsables_salle WHERE etudiantId = ?`,
            [studentId]
        );

        res.json({
            success: true,
            isResponsable: responsableRows.length > 0,
            details: responsableRows.length > 0 ? responsableRows[0] : null
        });

    } catch (error) {
        console.error('Erreur vérification statut responsable:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    } finally {
        if (connection) await connection.release();
    }
});

// GET /eligibility/delegue-status - Vérifier le statut de délégué
router.get('/delegue-status', authenticateToken, requireRole, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const userId = req.user.id;

        const [studentRows] = await connection.execute(
            `SELECT e.id FROM etudiants e WHERE e.userId = ?`,
            [userId]
        );

        if (studentRows.length === 0) {
            return res.json({
                success: true,
                isDelegue: false,
                message: 'Profil étudiant non trouvé'
            });
        }

        const studentId = studentRows[0].id;

        // Vérifier si l'étudiant est responsable de salle
        const [responsableRows] = await connection.execute(
            `SELECT * FROM responsables_salle WHERE etudiantId = ?`,
            [studentId]
        );

        if (responsableRows.length === 0) {
            return res.json({
                success: true,
                isDelegue: false,
                message: 'Non responsable de salle'
            });
        }

        const responsableId = responsableRows[0].id;

        // Vérifier si le responsable est délégué d'école
        const [delegueRows] = await connection.execute(
            `SELECT * FROM delegues_ecole WHERE responsableId = ?`,
            [responsableId]
        );

        res.json({
            success: true,
            isDelegue: delegueRows.length > 0,
            details: delegueRows.length > 0 ? delegueRows[0] : null
        });

    } catch (error) {
        console.error('Erreur vérification statut délégué:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    } finally {
        if (connection) await connection.release();
    }
});

export default router;