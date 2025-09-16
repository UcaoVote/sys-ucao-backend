import pool from '../dbconfig.js';

class VoteService {
    async getVoteToken(userId, electionId) {
        let connection;
        try {
            connection = await pool.getConnection();
            const electionIdInt = parseInt(electionId);

            console.log(`🔍 Vérification de l’éligibilité pour userId=${userId}, electionId=${electionIdInt}`);

            // Vérifier si l’élection est active
            const [electionRows] = await connection.execute(
                'SELECT * FROM elections WHERE id = ?',
                [electionIdInt]
            );

            if (electionRows.length === 0 || !electionRows[0].isActive) {
                throw new Error("Cette élection n'est pas active");
            }

            const election = electionRows[0];

            // Vérifier le profil étudiant
            const [userRows] = await connection.execute(`
            SELECT u.*, e.* 
            FROM users u
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE u.id = ?
        `, [userId]);

            if (userRows.length === 0 || !userRows[0].id) {
                throw new Error('Accès refusé - profil étudiant incomplet');
            }

            const etudiant = userRows[0];

            // Vérifier l’éligibilité
            if (!this.isEligibleForElection(etudiant, election)) {
                throw new Error('Vous n\'êtes pas éligible pour cette élection');
            }

            // Vérifier s’il existe déjà un jeton (même expiré ou utilisé)
            const [existingRows] = await connection.execute(`
            SELECT * FROM vote_tokens 
            WHERE userId = ? AND electionId = ?
            ORDER BY createdAt DESC
            LIMIT 1
        `, [userId, electionIdInt]);

            let voteToken;

            if (existingRows.length > 0) {
                const existing = existingRows[0];

                // Si le jeton est encore valide et non utilisé, le réutiliser
                if (!existing.isUsed && new Date(existing.expiresAt) > new Date()) {
                    console.log(`🔁 Jeton valide existant trouvé: ${existing.token}`);
                    voteToken = existing;
                } else {
                    console.log(`⚠️ Jeton existant expiré ou utilisé, mise à jour...`);

                    // Mettre à jour le jeton existant
                    const newToken = crypto.randomUUID();
                    await connection.execute(`
                    UPDATE vote_tokens
                    SET token = ?, isUsed = FALSE, expiresAt = DATE_ADD(NOW(), INTERVAL 1 HOUR), createdAt = NOW()
                    WHERE id = ?
                `, [newToken, existing.id]);

                    const [updatedRows] = await connection.execute(
                        'SELECT * FROM vote_tokens WHERE id = ?',
                        [existing.id]
                    );

                    voteToken = updatedRows[0];
                    console.log(`✅ Jeton régénéré: ${voteToken.token}`);
                }
            } else {
                console.log(`🆕 Aucun jeton trouvé, insertion d’un nouveau...`);

                const [insertResult] = await connection.execute(`
                INSERT INTO vote_tokens (userId, electionId, token, isUsed, expiresAt, createdAt)
                VALUES (?, ?, UUID(), FALSE, DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())
            `, [userId, electionIdInt]);

                const [newTokenRows] = await connection.execute(
                    'SELECT * FROM vote_tokens WHERE id = ?',
                    [insertResult.insertId]
                );

                voteToken = newTokenRows[0];
                console.log(`✅ Nouveau jeton généré: ${voteToken.token}`);
            }

            return {
                token: voteToken.token,
                expiresAt: voteToken.expiresAt,
                election: {
                    id: election.id,
                    titre: election.titre,
                    type: election.type
                }
            };

        } catch (error) {
            console.error('❌ Erreur dans getVoteToken:', error.message);
            throw error;
        } finally {
            if (connection) await connection.release();
        }
    }


