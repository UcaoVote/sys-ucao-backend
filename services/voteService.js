import pool from '../dbconfig.js';
import crypto from 'crypto';
import ActivityManager from '../controllers/activityManager.js';

class VoteService {
    async getVoteToken(userId, electionId) {
        let connection;
        try {
            connection = await pool.getConnection();
            const electionIdInt = parseInt(electionId);

            console.log(`🔍 Vérification de l'éligibilité pour userId=${userId}, electionId=${electionIdInt}`);

            // Vérifier si l'élection est active
            const [electionRows] = await connection.execute(
                'SELECT * FROM elections WHERE id = ?',
                [electionIdInt]
            );

            if (electionRows.length === 0) {
                throw new Error("Élection non trouvée");
            }

            const election = electionRows[0];

            if (!election.isActive) {
                throw new Error("Cette élection n'est pas active");
            }

            // Vérifier le profil étudiant
            const [userRows] = await connection.execute(`
                SELECT u.*, e.* 
                FROM users u
                LEFT JOIN etudiants e ON u.id = e.userId
                WHERE u.id = ?
            `, [userId]);

            if (userRows.length === 0) {
                throw new Error('Utilisateur non trouvé');
            }

            const etudiant = userRows[0];

            // Vérifier l'éligibilité
            if (!this.isEligibleForElection(etudiant, election)) {
                throw new Error('Vous n\'êtes pas éligible pour cette élection');
            }

            // Vérifier si l'utilisateur a déjà voté
            const [voteRows] = await connection.execute(
                'SELECT * FROM votes WHERE userId = ? AND electionId = ?',
                [userId, electionIdInt]
            );

            if (voteRows.length > 0) {
                throw new Error('Vous avez déjà voté pour cette élection');
            }

            // Vérifier s'il existe déjà un jeton
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
                console.log(`🆕 Aucun jeton trouvé, insertion d'un nouveau...`);

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

            // Valider le jeton de vote
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

            // Vérifier l'élection
            const [electionRows] = await connection.execute(
                'SELECT * FROM elections WHERE id = ?',
                [parseInt(electionId)]
            );

            if (electionRows.length === 0 || !electionRows[0].isActive) {
                throw new Error("Cette élection n'est pas active");
            }

            // Vérifier si l'utilisateur a déjà voté
            const [voteRows] = await connection.execute(`
                SELECT * FROM votes 
                WHERE userId = ? AND electionId = ?
            `, [userId, parseInt(electionId)]);

            if (voteRows.length > 0) {
                throw new Error('Vous avez déjà voté pour cette élection');
            }

            // Vérifier le candidat
            const [candidateRows] = await connection.execute(
                'SELECT * FROM candidates WHERE id = ? AND electionId = ?',
                [parseInt(candidateId), parseInt(electionId)]
            );

            if (candidateRows.length === 0) {
                throw new Error('Candidat invalide pour cette élection');
            }

            // Calculer le poids du vote
            const election = electionRows[0];
            const poidsVote = await this.calculateVoteWeight(connection, userId, election);

            // Enregistrer le vote
            await connection.execute(`
                INSERT INTO votes (userId, electionId, candidateId, poidsVote, createdAt)
                VALUES (?, ?, ?, ?, NOW())
            `, [userId, parseInt(electionId), parseInt(candidateId), poidsVote]);

            // Marquer le jeton comme utilisé
            await connection.execute(
                'UPDATE vote_tokens SET isUsed = TRUE, usedAt = NOW() WHERE id = ?',
                [validatedToken.id]
            );

            return {
                success: true,
                message: 'Vote enregistré avec succès',
                poidsVote: poidsVote
            };

        } catch (error) {
            console.error('❌ Erreur dans submitVote:', error.message);
            throw error;
        } finally {
            if (connection) await connection.release();
        }
    }

    async calculateVoteWeight(connection, userId, election) {
        try {
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
                    AND rs.ecoleId = ?
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
            return await this.calculateNormalElectionResults(connection, election);

        } catch (error) {
            console.error('❌ Erreur dans getElectionResults:', error.message);
            throw error;
        } finally {
            if (connection) await connection.release();
        }
    }

