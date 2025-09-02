import database from '../config/database.js';

async function checkConnection() {
    try {
        console.log('🔌 Test de connexion à la base de données Railways...');

        const isConnected = await database.testConnection();
        if (isConnected) {
            console.log('✅ Connexion réussie à MySQL Railways!');

            // Test simple de requête
            const result = await database.query('SELECT 1 + 1 AS solution');
            console.log('✅ Test de requête réussi:', result);
        } else {
            console.log('❌ Échec de connexion');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
}

checkConnection();