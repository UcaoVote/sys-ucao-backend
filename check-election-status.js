/**
 * Script de diagnostic pour vérifier l'état des élections
 * Vérifie les colonnes : isActive, resultsVisibility, resultsPublished
 */

import dotenv from 'dotenv';
import pool from './database/mysqlProxy.js';

dotenv.config();

async function checkElectionStatus() {
    let connection;
    try {
        connection = await pool.getConnection();

        console.log('\n🔍 Vérification de l\'état des élections...\n');

        // Récupérer toutes les élections
        const [elections] = await connection.execute(`
            SELECT 
                id,
                titre,
                type,
                niveau,
                isActive,
                resultsVisibility,
                resultsPublished,
                dateDebut,
                dateFin,
                createdAt
            FROM elections
            ORDER BY id DESC
            LIMIT 10
        `);

        if (elections.length === 0) {
            console.log('❌ Aucune élection trouvée dans la base de données');
            return;
        }

        console.log(`📊 Total élections trouvées : ${elections.length}\n`);

        elections.forEach((election) => {
            const now = new Date();
            const endDate = new Date(election.dateFin);
            const isCompleted = endDate < now;

            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`🆔 ID: ${election.id}`);
            console.log(`📋 Titre: ${election.titre}`);
            console.log(`🔖 Type: ${election.type} | Niveau: ${election.niveau || 'N/A'}`);
            console.log(`🎯 Active: ${election.isActive ? '✅ OUI' : '❌ NON'}`);
            console.log(`👁️  Visibilité: ${election.resultsVisibility}`);
            console.log(`📢 Résultats publiés: ${election.resultsPublished ? '✅ OUI' : '❌ NON'}`);
            console.log(`📅 Début: ${new Date(election.dateDebut).toLocaleString('fr-FR')}`);
            console.log(`📅 Fin: ${new Date(election.dateFin).toLocaleString('fr-FR')}`);
            console.log(`⏱️  Statut: ${isCompleted ? '✅ Terminée' : '⏳ En cours/À venir'}`);

            // Diagnostic pour l'affichage des résultats
            console.log('\n🔐 Analyse d\'affichage des résultats:');

            if (election.isActive) {
                console.log('   ❌ Résultats NON affichables (élection encore active)');
            } else if (election.resultsVisibility === 'IMMEDIATE') {
                console.log('   ✅ Résultats affichables (visibilité IMMEDIATE)');
            } else if (election.resultsVisibility === 'MANUAL' && election.resultsPublished) {
                console.log('   ✅ Résultats affichables (MANUAL + publiés)');
            } else if (election.resultsVisibility === 'MANUAL' && !election.resultsPublished) {
                console.log('   ❌ Résultats NON affichables (MANUAL + non publiés)');
                console.log('   💡 Solution: L\'admin doit publier les résultats');
            } else {
                console.log('   ❌ Résultats NON affichables (conditions non remplies)');
            }
            console.log('');
        });

        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        // Résumé des élections terminées non publiées
        const completedNotPublished = elections.filter(e => {
            const endDate = new Date(e.dateFin);
            return endDate < new Date() &&
                !e.isActive &&
                e.resultsVisibility === 'MANUAL' &&
                !e.resultsPublished;
        });

        if (completedNotPublished.length > 0) {
            console.log('⚠️  ÉLECTIONS TERMINÉES MAIS NON PUBLIÉES:');
            completedNotPublished.forEach(e => {
                console.log(`   - ID ${e.id}: "${e.titre}" (${e.type})`);
            });
            console.log('\n💡 Ces élections nécessitent une publication manuelle par l\'admin\n');
        }

        // Vérifier spécifiquement l'élection ID 4
        const election4 = elections.find(e => e.id === 4);
        if (election4) {
            console.log('🎯 ÉLECTION ID 4 (problème 403):');
            console.log(`   Titre: ${election4.titre}`);
            console.log(`   Active: ${election4.isActive}`);
            console.log(`   Visibilité: ${election4.resultsVisibility}`);
            console.log(`   Publiée: ${election4.resultsPublished}`);

            if (election4.resultsVisibility === 'MANUAL' && !election4.resultsPublished) {
                console.log('   🔴 PROBLÈME IDENTIFIÉ: Résultats non publiés !');
                console.log('   📋 Solution: Utiliser la page admin pour publier les résultats');
            }
        }
    } catch (error) {
        console.error('❌ Erreur lors de la vérification:', error.message);
        console.error(error);
    } finally {
        if (connection) await connection.release();
        // pool.end() n'existe pas avec mysqlProxy
        process.exit(0);
    }
}

// Exécuter la vérification
checkElectionStatus().catch(console.error);
