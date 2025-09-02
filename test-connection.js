// test-connection.js
import { testConnection } from './config/database.js';

async function main() {
    console.log('🔌 Test de connexion à la base de données...');
    const connected = await testConnection();

    if (connected) {
        console.log('🎉 Tout est bon! La connexion fonctionne.');
    } else {
        console.log('❌ Il y a un problème de connexion.');
    }
}

main();