// helpers/statsHelpers.js
export const calculateStartDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
};

export const formatDate = (date) => {
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit'
    });
};

export const calculateParticipationRate = async (connection, electionId, startDate) => {
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
};

export const calculateAverageVoteTime = async (connection, electionId, startDate) => {
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
};