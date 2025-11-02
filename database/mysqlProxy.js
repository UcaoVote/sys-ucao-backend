import axios from 'axios';

/**
 * 🔄 Client MySQL Proxy
 * Utilise l'API PHP pour communiquer avec MySQL
 */

const PROXY_URL = 'https://oeuvreuniversitaire.ucaobenin.org/api/db-proxy.php';
const PROXY_SECRET = '9n0YQwolDxipCm6MtgG8zBJRHcSdXyhkebFN37Vs';

class MySQLProxy {
    constructor() {
        this.client = axios.create({
            baseURL: PROXY_URL,
            headers: {
                'Authorization': `Bearer ${PROXY_SECRET}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
    }

    /**
     * Exécuter une requête SQL (compatible avec mysql2)
     * @param {string} query - La requête SQL
     * @param {array} params - Les paramètres préparés
     * @returns {Array} [rows, fields] - Format compatible mysql2
     */
    async query(query, params = []) {
        try {
            const response = await this.client.post('', {
                query,
                params
            });

            if (!response.data.success) {
                throw new Error(response.data.error);
            }

            // Retourner au format [rows, fields] comme mysql2
            const rows = response.data.data || [];
            const fields = []; // Les champs ne sont pas retournés par le proxy, mais rarement utilisés

            return [rows, fields];
        } catch (error) {
            if (error.response) {
                throw new Error(`MySQL Proxy Error: ${error.response.data.error || error.message}`);
            }
            throw error;
        }
    }

    /**
     * Exécuter une requête SELECT
     */
    async select(query, params = []) {
        const result = await this.query(query, params);
        return result.data || [];
    }

    /**
     * Exécuter une requête (compatible mysql2)
     * Retourne [rows, fields] pour SELECT ou [ResultSetHeader, fields] pour INSERT/UPDATE/DELETE
     * @returns {Array} [rows|ResultSetHeader, fields]
     */
    async execute(query, params = []) {
        try {
            const response = await this.client.post('', {
                query,
                params
            });

            if (!response.data.success) {
                throw new Error(response.data.error);
            }

            // Détecter le type de requête
            const queryType = query.trim().split(/\s+/)[0].toUpperCase();
            const isSelect = queryType === 'SELECT' || queryType === 'SHOW' || queryType === 'DESCRIBE';

            if (isSelect) {
                // Pour SELECT : retourner [rows, fields]
                const rows = response.data.data || [];
                return [rows, []];
            } else {
                // Pour INSERT/UPDATE/DELETE : retourner [ResultSetHeader, fields]
                const resultSetHeader = {
                    fieldCount: 0,
                    affectedRows: response.data.affectedRows || 0,
                    insertId: response.data.lastInsertId || 0,
                    info: '',
                    serverStatus: 2,
                    warningStatus: 0
                };
                return [resultSetHeader, []];
            }
        } catch (error) {
            if (error.response) {
                throw new Error(`MySQL Proxy Error: ${error.response.data.error || error.message}`);
            }
            throw error;
        }
    }

    /**
     * Obtenir une connexion (pour compatibilité avec mysql2)
     * Note: Les transactions ne sont pas réellement supportées via HTTP
     * mais on simule le comportement pour la compatibilité
     */
    getConnection() {
        return Promise.resolve({
            query: this.query.bind(this),
            execute: this.execute.bind(this),
            ping: async () => { await this.query('SELECT 1'); },
            beginTransaction: async () => {
                console.warn('⚠️ Transactions simulées - pas de rollback réel possible via HTTP');
            },
            commit: async () => {
                // No-op - les requêtes sont auto-commit via HTTP
            },
            rollback: async () => {
                console.warn('⚠️ Rollback simulé - impossible via HTTP');
            },
            release: () => { }, // No-op car HTTP est stateless
            destroy: () => { }  // No-op
        });
    }

    /**
     * Test de connexion
     */
    async testConnection() {
        try {
            await this.query('SELECT 1 as test');
            console.log('✅ Connexion MySQL Proxy établie');
            return true;
        } catch (error) {
            console.error('❌ Erreur connexion MySQL Proxy:', error.message);
            return false;
        }
    }
}

export default new MySQLProxy();
