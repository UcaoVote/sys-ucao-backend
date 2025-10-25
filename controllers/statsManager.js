import pool from '../dbconfig.js'
import ExcelJS from 'exceljs'

// Statistiques générales
async function getGeneralStats(req, res) {
    try {
        const { period, electionId } = req.query;

        // Nombre total d'utilisateurs actifs
        const [usersResult] = await pool.execute(
            'SELECT COUNT(*) AS total_users FROM users WHERE actif = TRUE'
        );

        // Nombre d’élections actives
        const [electionsResult] = await pool.execute(
            'SELECT COUNT(*) AS active_elections FROM elections WHERE isActive = TRUE'
        )

        // Nombre total de votes
        let votesQuery = 'SELECT COUNT(*) AS total_votes FROM votes';
        let votesParams = [];

        if (electionId && electionId !== 'all') {
            votesQuery += ' WHERE electionId = ?';
            votesParams.push(electionId);
        }

        const [votesResult] = await pool.execute(votesQuery, votesParams);

        // Nombre total de candidats approuvés
        let candidatesQuery = 'SELECT COUNT(*) AS total_candidates FROM candidates WHERE statut = "APPROUVE"';
        let candidatesParams = [];

        if (electionId && electionId !== 'all') {
            candidatesQuery += ' AND electionId = ?';
            candidatesParams.push(electionId);
        }

        const [candidatesResult] = await pool.execute(candidatesQuery, candidatesParams);

        // Taux de participation global
        let participationQuery = `
            SELECT 
                COUNT(DISTINCT v.userId) AS voters,
                (SELECT COUNT(*) FROM etudiants e 
                 JOIN users u ON e.userId = u.id 
                 WHERE u.actif = TRUE) AS total_students,
                CASE 
                    WHEN (SELECT COUNT(*) FROM etudiants e JOIN users u ON e.userId = u.id WHERE u.actif = TRUE) > 0 
                    THEN ROUND((COUNT(DISTINCT v.userId) * 100.0 / 
                          (SELECT COUNT(*) FROM etudiants e JOIN users u ON e.userId = u.id WHERE u.actif = TRUE)), 2)
                    ELSE 0 
                END AS participation_rate
            FROM votes v
        `;
        let participationParams = [];

        if (electionId && electionId !== 'all') {
            participationQuery += ' WHERE v.electionId = ?';
            participationParams.push(electionId);
        }

        const [participationResult] = await pool.execute(participationQuery, participationParams);

        // Calcul des tendances (pour la période spécifiée)
        const days = parseInt(period) || 30;

        // Tendance des votes
        let voteTrendQuery = `
            SELECT 
                'current' AS period,
                COUNT(*) AS vote_count
            FROM votes 
            WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `;
        let voteTrendParams = [days];

        if (electionId && electionId !== 'all') {
            voteTrendQuery += ' AND electionId = ?';
            voteTrendParams.push(electionId);
        }

        voteTrendQuery += `
            UNION ALL
            SELECT 
                'previous' AS period,
                COUNT(*) AS vote_count
            FROM votes 
            WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND createdAt < DATE_SUB(NOW(), INTERVAL ? DAY)
        `;
        voteTrendParams.push(days * 2, days);

        if (electionId && electionId !== 'all') {
            voteTrendQuery += ' AND electionId = ?';
            voteTrendParams.push(electionId);
        }

        const [voteTrendResult] = await pool.execute(voteTrendQuery, voteTrendParams);

        let voteTrend = 0;
        if (voteTrendResult.length === 2 && voteTrendResult[1].vote_count > 0) {
            voteTrend = ((voteTrendResult[0].vote_count - voteTrendResult[1].vote_count) / voteTrendResult[1].vote_count) * 100;
        }

        res.json({
            users: {
                total: usersResult[0].total_users,
                percent: 0
            },
            votes: {
                total: votesResult[0].total_votes,
                percent: voteTrend
            },
            candidates: {
                total: candidatesResult[0].total_candidates,
                percent: 0
            },
            elections: {
                active: electionsResult[0].active_elections,
                percent: 0
            },
            participationRate: participationResult[0].participation_rate
        });

    } catch (error) {
        console.error('Error in getGeneralStats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
// Évolution des votes
async function getVotesEvolution(req, res) {
    try {
        const { period, electionId } = req.query;
        const days = parseInt(period) || 30;

        let query, params;

        if (electionId && electionId !== 'all') {
            query = `
                SELECT 
                    DATE(v.createdAt) AS vote_date,
                    COUNT(*) AS vote_count
                FROM votes v
                WHERE v.electionId = ?
                    AND v.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
                GROUP BY DATE(v.createdAt)
                ORDER BY vote_date
            `;
            params = [electionId, days];
        } else {
            query = `
                SELECT 
                    DATE(v.createdAt) AS vote_date,
                    COUNT(*) AS vote_count
                FROM votes v
                WHERE v.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
                GROUP BY DATE(v.createdAt)
                ORDER BY vote_date
            `;
            params = [days];
        }

        const [rows] = await pool.execute(query, params);

        // Formater les dates pour les labels
        const labels = rows.map(row => {
            const date = new Date(row.vote_date);
            return date.toLocaleDateString('fr-FR');
        });
        const values = rows.map(row => row.vote_count);

        res.json({ labels, values });
    } catch (error) {
        console.error('Error in getVotesEvolution:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
// Répartition des votes
async function getVotesDistribution(req, res) {
    try {
        const { electionId } = req.query;

        if (!electionId || electionId === 'all') {
            return res.status(400).json({ error: 'Veuillez sélectionner une élection' });
        }

        const query = `
            SELECT 
                c.id AS candidate_id,
                CONCAT(c.prenom, ' ', c.nom) AS candidate_name,
                COUNT(v.id) AS vote_count,
                CASE 
                    WHEN (SELECT COUNT(*) FROM votes WHERE electionId = ?) > 0 
                    THEN ROUND((COUNT(v.id) * 100.0 / (SELECT COUNT(*) FROM votes WHERE electionId = ?)), 2)
                    ELSE 0 
                END AS percentage
            FROM candidates c
            LEFT JOIN votes v ON c.id = v.candidateId
            WHERE c.electionId = ?
                AND c.statut = 'APPROUVE'
            GROUP BY c.id, c.nom, c.prenom
            ORDER BY vote_count DESC
        `;

        const [rows] = await pool.execute(query, [electionId, electionId, electionId]);

        const labels = rows.map(row => row.candidate_name);
        const values = rows.map(row => row.vote_count);
        const percentages = rows.map(row => row.percentage);

        res.json({ labels, values, percentages });
    } catch (error) {
        console.error('Error in getVotesDistribution:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
// Participation par heure
async function getHourlyParticipation(req, res) {
    try {
        const { period, electionId } = req.query;
        const days = parseInt(period) || 30;

        let query, params;

        if (electionId && electionId !== 'all') {
            query = `
                SELECT 
                    HOUR(v.createdAt) AS hour_of_day,
                    COUNT(*) AS vote_count
                FROM votes v
                WHERE v.electionId = ?
                    AND v.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
                GROUP BY HOUR(v.createdAt)
                ORDER BY hour_of_day
            `;
            params = [electionId, days];
        } else {
            query = `
                SELECT 
                    HOUR(v.createdAt) AS hour_of_day,
                    COUNT(*) AS vote_count
                FROM votes v
                WHERE v.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
                GROUP BY HOUR(v.createdAt)
                ORDER BY hour_of_day
            `;
            params = [days];
        }

        const [rows] = await pool.execute(query, params);

        // Créer un tableau pour 24 heures
        const hourlyData = Array(24).fill(0);
        rows.forEach(row => {
            hourlyData[row.hour_of_day] = row.vote_count;
        });

        const labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
        const values = hourlyData;

        res.json({ labels, values });
    } catch (error) {
        console.error('Error in getHourlyParticipation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
// Comparaison des élections
async function getElectionsComparison(req, res) {
    try {
        const { period } = req.query;
        const days = parseInt(period) || 30;

        const query = `
            SELECT 
                e.id AS election_id,
                e.titre AS election_title,
                e.type AS election_type,
                COUNT(v.id) AS vote_count,
                (
                    SELECT COUNT(*) FROM etudiants et
                    JOIN users u ON et.userId = u.id
                    WHERE u.actif = TRUE AND (
                        (e.type = 'SALLE' AND et.filiereId = e.filiereId AND et.annee = e.annee AND et.ecoleId = e.ecoleId)
                        OR (e.type = 'ECOLE' AND et.ecoleId = e.ecoleId)
                        OR (e.type = 'UNIVERSITE')
                    )
                ) AS eligible_voters,
                CASE 
                    WHEN (
                        SELECT COUNT(*) FROM etudiants et
                        JOIN users u ON et.userId = u.id
                        WHERE u.actif = TRUE AND (
                            (e.type = 'SALLE' AND et.filiereId = e.filiereId AND et.annee = e.annee AND et.ecoleId = e.ecoleId)
                            OR (e.type = 'ECOLE' AND et.ecoleId = e.ecoleId)
                            OR (e.type = 'UNIVERSITE')
                        )
                    ) > 0 THEN ROUND(
                        COUNT(v.id) * 100.0 / (
                            SELECT COUNT(*) FROM etudiants et
                            JOIN users u ON et.userId = u.id
                            WHERE u.actif = TRUE AND (
                                (e.type = 'SALLE' AND et.filiereId = e.filiereId AND et.annee = e.annee AND et.ecoleId = e.ecoleId)
                                OR (e.type = 'ECOLE' AND et.ecoleId = e.ecoleId)
                                OR (e.type = 'UNIVERSITE')
                            )
                        ), 2
                    )
                    ELSE 0
                END AS participation_rate
            FROM elections e
            LEFT JOIN votes v ON e.id = v.electionId
            WHERE e.dateFin >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY e.id, e.titre, e.type
            ORDER BY e.dateDebut DESC
        `;

        const [rows] = await pool.execute(query, [days]);
        res.json(rows);
    } catch (error) {
        console.error('Error in getElectionsComparison:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Fonctions helper pour l'export Excel
async function addGeneralStatsSheet(workbook, period, electionId) {
    const worksheet = workbook.addWorksheet('Statistiques Générales');

    // Styles
    const headerStyle = {
        font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B0000' } },
        alignment: { horizontal: 'center' }
    };

    const subHeaderStyle = {
        font: { bold: true, size: 12 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8DC' } }
    };

    const dataStyle = {
        font: { size: 11 },
        alignment: { horizontal: 'left' }
    };

    // Titre
    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').value = 'RAPPORT DE STATISTIQUES UCAO';
    worksheet.getCell('A1').style = headerStyle;
    worksheet.getRow(1).height = 30;

    // Métadonnées
    worksheet.getCell('A3').value = 'Généré le:';
    worksheet.getCell('B3').value = new Date().toLocaleString('fr-FR');
    worksheet.getCell('A4').value = 'Période:';
    worksheet.getCell('B4').value = getPeriodLabel(period);
    worksheet.getCell('A5').value = 'Élection:';
    worksheet.getCell('B5').value = electionId === 'all' ? 'Toutes les élections' : await getElectionTitle(electionId);

    // Statistiques générales
    worksheet.getCell('A7').value = 'STATISTIQUES GÉNÉRALES';
    worksheet.getCell('A7').style = subHeaderStyle;
    worksheet.mergeCells('A7:D7');

    // En-têtes des statistiques
    worksheet.getCell('A9').value = 'Métrique';
    worksheet.getCell('B9').value = 'Valeur';
    worksheet.getCell('C9').value = 'Tendance (%)';
    worksheet.getCell('D9').value = 'Description';

    const headerRow = worksheet.getRow(9);
    headerRow.eachCell(cell => {
        cell.style = subHeaderStyle;
    });

    // Récupération des données
    let usersQuery = 'SELECT COUNT(*) AS total FROM users WHERE actif = TRUE';
    let votesQuery = 'SELECT COUNT(*) AS total FROM votes';
    let candidatesQuery = 'SELECT COUNT(*) AS total FROM candidates WHERE statut = "APPROUVE"';
    let params = [];

    if (electionId && electionId !== 'all') {
        votesQuery += ' WHERE electionId = ?';
        candidatesQuery += ' AND electionId = ?';
        params = [electionId, electionId];
    }

    const [usersResult] = await pool.execute(usersQuery);
    const [votesResult] = await pool.execute(votesQuery, params.length > 0 ? [electionId] : []);
    const [candidatesResult] = await pool.execute(candidatesQuery, params);

    // Calcul du taux de participation
    let participationQuery = `
        SELECT COUNT(DISTINCT v.userId) AS voters,
               (SELECT COUNT(*) FROM etudiants e JOIN users u ON e.userId = u.id WHERE u.actif = TRUE) AS total_students
        FROM votes v
    `;
    if (electionId && electionId !== 'all') {
        participationQuery += ' WHERE v.electionId = ?';
    }

    const [participationResult] = await pool.execute(
        participationQuery,
        electionId && electionId !== 'all' ? [electionId] : []
    );

    const participationRate = participationResult[0].total_students > 0
        ? ((participationResult[0].voters / participationResult[0].total_students) * 100).toFixed(2)
        : 0;

    // Données des statistiques
    const statsData = [
        ['Utilisateurs actifs', usersResult[0].total, '-', 'Nombre total d\'utilisateurs actifs dans le système'],
        ['Votes enregistrés', votesResult[0].total, '-', 'Nombre total de votes exprimés'],
        ['Candidats approuvés', candidatesResult[0].total, '-', 'Nombre de candidats validés'],
        ['Taux de participation', `${participationRate}%`, '-', 'Pourcentage d\'étudiants ayant voté']
    ];

    statsData.forEach((row, index) => {
        const rowNumber = 10 + index;
        worksheet.getCell(`A${rowNumber}`).value = row[0];
        worksheet.getCell(`B${rowNumber}`).value = row[1];
        worksheet.getCell(`C${rowNumber}`).value = row[2];
        worksheet.getCell(`D${rowNumber}`).value = row[3];

        worksheet.getCell(`A${rowNumber}`).style = dataStyle;
        worksheet.getCell(`B${rowNumber}`).style = dataStyle;
        worksheet.getCell(`C${rowNumber}`).style = dataStyle;
        worksheet.getCell(`D${rowNumber}`).style = dataStyle;
    });

    // Ajustement des colonnes
    worksheet.columns = [
        { key: 'metric', width: 25 },
        { key: 'value', width: 15 },
        { key: 'trend', width: 15 },
        { key: 'description', width: 50 }
    ];
}

async function addVotesEvolutionSheet(workbook, period, electionId) {
    const worksheet = workbook.addWorksheet('Évolution des Votes');

    const headerStyle = {
        font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B0000' } },
        alignment: { horizontal: 'center' }
    };

    // Titre
    worksheet.mergeCells('A1:B1');
    worksheet.getCell('A1').value = 'ÉVOLUTION DES VOTES';
    worksheet.getCell('A1').style = headerStyle;

    // En-têtes
    worksheet.getCell('A3').value = 'Date';
    worksheet.getCell('B3').value = 'Nombre de votes';
    worksheet.getRow(3).eachCell(cell => {
        cell.style = headerStyle;
    });

    // Récupération des données
    const days = parseInt(period) || 30;
    let query = `
        SELECT
            DATE(v.createdAt) AS vote_date,
            COUNT(*) AS vote_count
        FROM votes v
        WHERE v.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    let params = [days];

    if (electionId && electionId !== 'all') {
        query += ' AND v.electionId = ?';
        params.push(electionId);
    }

    query += ' GROUP BY DATE(v.createdAt) ORDER BY vote_date';

    const [rows] = await pool.execute(query, params);

    // Ajout des données
    rows.forEach((row, index) => {
        const rowNumber = 4 + index;
        const date = new Date(row.vote_date);
        worksheet.getCell(`A${rowNumber}`).value = date.toLocaleDateString('fr-FR');
        worksheet.getCell(`B${rowNumber}`).value = row.vote_count;
    });

    // Ajustement des colonnes
    worksheet.columns = [
        { key: 'date', width: 15 },
        { key: 'votes', width: 15 }
    ];
}

async function addVotesDistributionSheet(workbook, electionId) {
    const worksheet = workbook.addWorksheet('Répartition des Votes');

    const headerStyle = {
        font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B0000' } },
        alignment: { horizontal: 'center' }
    };

    // Titre
    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').value = 'RÉPARTITION DES VOTES PAR CANDIDAT';
    worksheet.getCell('A1').style = headerStyle;

    // En-têtes
    worksheet.getCell('A3').value = 'Candidat';
    worksheet.getCell('B3').value = 'Nombre de votes';
    worksheet.getCell('C3').value = 'Pourcentage';
    worksheet.getCell('D3').value = 'Position';
    worksheet.getRow(3).eachCell(cell => {
        cell.style = headerStyle;
    });

    // Récupération des données
    const query = `
        SELECT
            c.id AS candidate_id,
            CONCAT(c.prenom, ' ', c.nom) AS candidate_name,
            COUNT(v.id) AS vote_count,
            CASE
                WHEN (SELECT COUNT(*) FROM votes WHERE electionId = ?) > 0
                THEN ROUND((COUNT(v.id) * 100.0 / (SELECT COUNT(*) FROM votes WHERE electionId = ?)), 2)
                ELSE 0
            END AS percentage
        FROM candidates c
        LEFT JOIN votes v ON c.id = v.candidateId
        WHERE c.electionId = ? AND c.statut = 'APPROUVE'
        GROUP BY c.id, c.nom, c.prenom
        ORDER BY vote_count DESC
    `;

    const [rows] = await pool.execute(query, [electionId, electionId, electionId]);

    // Ajout des données
    rows.forEach((row, index) => {
        const rowNumber = 4 + index;
        worksheet.getCell(`A${rowNumber}`).value = row.candidate_name;
        worksheet.getCell(`B${rowNumber}`).value = row.vote_count;
        worksheet.getCell(`C${rowNumber}`).value = `${row.percentage}%`;
        worksheet.getCell(`D${rowNumber}`).value = index + 1;
    });

    // Ajustement des colonnes
    worksheet.columns = [
        { key: 'candidat', width: 30 },
        { key: 'votes', width: 15 },
        { key: 'percentage', width: 15 },
        { key: 'position', width: 10 }
    ];
}

async function addHourlyParticipationSheet(workbook, period, electionId) {
    const worksheet = workbook.addWorksheet('Participation Horaire');

    const headerStyle = {
        font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B0000' } },
        alignment: { horizontal: 'center' }
    };

    // Titre
    worksheet.mergeCells('A1:B1');
    worksheet.getCell('A1').value = 'PARTICIPATION PAR HEURE';
    worksheet.getCell('A1').style = headerStyle;

    // En-têtes
    worksheet.getCell('A3').value = 'Heure';
    worksheet.getCell('B3').value = 'Nombre de votes';
    worksheet.getRow(3).eachCell(cell => {
        cell.style = headerStyle;
    });

    // Récupération des données
    const days = parseInt(period) || 30;
    let query = `
        SELECT
            HOUR(v.createdAt) AS hour_of_day,
            COUNT(*) AS vote_count
        FROM votes v
        WHERE v.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    let params = [days];

    if (electionId && electionId !== 'all') {
        query += ' AND v.electionId = ?';
        params.push(electionId);
    }

    query += ' GROUP BY HOUR(v.createdAt) ORDER BY hour_of_day';

    const [rows] = await pool.execute(query, params);

    // Créer un tableau pour 24 heures
    const hourlyData = Array(24).fill(0);
    rows.forEach(row => {
        hourlyData[row.hour_of_day] = row.vote_count;
    });

    // Ajout des données
    for (let hour = 0; hour < 24; hour++) {
        const rowNumber = 4 + hour;
        worksheet.getCell(`A${rowNumber}`).value = `${hour}h`;
        worksheet.getCell(`B${rowNumber}`).value = hourlyData[hour];
    }

    // Ajustement des colonnes
    worksheet.columns = [
        { key: 'heure', width: 10 },
        { key: 'votes', width: 15 }
    ];
}

async function addElectionsComparisonSheet(workbook, period) {
    const worksheet = workbook.addWorksheet('Comparaison Élections');

    const headerStyle = {
        font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B0000' } },
        alignment: { horizontal: 'center' }
    };

    // Titre
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'COMPARAISON DES ÉLECTIONS';
    worksheet.getCell('A1').style = headerStyle;

    // En-têtes
    worksheet.getCell('A3').value = 'Élection';
    worksheet.getCell('B3').value = 'Type';
    worksheet.getCell('C3').value = 'Votes';
    worksheet.getCell('D3').value = 'Électeurs éligibles';
    worksheet.getCell('E3').value = 'Taux participation';
    worksheet.getCell('F3').value = 'Statut';
    worksheet.getRow(3).eachCell(cell => {
        cell.style = headerStyle;
    });

    // Récupération des données
    const days = parseInt(period) || 30;
    const query = `
        SELECT
            e.id,
            e.titre,
            e.type,
            e.isActive,
            COUNT(v.id) AS vote_count,
            (
                SELECT COUNT(*) FROM etudiants et
                JOIN users u ON et.userId = u.id
                WHERE u.actif = TRUE AND (
                    (e.type = 'SALLE' AND et.filiereId = e.filiereId AND et.annee = e.annee AND et.ecoleId = e.ecoleId)
                    OR (e.type = 'ECOLE' AND et.ecoleId = e.ecoleId)
                    OR (e.type = 'UNIVERSITE')
                )
            ) AS eligible_voters,
            CASE
                WHEN (
                    SELECT COUNT(*) FROM etudiants et
                    JOIN users u ON et.userId = u.id
                    WHERE u.actif = TRUE AND (
                        (e.type = 'SALLE' AND et.filiereId = e.filiereId AND et.annee = e.annee AND et.ecoleId = e.ecoleId)
                        OR (e.type = 'ECOLE' AND et.ecoleId = e.ecoleId)
                        OR (e.type = 'UNIVERSITE')
                    )
                ) > 0 THEN ROUND(
                    COUNT(v.id) * 100.0 / (
                        SELECT COUNT(*) FROM etudiants et
                        JOIN users u ON et.userId = u.id
                        WHERE u.actif = TRUE AND (
                            (e.type = 'SALLE' AND et.filiereId = e.filiereId AND et.annee = e.annee AND et.ecoleId = e.ecoleId)
                            OR (e.type = 'ECOLE' AND et.ecoleId = e.ecoleId)
                            OR (e.type = 'UNIVERSITE')
                        )
                    ), 2
                )
                ELSE 0
            END AS participation_rate
        FROM elections e
        LEFT JOIN votes v ON e.id = v.electionId
        WHERE e.dateFin >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY e.id, e.titre, e.type, e.isActive
        ORDER BY e.dateDebut DESC
    `;

    const [rows] = await pool.execute(query, [days]);

    // Ajout des données
    rows.forEach((row, index) => {
        const rowNumber = 4 + index;
        worksheet.getCell(`A${rowNumber}`).value = row.titre;
        worksheet.getCell(`B${rowNumber}`).value = row.type;
        worksheet.getCell(`C${rowNumber}`).value = row.vote_count;
        worksheet.getCell(`D${rowNumber}`).value = row.eligible_voters;
        worksheet.getCell(`E${rowNumber}`).value = `${row.participation_rate}%`;
        worksheet.getCell(`F${rowNumber}`).value = row.isActive ? 'Active' : 'Terminée';
    });

    // Ajustement des colonnes
    worksheet.columns = [
        { key: 'election', width: 30 },
        { key: 'type', width: 15 },
        { key: 'votes', width: 10 },
        { key: 'eligible', width: 15 },
        { key: 'participation', width: 15 },
        { key: 'status', width: 10 }
    ];
}

function getPeriodLabel(period) {
    const labels = {
        '7': '7 derniers jours',
        '30': '30 derniers jours',
        '90': '3 derniers mois',
        '365': '1 année'
    };
    return labels[period] || period;
}

async function getElectionTitle(electionId) {
    try {
        const [rows] = await pool.execute('SELECT titre FROM elections WHERE id = ?', [electionId]);
        return rows.length > 0 ? rows[0].titre : `Élection ${electionId}`;
    } catch (error) {
        console.error('Error getting election title:', error);
        return `Élection ${electionId}`;
    }
}

// Export des données Excel avec charts
async function exportStats(req, res) {
    try {
        const { format, period, electionId } = req.query;
        const days = parseInt(period) || 30;

        if (format !== 'excel') {
            return res.status(400).json({ error: 'Format non supporté. Utilisez format=excel' });
        }

        const workbook = new ExcelJS.Workbook();

        // Métadonnées - Utiliser le nom de l'admin connecté
        const adminName = req.user?.admin
            ? `${req.user.admin.prenom} ${req.user.admin.nom}`.trim()
            : 'UCAO Admin';

        workbook.creator = adminName;
        workbook.lastModifiedBy = adminName;
        workbook.created = new Date();
        workbook.modified = new Date();

        // Feuille 1: Statistiques Générales
        await addGeneralStatsSheet(workbook, period, electionId);

        // Feuille 2: Évolution des votes
        await addVotesEvolutionSheet(workbook, period, electionId);

        // Feuille 3: Répartition des votes (si élection spécifique)
        if (electionId && electionId !== 'all') {
            await addVotesDistributionSheet(workbook, electionId);
        }

        // Feuille 4: Participation par heure
        await addHourlyParticipationSheet(workbook, period, electionId);

        // Feuille 5: Comparaison des élections
        await addElectionsComparisonSheet(workbook, period);

        // Générer le fichier
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=statistiques-ucao-${new Date().toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error in exportStats:', error);
        res.status(500).json({ error: 'Erreur lors de l\'export Excel' });
    }
}


export default {
    getGeneralStats,
    getVotesEvolution,
    getVotesDistribution,
    getHourlyParticipation,
    getElectionsComparison,
    exportStats
};