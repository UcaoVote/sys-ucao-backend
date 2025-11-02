import mysqlProxy from './mysqlProxy.js';
import dotenv from 'dotenv';
dotenv.config();

// 🔄 Utiliser le proxy MySQL HTTP en production
// Car le firewall bloque les connexions directes TCP sur le port 3306
const useProxy = process.env.USE_MYSQL_PROXY === 'true' || process.env.NODE_ENV === 'production';

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
