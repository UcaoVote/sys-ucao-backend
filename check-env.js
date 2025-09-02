// database/check-connection.js
import { testConnection } from '../config/database.js';

async function check() {
    console.log('🔍 Vérification de la connexion...');
    const connected = await testConnection();
    if (connected) {
        console.log('✅ Connexion OK');

        // Vérifier les tables
        const { query } = await import('../config/database.js');
        try {
            const tables = await query('SHOW TABLES;');
            console.log(`📊 ${tables.length} table(s) existante(s)`);
        } catch (error) {
            console.log('ℹ️ Aucune table existante');
        }
    } else {
        console.log('❌ Problème de connexion');
    }
}

check();