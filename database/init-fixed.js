// database/init-fixed.js
import { query } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase() {
    try {
        console.log('🔧 Initialisation avec méthode alternative...');

        // Manuellement définir les requêtes SQL basées sur ton schema
        const sqlQueries = [
            `CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(191) PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('ETUDIANT', 'ADMIN') NOT NULL DEFAULT 'ADMIN',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                actif BOOLEAN DEFAULT TRUE,
                tempPassword VARCHAR(255),
                requirePasswordChange BOOLEAN DEFAULT FALSE,
                passwordResetExpires DATETIME,
                INDEX idx_users_email (email),
                INDEX idx_users_role (role),
                INDEX idx_users_actif (actif)
            ) ENGINE=InnoDB`,

            `CREATE TABLE IF NOT EXISTS etudiants (
                id INT AUTO_INCREMENT PRIMARY KEY,
                userId VARCHAR(191) UNIQUE,
                matricule VARCHAR(50) UNIQUE,
                codeInscription VARCHAR(50) UNIQUE,
                identifiantTemporaire VARCHAR(50) UNIQUE,
                nom VARCHAR(100),
                prenom VARCHAR(100),
                filiere VARCHAR(100),
                annee INT,
                photoUrl VARCHAR(500),
                ecole VARCHAR(100),
                CONSTRAINT fk_etudiant_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_etudiants_userId (userId),
                INDEX idx_etudiants_matricule (matricule),
                INDEX idx_etudiants_filiere (filiere),
                INDEX idx_etudiants_ecole (ecole)
            ) ENGINE=InnoDB`,

            `CREATE TABLE IF NOT EXISTS elections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type ENUM('SALLE', 'ECOLE', 'UNIVERSITE') NOT NULL,
                titre VARCHAR(200) NOT NULL,
                description TEXT,
                dateDebut DATETIME NOT NULL,
                dateFin DATETIME NOT NULL,
                dateDebutCandidature DATETIME NOT NULL,
                dateFinCandidature DATETIME NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                filiere VARCHAR(100),
                annee INT,
                ecole VARCHAR(100),
                niveau ENUM('PHASE1', 'PHASE2', 'PHASE3'),
                delegueType ENUM('PREMIER', 'DEUXIEME'),
                isActive BOOLEAN DEFAULT TRUE,
                INDEX idx_elections_type (type),
                INDEX idx_elections_dates (dateDebut, dateFin),
                INDEX idx_elections_candidature_dates (dateDebutCandidature, dateFinCandidature),
                INDEX idx_elections_active (isActive),
                INDEX idx_elections_filiere (filiere),
                INDEX idx_elections_ecole (ecole)
            ) ENGINE=InnoDB`,

            `CREATE TABLE IF NOT EXISTS candidates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nom VARCHAR(100) NOT NULL,
                prenom VARCHAR(100) NOT NULL,
                slogan VARCHAR(200) NOT NULL,
                programme TEXT NOT NULL,
                motivation TEXT NOT NULL,
                photoUrl VARCHAR(500) NOT NULL,
                statut ENUM('EN_ATTENTE', 'APPROUVE', 'REJETE') DEFAULT 'EN_ATTENTE',
                userId VARCHAR(191) NOT NULL,
                electionId INT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_candidate_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_candidate_election FOREIGN KEY (electionId) REFERENCES elections(id) ON DELETE CASCADE,
                UNIQUE(userId, electionId),
                INDEX idx_candidates_statut (statut),
                INDEX idx_candidates_election (electionId),
                INDEX idx_candidates_user (userId)
            ) ENGINE=InnoDB`,

            `CREATE TABLE IF NOT EXISTS votes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                userId VARCHAR(191) NOT NULL,
                electionId INT NOT NULL,
                candidateId INT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                poidsVote FLOAT NOT NULL,
                CONSTRAINT fk_vote_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_vote_election FOREIGN KEY (electionId) REFERENCES elections(id) ON DELETE CASCADE,
                CONSTRAINT fk_vote_candidate FOREIGN KEY (candidateId) REFERENCES candidates(id) ON DELETE CASCADE,
                UNIQUE(userId, electionId),
                INDEX idx_votes_election (electionId),
                INDEX idx_votes_candidate (candidateId),
                INDEX idx_votes_user (userId),
                INDEX idx_votes_created (createdAt)
            ) ENGINE=InnoDB`
        ];

        console.log(`📋 ${sqlQueries.length} requêtes à exécuter...`);

        for (let i = 0; i < sqlQueries.length; i++) {
            try {
                console.log(`\n➡️ [${i + 1}/${sqlQueries.length}] Exécution...`);
                await query(sqlQueries[i]);
                console.log(`✅ Table créée avec succès`);
            } catch (error) {
                console.error(`❌ Erreur:`, error.message);
            }
        }

        // Vérification finale
        const tables = await query('SHOW TABLES;');
        console.log(`\n🎉 ${tables.length} tables créées avec succès!`);
        tables.forEach((table, index) => {
            console.log(`${index + 1}. ${Object.values(table)[0]}`);
        });

    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error.message);
        throw error;
    }
}

// Exécuter
initializeDatabase()
    .then(() => {
        console.log('\n✅ Initialisation terminée avec succès!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Initialisation échouée:', error.message);
        process.exit(1);
    });