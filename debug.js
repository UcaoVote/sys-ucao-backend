// database/debug-schema.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function analyzeSchema() {
    try {
        const sqlPath = path.join(__dirname, 'schema.sql');

        // Vérifier si le fichier existe
        if (!fs.existsSync(sqlPath)) {
            console.log('❌ Le fichier schema.sql n\'existe pas!');
            console.log('Chemin recherché:', sqlPath);
            return;
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('=== ANALYSE DU FICHIER schema.sql ===');
        console.log(`Taille: ${sql.length} caractères`);
        console.log(`Nombre de lignes: ${sql.split('\n').length}`);

        if (sql.length === 0) {
            console.log('❌ Le fichier est vide!');
            return;
        }

        // Afficher les premiers 500 caractères
        console.log('\n=== PREMIERS 500 CARACTÈRES ===');
        console.log(sql.substring(0, 500));

        // Compter les points-virgules
        const semicolonCount = (sql.match(/;/g) || []).length;
        console.log(`\nNombre de ; : ${semicolonCount}`);

        // Test de split simple
        console.log('\n=== TEST DE SPLIT SIMPLE ===');
        const simpleQueries = sql.split(';').filter(q => q.trim().length > 0);
        console.log(`Requêtes détectées (split simple): ${simpleQueries.length}`);

        // Test de split avancé
        console.log('\n=== TEST DE SPLIT AVANCÉ ===');
        const advancedQueries = sql.split(/;(?=(?:[^'"]|'[^']*'|"[^"]*")*$)/)
            .map(q => q.trim())
            .filter(q => q.length > 0 && !q.startsWith('--') && !q.startsWith('/*'));
        console.log(`Requêtes détectées (split avancé): ${advancedQueries.length}`);

        if (advancedQueries.length > 0) {
            console.log('\n=== EXTRAIT PREMIÈRE REQUÊTE ===');
            const firstQuery = advancedQueries[0];
            console.log(firstQuery.substring(0, 200) + (firstQuery.length > 200 ? '...' : ''));
        }

    } catch (error) {
        console.error('❌ Erreur lors de l\'analyse:', error.message);
    }
}

// Exécuter le diagnostic
analyzeSchema();