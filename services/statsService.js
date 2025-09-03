// services/statsService.js
import pool from '../config/database.js';
import {
    calculateStartDate,
    formatDate,
    calculateParticipationRate,
    calculateAverageVoteTime
} from '../helpers/statsHelpers.js';

export const statsService = {
    async getGeneralStats(period, electionId) {
        let connection;
        try {
            connection = await pool.getConnection();
            const parsedPeriod = parseInt(period);
            const startDate = isNaN(parsedPeriod) ? calculateStartDate(30) : calculateStartDate(parsedPeriod);
            const electionIdInt = electionId ? parseInt(electionId) : undefined;

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

            const participationData = await calculateParticipationRate(connection, electionIdInt, startDate);
            const avgVoteTime = await calculateAverageVoteTime(connection, electionIdInt, startDate);

            return {
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
            };
        } finally {
            if (connection) await connection.release();
        }
    },

    async getVotesStats(period, electionId) {
        let connection;
        try {
            connection = await pool.getConnection();
            const startDate = calculateStartDate(parseInt(period));

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

            const labels = [];
            const values = [];

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

            return { labels, values };
        } finally {
            if (connection) await connection.release();
        }
    },

    async getDistributionStats(electionId) {
        let connection;
        try {
            connection = await pool.getConnection();

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

            return { labels, values };
        } finally {
            if (connection) await connection.release();
        }
    },

    async getHourlyStats(period, electionId) {
        let connection;
        try {
            connection = await pool.getConnection();
            const startDate = calculateStartDate(parseInt(period));

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

            const hourlyData = Array(24).fill(0);
            votesByHour.forEach(vote => {
                hourlyData[vote.hour] = vote.count;
            });

            const labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
            const values = hourlyData;

            return { labels, values };
        } finally {
            if (connection) await connection.release();
        }
    },

    async getComparisonStats(period) {
        let connection;
        try {
            connection = await pool.getConnection();
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

            return { labels, registered, voters };
        } finally {
            if (connection) await connection.release();
        }
    },

    async getParticipationStats() {
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
            return participationData;
        } finally {
            if (connection) await connection.release();
        }
    }
};