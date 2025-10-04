SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

CREATE TABLE activity_logs (
  id int(11) NOT NULL,
  action varchar(100) NOT NULL,
  details text DEFAULT NULL,
  userId varchar(191) DEFAULT NULL,
  actionType varchar(20) DEFAULT 'INFO',
  createdAt datetime DEFAULT current_timestamp(),
  module varchar(50) DEFAULT 'SYSTEM'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE admins (
  id int(11) NOT NULL,
  userId varchar(191) NOT NULL,
  nom varchar(100) NOT NULL,
  prenom varchar(100) NOT NULL,
  poste varchar(100) NOT NULL,
  createdAt datetime DEFAULT current_timestamp(),
  updatedAt datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE candidates (
  id int(11) NOT NULL,
  nom varchar(100) NOT NULL,
  prenom varchar(100) NOT NULL,
  slogan varchar(200) NOT NULL,
  programme text NOT NULL,
  motivation text NOT NULL,
  photoUrl varchar(500) NOT NULL,
  statut enum('EN_ATTENTE','APPROUVE','REJETE') DEFAULT 'EN_ATTENTE',
  userId varchar(191) NOT NULL,
  electionId int(11) NOT NULL,
  createdAt datetime DEFAULT current_timestamp(),
  updatedAt datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE delegues_ecole (
  id int(11) NOT NULL,
  responsableId int(11) NOT NULL,
  typeDelegue enum('PREMIER','DEUXIEME') NOT NULL,
  ecole varchar(100) NOT NULL,
  createdAt datetime DEFAULT current_timestamp(),
  ecoleId int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE delegues_universite (
  id int(11) NOT NULL,
  delegueEcoleId int(11) NOT NULL,
  typeDelegue enum('PREMIER','DEUXIEME') NOT NULL,
  createdAt datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE ecoles (
  id int(11) NOT NULL,
  nom varchar(100) NOT NULL,
  actif tinyint(1) DEFAULT 1,
  createdAt datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE elections (
  id int(11) NOT NULL,
  type enum('SALLE','ECOLE','UNIVERSITE') NOT NULL,
  titre varchar(200) NOT NULL,
  description text DEFAULT NULL,
  dateDebut datetime NOT NULL,
  dateFin datetime NOT NULL,
  dateDebutCandidature datetime NOT NULL,
  dateFinCandidature datetime NOT NULL,
  createdAt datetime DEFAULT current_timestamp(),
  annee int(11) DEFAULT NULL,
  niveau enum('PHASE1','PHASE2','PHASE3') DEFAULT NULL,
  delegueType enum('PREMIER','DEUXIEME') DEFAULT NULL,
  isActive tinyint(1) DEFAULT 1,
  resultsVisibility varchar(20) DEFAULT 'IMMEDIATE',
  tour int(11) DEFAULT 1,
  ecoleId int(11) DEFAULT NULL,
  filiereId int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE election_rounds (
  id int(11) NOT NULL,
  electionId int(11) NOT NULL,
  roundNumber int(11) NOT NULL DEFAULT 1,
  parentRoundId int(11) DEFAULT NULL,
  status enum('ACTIVE','COMPLETED','CANCELLED') DEFAULT 'ACTIVE',
  dateDebut datetime NOT NULL,
  dateFin datetime NOT NULL,
  candidates longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(candidates)),
  results longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(results)),
  createdAt datetime DEFAULT current_timestamp(),
  updatedAt datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE etudiants (
  id int(11) NOT NULL,
  userId varchar(191) DEFAULT NULL,
  matricule varchar(50) DEFAULT NULL,
  codeInscription varchar(50) DEFAULT NULL,
  identifiantTemporaire varchar(50) DEFAULT NULL,
  nom varchar(100) DEFAULT NULL,
  prenom varchar(100) DEFAULT NULL,
  annee int(11) DEFAULT NULL,
  photoUrl varchar(500) DEFAULT NULL,
  ecoleId int(11) DEFAULT NULL,
  filiereId int(11) DEFAULT NULL,
  whatsapp varchar(30) DEFAULT NULL,
  additional_info text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
-- Table des activités
CREATE TABLE activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  actif TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table des sous-activités
CREATE TABLE subactivities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_id INT NOT NULL,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  actif TINYINT(1) DEFAULT 1,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table de liaison étudiant-activité
CREATE TABLE student_activities (
  student_id INT NOT NULL,
  activity_id INT NOT NULL,
  PRIMARY KEY (student_id, activity_id),
  FOREIGN KEY (student_id) REFERENCES etudiants(id) ON DELETE CASCADE,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table de liaison étudiant-sous-activité
CREATE TABLE student_subactivities (
  student_id INT NOT NULL,
  activity_id INT NOT NULL,
  subactivity_id INT NOT NULL,
  PRIMARY KEY (student_id, activity_id, subactivity_id),
  FOREIGN KEY (student_id) REFERENCES etudiants(id) ON DELETE CASCADE,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  FOREIGN KEY (subactivity_id) REFERENCES subactivities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE filieres (
  id int(11) NOT NULL,
  nom varchar(100) NOT NULL,
  ecoleId int(11) NOT NULL,
  actif tinyint(1) DEFAULT 1,
  createdAt datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE notifications (
  id varchar(191) NOT NULL,
  title varchar(200) NOT NULL,
  message text NOT NULL,
  type varchar(50) NOT NULL,
  priority varchar(20) NOT NULL,
  is_read tinyint(1) DEFAULT 0,
  relatedEntity varchar(100) DEFAULT NULL,
  entityId varchar(50) DEFAULT NULL,
  userId varchar(191) NOT NULL,
  createdAt datetime DEFAULT current_timestamp(),
  updatedAt datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE registration_codes (
  id varchar(191) NOT NULL,
  code varchar(50) NOT NULL,
  createdAt datetime DEFAULT current_timestamp(),
  expiresAt datetime NOT NULL,
  used tinyint(1) DEFAULT 0,
  usedAt datetime DEFAULT NULL,
  generatedBy varchar(191) NOT NULL,
  usedBy varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE responsables_salle (
  id int(11) NOT NULL,
  etudiantId int(11) NOT NULL,
  annee int(11) NOT NULL,
  createdAt datetime DEFAULT current_timestamp(),
  ecoleId int(11) DEFAULT NULL,
  filiereId int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE users (
  id varchar(191) NOT NULL,
  email varchar(255) NOT NULL,
  password varchar(255) NOT NULL,
  role enum('ETUDIANT','ADMIN') NOT NULL DEFAULT 'ADMIN',
  createdAt datetime DEFAULT current_timestamp(),
  actif tinyint(1) DEFAULT 1,
  tempPassword varchar(255) DEFAULT NULL,
  requirePasswordChange tinyint(1) DEFAULT 0,
  passwordResetExpires datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE votes (
  id int(11) NOT NULL,
  userId varchar(191) NOT NULL,
  electionId int(11) NOT NULL,
  candidateId int(11) NOT NULL,
  createdAt datetime DEFAULT current_timestamp(),
  poidsVote float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE vote_tokens (
  id int(11) NOT NULL,
  token varchar(255) NOT NULL,
  userId varchar(191) NOT NULL,
  electionId int(11) NOT NULL,
  isUsed tinyint(1) DEFAULT 0,
  createdAt datetime DEFAULT current_timestamp(),
  expiresAt datetime NOT NULL,
  usedAt datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE vote_transfers (
  id int(11) NOT NULL,
  roundId int(11) NOT NULL,
  sourceCandidateId int(11) NOT NULL,
  targetCandidateId int(11) NOT NULL,
  votesTransferred int(11) NOT NULL,
  transferType enum('AUTO','MANUAL') DEFAULT 'AUTO',
  createdAt datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE activity_logs
  ADD PRIMARY KEY (id),
  ADD KEY idx_activitylogs_user (userId),
  ADD KEY idx_activitylogs_actionType (actionType),
  ADD KEY idx_activitylogs_created (createdAt);

ALTER TABLE admins
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY userId (userId),
  ADD KEY idx_admins_user (userId);

ALTER TABLE candidates
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY userId (userId,electionId),
  ADD KEY idx_candidates_statut (statut),
  ADD KEY idx_candidates_election (electionId),
  ADD KEY idx_candidates_user (userId);

ALTER TABLE delegues_ecole
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY responsableId (responsableId,typeDelegue,ecole),
  ADD KEY idx_delegues_ecole_type (typeDelegue),
  ADD KEY idx_delegues_ecole_ecole (ecole),
  ADD KEY idx_delegues_ecole_ecoleId (ecoleId);

ALTER TABLE delegues_universite
  ADD PRIMARY KEY (id),
  ADD KEY fk_delegue_ecole (delegueEcoleId),
  ADD KEY idx_delegues_univ_type (typeDelegue);

ALTER TABLE ecoles
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY nom (nom);

ALTER TABLE elections
  ADD PRIMARY KEY (id),
  ADD KEY idx_elections_type (type),
  ADD KEY idx_elections_dates (dateDebut,dateFin),
  ADD KEY idx_elections_candidature_dates (dateDebutCandidature,dateFinCandidature),
  ADD KEY idx_elections_active (isActive),
  ADD KEY idx_elections_ecoleId (ecoleId),
  ADD KEY idx_elections_filiereId (filiereId);

ALTER TABLE election_rounds
  ADD PRIMARY KEY (id),
  ADD KEY fk_election_rounds_parent (parentRoundId),
  ADD KEY idx_election_rounds_election (electionId),
  ADD KEY idx_election_rounds_status (status);

ALTER TABLE etudiants
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY userId (userId),
  ADD UNIQUE KEY matricule (matricule),
  ADD UNIQUE KEY codeInscription (codeInscription),
  ADD UNIQUE KEY identifiantTemporaire (identifiantTemporaire),
  ADD KEY idx_etudiants_userId (userId),
  ADD KEY idx_etudiants_matricule (matricule),
  ADD KEY idx_etudiants_ecoleId (ecoleId),
  ADD KEY idx_etudiants_filiereId (filiereId);

ALTER TABLE filieres
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY nom (nom,ecoleId),
  ADD KEY fk_filiere_ecole (ecoleId);

ALTER TABLE notifications
  ADD PRIMARY KEY (id),
  ADD KEY idx_notifications_userId (userId),
  ADD KEY idx_notifications_read (is_read),
  ADD KEY idx_notifications_createdAt (createdAt),
  ADD KEY idx_notifications_user_read (userId,is_read),
  ADD KEY idx_notifications_type (type),
  ADD KEY idx_notifications_priority (priority);

ALTER TABLE registration_codes
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY code (code),
  ADD UNIQUE KEY usedBy (usedBy),
  ADD KEY idx_regcodes_code (code),
  ADD KEY idx_regcodes_used (used),
  ADD KEY idx_regcodes_expires (expiresAt),
  ADD KEY idx_regcodes_generated (generatedBy);

ALTER TABLE responsables_salle
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY etudiantId (etudiantId,annee),
  ADD KEY idx_responsables_annee (annee),
  ADD KEY idx_resps_ecoleId (ecoleId),
  ADD KEY idx_resps_filiereId (filiereId);

ALTER TABLE users
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY email (email),
  ADD KEY idx_users_email (email),
  ADD KEY idx_users_role (role),
  ADD KEY idx_users_actif (actif);

ALTER TABLE votes
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY userId (userId,electionId),
  ADD KEY idx_votes_election (electionId),
  ADD KEY idx_votes_candidate (candidateId),
  ADD KEY idx_votes_user (userId),
  ADD KEY idx_votes_created (createdAt);

ALTER TABLE vote_tokens
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY token (token),
  ADD UNIQUE KEY userId (userId,electionId),
  ADD KEY fk_votetoken_election (electionId),
  ADD KEY idx_votetokens_token (token),
  ADD KEY idx_votetokens_used (isUsed),
  ADD KEY idx_votetokens_expires (expiresAt),
  ADD KEY idx_votetokens_user_election (userId,electionId);

ALTER TABLE vote_transfers
  ADD PRIMARY KEY (id),
  ADD KEY fk_vote_transfers_source (sourceCandidateId),
  ADD KEY fk_vote_transfers_target (targetCandidateId),
  ADD KEY idx_vote_transfers_round (roundId);

ALTER TABLE activity_logs
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE admins
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE candidates
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE delegues_ecole
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE delegues_universite
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE ecoles
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE elections
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE election_rounds
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE etudiants
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE filieres
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE responsables_salle
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE votes
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE vote_tokens
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE vote_transfers
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE activity_logs
  ADD CONSTRAINT fk_log_user FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE admins
  ADD CONSTRAINT fk_admin_user FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE candidates
  ADD CONSTRAINT fk_candidate_election FOREIGN KEY (electionId) REFERENCES elections (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_candidate_user FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE delegues_ecole
  ADD CONSTRAINT fk_delegue_responsable FOREIGN KEY (responsableId) REFERENCES responsables_salle (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_delegues_ecole_ecoleId FOREIGN KEY (ecoleId) REFERENCES ecoles (id) ON DELETE SET NULL;

ALTER TABLE delegues_universite
  ADD CONSTRAINT fk_delegue_ecole FOREIGN KEY (delegueEcoleId) REFERENCES delegues_ecole (id) ON DELETE CASCADE;

ALTER TABLE elections
  ADD CONSTRAINT fk_elections_ecoleId FOREIGN KEY (ecoleId) REFERENCES ecoles (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_elections_filiereId FOREIGN KEY (filiereId) REFERENCES filieres (id) ON DELETE SET NULL;

ALTER TABLE election_rounds
  ADD CONSTRAINT fk_election_rounds_election FOREIGN KEY (electionId) REFERENCES elections (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_election_rounds_parent FOREIGN KEY (parentRoundId) REFERENCES election_rounds (id) ON DELETE SET NULL;

ALTER TABLE etudiants
  ADD CONSTRAINT fk_etudiant_user FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_etudiants_ecoleId FOREIGN KEY (ecoleId) REFERENCES ecoles (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_etudiants_filiereId FOREIGN KEY (filiereId) REFERENCES filieres (id) ON DELETE SET NULL;

ALTER TABLE filieres
  ADD CONSTRAINT fk_filiere_ecole FOREIGN KEY (ecoleId) REFERENCES ecoles (id) ON DELETE CASCADE;

ALTER TABLE notifications
  ADD CONSTRAINT fk_notification_user FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE registration_codes
  ADD CONSTRAINT fk_regcode_generated FOREIGN KEY (generatedBy) REFERENCES users (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_regcode_used FOREIGN KEY (usedBy) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE responsables_salle
  ADD CONSTRAINT fk_responsable_etudiant FOREIGN KEY (etudiantId) REFERENCES etudiants (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_resps_ecoleId FOREIGN KEY (ecoleId) REFERENCES ecoles (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_resps_filiereId FOREIGN KEY (filiereId) REFERENCES filieres (id) ON DELETE SET NULL;

ALTER TABLE votes
  ADD CONSTRAINT fk_vote_candidate FOREIGN KEY (candidateId) REFERENCES candidates (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_vote_election FOREIGN KEY (electionId) REFERENCES elections (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_vote_user FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE vote_tokens
  ADD CONSTRAINT fk_votetoken_election FOREIGN KEY (electionId) REFERENCES elections (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_votetoken_user FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE vote_transfers
  ADD CONSTRAINT fk_vote_transfers_round FOREIGN KEY (roundId) REFERENCES election_rounds (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_vote_transfers_source FOREIGN KEY (sourceCandidateId) REFERENCES candidates (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_vote_transfers_target FOREIGN KEY (targetCandidateId) REFERENCES candidates (id) ON DELETE CASCADE;

COMMIT;
