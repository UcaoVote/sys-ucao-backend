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
     * Exécuter une requête SQL
     * @param {string} query - La requête SQL
     * @param {array} params - Les paramètres préparés
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

            return response.data;
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
     * Exécuter une requête INSERT/UPDATE/DELETE
     */
    async execute(query, params = []) {
        const result = await this.query(query, params);
        return {
            affectedRows: result.affectedRows || 0,
            insertId: result.lastInsertId || 0
        };
    }

    /**
     * Obtenir une connexion (pour compatibilité avec mysql2)
     */
    async getConnection() {
        return {
            query: this.query.bind(this),
            execute: this.execute.bind(this),
            release: () => { } // No-op car HTTP est stateless
        };
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
