import pool from '../database/dbconfig.js';
import crypto from 'crypto';
import paymentService from '../services/paymentService.js';

class ConcoursController {

    // GET /api/public/concours - Liste des concours actifs
    async getActiveConcours(req, res) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [concours] = await connection.execute(`
                SELECT 
                    c.*,
                    COUNT(DISTINCT cc.id) as totalCandidates,
                    COALESCE(SUM(cc.totalVotes), 0) as totalVotes
                FROM concours c
                LEFT JOIN candidates_concours cc ON c.id = cc.concoursId AND cc.statut = 'APPROUVE'
                WHERE c.statut = 'ACTIF'
                GROUP BY c.id
                ORDER BY c.dateDebutVote DESC
            `);

            res.json({
                success: true,
                data: concours
            });

        } catch (error) {
            console.error('Erreur getActiveConcours:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur chargement concours'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // GET /api/public/concours/:id - Détails d'un concours
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

    // GET /api/public/concours/:id/candidates - Liste des candidates
    async getCandidates(req, res) {
        let connection;
        try {
            const { id } = req.params;
            connection = await pool.getConnection();

            const [candidates] = await connection.execute(`
                SELECT 
                    cc.*,
                    COALESCE(cc.totalVotes, 0) as totalVotes,
                    COALESCE(cc.montantTotal, 0) as montantTotal
                FROM candidates_concours cc
                WHERE cc.concoursId = ? AND cc.statut = 'APPROUVE'
                ORDER BY cc.totalVotes DESC, cc.numero ASC
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

    // GET /api/public/concours/:id/stats - Statistiques temps réel
    async getStats(req, res) {
        let connection;
        try {
            const { id } = req.params;
            connection = await pool.getConnection();

            const [stats] = await connection.execute(`
                SELECT 
                    COUNT(DISTINCT cc.id) as totalCandidates,
                    COALESCE(SUM(cc.totalVotes), 0) as totalVotes,
                    COALESCE(SUM(cc.montantTotal), 0) as totalRevenue,
                    c.prixVote,
                    c.dateFinVote
                FROM concours c
                LEFT JOIN candidates_concours cc ON c.id = cc.concoursId AND cc.statut = 'APPROUVE'
                WHERE c.id = ?
                GROUP BY c.id
            `, [id]);

            if (stats.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Concours non trouvé'
                });
            }

            const statsData = stats[0];
            const daysRemaining = statsData.dateFinVote ?
                Math.max(0, Math.ceil((new Date(statsData.dateFinVote) - new Date()) / (1000 * 60 * 60 * 24))) : 0;

            res.json({
                success: true,
                data: {
                    totalCandidates: statsData.totalCandidates,
                    totalVotes: statsData.totalVotes,
                    totalRevenue: statsData.totalRevenue,
                    prixVote: statsData.prixVote,
                    daysRemaining,
                    participation: statsData.totalCandidates > 0 ?
                        ((statsData.totalVotes / statsData.totalCandidates) * 100).toFixed(1) + '%' : '0%'
                }
            });

        } catch (error) {
            console.error('Erreur getStats:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur chargement statistiques'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // GET /api/public/concours/:id/results - Résultats et classement
    async getResults(req, res) {
        let connection;
        try {
            const { id } = req.params;
            connection = await pool.getConnection();

            // Vérifier si les résultats sont visibles
            const [concours] = await connection.execute(
                'SELECT afficherResultatsTempsReel FROM concours WHERE id = ?',
                [id]
            );

            if (concours.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Concours non trouvé'
                });
            }

            if (!concours[0].afficherResultatsTempsReel) {
                return res.status(403).json({
                    success: false,
                    message: 'Les résultats ne sont pas encore disponibles'
                });
            }

            // Récupérer les candidates avec leurs votes
            const [candidates] = await connection.execute(`
                SELECT 
                    cc.*,
                    COALESCE(cc.totalVotes, 0) as totalVotes,
                    COALESCE(cc.montantTotal, 0) as montantTotal
                FROM candidates_concours cc
                WHERE cc.concoursId = ? AND cc.statut = 'APPROUVE'
                ORDER BY cc.totalVotes DESC, cc.numero ASC
            `, [id]);

            // Calculer les pourcentages
            const totalVotes = candidates.reduce((sum, c) => sum + c.totalVotes, 0);

            const results = candidates.map((candidate, index) => ({
                ...candidate,
                rang: index + 1,
                pourcentage: totalVotes > 0 ?
                    ((candidate.totalVotes / totalVotes) * 100).toFixed(2) : 0
            }));

            // Stats globales
            const stats = {
                totalCandidates: candidates.length,
                totalVotes,
                totalRevenue: candidates.reduce((sum, c) => sum + c.montantTotal, 0),
                participation: candidates.length > 0 ?
                    ((totalVotes / candidates.length) * 100).toFixed(1) + '%' : '0%'
            };

            res.json({
                success: true,
                data: {
                    results,
                    stats
                }
            });

        } catch (error) {
            console.error('Erreur getResults:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur chargement résultats'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // POST /api/public/vote/initiate - Initier un vote avec paiement
    async initiateVote(req, res) {
        let connection;
        try {
            const {
                concoursId,
                candidateId,
                nombreVotes,
                montantTotal,
                methodePaiement,
                votantNom,
                votantEmail,
                votantTelephone
            } = req.body;

            // Validation
            if (!concoursId || !candidateId || !nombreVotes || !montantTotal || !votantEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Données manquantes'
                });
            }

            connection = await pool.getConnection();
            await connection.beginTransaction();

            // Vérifier le concours
            const [concours] = await connection.execute(
                'SELECT * FROM concours WHERE id = ? AND statut = ?',
                [concoursId, 'ACTIF']
            );

            if (concours.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Concours non trouvé ou inactif'
                });
            }

            const concoursData = concours[0];

            // Vérifier les dates
            const now = new Date();
            if (now < new Date(concoursData.dateDebutVote) || now > new Date(concoursData.dateFinVote)) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Le vote n\'est pas ouvert actuellement'
                });
            }

            // Vérifier la candidate
            const [candidate] = await connection.execute(
                'SELECT * FROM candidates_concours WHERE id = ? AND concoursId = ? AND statut = ?',
                [candidateId, concoursId, 'APPROUVE']
            );

            if (candidate.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Candidate non trouvée'
                });
            }

            // Vérifier le montant
            const expectedAmount = nombreVotes * concoursData.prixVote;
            if (montantTotal !== expectedAmount) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Montant incorrect'
                });
            }

            // Vérifier les limitations anti-fraude
            const identifiant = votantEmail.toLowerCase();
            const [limitations] = await connection.execute(`
                SELECT nombreVotes 
                FROM vote_limitations 
                WHERE concoursId = ? AND identifiant = ? AND typeIdentifiant = 'EMAIL'
            `, [concoursId, identifiant]);

            if (limitations.length > 0) {
                const totalVotesDeja = limitations[0].nombreVotes;
                if (totalVotesDeja + nombreVotes > concoursData.limiteVotesParPersonne) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Limite de ${concoursData.limiteVotesParPersonne} votes par personne atteinte`
                    });
                }
            }

            // Générer un ID de transaction unique
            const transactionId = `TRX_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

            // Créer la transaction de paiement
            await connection.execute(`
                INSERT INTO transactions_paiement 
                (transactionId, concoursId, montant, devise, methodePaiement, statut, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                transactionId,
                concoursId,
                montantTotal,
                concoursData.devise || 'XOF',
                methodePaiement,
                'EN_ATTENTE',
                JSON.stringify({
                    candidateId,
                    nombreVotes,
                    votantNom,
                    votantEmail,
                    votantTelephone
                })
            ]);

            await connection.commit();

            // TODO: Intégrer avec FedaPay/CinetPay pour générer l'URL de paiement
            // Pour l'instant, on simule un paiement direct
            const paymentUrl = await this.generatePaymentUrl(
                transactionId,
                montantTotal,
                methodePaiement,
                votantEmail,
                votantNom
            );

            res.json({
                success: true,
                data: {
                    transactionId,
                    paymentUrl,
                    message: 'Transaction initiée avec succès'
                }
            });

        } catch (error) {
            console.error('Erreur initiateVote:', error);
            if (connection) await connection.rollback();
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'initiation du vote'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // POST /api/public/vote/confirm - Confirmer un vote après paiement
    async confirmVote(req, res) {
        let connection;
        try {
            const { transactionId } = req.body;

            if (!transactionId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de transaction manquant'
                });
            }

            connection = await pool.getConnection();
            await connection.beginTransaction();

            // Récupérer la transaction
            const [transactions] = await connection.execute(
                'SELECT * FROM transactions_paiement WHERE transactionId = ?',
                [transactionId]
            );

            if (transactions.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Transaction non trouvée'
                });
            }

            const transaction = transactions[0];

            if (transaction.statut !== 'SUCCES') {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Paiement non confirmé'
                });
            }

            // Vérifier si les votes ont déjà été comptabilisés
            const [existingVotes] = await connection.execute(
                'SELECT id FROM votes_miss WHERE transactionId = ?',
                [transactionId]
            );

            if (existingVotes.length > 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Votes déjà comptabilisés'
                });
            }

            const metadata = JSON.parse(transaction.metadata);
            const { candidateId, nombreVotes, votantNom, votantEmail, votantTelephone } = metadata;

            // Enregistrer les votes
            for (let i = 0; i < nombreVotes; i++) {
                await connection.execute(`
                    INSERT INTO votes_miss 
                    (concoursId, candidateId, transactionId, montant, methodePaiement, 
                     votantNom, votantEmail, votantTelephone, statut)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPTABILISE')
                `, [
                    transaction.concoursId,
                    candidateId,
                    transactionId,
                    transaction.montant / nombreVotes,
                    transaction.methodePaiement,
                    votantNom,
                    votantEmail,
                    votantTelephone
                ]);
            }

            // Mettre à jour les compteurs de la candidate
            await connection.execute(`
                UPDATE candidates_concours 
                SET totalVotes = totalVotes + ?,
                    montantTotal = montantTotal + ?
                WHERE id = ?
            `, [nombreVotes, transaction.montant, candidateId]);

            // Mettre à jour le total du concours
            await connection.execute(`
                UPDATE concours 
                SET totalVotes = totalVotes + ?,
                    totalRevenu = totalRevenu + ?
                WHERE id = ?
            `, [nombreVotes, transaction.montant, transaction.concoursId]);

            // Mettre à jour les limitations
            const identifiant = votantEmail.toLowerCase();
            await connection.execute(`
                INSERT INTO vote_limitations (concoursId, identifiant, typeIdentifiant, nombreVotes)
                VALUES (?, ?, 'EMAIL', ?)
                ON DUPLICATE KEY UPDATE nombreVotes = nombreVotes + ?
            `, [transaction.concoursId, identifiant, nombreVotes, nombreVotes]);

            await connection.commit();

            res.json({
                success: true,
                message: 'Votes comptabilisés avec succès'
            });

        } catch (error) {
            console.error('Erreur confirmVote:', error);
            if (connection) await connection.rollback();
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la confirmation du vote'
            });
        } finally {
            if (connection) connection.release();
        }
    }

    // Webhook FedaPay
    async webhookFedapay(req, res) {
        let connection;
        try {
            const payload = req.body;
            const signature = req.headers['x-fedapay-signature'];
            console.log('📥 Webhook FedaPay reçu:', payload);

            // Vérifier la signature
            const isValid = paymentService.verifyFedaPaySignature(payload, signature);
            if (!isValid && process.env.NODE_ENV === 'production') {
                console.error('❌ Signature FedaPay invalide');
                return res.status(401).send('Unauthorized');
            }

            const transactionId = payload.transaction?.reference;
            const statut = payload.transaction?.status === 'approved' ? 'SUCCES' : 'ECHEC';

            if (!transactionId) {
                return res.status(400).send('Transaction ID manquant');
            }

            connection = await pool.getConnection();

            // Mettre à jour le statut de la transaction
            await connection.execute(`
                UPDATE transactions_paiement 
                SET statut = ?,
                    providerId = ?,
                    providerName = 'FedaPay',
                    reponseProvider = ?
                WHERE transactionId = ?
            `, [
                statut,
                payload.transaction?.id,
                JSON.stringify(payload),
                transactionId
            ]);

            // Si succès, confirmer automatiquement les votes
            if (statut === 'SUCCES') {
                await this.confirmVote({ body: { transactionId } }, { json: () => { } });
            }

            res.status(200).send('OK');

        } catch (error) {
            console.error('Erreur webhookFedapay:', error);
            res.status(500).send('Erreur');
        } finally {
            if (connection) connection.release();
        }
    }

    // Webhook CinetPay
    async webhookCinetpay(req, res) {
        let connection;
        try {
            const payload = req.body;
            console.log('📥 Webhook CinetPay reçu:', payload);

            // Vérifier la signature
            const isValid = paymentService.verifyCinetPaySignature(payload);
            if (!isValid && process.env.NODE_ENV === 'production') {
                console.error('❌ Signature CinetPay invalide');
                return res.status(401).send('Unauthorized');
            }

            const transactionId = payload.cpm_trans_id;
            const statut = payload.cpm_result === '00' ? 'SUCCES' : 'ECHEC';

            if (!transactionId) {
                return res.status(400).send('Transaction ID manquant');
            }

            connection = await pool.getConnection();

            // Mettre à jour le statut de la transaction
            await connection.execute(`
                UPDATE transactions_paiement 
                SET statut = ?,
                    providerId = ?,
                    providerName = 'CinetPay',
                    reponseProvider = ?
                WHERE transactionId = ?
            `, [
                statut,
                payload.cpm_trans_id,
                JSON.stringify(payload),
                transactionId
            ]);

            // Si succès, confirmer automatiquement les votes
            if (statut === 'SUCCES') {
                await this.confirmVote({ body: { transactionId } }, { json: () => { } });
            }

            res.status(200).send('OK');

        } catch (error) {
            console.error('Erreur webhookCinetpay:', error);
            res.status(500).send('Erreur');
        } finally {
            if (connection) connection.release();
        }
    }

    // Générer URL de paiement (intégré avec FedaPay/CinetPay)
    async generatePaymentUrl(transactionId, montant, methodePaiement, email, nom, telephone) {
        try {
            // Déterminer le provider selon la méthode de paiement
            const provider = methodePaiement === 'CARTE_BANCAIRE' ? 'CINETPAY' : 'FEDAPAY';

            const transactionData = {
                transactionId,
                montantTotal: montant,
                votantNom: nom,
                votantEmail: email,
                votantTelephone: telephone,
                description: `Vote Miss UCAO - ${transactionId}`
            };

            const result = await paymentService.generatePaymentUrl(provider, transactionData);

            return result.paymentUrl;

        } catch (error) {
            console.error('❌ Erreur génération URL paiement:', error.message);
            return null;
        }
    }
}

export default new ConcoursController();
