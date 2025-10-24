// database/init-working.js
import { query } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase() {
    try {
        console.log('🔧 Initialisation SMART de la base de données...');

        // Méthode 1: Essayer de lire le fichier SQL normalement
        const sqlPath = path.join(__dirname, 'schema.sql');
        let sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📊 Taille du fichier:', sql.length, 'caractères');

        // Méthode intelligente: extraire les commandes CREATE TABLE
        const createTableRegex = /CREATE TABLE [^;]*;/gi;
        const queries = sql.match(createTableRegex) || [];

        console.log(`📋 ${queries.length} commandes CREATE TABLE détectées`);

        if (queries.length === 0) {
            console.log('⚠️  Aucune commande CREATE TABLE trouvée, tentative manuelle...');
            // Liste manuelle des tables basée sur ton schéma
            queries.push(...getManualQueries());
        }

        console.log(`🚀 Exécution de ${queries.length} requêtes...`);

        for (let i = 0; i < queries.length; i++) {
            try {
                console.log(`\n➡️ [${i + 1}/${queries.length}] Création table...`);
                await query(queries[i]);
                console.log(`✅ Table créée`);
            } catch (error) {
                console.error(`❌ Erreur:`, error.message);
                // Continuer malgré les erreurs (tables déjà existantes, etc.)
            }
        }

        // Vérification finale
        const tables = await query('SHOW TABLES;');
        console.log(`\n🎉 ${tables.length} tables dans la base de données`);

        if (tables.length > 0) {
            console.log('📋 Liste des tables:');
            tables.forEach((table, index) => {
                console.log(`${index + 1}. ${Object.values(table)[0]}`);
            });
        }

    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error.message);
    }
}

function getManualQueries() {
    return [
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
        ) ENGINE=InnoDB`
    ];
}

// Exécuter
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    initializeDatabase()
        .then(() => {
            console.log('\n✅ Initialisation terminée!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Erreur:', error.message);
            process.exit(1);
        });
}

export default initializeDatabase;