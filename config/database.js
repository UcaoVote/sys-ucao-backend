// config/database.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configuration  pour Railways
const dbConfig = {
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT,
    waitForConnections: true,
    connectionLimit: 10,
};

console.log('Configuration DB:', {
    host: dbConfig.host,
    user: dbConfig.user,
    database: dbConfig.database,
    port: dbConfig.port
});

const pool = mysql.createPool(dbConfig);

export async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Connecté à MySQL Railways avec succès!');

        // Test supplémentaire
        const [result] = await connection.execute('SELECT 1 + 1 AS solution');
        console.log('Test calcul:', result[0].solution);

        connection.release();
        return true;
    } catch (error) {
        console.error('Erreur de connexion détaillée:', error.message);
        console.log('Code erreur:', error.code);
        return false;
    }
}

export async function query(sql, params = []) {
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (error) {
        console.error('Erreur SQL:', error.message);
        console.log('Requête:', sql);
        throw error;
    }
}

export default pool;