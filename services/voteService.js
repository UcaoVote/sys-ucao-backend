import pool from '../database/dbconfig.js';
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

            // Vérifier l'éligibilité de base
            if (!this.isEligibleForElection(etudiant, election)) {
                throw new Error('Vous n\'êtes pas éligible pour cette élection');
            }

            // Vérification spéciale pour UNIVERSITE Tour 2
            // Seuls les candidats du Tour 1 peuvent voter
            if (election.type === 'UNIVERSITE' && election.tour === 2) {
                const isCandidate = await this.isCandidateFromTour1(connection, userId, election);
                if (!isCandidate) {
                    throw new Error('Seuls les candidats du Tour 1 peuvent voter au Tour 2');
                }
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

    /**
     * Calculer le poids d'un vote en fonction du type d'élection et du statut de l'utilisateur
     * NOUVELLE LOGIQUE:
     * - SALLE: 1.0 pour tous (pas de pondération)
     * - ECOLE: 1.0 pour tous (calcul groupé 80/20 dans calculateSchoolElectionResults)
     * - UNIVERSITE: 1.0 pour tous (calcul groupé 80/20 dans calculateUniversityElectionResults)
     * 
     * Note: Le poids individuel est toujours 1.0, la pondération se fait au niveau des groupes
     * lors du calcul des résultats.
     */
    async calculateVoteWeight(connection, userId, election) {
        try {
            // Tous les votes individuels ont maintenant un poids de 1.0
            // La pondération se fait au niveau des groupes (responsables/étudiants ou délégués/autres)
            // lors du calcul des résultats
            return 1.0;

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

            // Pour les élections d'école, utiliser le calcul spécial 80/20
            if (election.type === 'ECOLE') {
                return await this.calculateSchoolElectionResults(connection, election);
            }

            // Pour les élections d'université, utiliser le calcul 80/20 délégués/autres
            if (election.type === 'UNIVERSITE') {
                return await this.calculateUniversityElectionResults(connection, election);
            }

            // Pour les élections de salle, utiliser le calcul normal (1.0 pour tous)
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

        // Compter le nombre d'électeurs uniques (pas le nombre total de votes)
        const uniqueVoters = new Set(voteRows.map(vote => vote.userId)).size;

        return {
            election: election,
            statistiques: {
                totalVotes: voteRows.length,
                totalPoids: voteRows.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0),
                totalInscrits: totalInscrits,
                electeursAyantVote: uniqueVoters,
                tauxParticipation: totalInscrits > 0
                    ? parseFloat(((uniqueVoters / totalInscrits) * 100).toFixed(2))
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

        // Compter le total dans chaque groupe
        const totalVotesResponsables = votesResponsables.length;
        const totalVotesEtudiants = votesEtudiants.length;

        // Calcul des résultats avec pondération 80/20 sur les POURCENTAGES
        // Le groupe responsables pèse 80% du résultat final
        // Le groupe étudiants pèse 20% du résultat final
        const resultats = candidateRows.map(candidate => {
            const votesRespo = votesResponsables.filter(vote => vote.candidateId === candidate.id);
            const votesEtud = votesEtudiants.filter(vote => vote.candidateId === candidate.id);

            const nombreVotesRespo = votesRespo.length;
            const nombreVotesEtud = votesEtud.length;

            // Calculer le % dans chaque groupe
            const pctResponsables = totalVotesResponsables > 0 ? (nombreVotesRespo / totalVotesResponsables) * 100 : 0;
            const pctEtudiants = totalVotesEtudiants > 0 ? (nombreVotesEtud / totalVotesEtudiants) * 100 : 0;

            // Appliquer la pondération 80/20 sur les pourcentages
            const pourcentage = (pctResponsables * 0.8) + (pctEtudiants * 0.2); return {
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
                    pctResponsables: parseFloat(pctResponsables.toFixed(2)),
                    pctEtudiants: parseFloat(pctEtudiants.toFixed(2))
                }
            };
        });

        resultats.sort((a, b) => b.scoreFinal - a.scoreFinal);

        // Compter le nombre d'électeurs uniques (pas le nombre total de votes)
        const uniqueVoters = new Set(voteRows.map(vote => vote.userId)).size;

        return {
            election: election,
            statistiques: {
                totalVotes: voteRows.length,
                votesResponsables: totalVotesResponsables,
                votesEtudiants: totalVotesEtudiants,
                totalInscrits: totalInscrits,
                electeursAyantVote: uniqueVoters,
                tauxParticipation: totalInscrits > 0
                    ? parseFloat(((uniqueVoters / totalInscrits) * 100).toFixed(2))
                    : 0,
                ponderation: '80% du groupe responsables + 20% du groupe étudiants'
            },
            resultats: resultats
        };
    }

    /**
     * Calcul des résultats pour les élections UNIVERSITE
     * - Tour 1: Pondération 80/20 (délégués d'école / autres)
     * - Tour 2: Transfert de votes des candidats vers leur choix
     */
    async calculateUniversityElectionResults(connection, election) {
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
                CASE WHEN de.id IS NOT NULL THEN TRUE ELSE FALSE END as is_delegue
            FROM votes v
            LEFT JOIN users u ON v.userId = u.id
            LEFT JOIN etudiants e ON u.id = e.userId
            LEFT JOIN responsables_salle rs ON e.id = rs.etudiantId
            LEFT JOIN delegues_ecole de ON rs.id = de.responsableId
            WHERE v.electionId = ?
        `, [election.id]);

        const [tokenCountRows] = await connection.execute(
            'SELECT COUNT(*) as count FROM vote_tokens WHERE electionId = ?',
            [election.id]
        );

        const totalInscrits = tokenCountRows[0].count;

        // Vérifier le tour de l'élection
        const tour = election.tour || 1;

        if (tour === 1) {
            // TOUR 1: Pondération 80/20 (délégués / autres)
            const votesDelegues = voteRows.filter(vote => vote.is_delegue);
            const votesAutres = voteRows.filter(vote => !vote.is_delegue);

            const totalVotesDelegues = votesDelegues.length;
            const totalVotesAutres = votesAutres.length;

            // Calcul avec pondération 80/20 sur les POURCENTAGES
            // Le groupe délégués pèse 80% du résultat final
            // Le groupe autres pèse 20% du résultat final
            const resultats = candidateRows.map(candidate => {
                const votesDel = votesDelegues.filter(vote => vote.candidateId === candidate.id);
                const votesAut = votesAutres.filter(vote => vote.candidateId === candidate.id);

                const nombreVotesDel = votesDel.length;
                const nombreVotesAut = votesAut.length;

                // Calculer le % dans chaque groupe
                const pctDelegues = totalVotesDelegues > 0 ? (nombreVotesDel / totalVotesDelegues) * 100 : 0;
                const pctAutres = totalVotesAutres > 0 ? (nombreVotesAut / totalVotesAutres) * 100 : 0;

                // Appliquer la pondération 80/20 sur les pourcentages
                const pourcentage = (pctDelegues * 0.8) + (pctAutres * 0.2);

                return {
                    candidateId: candidate.id,
                    nom: candidate.nom,
                    prenom: candidate.prenom,
                    photoUrl: candidate.photoUrl,
                    slogan: candidate.slogan,
                    scoreFinal: parseFloat(pourcentage.toFixed(2)),
                    details: {
                        totalVotes: nombreVotesDel + nombreVotesAut,
                        votesDelegues: nombreVotesDel,
                        votesAutres: nombreVotesAut,
                        pctDelegues: parseFloat(pctDelegues.toFixed(2)),
                        pctAutres: parseFloat(pctAutres.toFixed(2))
                    }
                };
            });

            resultats.sort((a, b) => b.scoreFinal - a.scoreFinal);

            const uniqueVoters = new Set(voteRows.map(vote => vote.userId)).size;

            return {
                election: election,
                tour: 1,
                statistiques: {
                    totalVotes: voteRows.length,
                    votesDelegues: totalVotesDelegues,
                    votesAutres: totalVotesAutres,
                    totalInscrits: totalInscrits,
                    electeursAyantVote: uniqueVoters,
                    tauxParticipation: totalInscrits > 0
                        ? parseFloat(((uniqueVoters / totalInscrits) * 100).toFixed(2))
                        : 0,
                    ponderation: '80% du groupe délégués + 20% du groupe autres'
                },
                resultats: resultats
            };

        } else {
            // TOUR 2: Transfert de votes
            // Les candidats classés votent et transfèrent tous leurs votes
            // Note: La logique du tour 2 nécessite des données supplémentaires
            // sur les votes des candidats et leur transfert

            // Pour l'instant, on retourne un résultat basique
            // Cette partie devra être implémentée avec la logique de transfert

            const resultats = candidateRows.map(candidate => {
                const votes = voteRows.filter(vote => vote.candidateId === candidate.id);
                const scorePondere = votes.length;
                const totalVotes = voteRows.length;
                const pourcentage = totalVotes > 0 ? (scorePondere / totalVotes) * 100 : 0;

                return {
                    candidateId: candidate.id,
                    nom: candidate.nom,
                    prenom: candidate.prenom,
                    photoUrl: candidate.photoUrl,
                    slogan: candidate.slogan,
                    scoreFinal: parseFloat(pourcentage.toFixed(2)),
                    details: {
                        totalVotes: votes.length,
                        votesTransferes: 0 // À implémenter avec vote_transfers
                    }
                };
            });

            resultats.sort((a, b) => b.scoreFinal - a.scoreFinal);

            const uniqueVoters = new Set(voteRows.map(vote => vote.userId)).size;

            return {
                election: election,
                tour: 2,
                note: 'Logique de transfert de votes à implémenter',
                statistiques: {
                    totalVotes: voteRows.length,
                    totalInscrits: totalInscrits,
                    electeursAyantVote: uniqueVoters,
                    tauxParticipation: totalInscrits > 0
                        ? parseFloat(((uniqueVoters / totalInscrits) * 100).toFixed(2))
                        : 0
                },
                resultats: resultats
            };
        }
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

            // Pour les élections d'école, utiliser le calcul spécial 80/20
            if (election.type === 'ECOLE') {
                return await this.calculateDetailedSchoolResults(connection, election);
            }

            // Pour les élections d'université, utiliser le calcul 80/20 délégués/autres
            if (election.type === 'UNIVERSITE') {
                return await this.calculateUniversityElectionResults(connection, election);
            }

            // Pour les élections de salle, utiliser le calcul normal détaillé
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
    SELECT c.*, u.email, e.nom, e.prenom, e.filiereId, e.annee
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
                filiere: candidate.filiereId,
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

        // Compter le nombre d'électeurs uniques (pas le nombre total de votes)
        const uniqueVoters = new Set(voteRows.map(vote => vote.userId)).size;

        return {
            election: election,
            statistiques: {
                totalVotes: voteRows.length,
                votesResponsables: votesResponsables.length,
                votesEtudiants: votesEtudiants.length,
                totalPoids: voteRows.reduce((sum, vote) => sum + (vote.poidsVote || 1.0), 0),
                totalInscrits: totalInscrits,
                electeursAyantVote: uniqueVoters,
                tauxParticipation: totalInscrits > 0
                    ? parseFloat(((uniqueVoters / totalInscrits) * 100).toFixed(2))
                    : 0
            },
            resultats: resultats
        };
    }

    async calculateDetailedSchoolResults(connection, election) {
        const [candidateRows] = await connection.execute(`
            SELECT c.*, u.email, e.nom, e.prenom, e.filiereId, e.annee
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

        // Compter le total dans chaque groupe
        const totalVotesResponsables = votesResponsables.length;
        const totalVotesEtudiants = votesEtudiants.length;

        // Calcul des résultats avec pondération 80/20 sur les POURCENTAGES
        // Le groupe responsables pèse 80% du résultat final
        // Le groupe étudiants pèse 20% du résultat final
        const resultats = candidateRows.map(candidate => {
            const votesRespo = votesResponsables.filter(vote => vote.candidateId === candidate.id);
            const votesEtud = votesEtudiants.filter(vote => vote.candidateId === candidate.id);

            const nombreVotesRespo = votesRespo.length;
            const nombreVotesEtud = votesEtud.length;

            // Calculer le % dans chaque groupe
            const pctResponsables = totalVotesResponsables > 0 ? (nombreVotesRespo / totalVotesResponsables) * 100 : 0;
            const pctEtudiants = totalVotesEtudiants > 0 ? (nombreVotesEtud / totalVotesEtudiants) * 100 : 0;

            // Appliquer la pondération 80/20 sur les pourcentages
            const pourcentage = (pctResponsables * 0.8) + (pctEtudiants * 0.2);

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
                    pctResponsables: parseFloat(pctResponsables.toFixed(2)),
                    pctEtudiants: parseFloat(pctEtudiants.toFixed(2))
                }
            };
        });

        resultats.sort((a, b) => b.scoreFinal - a.scoreFinal);

        // Compter le nombre d'électeurs uniques (pas le nombre total de votes)
        const uniqueVoters = new Set(voteRows.map(vote => vote.userId)).size;

        return {
            election: election,
            statistiques: {
                totalVotes: voteRows.length,
                votesResponsables: totalVotesResponsables,
                votesEtudiants: totalVotesEtudiants,
                totalInscrits: totalInscrits,
                electeursAyantVote: uniqueVoters,
                tauxParticipation: totalInscrits > 0
                    ? parseFloat(((uniqueVoters / totalInscrits) * 100).toFixed(2))
                    : 0,
                ponderation: '80% du groupe responsables + 20% du groupe étudiants'
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

    /**
     * Vérifier si un étudiant est éligible pour voter dans une élection
     * Note: Pour UNIVERSITE Tour 2, retourne true ici mais la vérification
     * complète se fait dans generateVoteToken() via isCandidateFromTour1()
     */
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
            // Tour 1: Tous les étudiants peuvent voter
            // Tour 2: Vérification asynchrone dans generateVoteToken()
            return true;
        }
        return false;
    }

    /**
     * Vérifier si un utilisateur était candidat dans l'élection Tour 1 (parent)
     * Utilisé pour déterminer qui peut voter au Tour 2
     * 
     * @param {Object} connection - Connexion à la base de données
     * @param {String} userId - ID de l'utilisateur
     * @param {Object} election - Objet élection (Tour 2)
     * @returns {Promise<Boolean>} True si l'utilisateur était candidat au Tour 1
     */
    async isCandidateFromTour1(connection, userId, election) {
        try {
            // Vérifier que c'est bien un Tour 2 avec un parent
            if (election.tour !== 2 || !election.parentElectionId) {
                return false;
            }

            // Chercher si l'utilisateur était candidat dans l'élection parent (Tour 1)
            const [candidateRows] = await connection.execute(`
                SELECT c.id, c.statut 
                FROM candidates c
                WHERE c.userId = ? 
                AND c.electionId = ?
                AND c.statut = 'APPROUVE'
            `, [userId, election.parentElectionId]);

            return candidateRows.length > 0;

        } catch (error) {
            console.error('❌ Erreur dans isCandidateFromTour1:', error.message);
            return false;
        }
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

            // Calculer les résultats complets
            const results = await this.getElectionResults(parseInt(electionId));

            // Sauvegarder les résultats dans la table election_results
            await connection.execute(
                'DELETE FROM election_results WHERE electionId = ?',
                [parseInt(electionId)]
            );

            for (const candidat of results.resultats) {
                const isWinner = candidat === results.resultats[0]; // Le premier est le gagnant

                await connection.execute(`
                    INSERT INTO election_results 
                    (electionId, candidateId, roundNumber, votes, pourcentage, isWinner, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
                `, [
                    parseInt(electionId),
                    candidat.candidateId,
                    election.tour || 1,
                    candidat.details.totalVotes,
                    candidat.scoreFinal,
                    isWinner ? 1 : 0
                ]);
            }

            // Si c'est une élection de SALLE, enregistrer le gagnant dans responsables_salle
            if (election.type === 'SALLE' && results.resultats.length > 0) {
                const gagnant = results.resultats[0];

                // Récupérer l'etudiantId depuis le candidat
                const [candidateInfo] = await connection.execute(`
                    SELECT c.userId, e.id as etudiantId, e.annee, e.ecoleId, e.filiereId
                    FROM candidates c
                    JOIN users u ON c.userId = u.id
                    JOIN etudiants e ON u.id = e.userId
                    WHERE c.id = ?
                `, [gagnant.candidateId]);

                if (candidateInfo.length > 0) {
                    const etudiant = candidateInfo[0];

                    // Vérifier si le responsable n'existe pas déjà
                    const [existing] = await connection.execute(
                        'SELECT id FROM responsables_salle WHERE etudiantId = ? AND annee = ?',
                        [etudiant.etudiantId, etudiant.annee]
                    );

                    if (existing.length === 0) {
                        await connection.execute(`
                            INSERT INTO responsables_salle 
                            (etudiantId, annee, ecoleId, filiereId, createdAt)
                            VALUES (?, ?, ?, ?, NOW())
                        `, [
                            etudiant.etudiantId,
                            etudiant.annee,
                            etudiant.ecoleId,
                            etudiant.filiereId
                        ]);
                        console.log(`✅ Responsable de salle enregistré: etudiantId=${etudiant.etudiantId}, annee=${etudiant.annee}`);
                    }
                }
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
                    COUNT(DISTINCT v.userId) as electeursAyantVote,
                    COUNT(DISTINCT v.id) as totalVotes,
                    CASE 
                        WHEN COUNT(DISTINCT vt.id) > 0 
                        THEN ROUND((COUNT(DISTINCT v.userId) * 100.0 / COUNT(DISTINCT vt.id)), 2)
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

            if (!elections || elections.length === 0) {
                console.warn('Aucune élection terminée trouvée');
                return []; // réponse vide mais valide
            }

            console.log(`✅ ${elections.length} élection(s) terminée(s) chargée(s) avec taux de participation corrigé`);

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
                    COUNT(DISTINCT v.userId) as electeursAyantVote,
                    COUNT(DISTINCT v.id) as totalVotes,
                    COUNT(DISTINCT c.id) as totalCandidats,
                    CASE 
                        WHEN COUNT(DISTINCT vt.id) > 0 
                        THEN ROUND((COUNT(DISTINCT v.userId) * 100.0 / COUNT(DISTINCT vt.id)), 2)
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

            console.log(`📊 Stats élection ${electionId}:`, {
                totalInscrits: stats[0].totalInscrits,
                electeursAyantVote: stats[0].electeursAyantVote,
                tauxParticipation: stats[0].tauxParticipation
            });

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