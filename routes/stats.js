import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

/**
 * GET /stats/general
 * Récupère les statistiques générales pour le dashboard
 */
router.get('/general', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { period = '30', electionId } = req.query;

        // Sécurisation des paramètres
        const parsedPeriod = parseInt(period);
        const startDate = isNaN(parsedPeriod) ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : calculateStartDate(parsedPeriod);
        const electionIdInt = electionId ? parseInt(electionId) : undefined;

        // Requêtes MySQL
        const totalUsersQuery = `
            SELECT COUNT(*) as count FROM users 
            WHERE role = 'ETUDIANT' AND createdAt >= ?
        `;

        const totalVotesQuery = electionIdInt ?
            `SELECT COUNT(*) as count FROM votes WHERE electionId = ? AND createdAt >= ?` :
            `SELECT COUNT(*) as count FROM votes WHERE createdAt >= ?`;

        const totalElectionsQuery = `SELECT COUNT(*) as count FROM elections WHERE createdAt >= ?`;
        const totalCandidatesQuery = `SELECT COUNT(*) as count FROM candidates WHERE createdAt >= ?`;

        const [usersResult] = await connection.execute(totalUsersQuery, [startDate]);
        const [votesResult] = await connection.execute(
            totalVotesQuery,
            electionIdInt ? [electionIdInt, startDate] : [startDate]
        );
        const [electionsResult] = await connection.execute(totalElectionsQuery, [startDate]);
        const [candidatesResult] = await connection.execute(totalCandidatesQuery, [startDate]);

        const totalUsers = usersResult[0].count;
        const totalVotes = votesResult[0].count;
        const totalElections = electionsResult[0].count;
        const totalCandidates = candidatesResult[0].count;

        // Calculs de participation
        const participationData = await calculateParticipationRate(connection, electionIdInt, startDate);
        const avgVoteTime = await calculateAverageVoteTime(connection, electionIdInt, startDate);

        // Réponse structurée
        res.json({
            success: true,
            data: {
                users: {
                    total: totalUsers,
                    percent: participationData.userPercent || 0
                },
                votes: {
                    total: totalVotes,
                    percent: participationData.votePercent || 0
                },
                candidates: {
                    total: totalCandidates,
                    percent: participationData.candidatePercent || 0
                },
                elections: {
                    active: totalElections,
                    percent: participationData.electionPercent || 0
                },
                avgVoteTime,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Erreur stats générales:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

/**
 * GET /stats/votes
 * Récupère les données pour le graphique d'évolution des votes
 */
router.get('/votes', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { period = '30', electionId } = req.query;
        const startDate = calculateStartDate(parseInt(period));

        // Récupérer les votes groupés par jour
        const votesQuery = electionId ?
            `SELECT DATE(createdAt) as date, COUNT(*) as count 
             FROM votes 
             WHERE electionId = ? AND createdAt >= ? 
             GROUP BY DATE(createdAt) 
             ORDER BY date ASC` :
            `SELECT DATE(createdAt) as date, COUNT(*) as count 
             FROM votes 
             WHERE createdAt >= ? 
             GROUP BY DATE(createdAt) 
             ORDER BY date ASC`;

        const [votesByDay] = await connection.execute(
            votesQuery,
            electionId ? [parseInt(electionId), startDate] : [startDate]
        );

        // Formater les données pour Chart.js
        const labels = [];
        const values = [];

        // Générer les données pour chaque jour de la période
        const currentDate = new Date(startDate);
        const today = new Date();

        while (currentDate <= today) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const votesForDay = votesByDay.find(v => {
                const voteDate = new Date(v.date);
                return voteDate.toISOString().split('T')[0] === dateStr;
            });

            labels.push(formatDate(currentDate));
            values.push(votesForDay ? votesForDay.count : 0);

            currentDate.setDate(currentDate.getDate() + 1);
        }

        res.json({
            success: true,
            data: { labels, values }
        });
    } catch (error) {
        console.error('Erreur stats votes:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

/**
 * GET /stats/distribution
 * Récupère la répartition des votes par candidat
 */
router.get('/distribution', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { electionId } = req.query;

        if (!electionId) {
            return res.status(400).json({
                success: false,
                message: 'ID d\'élection requis'
            });
        }

        const distributionQuery = `
            SELECT 
                c.*,
                COUNT(v.id) as vote_count,
                e.nom as etudiant_nom,
                e.prenom as etudiant_prenom
            FROM candidates c
            LEFT JOIN votes v ON c.id = v.candidateId
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE c.electionId = ?
            GROUP BY c.id
            ORDER BY vote_count DESC
        `;

        const [votesDistribution] = await connection.execute(distributionQuery, [parseInt(electionId)]);

        const labels = votesDistribution.map(c => `${c.etudiant_prenom} ${c.etudiant_nom}`.trim() || 'Candidat inconnu');
        const values = votesDistribution.map(c => c.vote_count);

        res.json({
            success: true,
            data: { labels, values }
        });
    } catch (error) {
        console.error('Erreur distribution votes:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

/**
 * GET /stats/hourly
 * Récupère la participation par heure
 */
router.get('/hourly', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { period = '7', electionId } = req.query;
        const startDate = calculateStartDate(parseInt(period));

        // Récupérer les votes groupés par heure
        const hourlyQuery = electionId ?
            `SELECT HOUR(createdAt) as hour, COUNT(*) as count 
             FROM votes 
             WHERE electionId = ? AND createdAt >= ? 
             GROUP BY HOUR(createdAt)
             ORDER BY hour ASC` :
            `SELECT HOUR(createdAt) as hour, COUNT(*) as count 
             FROM votes 
             WHERE createdAt >= ? 
             GROUP BY HOUR(createdAt)
             ORDER BY hour ASC`;

        const [votesByHour] = await connection.execute(
            hourlyQuery,
            electionId ? [parseInt(electionId), startDate] : [startDate]
        );

        // Préparer les données pour les 24 heures
        const hourlyData = Array(24).fill(0);

        votesByHour.forEach(vote => {
            hourlyData[vote.hour] = vote.count;
        });

        const labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
        const values = hourlyData;

        res.json({
            success: true,
            data: { labels, values }
        });
    } catch (error) {
        console.error('Erreur stats horaires:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

/**
 * GET /stats/comparison
 * Récupère les données de comparaison entre élections
 */
router.get('/comparison', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { period = '365' } = req.query;
        const startDate = calculateStartDate(parseInt(period));

        const comparisonQuery = `
            SELECT 
                e.*,
                COUNT(DISTINCT vt.id) as registered_count,
                COUNT(DISTINCT v.id) as votes_count
            FROM elections e
            LEFT JOIN vote_tokens vt ON e.id = vt.electionId
            LEFT JOIN votes v ON e.id = v.electionId
            WHERE e.createdAt >= ?
            GROUP BY e.id
            ORDER BY e.dateDebut ASC
        `;

        const [elections] = await connection.execute(comparisonQuery, [startDate]);

        const labels = elections.map(e => e.titre);
        const registered = elections.map(e => e.registered_count);
        const voters = elections.map(e => e.votes_count);

        res.json({
            success: true,
            data: { labels, registered, voters }
        });
    } catch (error) {
        console.error('Erreur comparaison élections:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

/**
 * GET /stats/participation
 * Récupère le taux de participation par élection
 */
router.get('/participation', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const participationQuery = `
            SELECT 
                e.id,
                e.titre,
                e.type,
                e.dateDebut,
                e.dateFin,
                COUNT(DISTINCT vt.id) as total_voters,
                COUNT(DISTINCT v.id) as total_votes,
                CASE 
                    WHEN COUNT(DISTINCT vt.id) > 0 
                    THEN ROUND((COUNT(DISTINCT v.id) * 100.0 / COUNT(DISTINCT vt.id)), 2)
                    ELSE 0 
                END as participation_rate
            FROM elections e
            LEFT JOIN vote_tokens vt ON e.id = vt.electionId
            LEFT JOIN votes v ON e.id = v.electionId
            GROUP BY e.id
            ORDER BY e.dateDebut DESC
        `;

        const [participationData] = await connection.execute(participationQuery);

        res.json({
            success: true,
            data: participationData
        });
    } catch (error) {
        console.error('Erreur stats participation:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Fonctions utilitaires
function calculateStartDate(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
}

function formatDate(date) {
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit'
    });
}

async function calculateParticipationRate(connection, electionId, startDate) {
    try {
        if (electionId) {
            const electionQuery = `
                SELECT 
                    COUNT(DISTINCT v.id) as votes_count,
                    COUNT(DISTINCT vt.id) as tokens_count
                FROM elections e
                LEFT JOIN votes v ON e.id = v.electionId
                LEFT JOIN vote_tokens vt ON e.id = vt.electionId
                WHERE e.id = ?
            `;

            const [electionResult] = await connection.execute(electionQuery, [electionId]);
            const election = electionResult[0];

            if (election && election.tokens_count > 0) {
                const rate = ((election.votes_count / election.tokens_count) * 100);
                return {
                    votePercent: parseFloat(rate.toFixed(1)),
                    userPercent: 0,
                    candidatePercent: 0,
                    electionPercent: 0
                };
            }
        }

        // Calcul global si pas d'élection spécifique
        const votesQuery = `SELECT COUNT(*) as count FROM votes WHERE createdAt >= ?`;
        const tokensQuery = `SELECT COUNT(*) as count FROM vote_tokens WHERE createdAt >= ?`;

        const [[votesResult]] = await connection.execute(votesQuery, [startDate]);
        const [[tokensResult]] = await connection.execute(tokensQuery, [startDate]);

        const totalVotes = votesResult.count;
        const totalVoters = tokensResult.count;

        const voteRate = totalVoters > 0 ? ((totalVotes / totalVoters) * 100) : 0;

        return {
            votePercent: parseFloat(voteRate.toFixed(1)),
            userPercent: 0,
            candidatePercent: 0,
            electionPercent: 0
        };
    } catch (error) {
        console.error('Erreur calcul participation:', error);
        return {
            votePercent: 0,
            userPercent: 0,
            candidatePercent: 0,
            electionPercent: 0
        };
    }
}

async function calculateAverageVoteTime(connection, electionId, startDate) {
    try {
        const avgTimeQuery = electionId ?
            `SELECT AVG(TIMESTAMPDIFF(SECOND, vt.createdAt, v.createdAt)) as avg_time 
             FROM votes v
             JOIN vote_tokens vt ON v.userId = vt.userId AND v.electionId = vt.electionId
             WHERE v.electionId = ? AND v.createdAt >= ?` :
            `SELECT AVG(TIMESTAMPDIFF(SECOND, vt.createdAt, v.createdAt)) as avg_time 
             FROM votes v
             JOIN vote_tokens vt ON v.userId = vt.userId AND v.electionId = vt.electionId
             WHERE v.createdAt >= ?`;

        const [result] = await connection.execute(
            avgTimeQuery,
            electionId ? [electionId, startDate] : [startDate]
        );

        return result[0]?.avg_time ? parseFloat(result[0].avg_time) : 0;
    } catch (error) {
        console.error('Erreur calcul temps moyen:', error);
        return 0;
    }
}

export default router;