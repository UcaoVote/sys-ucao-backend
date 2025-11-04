import mysqlProxy from './mysqlProxy.js';
import dotenv from 'dotenv';
dotenv.config();

// 🔄 Utiliser le proxy MySQL HTTP seulement si explicitement activé
const useProxy = process.env.USE_MYSQL_PROXY === 'true';

// 🐛 DEBUG - Afficher la configuration au démarrage
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 CONFIGURATION BASE DE DONNÉES');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📌 NODE_ENV:', process.env.NODE_ENV);
console.log('📌 USE_MYSQL_PROXY:', process.env.USE_MYSQL_PROXY);
console.log('📌 useProxy (calculé):', useProxy);
console.log('📌 MYSQLHOST:', process.env.MYSQLHOST);
console.log('📌 MYSQLDATABASE:', process.env.MYSQLDATABASE);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

let realPool;

if (useProxy) {
    console.log('🔄 Utilisation du MySQL Proxy HTTP');
    realPool = mysqlProxy;
} else {
    console.log('⚠️ Mode proxy désactivé - connexion directe MySQL (peut échouer si firewall actif)');
    const mysql = await import('mysql2/promise');
    realPool = mysql.default.createPool({
        host: process.env.MYSQLHOST,
        port: process.env.MYSQLPORT,
        user: process.env.MYSQLUSER,
        password: process.env.MYSQLPASSWORD,
        database: process.env.MYSQLDATABASE,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4',
        timezone: 'Z'
    });
}

// Export d'un Proxy JavaScript qui forward tous les appels vers realPool
// Cela garantit que même si les modules sont cachés, ils utilisent toujours la bonne instance
const pool = new Proxy(realPool, {
    get(target, prop) {
        // Si c'est une fonction, la binder au bon contexte
        if (typeof target[prop] === 'function') {
            return target[prop].bind(target);
        }
        return target[prop];
    }
});

// Vérification simple
export async function testConnection() {
    try {
        return await realPool.testConnection();
    } catch (error) {
        console.error('❌ Erreur test connexion:', error.message);
        return false;
    }
}

export default pool;