    async submitVote(voteData, userId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const { electionId, candidateId, voteToken } = voteData;

            const [tokenRows] = await connection.execute(`
                SELECT * FROM vote_tokens 
                WHERE token = ? AND electionId = ? AND isUsed = FALSE AND expiresAt > NOW()
            `, [voteToken, parseInt(electionId)]);

            if (tokenRows.length === 0) {
                throw new Error('Jeton de vote invalide ou expiré');
            }

            const validatedToken = tokenRows[0];

            if (validatedToken.userId !== userId) {
                throw new Error('Jeton de vote non autorisé');
            }

            const [electionRows] = await connection.execute(
                'SELECT * FROM elections WHERE id = ?',
                [parseInt(electionId)]
            );

            if (electionRows.length === 0 || !electionRows[0].isActive) {
                throw new Error("Cette élection n'est pas active");
            }

            const election = electionRows[0];

            const [voteRows] = await connection.execute(`
                SELECT * FROM votes 
                WHERE userId = ? AND electionId = ?
            `, [userId, parseInt(electionId)]);

            if (voteRows.length > 0) {
                throw new Error('Vous avez déjà voté pour cette élection');
            }

            const [candidateRows] = await connection.execute(
                'SELECT * FROM candidates WHERE id = ? AND electionId = ?',
                [parseInt(candidateId), parseInt(electionId)]
            );

            if (candidateRows.length === 0) {
                throw new Error('Candidat invalide pour cette élection');
            }

            const poidsVote = await this.calculateVoteWeight(connection, userId, election);

            await connection.execute(`
                INSERT INTO votes (userId, electionId, candidateId, poidsVote, createdAt)
                VALUES (?, ?, ?, ?, NOW())
            `, [userId, parseInt(electionId), parseInt(candidateId), poidsVote]);

            await connection.execute(
                'UPDATE vote_tokens SET isUsed = TRUE, usedAt = NOW() WHERE id = ?',
                [validatedToken.id]
            );

            return true;
        } finally {
            if (connection) await connection.release();
        }
    }

    async calculateVoteWeight(connection, userId, election) {
        try {
            // Normalisation des champs potentiellement undefined
            const filiereId = election.filiereId ?? null;
            const annee = election.annee ?? null;
            const ecoleId = election.ecoleId ?? null;

            console.log('📊 Paramètres pour calcul du poids du vote :', {
                userId,
                type: election.type,
                filiereId,
                annee,
                ecoleId
            });

            if (election.type === 'ECOLE') {
                const [responsableRows] = await connection.execute(`
                SELECT rs.* 
                FROM responsables_salle rs
                INNER JOIN etudiants e ON rs.etudiantId = e.id
                WHERE e.userId = ? 
                AND rs.ecole = ?
            `, [userId, ecoleId]);

                return responsableRows.length > 0 ? 1.5 : 1.0;
            } else {
                const [responsableRows] = await connection.execute(`
                SELECT rs.* 
                FROM responsables_salle rs
                INNER JOIN etudiants e ON rs.etudiantId = e.id
                WHERE e.userId = ? 
                AND (? IS NULL OR rs.filiereId = ?)
                AND (? IS NULL OR rs.annee = ?)
                AND (? IS NULL OR rs.ecoleId = ?)
            `, [
                    userId,
                    filiereId, filiereId,
                    annee, annee,
                    ecoleId, ecoleId
                ]);

                return responsableRows.length > 0 ? 1.6 : 1.0;
            }

        } catch (error) {
            console.error('❌ Erreur calcul poids vote:', error.message);
            return 1.0;
        }
    }


    async getElectionResults(electionId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [electionRows] = await connection.execute(
                'SELECT * FROM elections WHERE id = ?',
                [parseInt(electionId)]
            );

            if (electionRows.length === 0) {
                throw new Error('Élection non trouvée');
            }

            const election = electionRows[0];

            // Pour les élections d'école, utiliser le calcul spécial 60/40
            if (election.type === 'ECOLE') {
                return await this.calculateSchoolElectionResults(connection, election);
            }

            // Pour les autres types d'élection, utiliser le calcul normal
            const [candidateRows] = await connection.execute(`
                SELECT c.*, u.email, e.nom, e.prenom
                FROM candidates c
                LEFT JOIN users u ON c.userId = u.id
                LEFT JOIN etudiants e ON u.id = e.userId
                WHERE c.electionId = ?
            `, [parseInt(electionId)]);

            const [voteRows] = await connection.execute(`
                SELECT v.*, u.email, e.nom, e.prenom
                FROM votes v
                LEFT JOIN users u ON v.userId = u.id
                LEFT JOIN etudiants e ON u.id = e.userId
                WHERE v.electionId = ?
            `, [parseInt(electionId)]);

            const [tokenCountRows] = await connection.execute(
                'SELECT COUNT(*) as count FROM vote_tokens WHERE electionId = ?',
                [parseInt(electionId)]
            );

            const totalInscrits = tokenCountRows[0].count;

            const resultats = candidateRows.map(candidate => {
                const votes = voteRows.filter(vote => vote.candidateId === candidate.id);
                const scorePondere = votes.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0);
                const totalPoids = voteRows.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0);
                const pourcentage = totalPoids > 0 ? (scorePondere / totalPoids) * 100 : 0;

                return {
                    candidateId: candidate.id,
                    nom: candidate.nom,
                    prenom: candidate.prenom,
                    scoreFinal: parseFloat(pourcentage.toFixed(2)),
                    details: {
                        totalVotes: votes.length,
                        scorePondere: parseFloat(scorePondere.toFixed(2)),
                        poidsMoyen: votes.length > 0 ? parseFloat((scorePondere / votes.length).toFixed(2)) : 0
                    }
                };
            });

            resultats.sort((a, b) => b.scoreFinal - a.scoreFinal);

            return {
                election: election,
                statistiques: {
                    totalVotes: voteRows.length,
                    totalPoids: voteRows.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0),
                    totalInscrits: totalInscrits,
                    tauxParticipation: totalInscrits > 0
                        ? parseFloat(((voteRows.length / totalInscrits) * 100).toFixed(2))
                        : 0
                },
                resultats: resultats
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    async calculateSchoolElectionResults(connection, election) {
        const [candidateRows] = await connection.execute(`
            SELECT c.*, u.email, e.nom, e.prenom
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE c.electionId = ?
        `, [election.id]);

        const [voteRows] = await connection.execute(`
            SELECT 
                v.*, 
                u.email,
                e.nom,
                e.prenom,
                CASE WHEN rs.id IS NOT NULL THEN TRUE ELSE FALSE END as is_responsable
            FROM votes v
            LEFT JOIN users u ON v.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            LEFT JOIN responsables_salle rs ON e.id = rs.etudiantId
                AND (? IS NULL OR rs.filiereId = ?)
                AND (? IS NULL OR rs.annee = ?)
                AND (? IS NULL OR rs.ecoleId = ?)

            WHERE v.electionId = ?
        `, [
            election.filiereId, election.filiereId,
            election.annee, election.annee,
            election.ecoleId, election.ecoleId,
            election.id
        ]
        );

        const [tokenCountRows] = await connection.execute(
            'SELECT COUNT(*) as count FROM vote_tokens WHERE electionId = ?',
            [election.id]
        );

        const totalInscrits = tokenCountRows[0].count;

        // Séparation des votes
        const votesResponsables = voteRows.filter(vote => vote.is_responsable);
        const votesEtudiants = voteRows.filter(vote => !vote.is_responsable);

        // Calcul du total pondéré de l'élection
        const totalVotesResponsables = votesResponsables.length;
        const totalVotesEtudiants = votesEtudiants.length;
        const totalPondere = (totalVotesResponsables * 0.6) + (totalVotesEtudiants * 0.4);

        // Calcul des résultats avec pondération 60/40
        const resultats = candidateRows.map(candidate => {
            const votesRespo = votesResponsables.filter(vote => vote.candidateId === candidate.id);
            const votesEtud = votesEtudiants.filter(vote => vote.candidateId === candidate.id);

            const nombreVotesRespo = votesRespo.length;
            const nombreVotesEtud = votesEtud.length;

            // Appliquer la pondération 60/40
            const scorePondere = (nombreVotesRespo * 0.6) + (nombreVotesEtud * 0.4);
            const pourcentage = totalPondere > 0 ? (scorePondere / totalPondere) * 100 : 0;

            return {
                candidateId: candidate.id,
                nom: candidate.nom,
                prenom: candidate.prenom,
                scoreFinal: parseFloat(pourcentage.toFixed(2)),
                details: {
                    totalVotes: nombreVotesRespo + nombreVotesEtud,
                    votesResponsables: nombreVotesRespo,
                    votesEtudiants: nombreVotesEtud,
                    scorePondere: parseFloat(scorePondere.toFixed(2)),
                    poidsMoyen: (nombreVotesRespo + nombreVotesEtud) > 0
                        ? parseFloat((scorePondere / (nombreVotesRespo + nombreVotesEtud)).toFixed(2))
                        : 0
                }
            };
        });

        resultats.sort((a, b) => b.scoreFinal - a.scoreFinal);

        return {
            election: election,
            statistiques: {
                totalVotes: voteRows.length,
                votesResponsables: totalVotesResponsables,
                votesEtudiants: totalVotesEtudiants,
                totalPondere: totalPondere,
                totalInscrits: totalInscrits,
                tauxParticipation: totalInscrits > 0
                    ? parseFloat(((voteRows.length / totalInscrits) * 100).toFixed(2))
                    : 0
            },
            resultats: resultats
        };
    }

    async getDetailedResults(electionId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [electionRows] = await connection.execute(
                'SELECT * FROM elections WHERE id = ?',
                [parseInt(electionId)]
            );

            if (electionRows.length === 0) {
                throw new Error('Élection non trouvée');
            }

            const election = electionRows[0];

            // Pour les élections d'école, utiliser le calcul spécial 60/40
            if (election.type === 'ECOLE') {
                return await this.calculateDetailedSchoolResults(connection, election);
            }

            // Pour les autres types d'élection, utiliser le calcul normal
            const [candidateRows] = await connection.execute(`
                SELECT c.*, u.email, e.nom, e.prenom
                FROM candidates c
                LEFT JOIN users u ON c.userId = u.id
                LEFT JOIN etudiants e ON u.id = e.userId
                WHERE c.electionId = ?
            `, [parseInt(electionId)]);

            const [voteRows] = await connection.execute(`
                SELECT 
                    v.*, 
                    u.email,
                    e.nom,
                    e.prenom,
                    CASE WHEN rs.id IS NOT NULL THEN TRUE ELSE FALSE END as is_responsable
                FROM votes v
                LEFT JOIN users u ON v.userId = u.id
                LEFT JOIN etudiants e ON u.id = e.userId
                LEFT JOIN responsables_salle rs ON e.id = rs.etudiantId
                    AND (? IS NULL OR rs.filiere = ?)
AND (? IS NULL OR rs.annee = ?)
AND (? IS NULL OR rs.ecole = ?)

                WHERE v.electionId = ?
            `, [
                election.filiereId, election.filiereId,
                election.annee, election.annee,
                election.ecoleId, election.ecoleId,
                parseInt(electionId)
            ]
            );

            const [tokenCountRows] = await connection.execute(
                'SELECT COUNT(*) as count FROM vote_tokens WHERE electionId = ?',
                [parseInt(electionId)]
            );

            const totalInscrits = tokenCountRows[0].count;

            const votesResponsables = voteRows.filter(vote => vote.is_responsable);
            const votesEtudiants = voteRows.filter(vote => !vote.is_responsable);

            const resultats = candidateRows.map(candidate => {
                const votesRespo = votesResponsables.filter(vote => vote.candidateId === candidate.id);
                const votesEtud = votesEtudiants.filter(vote => vote.candidateId === candidate.id);

                const scoreRespo = votesRespo.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0);
                const scoreEtud = votesEtud.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0);

                const totalVotes = votesRespo.length + votesEtud.length;
                const scorePondere = scoreRespo + scoreEtud;
                const totalPoids = voteRows.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0);
                const pourcentage = totalPoids > 0 ? (scorePondere / totalPoids) * 100 : 0;

                return {
                    candidateId: candidate.id,
                    nom: candidate.nom,
                    prenom: candidate.prenom,
                    scoreFinal: parseFloat(pourcentage.toFixed(2)),
                    details: {
                        votesResponsables: votesRespo.length,
                        votesEtudiants: votesEtud.length,
                        totalVotes: totalVotes,
                        scorePondere: parseFloat(scorePondere.toFixed(2)),
                        poidsMoyen: totalVotes > 0 ? parseFloat((scorePondere / totalVotes).toFixed(2)) : 0
                    }
                };
            });

            resultats.sort((a, b) => b.scoreFinal - a.scoreFinal);

            return {
                election: election,
                statistiques: {
                    totalVotes: voteRows.length,
                    votesResponsables: votesResponsables.length,
                    votesEtudiants: votesEtudiants.length,
                    totalPoids: voteRows.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0),
                    totalInscrits: totalInscrits,
                    tauxParticipation: totalInscrits > 0
                        ? parseFloat(((voteRows.length / totalInscrits) * 100).toFixed(2))
                        : 0
                },
                resultats: resultats
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    async calculateDetailedSchoolResults(connection, election) {
        const [candidateRows] = await connection.execute(`
            SELECT c.*, u.email, e.nom, e.prenom
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE c.electionId = ?
        `, [election.id]);

        const [voteRows] = await connection.execute(`
            SELECT 
                v.*, 
                u.email,
                e.nom,
                e.prenom,
                CASE WHEN rs.id IS NOT NULL THEN TRUE ELSE FALSE END as is_responsable
            FROM votes v
            LEFT JOIN users u ON v.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            LEFT JOIN responsables_salle rs ON e.id = rs.etudiantId
                AND (? IS NULL OR rs.filiere = ?)
AND (? IS NULL OR rs.annee = ?)
AND (? IS NULL OR rs.ecole = ?)

            WHERE v.electionId = ?
        `, [
            election.filiereId, election.filiereId,
            election.annee, election.annee,
            election.ecoleId, election.ecoleId,
            election.id
        ]
        );

        const [tokenCountRows] = await connection.execute(
            'SELECT COUNT(*) as count FROM vote_tokens WHERE electionId = ?',
            [election.id]
        );

        const totalInscrits = tokenCountRows[0].count;

        const votesResponsables = voteRows.filter(vote => vote.is_responsable);
        const votesEtudiants = voteRows.filter(vote => !vote.is_responsable);

        // Calcul du total pondéré de l'élection
        const totalVotesResponsables = votesResponsables.length;
        const totalVotesEtudiants = votesEtudiants.length;
        const totalPondere = (totalVotesResponsables * 0.6) + (totalVotesEtudiants * 0.4);

        // Calcul des résultats avec pondération 60/40
        const resultats = candidateRows.map(candidate => {
            const votesRespo = votesResponsables.filter(vote => vote.candidateId === candidate.id);
            const votesEtud = votesEtudiants.filter(vote => vote.candidateId === candidate.id);

            const nombreVotesRespo = votesRespo.length;
            const nombreVotesEtud = votesEtud.length;

            // Appliquer la pondération 60/40
            const scorePondere = (nombreVotesRespo * 0.6) + (nombreVotesEtud * 0.4);
            const pourcentage = totalPondere > 0 ? (scorePondere / totalPondere) * 100 : 0;

            return {
                candidateId: candidate.id,
                nom: candidate.nom,
                prenom: candidate.prenom,
                scoreFinal: parseFloat(pourcentage.toFixed(2)),
                details: {
                    votesResponsables: nombreVotesRespo,
                    votesEtudiants: nombreVotesEtud,
                    totalVotes: nombreVotesRespo + nombreVotesEtud,
                    scorePondere: parseFloat(scorePondere.toFixed(2)),
                    poidsMoyen: (nombreVotesRespo + nombreVotesEtud) > 0
                        ? parseFloat((scorePondere / (nombreVotesRespo + nombreVotesEtud)).toFixed(2))
                        : 0
                }
            };
        });

        resultats.sort((a, b) => b.scoreFinal - a.scoreFinal);

        return {
            election: election,
            statistiques: {
                totalVotes: voteRows.length,
                votesResponsables: totalVotesResponsables,
                votesEtudiants: totalVotesEtudiants,
                totalPondere: totalPondere,
                totalInscrits: totalInscrits,
                tauxParticipation: totalInscrits > 0
                    ? parseFloat(((voteRows.length / totalInscrits) * 100).toFixed(2))
                    : 0
            },
            resultats: resultats
        };
    }

    async getVoteStatus(userId, electionId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [voteRows] = await connection.execute(`
                SELECT * FROM votes 
                WHERE userId = ? AND electionId = ?
            `, [userId, parseInt(electionId)]);

            return {
                hasVoted: voteRows.length > 0,
                electionId: parseInt(electionId)
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    async validateToken(voteToken, electionId, userId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [tokenRows] = await connection.execute(`
                SELECT * FROM vote_tokens 
                WHERE token = ? AND electionId = ? AND isUsed = FALSE AND expiresAt > NOW()
            `, [voteToken, parseInt(electionId)]);

            if (tokenRows.length === 0) {
                throw new Error('Jeton de vote invalide ou expiré');
            }

            if (tokenRows[0].userId !== userId) {
                throw new Error('Jeton de vote non autorisé');
            }

            return {
                valid: true,
                expiresAt: tokenRows[0].expiresAt
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    isEligibleForElection(etudiant, election) {
        if (!etudiant || !election) return false;

        const etudiantFiliere = String(etudiant.filiereId || '');
        const etudiantAnnee = String(etudiant.annee || '');
        const etudiantEcole = String(etudiant.ecoleId || '');

        const electionFiliere = String(election.filiereId || '');
        const electionAnnee = String(election.annee || '');
        const electionEcole = String(election.ecoleId || '');

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

}

export default new VoteService();