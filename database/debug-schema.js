// database/debug-schema.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function analyzeSchema() {
    try {
        const sqlPath = path.join(__dirname, 'schema.sql');

        console.log('🔍 Analyse du fichier schema.sql...');
        console.log('📁 Chemin complet:', sqlPath);

        // Vérifier si le fichier existe
        if (!fs.existsSync(sqlPath)) {
            console.log('❌ Le fichier schema.sql n\'existe pas!');
            return;
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('✅ Fichier trouvé');
        console.log(`📊 Taille: ${sql.length} caractères`);
        console.log(`📊 Nombre de lignes: ${sql.split('\n').length}`);

        if (sql.length === 0) {
            console.log('❌ Le fichier est vide!');
            return;
        }

        // Afficher les premiers 200 caractères
        console.log('\n=== DÉBUT DU FICHIER (200 premiers caractères) ===');
        console.log(sql.substring(0, 200));

        // Afficher les derniers 200 caractères
        console.log('\n=== FIN DU FICHIER (200 derniers caractères) ===');
        console.log(sql.substring(sql.length - 200));

        // Compter les points-virgules
        const semicolonCount = (sql.match(/;/g) || []).length;
        console.log(`\n🔢 Nombre de points-virgules : ${semicolonCount}`);

        // Test de split simple
        console.log('\n=== TEST DE SPLIT PAR POINTS-VIRGULES ===');
        const queries = sql.split(';')
            .map(q => q.trim())
            .filter(q => q.length > 0 && !q.startsWith('--') && !q.startsWith('/*'));

        console.log(`📋 Requêtes détectées: ${queries.length}`);

        if (queries.length > 0) {
            console.log('\n=== EXTRAIT DE LA PREMIÈRE REQUÊTE ===');
            console.log(queries[0].substring(0, 150) + (queries[0].length > 150 ? '...' : ''));

            console.log('\n=== EXTRAIT DE LA DERNIÈRE REQUÊTE ===');
            console.log(queries[queries.length - 1].substring(0, 150) + (queries[queries.length - 1].length > 150 ? '...' : ''));
        }

    } catch (error) {
        console.error('❌ Erreur lors de l\'analyse:', error.message);
    }
}

// Exécuter le diagnostic
analyzeSchema();