/**
 * Script pour nettoyer les URLs d'images cassées dans la base de données
 * Met à NULL les photoUrl qui pointent vers des fichiers inexistants
 */

import dotenv from 'dotenv';
import pool from './database/mysqlProxy.js';
import fetch from 'node-fetch';

dotenv.config();

async function checkImageExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function cleanupBrokenImages() {
    let connection;
    try {
        connection = await pool.getConnection();

        console.log('\n🔍 Recherche des images cassées...\n');

        // Vérifier les photos des candidats
        const [candidates] = await connection.execute(
            'SELECT id, nom, prenom, photoUrl FROM candidates WHERE photoUrl IS NOT NULL'
        );

        console.log(`📊 Total candidats avec photo: ${candidates.length}\n`);

        let brokenCount = 0;
        let validCount = 0;

        for (const candidate of candidates) {
            const exists = await checkImageExists(candidate.photoUrl);

            if (!exists) {
                console.log(`❌ Image cassée pour ${candidate.nom} ${candidate.prenom || ''}`);
                console.log(`   URL: ${candidate.photoUrl}`);

                // Mettre à NULL
                await connection.execute(
                    'UPDATE candidates SET photoUrl = NULL WHERE id = ?',
                    [candidate.id]
                );

                brokenCount++;
            } else {
                console.log(`✅ Image OK pour ${candidate.nom} ${candidate.prenom || ''}`);
                validCount++;
            }
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 RÉSUMÉ:');
        console.log(`   ✅ Images valides: ${validCount}`);
        console.log(`   ❌ Images cassées (nettoyées): ${brokenCount}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Vérifier les photos des étudiants
        console.log('🔍 Vérification des photos étudiants...\n');

        const [students] = await connection.execute(
            'SELECT COUNT(*) as count FROM etudiants WHERE photoUrl IS NOT NULL'
        );

        console.log(`📊 Total étudiants avec photo: ${students[0].count}\n`);

        if (students[0].count > 0) {
            console.log('💡 Pour nettoyer les photos étudiants aussi, ajoutez la logique similaire');
        }

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        console.error(error);
    } finally {
        if (connection) await connection.release();
        process.exit(0);
    }
}

// Exécuter le nettoyage
cleanupBrokenImages().catch(console.error);