    async calculateNormalElectionResults(connection, election) {
        const [candidateRows] = await connection.execute(`
            SELECT c.*, u.email, e.nom, e.prenom
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE c.electionId = ?
        `, [election.id]);

        const [voteRows] = await connection.execute(`
            SELECT v.*, u.email, e.nom, e.prenom
            FROM votes v
            LEFT JOIN users u ON v.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            WHERE v.electionId = ?
        `, [election.id]);

        const [tokenCountRows] = await connection.execute(
            'SELECT COUNT(*) as count FROM vote_tokens WHERE electionId = ?',
            [election.id]
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
                photoUrl: candidate.photoUrl,
                filiere: candidate.filiere,
                annee: candidate.annee,
                slogan: candidate.slogan,
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
    }

    async calculateSchoolElectionResults(connection, election) {
        const [candidateRows] = await connection.execute(`
            SELECT c.*, u.email, e.nom, e.prenom, e.filiere, e.annee
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
                AND rs.ecoleId = ?
            WHERE v.electionId = ?
        `, [election.ecoleId, election.id]);

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
                photoUrl: candidate.photoUrl,
                filiere: candidate.filiere,
                annee: candidate.annee,
                slogan: candidate.slogan,
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

            // Pour les autres types d'élection, utiliser le calcul normal détaillé
            return await this.calculateDetailedNormalResults(connection, election);

        } catch (error) {
            console.error('❌ Erreur dans getDetailedResults:', error.message);
            throw error;
        } finally {
            if (connection) await connection.release();
        }
    }

    async calculateDetailedNormalResults(connection, election) {
        const [candidateRows] = await connection.execute(`
            SELECT c.*, u.email, e.nom, e.prenom, e.filiere, e.annee
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
        ]);

        const [tokenCountRows] = await connection.execute(
            'SELECT COUNT(*) as count FROM vote_tokens WHERE electionId = ?',
            [election.id]
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
                photoUrl: candidate.photoUrl,
                filiere: candidate.filiere,
                annee: candidate.annee,
                slogan: candidate.slogan,
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
    }

    async calculateDetailedSchoolResults(connection, election) {
        const [candidateRows] = await connection.execute(`
            SELECT c.*, u.email, e.nom, e.prenom, e.filiere, e.annee
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
                AND rs.ecoleId = ?
            WHERE v.electionId = ?
        `, [election.ecoleId, election.id]);

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
                photoUrl: candidate.photoUrl,
                filiere: candidate.filiere,
                annee: candidate.annee,
                slogan: candidate.slogan,
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
        } catch (error) {
            console.error('❌ Erreur dans getVoteStatus:', error.message);
            throw error;
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
        } catch (error) {
            console.error('❌ Erreur dans validateToken:', error.message);
            throw error;
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

    async publishResults(electionId, userId) {
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

            console.log('État publication:', {
                isActive: election.isActive,
                visibility: election.resultsVisibility,
                published: election.resultsPublished
            });

            // Vérifier si l'élection est terminée
            if (election.isActive) {
                throw new Error('Impossible de publier les résultats d\'une élection active');
            }

            // Vérifier si les résultats sont déjà publiés
            if (election.resultsPublished) {
                throw new Error('Les résultats de cette élection sont déjà publiés');
            }

            // Vérifier que l'élection est en mode manuel
            if (election.resultsVisibility !== 'MANUAL') {
                throw new Error('Cette élection est en mode automatique, la publication manuelle est désactivée');
            }

            await connection.execute(
                'UPDATE elections SET resultsPublished = TRUE, publishedAt = NOW() WHERE id = ?',
                [parseInt(electionId)]
            );

            await ActivityManager.createActivityLog({
                action: 'Résultats publiés manuellement',
                userId: userId,
                details: `Publication manuelle des résultats de l'élection: ${election.titre}`,
                actionType: 'PUBLICATION',
                module: 'ELECTION'
            });

