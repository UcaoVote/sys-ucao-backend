import mysqlProxy from './mysqlProxy.js';
import dotenv from 'dotenv';
dotenv.config();

// 🔄 Utiliser le proxy MySQL HTTP seulement si explicitement activé
// Le proxy n'est plus nécessaire car la base de données est accessible directement
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

let pool;

if (useProxy) {
    console.log('🔄 Utilisation du MySQL Proxy HTTP');
    pool = mysqlProxy;
} else {
    console.log('⚠️ Mode proxy désactivé - connexion directe MySQL (peut échouer si firewall actif)');
    // Import dynamique pour éviter les erreurs si mysql2 n'est pas utilisé
    const mysql = await import('mysql2/promise');
    pool = mysql.default.createPool({
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

// Vérification simple
export async function testConnection() {
    try {
        return await pool.testConnection();
    } catch (error) {
        console.error('❌ Erreur test connexion:', error.message);
        return false;
    }
}

export default pool;
