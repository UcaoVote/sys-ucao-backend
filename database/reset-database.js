// database/reset-database.js
import { query } from '../config/database.js';

async function resetDatabase() {
    try {
        console.log('💥 ATTENTION: Opération TRÈS dangereuse!');
        console.log('🔻 Ce script va supprimer TOUTES les TABLES de la base de données');
        console.log('🔻 Toutes les données et structures seront PERDUES');

        const readline = (await import('readline')).createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (text) => new Promise(resolve => readline.question(text, resolve));

        const confirm = await question('❓ Êtes-vous ABSOLUMENT sûr ? (tapez "DETRUIRE" pour confirmer): ');

        if (confirm !== 'DETRUIRE') {
            console.log('❌ Opération annulée');
            readline.close();
            return;
        }

        readline.close();

        console.log('\n💥 Début de la destruction...');

        // Désactiver les contraintes
        await query('SET FOREIGN_KEY_CHECKS = 0;');

        // Lister toutes les tables
        const tables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_type = 'BASE TABLE'
        `);

        console.log(`📋 ${tables.length} tables à détruire`);

        // Supprimer chaque table
        for (const table of tables) {
            const tableName = table.TABLE_NAME || table.table_name;
            try {
                await query(`DROP TABLE IF EXISTS ${tableName};`);
                console.log(`✅ Table ${tableName} supprimée`);
            } catch (error) {
                console.log(`⚠️  Impossible de supprimer ${tableName}:`, error.message);
            }
        }

        // Réactiver les contraintes
        await query('SET FOREIGN_KEY_CHECKS = 1;');

        // Vérification
        const remainingTables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_type = 'BASE TABLE'
        `);

        console.log(`\n📊 Tables restantes: ${remainingTables.length}`);

        if (remainingTables.length === 0) {
            console.log('🎉 Base de données complètement resetée!');
        } else {
            console.log('⚠️  Certaines tables n\'ont pas pu être supprimées');
        }

    } catch (error) {
        console.error('❌ Erreur lors de la destruction:', error.message);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    resetDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

export default resetDatabase;