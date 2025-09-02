import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middlewares/auth.js';


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
            electionIdInt ? totalVotesQuery : totalVotesQuery.replace('?', '?'),
            electionIdInt ? [electionIdInt, startDate] : [startDate]
        );
        const [electionsResult] = await connection.execute(totalElectionsQuery, [startDate]);
        const [candidatesResult] = await connection.execute(totalCandidatesQuery, [startDate]);

        const totalUsers = usersResult[0].count;
        const totalVotes = votesResult[0].count;
        const totalElections = electionsResult[0].count;
        const totalCandidates = candidatesResult[0].count;

        // Calculs de participation
        let participationData = {
            userPercent: 0,
            votePercent: 0,
            candidatePercent: 0,
            electionPercent: 0
        };
        let avgVoteTime = 0;

        try {
            participationData = await calculateParticipationRate(electionIdInt, startDate);
        } catch (err) {
            console.warn('Erreur participationRate:', err.message);
        }

        try {
            avgVoteTime = await calculateAverageVoteTime(electionIdInt, startDate);
        } catch (err) {
            console.warn('Erreur avgVoteTime:', err.message);
        }

        // Réponse structurée
        res.json({
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
        });
    } catch (error) {
        console.error('Erreur stats générales:', error);
        res.status(500).json({
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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
            const votesForDay = votesByDay.find(v =>
                v.date.toISOString().split('T')[0] === dateStr
            );

            labels.push(formatDate(currentDate));
            values.push(votesForDay ? votesForDay.count : 0);

            currentDate.setDate(currentDate.getDate() + 1);
        }

        res.json({ labels, values });
    } catch (error) {
        console.error('Erreur stats votes:', error);
        res.status(500).json({
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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
            return res.status(400).json({ message: 'ID d\'élection requis' });
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

        const labels = votesDistribution.map(c => `${c.etudiant_prenom} ${c.etudiant_nom}`);
        const values = votesDistribution.map(c => c.vote_count);

        res.json({ labels, values });
    } catch (error) {
        console.error('Erreur distribution votes:', error);
        res.status(500).json({
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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
             GROUP BY HOUR(createdAt)` :
            `SELECT HOUR(createdAt) as hour, COUNT(*) as count 
             FROM votes 
             WHERE createdAt >= ? 
             GROUP BY HOUR(createdAt)`;

        const [votesByHour] = await connection.execute(
            hourlyQuery,
            electionId ? [parseInt(electionId), startDate] : [startDate]
        );

        // Préparer les données pour les 24 heures
        const hourlyData = Array(24).fill(0);

        votesByHour.forEach(vote => {
            hourlyData[vote.hour] += vote.count;
        });

        const labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
        const values = hourlyData;

        res.json({ labels, values });
    } catch (error) {
        console.error('Erreur stats horaires:', error);
        res.status(500).json({
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /stats/comparison
 * Récupère les données de comparaison entre élections
 */
router.get('/comparison', authenticateToken, async (req, res) => {
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

        res.json({ labels, registered, voters });
    } catch (error) {
        console.error('Erreur comparaison élections:', error);
        res.status(500).json({
            message: 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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

async function calculateParticipationRate(electionId, startDate) {
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
            return {
                rate: ((election.votes_count / election.tokens_count) * 100).toFixed(1),
                totalVotes: election.votes_count,
                totalVoters: election.tokens_count
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

    return {
        rate: totalVoters > 0 ? ((totalVotes / totalVoters) * 100).toFixed(1) : 0,
        totalVotes,
        totalVoters
    };
}

async function calculateAverageVoteTime(electionId, startDate) {
    // Simulation - à adapter selon votre structure de données
    return Math.random() * 10 + 15;
}

export default router;