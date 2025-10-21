/**
 * SERVICE DE PAIEMENT - MODULE MISS
 * Gestion des transactions FedaPay et CinetPay
 */

import crypto from 'crypto';
import axios from 'axios';

class PaymentService {
    constructor() {
        this.fedapayApiKey = process.env.FEDAPAY_SECRET_KEY;
        this.fedapayPublicKey = process.env.FEDAPAY_PUBLIC_KEY;
        this.fedapayEnvironment = process.env.FEDAPAY_ENVIRONMENT || 'sandbox'; // 'sandbox' ou 'live'

        this.cinetpayApiKey = process.env.CINETPAY_API_KEY;
        this.cinetpaySiteId = process.env.CINETPAY_SITE_ID;

        this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
        this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
    }

    /**
     * Génère une URL de paiement selon le provider choisi
     */
    async generatePaymentUrl(provider, transactionData) {
        const { transactionId, montantTotal, votantNom, votantEmail, votantTelephone, description } = transactionData;

        try {
            if (provider === 'FEDAPAY' || provider === 'MOBILE_MONEY') {
                return await this.createFedaPayTransaction(transactionId, montantTotal, votantNom, votantEmail, description);
            } else if (provider === 'CINETPAY' || provider === 'CARTE_BANCAIRE') {
                return await this.createCinetPayTransaction(transactionId, montantTotal, votantNom, votantEmail, votantTelephone, description);
            } else {
                throw new Error(`Provider de paiement non supporté: ${provider}`);
            }
        } catch (error) {
            console.error('❌ Erreur génération URL paiement:', error.message);
            throw error;
        }
    }

