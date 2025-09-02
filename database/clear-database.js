// database/clear-database.js
import { query } from '../config/database.js';

async function clearDatabase() {
    try {
        console.log('🚨 ATTENTION: Opération dangereuse!');
        console.log('🔻 Ce script va supprimer TOUTES les données de la base de données');

        // Demande de confirmation pour sécurité
        const readline = (await import('readline')).createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (text) => new Promise(resolve => readline.question(text, resolve));

        const confirm = await question('❓ Êtes-vous sûr ? (tapez "SUPPRIMER" pour confirmer): ');

        if (confirm !== 'SUPPRIMER') {
            console.log('❌ Opération annulée');
            readline.close();
            return;
        }

        readline.close();

        console.log('\n🔥 Début de la suppression...');

        // Désactiver les contraintes de clés étrangères temporairement
        await query('SET FOREIGN_KEY_CHECKS = 0;');
        console.log('✅ Contraintes étrangères désactivées');

        // Lister toutes les tables
        const tables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_type = 'BASE TABLE'
        `);

        console.log(`📋 ${tables.length} tables à supprimer`);

        // Supprimer le contenu de chaque table
        for (const table of tables) {
            const tableName = table.TABLE_NAME || table.table_name;
            try {
                await query(`DELETE FROM ${tableName};`);
                console.log(`✅ Données de ${tableName} supprimées`);
            } catch (error) {
                console.log(`⚠️  Impossible de supprimer ${tableName}:`, error.message);
            }
        }

        // Réactiver les contraintes
        await query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('✅ Contraintes étrangères réactivées');

        // Vérification
        const tableCounts = [];
        for (const table of tables) {
            const tableName = table.TABLE_NAME || table.table_name;
            try {
                const [result] = await query(`SELECT COUNT(*) as count FROM ${tableName};`);
                tableCounts.push({ table: tableName, count: result.count });
            } catch (error) {
                tableCounts.push({ table: tableName, count: 'error' });
            }
        }

        console.log('\n📊 Vérification après suppression:');
        tableCounts.forEach(item => {
            console.log(`   ${item.table}: ${item.count} enregistrement(s)`);
        });

        console.log('\n🎉 Base de données vidée avec succès!');

    } catch (error) {
        console.error('❌ Erreur lors de la suppression:', error.message);
    }
}

// Exécuter seulement si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    clearDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

export default clearDatabase;