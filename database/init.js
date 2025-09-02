// database/init.js
import { query } from '../config/database.js';
import fs from 'fs';
import path from 'path';

async function initializeDatabase() {
    try {
        console.log('Initialisation de la base de données...');

        // Lire le fichier SQL
        const sqlPath = path.join(process.cwd(), 'database', 'schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Séparer les requêtes SQL
        const queries = sql.split(';').filter(q => q.trim());

        // Exécuter chaque requête
        for (const q of queries) {
            if (q.trim()) {
                await query(q);
                console.log('Requête exécutée');
            }
        }

        console.log(' Base de données initialisée avec succès!');
    } catch (error) {
        console.error(' Erreur lors de l\'initialisation:', error.message);
    }
}

// Exécuter seulement si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeDatabase();
}

export default initializeDatabase;