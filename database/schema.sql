-- USERS
CREATE TABLE users (
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
) ENGINE=InnoDB;

-- ETUDIANTS
CREATE TABLE etudiants (
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
) ENGINE=InnoDB;

-- ELECTIONS
CREATE TABLE elections (
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
) ENGINE=InnoDB;

-- CANDIDATES
CREATE TABLE candidates (
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
) ENGINE=InnoDB;

-- VOTES
CREATE TABLE votes (
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
) ENGINE=InnoDB;

-- RESPONSABLES SALLE
CREATE TABLE responsables_salle (
    id INT AUTO_INCREMENT PRIMARY KEY,
    etudiantId INT NOT NULL,
    filiere VARCHAR(100) NOT NULL,
    annee INT NOT NULL,
    ecole VARCHAR(100) NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_responsable_etudiant FOREIGN KEY (etudiantId) REFERENCES etudiants(id) ON DELETE CASCADE,
    UNIQUE(etudiantId, annee),
    INDEX idx_responsables_filiere (filiere),
    INDEX idx_responsables_ecole (ecole),
    INDEX idx_responsables_annee (annee)
) ENGINE=InnoDB;

-- DELEGUES ECOLE
CREATE TABLE delegues_ecole (
    id INT AUTO_INCREMENT PRIMARY KEY,
    responsableId INT NOT NULL,
    typeDelegue ENUM('PREMIER', 'DEUXIEME') NOT NULL,
    ecole VARCHAR(100) NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_delegue_responsable FOREIGN KEY (responsableId) REFERENCES responsables_salle(id) ON DELETE CASCADE,
    UNIQUE(responsableId, typeDelegue, ecole),
    INDEX idx_delegues_ecole_type (typeDelegue),
    INDEX idx_delegues_ecole_ecole (ecole)
) ENGINE=InnoDB;

-- DELEGUES UNIVERSITE
CREATE TABLE delegues_universite (
    id INT AUTO_INCREMENT PRIMARY KEY,
    delegueEcoleId INT NOT NULL,
    typeDelegue ENUM('PREMIER', 'DEUXIEME') NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_delegue_ecole FOREIGN KEY (delegueEcoleId) REFERENCES delegues_ecole(id) ON DELETE CASCADE,
    INDEX idx_delegues_univ_type (typeDelegue)
) ENGINE=InnoDB;

-- ADMINS (sans email - évitons la redondance)
CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId VARCHAR(191) UNIQUE NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    poste VARCHAR(100) NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_admins_user (userId)
) ENGINE=InnoDB;

-- REGISTRATION CODES
CREATE TABLE registration_codes (
    id VARCHAR(191) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    expiresAt DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    usedAt DATETIME,
    generatedBy VARCHAR(191) NOT NULL,
    usedBy VARCHAR(191) UNIQUE,
    CONSTRAINT fk_regcode_generated FOREIGN KEY (generatedBy) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_regcode_used FOREIGN KEY (usedBy) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_regcodes_code (code),
    INDEX idx_regcodes_used (used),
    INDEX idx_regcodes_expires (expiresAt),
    INDEX idx_regcodes_generated (generatedBy)
) ENGINE=InnoDB;

-- VOTE TOKENS
CREATE TABLE vote_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    userId VARCHAR(191) NOT NULL,
    electionId INT NOT NULL,
    isUsed BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    expiresAt DATETIME NOT NULL,
    usedAt DATETIME,
    CONSTRAINT fk_votetoken_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_votetoken_election FOREIGN KEY (electionId) REFERENCES elections(id) ON DELETE CASCADE,
    UNIQUE(userId, electionId),
    INDEX idx_votetokens_token (token),
    INDEX idx_votetokens_used (isUsed),
    INDEX idx_votetokens_expires (expiresAt),
    INDEX idx_votetokens_user_election (userId, electionId)
) ENGINE=InnoDB;

-- ACTIVITY LOGS
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    userId VARCHAR(191),
    actionType VARCHAR(20) DEFAULT 'INFO',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_activitylogs_user (userId),
    INDEX idx_activitylogs_actionType (actionType),
    INDEX idx_activitylogs_created (createdAt)
) ENGINE=InnoDB;

-- NOTIFICATIONS
CREATE TABLE notifications (
    id VARCHAR(191) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    relatedEntity VARCHAR(100),
    entityId VARCHAR(50),
    userId VARCHAR(191) NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_notification_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_userId (userId),
    INDEX idx_notifications_read (read),
    INDEX idx_notifications_createdAt (createdAt),
    INDEX idx_notifications_user_read (userId, read),
    INDEX idx_notifications_type (type),
    INDEX idx_notifications_priority (priority)
) ENGINE=InnoDB;