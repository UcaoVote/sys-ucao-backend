import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    port: process.env.MYSQLPORT,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
    debug: false,
    trace: false,
    timezone: 'Z',
    flags: [
        '-FOUND_ROWS',
        '-MULTI_STATEMENTS'
    ]
});


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

export default pool;
