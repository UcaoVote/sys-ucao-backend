/**
 * Script de test pour vérifier les données dans la base de données
 * Exécuter avec: node test-db-data.js
 */

import db from './database/dbconfig.js';

async function testDatabaseData() {
    console.log('\n🔍 VÉRIFICATION DES DONNÉES DE LA BASE DE DONNÉES\n');
    console.log('='.repeat(60));

    try {
        // 1. Test de connexion
        console.log('\n1️⃣ Test de connexion à la base de données...');
        await db.execute('SELECT 1 as test');
        console.log('✅ Connexion réussie\n');

        // 2. Compter les utilisateurs
        console.log('2️⃣ Vérification des UTILISATEURS...');
        const [users] = await db.execute('SELECT COUNT(*) as total FROM users');
        console.log(`   📊 Nombre total d'utilisateurs: ${users[0].total}`);

        const [usersByRole] = await db.execute(`
            SELECT role, COUNT(*) as count 
            FROM users 
            GROUP BY role
        `);
        console.log('   📋 Par rôle:');
        usersByRole.forEach(row => {
            console.log(`      - ${row.role}: ${row.count}`);
        });

        // 3. Compter les étudiants
        console.log('\n3️⃣ Vérification des ÉTUDIANTS...');
        const [students] = await db.execute('SELECT COUNT(*) as total FROM etudiants');
        console.log(`   📊 Nombre total d'étudiants: ${students[0].total}`);

        const [studentsActive] = await db.execute(`
            SELECT 
                e.actif,
                COUNT(*) as count 
            FROM etudiants e
            GROUP BY e.actif
        `);
        console.log('   📋 Par statut:');
        studentsActive.forEach(row => {
            console.log(`      - ${row.actif ? 'Actif' : 'Inactif'}: ${row.count}`);
        });

        // 4. Compter les élections
        console.log('\n4️⃣ Vérification des ÉLECTIONS...');
        const [elections] = await db.execute('SELECT COUNT(*) as total FROM elections');
        console.log(`   📊 Nombre total d'élections: ${elections[0].total}`);

        const [electionsByType] = await db.execute(`
            SELECT 
                type,
                isActive,
                COUNT(*) as count 
            FROM elections 
            GROUP BY type, isActive
        `);
        console.log('   📋 Par type et statut:');
        electionsByType.forEach(row => {
            console.log(`      - ${row.type} (${row.isActive ? 'Active' : 'Inactive'}): ${row.count}`);
        });

        // 5. Lister quelques élections
        if (elections[0].total > 0) {
            console.log('\n5️⃣ Détails de quelques ÉLECTIONS:');
            const [electionsList] = await db.execute(`
                SELECT 
                    id,
                    titre,
                    type,
                    niveau,
                    isActive,
                    dateDebut,
                    dateFin
                FROM elections 
                LIMIT 5
            `);
            electionsList.forEach(election => {
                console.log(`   📋 [${election.id}] ${election.titre}`);
                console.log(`      Type: ${election.type} | Niveau: ${election.niveau}`);
                console.log(`      Active: ${election.isActive ? 'Oui' : 'Non'}`);
                console.log(`      Dates: ${election.dateDebut} → ${election.dateFin}`);
            });
        }

        // 6. Compter les candidats
        console.log('\n6️⃣ Vérification des CANDIDATS...');
        const [candidates] = await db.execute('SELECT COUNT(*) as total FROM candidates');
        console.log(`   📊 Nombre total de candidats: ${candidates[0].total}`);

        // 7. Vérifier les écoles
        console.log('\n7️⃣ Vérification des ÉCOLES...');
        const [ecoles] = await db.execute('SELECT COUNT(*) as total FROM ecoles');
        console.log(`   📊 Nombre total d\'écoles: ${ecoles[0].total}`);

        const [ecolesList] = await db.execute(`
            SELECT id, nom, code, actif 
            FROM ecoles
        `);
        console.log('   📋 Liste des écoles:');
        ecolesList.forEach(ecole => {
            console.log(`      - [${ecole.id}] ${ecole.nom} (${ecole.code}) - ${ecole.actif ? 'Active' : 'Inactive'}`);
        });

        // 8. Vérifier les filières
        console.log('\n8️⃣ Vérification des FILIÈRES...');
        const [filieres] = await db.execute('SELECT COUNT(*) as total FROM filieres');
        console.log(`   📊 Nombre total de filières: ${filieres[0].total}`);

        console.log('\n' + '='.repeat(60));
        console.log('✅ Vérification terminée avec succès\n');

    } catch (error) {
        console.error('\n❌ ERREUR lors de la vérification:', error);
        console.error('Message:', error.message);
        console.error('SQL:', error.sql);
    } finally {
        await db.end();
        process.exit(0);
    }
}

// Exécuter le test
testDatabaseData();
