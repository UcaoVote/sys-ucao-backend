// config/database.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configuration de la base MySQL
const dbConfig = {
    host: process.env.MYSQLHOST || 'localhost',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'election_db',
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Création du pool de connexions
let pool = mysql.createPool(dbConfig);

// Vérification simple
export async function testConnection() {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        console.log('✅ Connexion MySQL établie');
        return true;
    } catch (error) {
        console.error('❌ Erreur connexion MySQL:', error.message);
        return false;
    }
}

// Fonction de reconnexion automatique
async function handleDisconnect() {
    try {
        pool = mysql.createPool(dbConfig);
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        console.log('🔄 Pool MySQL recréé après déconnexion');
    } catch (err) {
        console.error('❌ Impossible de recréer le pool:', err.message);
        // Réessaye après 5 secondes
        setTimeout(handleDisconnect, 5000);
    }
}

// Gestion des erreurs globales
pool.on('error', (err) => {
    console.error('⚠️ Erreur MySQL détectée:', err.code);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.fatal) {
        handleDisconnect();
    }
});

// Fonction utilitaire pour exécuter une requête
export async function query(sql, params = []) {
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (error) {
        console.error('❌ Erreur SQL:', error.message);
        throw error;
    }
}

export default pool;
