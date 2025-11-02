import pool from '../database/dbconfig.js';

class ConcoursAdminController {

    // GET /api/admin/concours - Liste tous les concours
    async getAllConcours(req, res) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [concours] = await connection.execute(`
                SELECT 
                    c.*,
                    COUNT(DISTINCT cc.id) as totalCandidates,
                    COALESCE(SUM(cc.totalVotes), 0) as totalVotes,
                    COALESCE(SUM(cc.montantTotal), 0) as totalRevenu
                FROM concours c
                LEFT JOIN candidates_concours cc ON c.id = cc.concoursId
                GROUP BY c.id
                ORDER BY c.createdAt DESC
            `);

            res.json({
                success: true,
                data: concours
            });

        } catch (error) {
            console.error('Erreur getAllConcours:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur chargement concours'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // POST /api/admin/concours - Créer un concours
    async createConcours(req, res) {
        let connection;
        try {
            const {
                titre,
                description,
                type,
                dateDebutCandidature,
                dateFinCandidature,
                dateDebutVote,
                dateFinVote,
                prixVote,
                devise,
                limiteVotesParPersonne,
                afficherResultatsTempsReel,
                reglement,
                organisateur
            } = req.body;

            // Validation
            if (!titre || !type || !dateDebutVote || !dateFinVote || !prixVote) {
                return res.status(400).json({
                    success: false,
                    message: 'Champs obligatoires manquants'
                });
            }

            connection = await pool.getConnection();

            const [result] = await connection.execute(`
                INSERT INTO concours 
                (titre, description, type, dateDebutCandidature, dateFinCandidature,
                 dateDebutVote, dateFinVote, prixVote, devise, limiteVotesParPersonne,
                 afficherResultatsTempsReel, reglement, organisateur, statut)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BROUILLON')
            `, [
                titre,
                description,
                type,
                dateDebutCandidature,
                dateFinCandidature,
                dateDebutVote,
                dateFinVote,
                prixVote,
                devise || 'XOF',
                limiteVotesParPersonne || 10,
                afficherResultatsTempsReel || false,
                reglement,
                organisateur
            ]);

            res.json({
                success: true,
                message: 'Concours créé avec succès',
                data: {
                    id: result.insertId
                }
            });

        } catch (error) {
            console.error('Erreur createConcours:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur création concours'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // GET /api/admin/concours/:id - Détails d'un concours
    async getConcoursById(req, res) {
        let connection;
        try {
            const { id } = req.params;
            connection = await pool.getConnection();

            const [concours] = await connection.execute(
                'SELECT * FROM concours WHERE id = ?',
                [id]
            );

            if (concours.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Concours non trouvé'
                });
            }

            res.json({
                success: true,
                data: concours[0]
            });

        } catch (error) {
            console.error('Erreur getConcoursById:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur chargement concours'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // PUT /api/admin/concours/:id - Mettre à jour un concours
    async updateConcours(req, res) {
        let connection;
        try {
            const { id } = req.params;
            const updates = req.body;

            connection = await pool.getConnection();

            // Construire la requête UPDATE dynamiquement
            const fields = Object.keys(updates).filter(key => key !== 'id');
            const setClause = fields.map(field => `${field} = ?`).join(', ');
            const values = fields.map(field => updates[field]);
            values.push(id);

            if (fields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucune donnée à mettre à jour'
                });
            }

            await connection.execute(
                `UPDATE concours SET ${setClause} WHERE id = ?`,
                values
            );

            res.json({
                success: true,
                message: 'Concours mis à jour avec succès'
            });

        } catch (error) {
            console.error('Erreur updateConcours:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur mise à jour concours'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // DELETE /api/admin/concours/:id - Supprimer un concours
    async deleteConcours(req, res) {
        let connection;
        try {
            const { id } = req.params;
            connection = await pool.getConnection();

            // Vérifier s'il y a des votes
            const [votes] = await connection.execute(
                'SELECT COUNT(*) as count FROM votes_miss WHERE concoursId = ?',
                [id]
            );

            if (votes[0].count > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Impossible de supprimer un concours avec des votes'
                });
            }

            await connection.execute('DELETE FROM concours WHERE id = ?', [id]);

            res.json({
                success: true,
                message: 'Concours supprimé avec succès'
            });

        } catch (error) {
            console.error('Erreur deleteConcours:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur suppression concours'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // GET /api/admin/concours/:id/candidates - Liste des candidates
    async getCandidates(req, res) {
        let connection;
        try {
            const { id } = req.params;
            connection = await pool.getConnection();

            const [candidates] = await connection.execute(`
                SELECT * FROM candidates_concours 
                WHERE concoursId = ?
                ORDER BY numero ASC
            `, [id]);

            res.json({
                success: true,
                data: candidates
            });

        } catch (error) {
            console.error('Erreur getCandidates:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur chargement candidates'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // POST /api/admin/concours/:id/candidates - Ajouter une candidate
    async addCandidate(req, res) {
        let connection;
        try {
            const { id } = req.params;
            const {
                numero,
                nom,
                age,
                ville,
                profession,
                bio,
                hobbies,
                photo1Url,
                photo2Url,
                photo3Url,
                videoUrl,
                facebook,
                instagram,
                whatsapp
            } = req.body;

            // Validation
            if (!numero || !nom || !age) {
                return res.status(400).json({
                    success: false,
                    message: 'Champs obligatoires manquants'
                });
            }

            connection = await pool.getConnection();

            // Vérifier que le numéro n'existe pas déjà
            const [existing] = await connection.execute(
                'SELECT id FROM candidates_concours WHERE concoursId = ? AND numero = ?',
                [id, numero]
            );

            if (existing.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Ce numéro de candidate existe déjà'
                });
            }

            const [result] = await connection.execute(`
                INSERT INTO candidates_concours 
                (concoursId, numero, nom, age, ville, profession, bio, hobbies,
                 photo1Url, photo2Url, photo3Url, videoUrl, facebook, instagram, whatsapp, statut)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE')
            `, [
                id, numero, nom, age, ville, profession, bio, hobbies,
                photo1Url, photo2Url, photo3Url, videoUrl, facebook, instagram, whatsapp
            ]);

            res.json({
                success: true,
                message: 'Candidate ajoutée avec succès',
                data: {
                    id: result.insertId
                }
            });

        } catch (error) {
            console.error('Erreur addCandidate:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur ajout candidate'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // PUT /api/admin/candidates/:id - Mettre à jour une candidate
    async updateCandidate(req, res) {
        let connection;
        try {
            const { id } = req.params;
            const updates = req.body;

            connection = await pool.getConnection();

            const fields = Object.keys(updates).filter(key => key !== 'id');
            const setClause = fields.map(field => `${field} = ?`).join(', ');
            const values = fields.map(field => updates[field]);
            values.push(id);

            if (fields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucune donnée à mettre à jour'
                });
            }

            await connection.execute(
                `UPDATE candidates_concours SET ${setClause} WHERE id = ?`,
                values
            );

            res.json({
                success: true,
                message: 'Candidate mise à jour avec succès'
            });

        } catch (error) {
            console.error('Erreur updateCandidate:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur mise à jour candidate'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // PUT /api/admin/candidates/:id/status - Changer le statut
    async updateCandidateStatus(req, res) {
        let connection;
        try {
            const { id } = req.params;
            const { statut } = req.body;

            if (!['EN_ATTENTE', 'APPROUVE', 'REJETE'].includes(statut)) {
                return res.status(400).json({
                    success: false,
                    message: 'Statut invalide'
                });
            }

            connection = await pool.getConnection();

            await connection.execute(
                'UPDATE candidates_concours SET statut = ? WHERE id = ?',
                [statut, id]
            );

            res.json({
                success: true,
                message: 'Statut mis à jour avec succès'
            });

        } catch (error) {
            console.error('Erreur updateCandidateStatus:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur mise à jour statut'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // DELETE /api/admin/candidates/:id - Supprimer une candidate
    async deleteCandidate(req, res) {
        let connection;
        try {
            const { id } = req.params;
            connection = await pool.getConnection();

            // Vérifier s'il y a des votes
            const [votes] = await connection.execute(
                'SELECT COUNT(*) as count FROM votes_miss WHERE candidateId = ?',
                [id]
            );

            if (votes[0].count > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Impossible de supprimer une candidate avec des votes'
                });
            }

            await connection.execute('DELETE FROM candidates_concours WHERE id = ?', [id]);

            res.json({
                success: true,
                message: 'Candidate supprimée avec succès'
            });

        } catch (error) {
            console.error('Erreur deleteCandidate:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur suppression candidate'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // GET /api/admin/concours/:id/stats - Statistiques détaillées
    async getDetailedStats(req, res) {
        let connection;
        try {
            const { id } = req.params;
            connection = await pool.getConnection();

            // Stats générales
            const [stats] = await connection.execute(`
                SELECT 
                    COUNT(DISTINCT cc.id) as totalCandidates,
                    COUNT(DISTINCT CASE WHEN cc.statut = 'APPROUVE' THEN cc.id END) as candidatesApprouvees,
                    COALESCE(SUM(cc.totalVotes), 0) as totalVotes,
                    COALESCE(SUM(cc.montantTotal), 0) as totalRevenu,
                    COUNT(DISTINCT vm.id) as totalTransactions,
                    COUNT(DISTINCT vm.votantEmail) as votantsUniques
                FROM concours c
                LEFT JOIN candidates_concours cc ON c.id = cc.concoursId
                LEFT JOIN votes_miss vm ON c.id = vm.concoursId
                WHERE c.id = ?
            `, [id]);

            // Top 5 candidates
            const [topCandidates] = await connection.execute(`
                SELECT numero, nom, totalVotes, montantTotal
                FROM candidates_concours
                WHERE concoursId = ? AND statut = 'APPROUVE'
                ORDER BY totalVotes DESC
                LIMIT 5
            `, [id]);

            // Répartition par méthode de paiement
            const [paymentMethods] = await connection.execute(`
                SELECT 
                    methodePaiement,
                    COUNT(*) as nombre,
                    SUM(montant) as montantTotal
                FROM votes_miss
                WHERE concoursId = ?
                GROUP BY methodePaiement
            `, [id]);

            // Évolution des votes par jour
            const [dailyVotes] = await connection.execute(`
                SELECT 
                    DATE(createdAt) as date,
                    COUNT(*) as votes,
                    SUM(montant) as revenu
                FROM votes_miss
                WHERE concoursId = ?
                GROUP BY DATE(createdAt)
                ORDER BY date DESC
                LIMIT 30
            `, [id]);

            res.json({
                success: true,
                data: {
                    general: stats[0],
                    topCandidates,
                    paymentMethods,
                    dailyVotes
                }
            });

        } catch (error) {
            console.error('Erreur getDetailedStats:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur chargement statistiques'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // GET /api/admin/concours/:id/transactions - Liste des transactions
    async getTransactions(req, res) {
        let connection;
        try {
            const { id } = req.params;
            const { page = 1, limit = 50 } = req.query;
            const offset = (page - 1) * limit;

            connection = await pool.getConnection();

            const [transactions] = await connection.execute(`
                SELECT 
                    tp.*,
                    cc.nom as candidateNom,
                    cc.numero as candidateNumero
                FROM transactions_paiement tp
                LEFT JOIN votes_miss vm ON tp.transactionId = vm.transactionId
                LEFT JOIN candidates_concours cc ON vm.candidateId = cc.id
                WHERE tp.concoursId = ?
                ORDER BY tp.createdAt DESC
                LIMIT ? OFFSET ?
            `, [id, parseInt(limit), parseInt(offset)]);

            const [countResult] = await connection.execute(
                'SELECT COUNT(*) as total FROM transactions_paiement WHERE concoursId = ?',
                [id]
            );

            res.json({
                success: true,
                data: {
                    transactions,
                    total: countResult[0].total,
                    page: parseInt(page),
                    limit: parseInt(limit)
                }
            });

        } catch (error) {
            console.error('Erreur getTransactions:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur chargement transactions'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // GET /api/admin/concours/:id/export - Export résultats
    async exportResults(req, res) {
        let connection;
        try {
            const { id } = req.params;
            connection = await pool.getConnection();

            const [results] = await connection.execute(`
                SELECT 
                    cc.numero,
                    cc.nom,
                    cc.age,
                    cc.ville,
                    cc.profession,
                    cc.totalVotes,
                    cc.montantTotal,
                    cc.statut
                FROM candidates_concours cc
                WHERE cc.concoursId = ?
                ORDER BY cc.totalVotes DESC
            `, [id]);

            // Retourner en JSON (à adapter pour CSV/Excel si besoin)
            res.json({
                success: true,
                data: results
            });

        } catch (error) {
            console.error('Erreur exportResults:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur export résultats'
            });
        } finally {
            if (connection) connection.release();
        }
    }
}

export default new ConcoursAdminController();