    /**
     * Crée une transaction FedaPay
     * Doc: https://docs.fedapay.com
     */
    async createFedaPayTransaction(transactionId, montant, nomComplet, email, description) {
        const baseUrl = this.fedapayEnvironment === 'live'
            ? 'https://api.fedapay.com/v1'
            : 'https://sandbox-api.fedapay.com/v1';

        const [prenom, ...nomParts] = nomComplet.split(' ');
        const nom = nomParts.join(' ') || prenom;

        const payload = {
            description: description || `Vote Miss UCAO - ${transactionId}`,
            amount: montant,
            currency: {
                iso: 'XOF'
            },
            callback_url: `${this.backendUrl}/api/public/webhooks/fedapay`,
            customer: {
                firstname: prenom,
                lastname: nom,
                email: email
            },
            custom_metadata: {
                transaction_id: transactionId,
                source: 'vote_miss_ucao'
            }
        };

        try {
            // 1. Créer la transaction
            const response = await axios.post(`${baseUrl}/transactions`, payload, {
                headers: {
                    'Authorization': `Bearer ${this.fedapayApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const fedaTransactionId = response.data.v1.id;

            // 2. Générer le token de paiement
            const tokenResponse = await axios.post(
                `${baseUrl}/transactions/${fedaTransactionId}/token`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${this.fedapayApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const paymentUrl = tokenResponse.data.v1.url;

            console.log('✅ Transaction FedaPay créée:', fedaTransactionId);
            return {
                provider: 'FedaPay',
                providerId: fedaTransactionId,
                paymentUrl: paymentUrl
            };

        } catch (error) {
            console.error('❌ Erreur FedaPay:', error.response?.data || error.message);
            throw new Error(`Erreur FedaPay: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Crée une transaction CinetPay
     * Doc: https://docs.cinetpay.com
     */
    async createCinetPayTransaction(transactionId, montant, nomComplet, email, telephone, description) {
        const payload = {
            apikey: this.cinetpayApiKey,
            site_id: this.cinetpaySiteId,
            transaction_id: transactionId,
            amount: montant,
            currency: 'XOF',
            description: description || `Vote Miss UCAO - ${transactionId}`,
            customer_name: nomComplet,
            customer_email: email,
            customer_phone_number: telephone,
            notify_url: `${this.backendUrl}/api/public/webhooks/cinetpay`,
            return_url: `${this.frontendUrl}/public/vote-success.html`,
            channels: 'ALL', // Mobile Money + Cartes bancaires
            metadata: JSON.stringify({
                transaction_id: transactionId,
                source: 'vote_miss_ucao'
            })
        };

        try {
            const response = await axios.post(
                'https://api-checkout.cinetpay.com/v2/payment',
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.code === '201') {
                const paymentUrl = response.data.data.payment_url;
                const cinetpayTransactionId = response.data.data.payment_token;

                console.log('✅ Transaction CinetPay créée:', cinetpayTransactionId);
                return {
                    provider: 'CinetPay',
                    providerId: cinetpayTransactionId,
                    paymentUrl: paymentUrl
                };
            } else {
                throw new Error(`Erreur CinetPay: ${response.data.message}`);
            }

        } catch (error) {
            console.error('❌ Erreur CinetPay:', error.response?.data || error.message);
            throw new Error(`Erreur CinetPay: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Vérifie la signature d'un webhook FedaPay
     */
    verifyFedaPaySignature(payload, signature) {
        if (!signature) {
            console.warn('⚠️ Pas de signature FedaPay fournie');
            return process.env.NODE_ENV === 'development'; // Accepter en dev, refuser en prod
        }

        try {
            const expectedSignature = crypto
                .createHmac('sha256', this.fedapayApiKey)
                .update(JSON.stringify(payload))
                .digest('hex');

            const isValid = crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            );

            if (!isValid) {
                console.error('❌ Signature FedaPay invalide');
            }

            return isValid;
        } catch (error) {
            console.error('❌ Erreur vérification signature FedaPay:', error.message);
            return false;
        }
    }

    /**
     * Vérifie la signature d'un webhook CinetPay
     */
    verifyCinetPaySignature(payload) {
        // CinetPay utilise un token dans le payload
        if (!payload.cpm_trans_id || !payload.cpm_site_id) {
            console.warn('⚠️ Données CinetPay incomplètes');
            return false;
        }

        // Vérifier que le site_id correspond
        if (payload.cpm_site_id !== this.cinetpaySiteId) {
            console.error('❌ Site ID CinetPay invalide');
            return false;
        }

        // Vérifier la signature si présente
        if (payload.signature) {
            const token = `${this.cinetpaySiteId}${payload.cpm_trans_id}${this.cinetpayApiKey}`;
            const expectedSignature = crypto
                .createHash('sha256')
                .update(token)
                .digest('hex');

            if (payload.signature !== expectedSignature) {
                console.error('❌ Signature CinetPay invalide');
                return false;
            }
        }

        return true;
    }

    /**
     * Vérifie le statut d'une transaction FedaPay
     */
    async checkFedaPayTransactionStatus(fedaTransactionId) {
        const baseUrl = this.fedapayEnvironment === 'live'
            ? 'https://api.fedapay.com/v1'
            : 'https://sandbox-api.fedapay.com/v1';

        try {
            const response = await axios.get(
                `${baseUrl}/transactions/${fedaTransactionId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.fedapayApiKey}`
                    }
                }
            );

            return {
                status: response.data.v1.status, // 'approved', 'declined', 'pending'
                amount: response.data.v1.amount,
                reference: response.data.v1.reference
            };
        } catch (error) {
            console.error('❌ Erreur vérification statut FedaPay:', error.message);
            throw error;
        }
    }

    /**
     * Vérifie le statut d'une transaction CinetPay
     */
    async checkCinetPayTransactionStatus(cinetpayTransactionId) {
        const payload = {
            apikey: this.cinetpayApiKey,
            site_id: this.cinetpaySiteId,
            transaction_id: cinetpayTransactionId
        };

        try {
            const response = await axios.post(
                'https://api-checkout.cinetpay.com/v2/payment/check',
                payload
            );

            if (response.data.code === '00') {
                return {
                    status: response.data.data.status, // 'ACCEPTED', 'REFUSED', 'PENDING'
                    amount: response.data.data.amount,
                    reference: response.data.data.payment_method
                };
            } else {
                throw new Error(`Erreur CinetPay: ${response.data.message}`);
            }
        } catch (error) {
            console.error('❌ Erreur vérification statut CinetPay:', error.message);
            throw error;
        }
    }

    /**
     * Convertit le statut provider en statut unifié
     */
    normalizeTransactionStatus(provider, providerStatus) {
        const statusMap = {
            'FedaPay': {
                'approved': 'SUCCES',
                'pending': 'EN_ATTENTE',
                'declined': 'ECHEC',
                'canceled': 'ECHEC'
            },
            'CinetPay': {
                'ACCEPTED': 'SUCCES',
                'PENDING': 'EN_ATTENTE',
                'REFUSED': 'ECHEC'
            }
        };

        return statusMap[provider]?.[providerStatus] || 'EN_ATTENTE';
    }
}

// Export singleton
const paymentService = new PaymentService();
export default paymentService;
