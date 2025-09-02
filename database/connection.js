const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration de la connexion
const dbConfig = {
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT,
    waitForConnections: true,
    connectionLimit: 10,
};

// Créer un pool de connexions
const pool = mysql.createPool(dbConfig);

// Test de connexion
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Connecté à la base de données MySQL');
        connection.release();
    } catch (error) {
        console.error('❌ Erreur de connexion à la base de données:', error.message);
        process.exit(1);
    }
}

testConnection();

module.exports = pool;