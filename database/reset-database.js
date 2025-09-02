import mysql from 'mysql2/promise';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Cette opération va supprimer toutes les tables. Tape "DETRUIRE" pour confirmer : ', async (answer) => {
    if (answer !== 'DETRUIRE') {
        console.log('Opération annulée.');
        rl.close();
        return;
    }

    const connection = await mysql.createConnection({
        host: process.env.MYSQLHOST,
        user: process.env.MYSQLUSER,
        password: process.env.MYSQLPASSWORD,
        database: process.env.MYSQLDATABASE,
        port: process.env.MYSQLPORT,
        waitForConnections: true,
        connectionLimit: 10,

    });

    try {
        const [rows] = await connection.execute('SHOW TABLES');
        const tableKey = Object.keys(rows[0])[0];
        const tables = rows.map(row => row[tableKey]);

        console.log(`${tables.length} tables détectées`);

        let success = 0;
        let failed = [];
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        for (const table of tables) {
            try {
                await connection.execute(`DROP TABLE IF EXISTS \`${table}\``);
                console.log(`Table supprimée: ${table}`);
                success++;
            } catch (err) {
                console.log(`Échec suppression: ${table} → ${err.message}`);
                failed.push(table);
            }
        }
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log(`\nRésumé : ${success} supprimée(s), ${failed.length} échec(s)`);
        if (failed.length) {
            console.log(` Tables non supprimées :\n- ${failed.join('\n- ')}`);
        } else {
            console.log('Destruction complète réussie.');
        }

    } catch (err) {
        console.error('Erreur critique :', err.message);
    } finally {
        await connection.end();
        rl.close();
    }
});
