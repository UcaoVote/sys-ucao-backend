// database/clean-schema.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function cleanSchema() {
    try {
        const sqlPath = path.join(__dirname, 'schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('🔧 Nettoyage du fichier schema.sql...');

        // Nettoyer le SQL
        let cleanedSql = sql
            // Supprimer les caractères non-ASCII
            .replace(/[^\x00-\x7F]/g, '')
            // Remplacer les sauts de ligne Windows par Unix
            .replace(/\r\n/g, '\n')
            // Supprimer les espaces multiples
            .replace(/\s+/g, ' ')
            // Réduire les espaces autour des parenthèses
            .replace(/\s*\(\s*/g, '(')
            .replace(/\s*\)\s*/g, ')')
            // Ajouter des points-virgules manquants
            .replace(/\)\s*([A-Z])/g, ');\n$1');

        // Sauvegarder le fichier nettoyé
        const cleanPath = path.join(__dirname, 'schema-clean.sql');
        fs.writeFileSync(cleanPath, cleanedSql, 'utf8');

        console.log('✅ Fichier nettoyé: schema-clean.sql');
        console.log('📊 Taille originale:', sql.length, 'caractères');
        console.log('📊 Taille nettoyée:', cleanedSql.length, 'caractères');

        // Afficher un extrait
        console.log('\n=== EXTRATI NETTOYÉ ===');
        console.log(cleanedSql.substring(0, 200));

    } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error.message);
    }
}

cleanSchema();