            return {
                success: true,
                message: 'Résultats publiés avec succès',
                election: {
                    id: election.id,
                    titre: election.titre,
                    resultsPublished: true,
                    resultsVisibility: election.resultsVisibility,
                    publishedAt: new Date()
                }
            };

        } catch (error) {
            console.error('❌ Erreur dans publishResults:', error.message);
            throw error;
        } finally {
            if (connection) await connection.release();
        }
    }

    async unpublishResults(electionId, userId) {
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

            if (!election.resultsPublished) {
                throw new Error('Les résultats de cette élection ne sont pas publiés');
            }

            // Vérifier que l'élection est en mode manuel
            if (election.resultsVisibility !== 'MANUAL') {
                throw new Error('Impossible de masquer les résultats d\'une élection en mode automatique');
            }

            await connection.execute(
                'UPDATE elections SET resultsPublished = FALSE, publishedAt = NULL WHERE id = ?',
                [parseInt(electionId)]
            );

            await ActivityManager.createActivityLog({
                action: 'Résultats masqués',
                userId: userId,
                details: `Masquage des résultats de l'élection: ${election.titre}`,
                actionType: 'PUBLICATION',
                module: 'ELECTION'
            });

            return {
                success: true,
                message: 'Résultats masqués avec succès',
                election: {
                    id: election.id,
                    titre: election.titre,
                    resultsPublished: false,
                    resultsVisibility: election.resultsVisibility,
                    publishedAt: null
                }
            };

        } catch (error) {
            console.error('❌ Erreur dans unpublishResults:', error.message);
            throw error;
        } finally {
            if (connection) await connection.release();
        }
    }

    async getCompletedElections() {
        let connection;
        try {
            connection = await pool.getConnection();

            const [elections] = await connection.execute(`
                SELECT 
                    e.*,
                    COUNT(DISTINCT vt.id) as totalInscrits,
                    COUNT(DISTINCT v.id) as totalVotes,
                    CASE 
                        WHEN COUNT(DISTINCT vt.id) > 0 
                        THEN ROUND((COUNT(DISTINCT v.id) * 100.0 / COUNT(DISTINCT vt.id)), 2)
                        ELSE 0 
                    END as tauxParticipation,
                    CASE 
                        WHEN e.resultsVisibility = 'IMMEDIATE' AND e.isActive = FALSE THEN TRUE
                        WHEN e.resultsVisibility = 'MANUAL' AND e.resultsPublished = TRUE THEN TRUE
                        ELSE FALSE
                    END as canDisplayResults
                FROM elections e
                LEFT JOIN vote_tokens vt ON e.id = vt.electionId
                LEFT JOIN votes v ON e.id = v.electionId
                WHERE e.isActive = FALSE
                GROUP BY e.id
                ORDER BY e.dateFin DESC
            `);

            return elections;

        } catch (error) {
            console.error('❌ Erreur dans getCompletedElections:', error.message);
            throw error;
        } finally {
            if (connection) await connection.release();
        }
    }

    async getElectionStats(electionId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [stats] = await connection.execute(`
                SELECT 
                    e.*,
                    COUNT(DISTINCT vt.id) as totalInscrits,
                    COUNT(DISTINCT v.id) as totalVotes,
                    COUNT(DISTINCT c.id) as totalCandidats,
                    CASE 
                        WHEN COUNT(DISTINCT vt.id) > 0 
                        THEN ROUND((COUNT(DISTINCT v.id) * 100.0 / COUNT(DISTINCT vt.id)), 2)
                        ELSE 0 
                    END as tauxParticipation
                FROM elections e
                LEFT JOIN vote_tokens vt ON e.id = vt.electionId
                LEFT JOIN votes v ON e.id = v.electionId
                LEFT JOIN candidates c ON e.id = c.electionId
                WHERE e.id = ?
                GROUP BY e.id
            `, [parseInt(electionId)]);

            if (stats.length === 0) {
                throw new Error('Élection non trouvée');
            }

            return stats[0];

        } catch (error) {
            console.error('❌ Erreur dans getElectionStats:', error.message);
            throw error;
        } finally {
            if (connection) await connection.release();
        }
    }

    async canDisplayResults(electionId) {
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

            // Logique de visibilité des résultats
            if (election.isActive) {
                return false; // Élection toujours active
            }

            if (election.resultsVisibility === 'IMMEDIATE') {
                return true;
            }

            if (election.resultsVisibility === 'MANUAL' && election.resultsPublished) {
                return true;
            }

            return false;

        } catch (error) {
            console.error('❌ Erreur dans canDisplayResults:', error.message);
            throw error;
        } finally {
            if (connection) await connection.release();
        }
    }

    async publishAutomaticElections() {
        let connection;
        try {
            connection = await pool.getConnection();

            // Publier automatiquement les élections terminées en mode automatique
            const [result] = await connection.execute(`
                UPDATE elections 
                SET resultsPublished = TRUE, publishedAt = NOW()
                WHERE isActive = FALSE 
                AND resultsVisibility = 'IMMEDIATE'
                AND resultsPublished = FALSE
                AND dateFin < NOW()
            `);

            if (result.affectedRows > 0) {
                console.log(`📢 ${result.affectedRows} élection(s) publiée(s) automatiquement`);
            }

        } catch (error) {
            console.error('❌ Erreur dans publishAutomaticElections:', error.message);
        } finally {
            if (connection) await connection.release();
        }
    }
}

export default new VoteService();