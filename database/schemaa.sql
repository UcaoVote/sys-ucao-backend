/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

DROP TABLE IF EXISTS `activities`;
CREATE TABLE `activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL,
  `description` text,
  `actif` tinyint(1) DEFAULT '1',
  `icone` varchar(255) DEFAULT NULL,
  `has_subactivities` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `action` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `details` text COLLATE utf8mb4_general_ci,
  `userId` varchar(191) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `actionType` varchar(20) COLLATE utf8mb4_general_ci DEFAULT 'INFO',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `module` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'SYSTEM',
  PRIMARY KEY (`id`),
  KEY `idx_activitylogs_user` (`userId`),
  KEY `idx_activitylogs_actionType` (`actionType`),
  KEY `idx_activitylogs_created` (`createdAt`),
  CONSTRAINT `fk_log_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `admins`;
CREATE TABLE `admins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` varchar(191) COLLATE utf8mb4_general_ci NOT NULL,
  `nom` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `prenom` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `poste` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `userId` (`userId`),
  KEY `idx_admins_user` (`userId`),
  CONSTRAINT `fk_admin_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `candidates`;
CREATE TABLE `candidates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `prenom` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `slogan` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `programme` text COLLATE utf8mb4_general_ci NOT NULL,
  `motivation` text COLLATE utf8mb4_general_ci NOT NULL,
  `photoUrl` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `statut` enum('EN_ATTENTE','APPROUVE','REJETE') COLLATE utf8mb4_general_ci DEFAULT 'EN_ATTENTE',
  `userId` varchar(191) COLLATE utf8mb4_general_ci NOT NULL,
  `electionId` int NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `userId` (`userId`,`electionId`),
  KEY `idx_candidates_statut` (`statut`),
  KEY `idx_candidates_election` (`electionId`),
  KEY `idx_candidates_user` (`userId`),
  CONSTRAINT `fk_candidate_election` FOREIGN KEY (`electionId`) REFERENCES `elections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_candidate_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `delegues_ecole`;
CREATE TABLE `delegues_ecole` (
  `id` int NOT NULL AUTO_INCREMENT,
  `responsableId` int NOT NULL,
  `typeDelegue` enum('PREMIER','DEUXIEME') COLLATE utf8mb4_general_ci NOT NULL,
  `ecole` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `ecoleId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `responsableId` (`responsableId`,`typeDelegue`,`ecole`),
  KEY `idx_delegues_ecole_type` (`typeDelegue`),
  KEY `idx_delegues_ecole_ecole` (`ecole`),
  KEY `idx_delegues_ecole_ecoleId` (`ecoleId`),
  CONSTRAINT `fk_delegue_responsable` FOREIGN KEY (`responsableId`) REFERENCES `responsables_salle` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_delegues_ecole_ecoleId` FOREIGN KEY (`ecoleId`) REFERENCES `ecoles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `delegues_universite`;
CREATE TABLE `delegues_universite` (
  `id` int NOT NULL AUTO_INCREMENT,
  `delegueEcoleId` int NOT NULL,
  `typeDelegue` enum('PREMIER','DEUXIEME') COLLATE utf8mb4_general_ci NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_delegue_ecole` (`delegueEcoleId`),
  KEY `idx_delegues_univ_type` (`typeDelegue`),
  CONSTRAINT `fk_delegue_ecole` FOREIGN KEY (`delegueEcoleId`) REFERENCES `delegues_ecole` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `ecoles`;
CREATE TABLE `ecoles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `actif` tinyint(1) DEFAULT '1',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nom` (`nom`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `election_results`;
CREATE TABLE `election_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `electionId` int NOT NULL,
  `candidateId` int NOT NULL,
  `roundNumber` int DEFAULT '1',
  `votes` int NOT NULL,
  `pourcentage` float DEFAULT '0',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `isWinner` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `electionId` (`electionId`),
  KEY `candidateId` (`candidateId`),
  CONSTRAINT `election_results_ibfk_1` FOREIGN KEY (`electionId`) REFERENCES `elections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `election_results_ibfk_2` FOREIGN KEY (`candidateId`) REFERENCES `candidates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `election_rounds`;
CREATE TABLE `election_rounds` (
  `id` int NOT NULL AUTO_INCREMENT,
  `electionId` int NOT NULL,
  `roundNumber` int NOT NULL DEFAULT '1',
  `parentRoundId` int DEFAULT NULL,
  `status` enum('ACTIVE','COMPLETED','CANCELLED') COLLATE utf8mb4_general_ci DEFAULT 'ACTIVE',
  `dateDebut` datetime NOT NULL,
  `dateFin` datetime NOT NULL,
  `candidates` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `results` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_election_rounds_parent` (`parentRoundId`),
  KEY `idx_election_rounds_election` (`electionId`),
  KEY `idx_election_rounds_status` (`status`),
  CONSTRAINT `fk_election_rounds_election` FOREIGN KEY (`electionId`) REFERENCES `elections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_election_rounds_parent` FOREIGN KEY (`parentRoundId`) REFERENCES `election_rounds` (`id`) ON DELETE SET NULL,
  CONSTRAINT `election_rounds_chk_1` CHECK (json_valid(`candidates`)),
  CONSTRAINT `election_rounds_chk_2` CHECK (json_valid(`results`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `elections`;
CREATE TABLE `elections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` enum('SALLE','ECOLE','UNIVERSITE') COLLATE utf8mb4_general_ci NOT NULL,
  `titre` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `dateDebut` datetime NOT NULL,
  `dateFin` datetime NOT NULL,
  `dateDebutCandidature` datetime NOT NULL,
  `dateFinCandidature` datetime NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `annee` int DEFAULT NULL,
  `niveau` enum('PHASE1','PHASE2','PHASE3') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `delegueType` enum('PREMIER','DEUXIEME') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `isActive` tinyint(1) DEFAULT '1',
  `resultsVisibility` varchar(20) COLLATE utf8mb4_general_ci DEFAULT 'IMMEDIATE',
  `tour` int DEFAULT '1',
  `ecoleId` int DEFAULT NULL,
  `filiereId` int DEFAULT NULL,
  `resultsPublished` tinyint(1) DEFAULT '0',
  `responsableType` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `publishedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_elections_type` (`type`),
  KEY `idx_elections_dates` (`dateDebut`,`dateFin`),
  KEY `idx_elections_candidature_dates` (`dateDebutCandidature`,`dateFinCandidature`),
  KEY `idx_elections_active` (`isActive`),
  KEY `idx_elections_ecoleId` (`ecoleId`),
  KEY `idx_elections_filiereId` (`filiereId`),
  CONSTRAINT `fk_elections_ecoleId` FOREIGN KEY (`ecoleId`) REFERENCES `ecoles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_elections_filiereId` FOREIGN KEY (`filiereId`) REFERENCES `filieres` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `etudiants`;
CREATE TABLE `etudiants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` varchar(191) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `matricule` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `codeInscription` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `identifiantTemporaire` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `nom` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `prenom` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `annee` int DEFAULT NULL,
  `photoUrl` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ecoleId` int DEFAULT NULL,
  `filiereId` int DEFAULT NULL,
  `whatsapp` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `additional_info` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `userId` (`userId`),
  UNIQUE KEY `matricule` (`matricule`),
  UNIQUE KEY `codeInscription` (`codeInscription`),
  UNIQUE KEY `identifiantTemporaire` (`identifiantTemporaire`),
  KEY `idx_etudiants_userId` (`userId`),
  KEY `idx_etudiants_matricule` (`matricule`),
  KEY `idx_etudiants_ecoleId` (`ecoleId`),
  KEY `idx_etudiants_filiereId` (`filiereId`),
  CONSTRAINT `fk_etudiant_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_etudiants_ecoleId` FOREIGN KEY (`ecoleId`) REFERENCES `ecoles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_etudiants_filiereId` FOREIGN KEY (`filiereId`) REFERENCES `filieres` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `filieres`;
CREATE TABLE `filieres` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `ecoleId` int NOT NULL,
  `actif` tinyint(1) DEFAULT '1',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nom` (`nom`,`ecoleId`),
  KEY `fk_filiere_ecole` (`ecoleId`),
  CONSTRAINT `fk_filiere_ecole` FOREIGN KEY (`ecoleId`) REFERENCES `ecoles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` varchar(191) COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `message` text COLLATE utf8mb4_general_ci NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `priority` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `relatedEntity` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entityId` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `userId` varchar(191) COLLATE utf8mb4_general_ci NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_userId` (`userId`),
  KEY `idx_notifications_read` (`is_read`),
  KEY `idx_notifications_createdAt` (`createdAt`),
  KEY `idx_notifications_user_read` (`userId`,`is_read`),
  KEY `idx_notifications_type` (`type`),
  KEY `idx_notifications_priority` (`priority`),
  CONSTRAINT `fk_notification_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `registration_codes`;
CREATE TABLE `registration_codes` (
  `id` varchar(191) COLLATE utf8mb4_general_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` datetime NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `usedAt` datetime DEFAULT NULL,
  `generatedBy` varchar(191) COLLATE utf8mb4_general_ci NOT NULL,
  `usedBy` varchar(191) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `usedBy` (`usedBy`),
  KEY `idx_regcodes_code` (`code`),
  KEY `idx_regcodes_used` (`used`),
  KEY `idx_regcodes_expires` (`expiresAt`),
  KEY `idx_regcodes_generated` (`generatedBy`),
  CONSTRAINT `fk_regcode_generated` FOREIGN KEY (`generatedBy`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_regcode_used` FOREIGN KEY (`usedBy`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `responsables_salle`;
CREATE TABLE `responsables_salle` (
  `id` int NOT NULL AUTO_INCREMENT,
  `etudiantId` int NOT NULL,
  `annee` int NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `ecoleId` int DEFAULT NULL,
  `filiereId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `etudiantId` (`etudiantId`,`annee`),
  KEY `idx_responsables_annee` (`annee`),
  KEY `idx_resps_ecoleId` (`ecoleId`),
  KEY `idx_resps_filiereId` (`filiereId`),
  CONSTRAINT `fk_responsable_etudiant` FOREIGN KEY (`etudiantId`) REFERENCES `etudiants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_resps_ecoleId` FOREIGN KEY (`ecoleId`) REFERENCES `ecoles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_resps_filiereId` FOREIGN KEY (`filiereId`) REFERENCES `filieres` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `student_activities`;
CREATE TABLE `student_activities` (
  `student_id` int NOT NULL,
  `activity_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`,`activity_id`),
  KEY `activity_id` (`activity_id`),
  CONSTRAINT `student_activities_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `etudiants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `student_activities_ibfk_2` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `student_subactivities`;
CREATE TABLE `student_subactivities` (
  `student_id` int NOT NULL,
  `activity_id` int NOT NULL,
  `subactivity_id` int NOT NULL,
  PRIMARY KEY (`student_id`,`activity_id`,`subactivity_id`),
  KEY `activity_id` (`activity_id`),
  KEY `subactivity_id` (`subactivity_id`),
  CONSTRAINT `student_subactivities_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `etudiants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `student_subactivities_ibfk_2` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `student_subactivities_ibfk_3` FOREIGN KEY (`subactivity_id`) REFERENCES `subactivities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `subactivities`;
CREATE TABLE `subactivities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity_id` int NOT NULL,
  `nom` varchar(100) NOT NULL,
  `description` text,
  `actif` tinyint(1) DEFAULT '1',
  `icone` varchar(100) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `activity_id` (`activity_id`),
  CONSTRAINT `subactivities_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` varchar(191) COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `role` enum('ETUDIANT','ADMIN') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'ADMIN',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `actif` tinyint(1) DEFAULT '1',
  `tempPassword` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `requirePasswordChange` tinyint(1) DEFAULT '0',
  `passwordResetExpires` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_actif` (`actif`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `vote_tokens`;
CREATE TABLE `vote_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_general_ci NOT NULL,
  `electionId` int NOT NULL,
  `isUsed` tinyint(1) DEFAULT '0',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` datetime NOT NULL,
  `usedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  UNIQUE KEY `userId` (`userId`,`electionId`),
  KEY `fk_votetoken_election` (`electionId`),
  KEY `idx_votetokens_token` (`token`),
  KEY `idx_votetokens_used` (`isUsed`),
  KEY `idx_votetokens_expires` (`expiresAt`),
  KEY `idx_votetokens_user_election` (`userId`,`electionId`),
  CONSTRAINT `fk_votetoken_election` FOREIGN KEY (`electionId`) REFERENCES `elections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_votetoken_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `vote_transfers`;
CREATE TABLE `vote_transfers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `roundId` int NOT NULL,
  `sourceCandidateId` int NOT NULL,
  `targetCandidateId` int NOT NULL,
  `votesTransferred` int NOT NULL,
  `transferType` enum('AUTO','MANUAL') COLLATE utf8mb4_general_ci DEFAULT 'AUTO',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_vote_transfers_source` (`sourceCandidateId`),
  KEY `fk_vote_transfers_target` (`targetCandidateId`),
  KEY `idx_vote_transfers_round` (`roundId`),
  CONSTRAINT `fk_vote_transfers_round` FOREIGN KEY (`roundId`) REFERENCES `election_rounds` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vote_transfers_source` FOREIGN KEY (`sourceCandidateId`) REFERENCES `candidates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vote_transfers_target` FOREIGN KEY (`targetCandidateId`) REFERENCES `candidates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `votes`;
CREATE TABLE `votes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` varchar(191) COLLATE utf8mb4_general_ci NOT NULL,
  `electionId` int NOT NULL,
  `candidateId` int NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `poidsVote` float NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `userId` (`userId`,`electionId`),
  KEY `idx_votes_election` (`electionId`),
  KEY `idx_votes_candidate` (`candidateId`),
  KEY `idx_votes_user` (`userId`),
  KEY `idx_votes_created` (`createdAt`),
  CONSTRAINT `fk_vote_candidate` FOREIGN KEY (`candidateId`) REFERENCES `candidates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vote_election` FOREIGN KEY (`electionId`) REFERENCES `elections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vote_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `activities` (`id`, `nom`, `description`, `actif`, `icone`, `has_subactivities`, `created_at`, `updated_at`) VALUES
(1, 'Technologie', 'Science', 1, 'running', 1, '2025-10-12 09:23:11', '2025-10-12 09:23:11'),
(2, 'UC-TEC', NULL, 1, 'terminal', 1, '2025-10-13 18:18:32', '2025-10-13 18:18:32');
INSERT INTO `activity_logs` (`id`, `action`, `details`, `userId`, `actionType`, `createdAt`, `module`) VALUES
(1, 'Création d\'une élection', 'Élection \"Election Responsable\" créée', 'user_1760230884742_gpwoxklrj', 'ADMIN', '2025-10-12 09:15:53', 'SYSTEM'),
(2, 'Création d\'une élection', 'Élection \"Election Responsable de Salle\" créée', 'user_1760230884742_gpwoxklrj', 'ADMIN', '2025-10-12 09:52:19', 'SYSTEM'),
(3, 'Création d\'une élection', 'Élection \"Election Responsable de Salle\" créée', 'user_1760230884742_gpwoxklrj', 'ADMIN', '2025-10-12 10:18:57', 'SYSTEM'),
(4, 'Création d\'une élection', 'Élection \"Election Responsable de Salle\" créée', 'user_1760230884742_gpwoxklrj', 'ADMIN', '2025-10-12 10:28:28', 'SYSTEM'),
(5, 'Création d\'une élection', 'Élection \"Election Responsable de Salle\" créée', 'user_1760230884742_gpwoxklrj', 'ADMIN', '2025-10-12 11:19:17', 'SYSTEM'),
(6, 'Création d\'une élection', 'Élection \"Election Responsable de Salle\" créée', 'user_1760230884742_gpwoxklrj', 'ADMIN', '2025-10-12 11:23:00', 'SYSTEM'),
(7, 'Candidature réussie', 'Soumission à l’élection 2 avec l’ID 1', 'USR-STUDENT-1001', 'SUCCESS', '2025-10-12 11:26:27', 'SYSTEM'),
(8, 'Changement de statut de candidature', 'Statut changé en \"APPROUVE\" pour l\'élection \"Election Responsable de Salle\"', 'user_1760230884742_gpwoxklrj', 'ADMIN', '2025-10-12 11:28:48', 'SYSTEM'),
(9, 'Résultats publiés manuellement', 'Publication manuelle des résultats de l\'élection: Election Responsable de Salle', 'user_1760230884742_gpwoxklrj', 'PUBLICATION', '2025-10-12 11:57:22', 'SYSTEM'),
(10, 'Vote enregistré', 'Vote pour le candidat 3 dans l\'élection 4', 'USR-STUDENT-1001', 'VOTE', '2025-10-12 12:51:04', 'SYSTEM'),
(11, 'RESET_STUDENT_ACCESS', 'Admin user_1760230884742_gpwoxklrj reset student 16', 'user_1760230884742_gpwoxklrj', 'ADMIN', '2025-10-13 18:23:52', 'SYSTEM');
INSERT INTO `admins` (`id`, `userId`, `nom`, `prenom`, `poste`, `createdAt`, `updatedAt`) VALUES
(2, 'user_1760189182592_wy8941v2y', 'Admin_UCAO', 'UUC', 'Directeur', '2025-10-11 13:26:23', '2025-10-11 13:26:23'),
(3, 'user_1760230884742_gpwoxklrj', 'Admin', 'UUC', 'Directeur', '2025-10-12 01:01:25', '2025-10-12 01:01:25');
INSERT INTO `candidates` (`id`, `nom`, `prenom`, `slogan`, `programme`, `motivation`, `photoUrl`, `statut`, `userId`, `electionId`, `createdAt`, `updatedAt`) VALUES
(1, 'ADJIBADE', 'Leonce', 'Un délégué à votre écoute !', 'Programme standard de responsable de salle', 'Dtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttfffffffffhhhhhhhhhhhhhhhhhnnnnnnnnnnnnnnnnnnnnnn', 'https://i.ibb.co/rfRS8gH6/imgg.png', 'APPROUVE', 'USR-STUDENT-1001', 2, '2025-10-12 11:26:27', '2025-10-12 11:28:48'),
(2, 'GNAHOUI', 'Sylvie', 'Communication et proximité au service de tous !', 'Mon programme en tant que Responsable communication BDE :\n1. Améliorer la communication entre étudiants et administration\n2. Organiser des activités de cohésion de classe régulières\n3. Mettre en place un système de tutorat entre étudiants\n4. Faciliter l\'accès aux ressources pédagogiques', 'Forte de mon expérience en tant que Responsable communication au BDE, je connais les défis de la représentation étudiante. Je veux mettre mes compétences au service de notre salle pour créer une ambiance de travail positive et productive.', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?ixlib=rb-4.0.3', 'APPROUVE', 'USR-STUDENT-1004', 2, '2025-10-12 11:37:54', '2025-10-12 11:37:54'),
(3, 'ADJIBADE', 'Leonce', 'Un délégué à votre écoute !', 'Représentation étudiante, communication, organisation d\'activités', 'Passionné par le leadership et l\'engagement étudiant', 'https://i.ibb.co/rfRS8gH6/imgg.png', 'APPROUVE', 'USR-STUDENT-1001', 4, '2025-10-12 12:27:03', '2025-10-12 12:27:03'),
(4, 'GNAHOUI', 'Sylvie', 'Communication et proximité !', 'Communication BDE, activités cohésion, tutorat, ressources pédagogiques', 'Responsable communication BDE, expérience représentation', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1', 'APPROUVE', 'USR-STUDENT-1004', 4, '2025-10-12 12:27:03', '2025-10-12 12:27:03'),
(5, 'AHOUANSOU', 'Mathieu', 'Excellence académique !', 'Tutorat C++, groupes d\'étude, préparation examens', 'Mentor expérimenté en programmation', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e', 'APPROUVE', 'USR-STUDENT-1007', 4, '2025-10-12 12:27:03', '2025-10-12 12:27:03'),
(6, 'ADJOVI', 'Faustin', 'Innovation technologique !', 'Hackathons, projets pratiques, compétitions coding', 'Animateur hackathons, passionné tech', 'https://images.unsplash.com/photo-1521579971123-1192931a1452', 'APPROUVE', 'USR-STUDENT-1009', 4, '2025-10-12 12:27:03', '2025-10-12 12:27:03');


INSERT INTO `ecoles` (`id`, `nom`, `actif`, `createdAt`) VALUES
(1, 'EGEI', 1, '2025-09-01 08:00:00'),
(2, 'FSAE', 1, '2025-09-01 08:05:00'),
(3, 'FDE', 1, '2024-01-15 09:00:00'),
(4, 'ESMEA', 1, '2024-01-15 09:00:00');


INSERT INTO `elections` (`id`, `type`, `titre`, `description`, `dateDebut`, `dateFin`, `dateDebutCandidature`, `dateFinCandidature`, `createdAt`, `annee`, `niveau`, `delegueType`, `isActive`, `resultsVisibility`, `tour`, `ecoleId`, `filiereId`, `resultsPublished`, `responsableType`, `publishedAt`) VALUES
(1, 'SALLE', 'Election Responsable de Salle', '2025', '2025-10-12 11:32:00', '2025-10-12 11:46:43', '2025-10-12 11:20:00', '2025-10-12 11:31:00', '2025-10-12 11:19:16', 1, 'PHASE1', NULL, 0, 'MANUAL', 1, 1, 1, 0, 'PREMIER', NULL),
(2, 'SALLE', 'Election Responsable de Salle', '222222', '2025-10-12 11:31:00', '2025-10-12 11:41:44', '2025-10-12 11:24:00', '2025-10-12 11:30:00', '2025-10-12 11:23:00', 2, 'PHASE1', NULL, 0, 'MANUAL', 1, 1, 1, 1, 'PREMIER', '2025-10-12 11:57:22'),
(4, 'SALLE', 'Election Responsable de Salle L2 - EGEI', 'Élection des responsables de salle pour la deuxième année d\'Informatique Industrielle', '2025-10-10 08:00:00', '2025-10-15 18:00:00', '2025-10-05 08:00:00', '2025-10-09 18:00:00', '2025-10-12 12:27:03', 2, 'PHASE1', NULL, 0, 'IMMEDIATE', 1, 1, 1, 0, NULL, NULL);
INSERT INTO `etudiants` (`id`, `userId`, `matricule`, `codeInscription`, `identifiantTemporaire`, `nom`, `prenom`, `annee`, `photoUrl`, `ecoleId`, `filiereId`, `whatsapp`, `additional_info`) VALUES
(1, 'USR-STUDENT-1001', 'UCAO-2025-201', NULL, 'TEMP-201', 'ADJIBADE', 'Leonce', 2, 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39', 1, 1, '+22961001201', 'Membre du club juridique'),
(2, 'USR-STUDENT-1002', NULL, 'INS-2025-202', 'TEMP-202', 'HOUNKPE', 'Ayaba', 1, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1', 2, 2, '+22961001202', 'Ambassadrice orientation'),
(3, 'USR-STUDENT-1003', 'UCAO-2025-203', 'INS-2025-203', 'TEMP-203', 'DOSSA', 'Marcel', 3, 'https://images.unsplash.com/photo-1504593811423-6dd665756598', 1, 1, '+22961001203', 'Responsable logistique BDE'),
(4, 'USR-STUDENT-1004', 'UCAO-2025-204', 'INS-2025-204', 'TEMP-204', 'GNAHOUI', 'Sylvie', 2, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?ixlib=rb-4.0.3', 1, 1, '+22961001204', 'Responsable communication BDE'),
(5, 'USR-STUDENT-1005', 'UCAO-2025-205', 'INS-2025-205', 'TEMP-205', 'TOKO', 'Idriss', 3, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3', 1, 1, '+22961001205', 'Tuteur en algorithmique'),
(6, 'USR-STUDENT-1006', 'UCAO-2025-206', 'INS-2025-206', 'TEMP-206', 'KOUDJO', 'Prisca', 1, 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3', 1, 1, '+22961001206', 'Club robotique'),
(7, 'USR-STUDENT-1007', 'UCAO-2025-207', 'INS-2025-207', 'TEMP-207', 'AHOUANSOU', 'Mathieu', 2, 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3', 1, 1, '+22961001207', 'Mentor tutorat C++'),
(8, 'USR-STUDENT-1008', 'UCAO-2025-208', 'INS-2025-208', 'TEMP-208', 'AGOSSA', 'Clarisse', 3, 'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?ixlib=rb-4.0.3', 1, 1, '+22961001208', 'Responsable vie associative'),
(9, 'USR-STUDENT-1009', 'UCAO-2025-209', 'INS-2025-209', 'TEMP-209', 'ADJOVI', 'Faustin', 2, 'https://images.unsplash.com/photo-1521579971123-1192931a1452?ixlib=rb-4.0.3', 1, 1, '+22961001209', 'Animateur hackathons'),
(10, 'USR-STUDENT-1010', 'UCAO-2025-210', 'INS-2025-210', 'TEMP-210', 'LOKO', 'Mireille', 1, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?ixlib=rb-4.0.3', 1, 1, '+22961001210', 'Référente UX design'),
(11, 'USR-STUDENT-1011', 'UCAO-2025-211', NULL, NULL, 'AZANKPO', 'Emma', 1, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', 1, 1, '+22961001211', NULL),
(12, 'USR-STUDENT-1012', 'UCAO-2025-212', NULL, NULL, 'HOUNGBO', 'Daniel', 1, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d', 1, 1, '+22961001212', NULL),
(13, 'USR-STUDENT-1013', 'UCAO-2025-213', NULL, NULL, 'SENOU', 'Rachel', 1, 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80', 1, 1, '+22961001213', NULL),
(14, 'USR-STUDENT-1014', 'UCAO-2025-214', NULL, NULL, 'GANGBETO', 'Eric', 1, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', 1, 1, '+22961001214', NULL),
(15, 'USR-STUDENT-1015', 'UCAO-2025-215', NULL, NULL, 'TOKPOHOUNON', 'Sophie', 1, 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f', 1, 1, '+22961001215', NULL),
(16, 'USR-STUDENT-1016', 'UCAO-2025-216', NULL, 'TEMPE8XPLUUZ', 'AKPLOGAN', 'Boris', 1, 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d', 1, 1, '+22961001216', NULL),
(17, 'USR-STUDENT-1017', 'UCAO-2025-217', NULL, NULL, 'BIO', 'Fatima', 1, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb', 1, 1, '+22961001217', NULL),
(18, 'USR-STUDENT-1018', 'UCAO-2025-218', NULL, NULL, 'DOSSOU', 'Kevin', 1, 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef', 1, 1, '+22961001218', NULL),
(19, 'USR-STUDENT-1019', 'UCAO-2025-219', NULL, NULL, 'SAGBO', 'Nadia', 1, 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df', 1, 1, '+22961001219', NULL),
(20, 'USR-STUDENT-1020', 'UCAO-2025-220', NULL, NULL, 'AMOUSSOU', 'Rodrigue', 1, 'https://images.unsplash.com/photo-1463453091185-61582044d556', 1, 1, '+22961001220', NULL),
(21, 'USR-STUDENT-1021', 'UCAO-2025-221', NULL, NULL, 'ADEOTI', 'Armelle', 2, 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe', 1, 1, '+22961001221', NULL),
(22, 'USR-STUDENT-1022', 'UCAO-2025-222', NULL, NULL, 'GBEDO', 'Leopold', 2, 'https://images.unsplash.com/photo-1504257432389-52343af06ae3', 1, 1, '+22961001222', NULL),
(23, 'USR-STUDENT-1023', 'UCAO-2025-223', NULL, NULL, 'GBAGUIDI', 'Marina', 2, 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e', 1, 1, '+22961001223', NULL),
(24, 'USR-STUDENT-1024', 'UCAO-2025-224', NULL, NULL, 'HOUSSOU', 'Olivier', 2, 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce', 1, 1, '+22961001224', NULL),
(25, 'USR-STUDENT-1025', 'UCAO-2025-225', NULL, NULL, 'YOVO', 'Vanessa', 2, 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6', 1, 1, '+22961001225', NULL),
(26, 'USR-STUDENT-1026', 'UCAO-2025-226', NULL, NULL, 'ZANNOU', 'Patrick', 2, 'https://images.unsplash.com/photo-1507081323647-4d250478b919', 1, 1, '+22961001226', NULL),
(27, 'USR-STUDENT-1027', 'UCAO-2025-227', NULL, NULL, 'BOSSOU', 'Rosine', 2, 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91', 1, 1, '+22961001227', NULL),
(28, 'USR-STUDENT-1028', 'UCAO-2025-228', NULL, NULL, 'GBENOU', 'Samuel', 2, 'https://images.unsplash.com/photo-1489980557514-251d61e3eeb6', 1, 1, '+22961001228', NULL),
(29, 'USR-STUDENT-1029', 'UCAO-2025-229', NULL, NULL, 'DEGBELO', 'Therese', 2, 'https://images.unsplash.com/photo-1525134479668-1bee5c7c6845', 1, 1, '+22961001229', NULL),
(30, 'USR-STUDENT-1030', 'UCAO-2025-230', NULL, NULL, 'BOKPE', 'Ulrich', 2, 'https://images.unsplash.com/photo-1503235930437-8c6293ba41f5', 1, 1, '+22961001230', NULL),
(31, 'USR-STUDENT-1031', 'UCAO-2025-231', NULL, NULL, 'ALLADAYE', 'Agnes', 3, 'https://images.unsplash.com/photo-1517841905240-472988babdf9', 1, 1, '+22961001231', NULL),
(32, 'USR-STUDENT-1032', 'UCAO-2025-232', NULL, NULL, 'AVOCEGAME', 'Benjamin', 3, 'https://images.unsplash.com/photo-1491349174775-aaafddd81942', 1, 1, '+22961001232', NULL),
(33, 'USR-STUDENT-1033', 'UCAO-2025-233', NULL, NULL, 'AWOKOU', 'Cecile', 3, 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df', 1, 1, '+22961001233', NULL),
(34, 'USR-STUDENT-1034', 'UCAO-2025-234', NULL, NULL, 'AZIZOU', 'David', 3, 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea', 1, 1, '+22961001234', NULL),
(35, 'USR-STUDENT-1035', 'UCAO-2025-235', NULL, NULL, 'DANSOU', 'Elodie', 3, 'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7', 1, 1, '+22961001235', NULL),
(36, 'USR-STUDENT-1036', 'UCAO-2025-236', NULL, NULL, 'DJIDOHOKPIN', 'Franck', 3, 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d', 1, 1, '+22961001236', NULL),
(37, 'USR-STUDENT-1037', 'UCAO-2025-237', NULL, NULL, 'DOTOU', 'Geraldine', 3, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', 1, 1, '+22961001237', NULL),
(38, 'USR-STUDENT-1038', 'UCAO-2025-238', NULL, NULL, 'EZOUHOUN', 'Hugues', 3, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', 1, 1, '+22961001238', NULL),
(39, 'USR-STUDENT-1039', 'UCAO-2025-239', NULL, NULL, 'GANDONOU', 'Isabelle', 3, 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f', 1, 1, '+22961001239', NULL),
(40, 'USR-STUDENT-1040', 'UCAO-2025-240', NULL, NULL, 'SOGLO', 'Jules', 3, 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef', 1, 1, '+22961001240', NULL);
INSERT INTO `filieres` (`id`, `nom`, `ecoleId`, `actif`, `createdAt`) VALUES
(1, 'Informatique Industrielle', 1, 1, '2025-09-02 09:00:00'),
(2, 'Agroéconomie Durable', 2, 1, '2025-09-02 09:10:00'),
(3, 'Génie Civil', 1, 1, '2024-01-15 09:00:00'),
(4, 'Sciences Économiques', 2, 1, '2024-01-15 09:00:00'),
(5, 'Gestion des Entreprises', 2, 1, '2024-01-15 09:00:00'),
(6, 'Marketing', 2, 1, '2024-01-15 09:00:00'),
(7, 'Droit Public', 3, 1, '2024-01-15 09:00:00'),
(8, 'Droit Privé', 3, 1, '2024-01-15 09:00:00'),
(9, 'Sciences Politiques', 3, 1, '2024-01-15 09:00:00'),
(10, 'Médecine Générale', 4, 1, '2024-01-15 09:00:00'),
(11, 'Chirurgie Dentaire', 4, 1, '2024-01-15 09:00:00'),
(12, 'Pharmacie', 4, 1, '2024-01-15 09:00:00');
INSERT INTO `notifications` (`id`, `title`, `message`, `type`, `priority`, `is_read`, `relatedEntity`, `entityId`, `userId`, `createdAt`, `updatedAt`) VALUES
('8a512313-6942-4cfc-84d8-126a228dd9e4', 'Candidature Approuvée', 'Votre candidature pour l\'élection \"Election Responsable de Salle\" a été approuvée.', 'CANDIDATURE', 'HIGH', 0, 'election', '2', 'USR-STUDENT-1001', '2025-10-12 11:28:49', '2025-10-12 11:28:49');


INSERT INTO `student_activities` (`student_id`, `activity_id`, `created_at`) VALUES
(1, 1, '2025-10-12 09:25:33'),
(10, 1, '2025-10-13 12:45:34'),
(11, 1, '2025-10-13 13:21:25'),
(12, 1, '2025-10-13 16:13:30'),
(13, 1, '2025-10-13 16:19:16'),
(14, 1, '2025-10-13 16:28:16');
INSERT INTO `student_subactivities` (`student_id`, `activity_id`, `subactivity_id`) VALUES
(1, 1, 1),
(12, 1, 1),
(13, 1, 1),
(14, 1, 1);
INSERT INTO `subactivities` (`id`, `activity_id`, `nom`, `description`, `actif`, `icone`, `created_at`, `updated_at`) VALUES
(1, 1, 'UCAO-TECH', 'Rien', 1, 'code', '2025-10-12 09:23:42', '2025-10-12 09:23:42'),
(2, 2, 'Techno', NULL, 1, 'microchip', '2025-10-13 18:19:27', '2025-10-13 18:19:27');
INSERT INTO `users` (`id`, `email`, `password`, `role`, `createdAt`, `actif`, `tempPassword`, `requirePasswordChange`, `passwordResetExpires`) VALUES
('user_1760230884742_gpwoxklrj', 'ucaotech@gmail.com', '$2b$10$kndFw2UDsvz3kXniVo6gtOhcC.ETpa1u.VH8xZuZOj6m7bV8AaMXu', 'ADMIN', '2025-10-12 01:01:25', 1, NULL, 0, NULL),
('USR-STUDENT-1001', 'leonce.adjibade@ucao.bj', '$2b$10$4BJdaqeo5/dhdmraWScNIOzibwDAPqPeHbkjWN5Dic8JZwdQkDEPS', 'ETUDIANT', '2025-10-12 08:30:00', 1, NULL, 0, NULL),
('USR-STUDENT-1002', 'ayaba.hounkpe@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 08:32:00', 1, NULL, 0, NULL),
('USR-STUDENT-1003', 'marcel.dossa@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 08:35:00', 1, NULL, 0, NULL),
('USR-STUDENT-1004', 'sylvie.gnahoui@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 08:37:00', 1, NULL, 0, NULL),
('USR-STUDENT-1005', 'idriss.toko@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 08:38:00', 1, NULL, 0, NULL),
('USR-STUDENT-1006', 'prisca.koudjo@ucao.bj', '$2b$10$OCJoweU0LuLWOhUDQTNcleXjixsm5kLH/Y2aRmSg0mqTYRD.aUT2m', 'ETUDIANT', '2025-10-12 08:39:00', 1, NULL, 0, NULL),
('USR-STUDENT-1007', 'mathieu.ahouansou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 08:40:00', 1, NULL, 0, NULL),
('USR-STUDENT-1008', 'clarisse.agossa@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 08:41:00', 1, NULL, 0, NULL),
('USR-STUDENT-1009', 'faustin.adjovi@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 08:42:00', 1, NULL, 0, NULL),
('USR-STUDENT-1010', 'mireille.loko@ucao.bj', '$2b$10$x/lk5kjvJgS4v70/16PwYO.14uEeE04jjwe5Hvz7/AsnhnoFPnjDa', 'ETUDIANT', '2025-10-12 08:43:00', 1, NULL, 0, NULL),
('USR-STUDENT-1011', 'emma.azankpo@ucao.bj', '$2b$10$EfTJaMP4/qDbyGWDBUhuL.5oyAbEfO7LnsG7j8vBntvG0bmkE1T/u', 'ETUDIANT', '2025-10-12 09:00:00', 1, NULL, 0, NULL),
('USR-STUDENT-1012', 'daniel.houngbo@ucao.bj', '$2b$10$1R5csQmgnwcSsNJG8lU14uHQDeCmkyvxmZwNKbwquyQZVoRrFYgTe', 'ETUDIANT', '2025-10-12 09:01:00', 1, NULL, 0, NULL),
('USR-STUDENT-1013', 'rachel.senou@ucao.bj', '$2b$10$biIOLYFRE5ZNSMH85qsGTeS6cXo.60wGk99FXTR/8EtYvBAlre0ZW', 'ETUDIANT', '2025-10-12 09:02:00', 1, NULL, 0, NULL),
('USR-STUDENT-1014', 'eric.gangbeto@ucao.bj', '$2b$10$8lCPPqTTeLmSbuDulztBsurTv9/cvrEwvaCAFUgOvtV8xXBR8j23C', 'ETUDIANT', '2025-10-12 09:03:00', 1, NULL, 0, NULL),
('USR-STUDENT-1015', 'sophie.tokpohounon@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:04:00', 1, NULL, 0, NULL),
('USR-STUDENT-1016', 'boris.akplogan@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:05:00', 1, '$2b$10$c5AI0KTtyDtsakgaURru4uezZYn/BCtXWkVpC1vrjcAa5BGO.e4ym', 1, '2025-10-14 18:23:52'),
('USR-STUDENT-1017', 'fatima.bio@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:06:00', 1, NULL, 0, NULL),
('USR-STUDENT-1018', 'kevin.dossou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:07:00', 1, NULL, 0, NULL),
('USR-STUDENT-1019', 'nadia.sagbo@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:08:00', 1, NULL, 0, NULL),
('USR-STUDENT-1020', 'rodrigue.amoussou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:09:00', 1, NULL, 0, NULL),
('USR-STUDENT-1021', 'armelle.adeoti@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:10:00', 1, NULL, 0, NULL),
('USR-STUDENT-1022', 'leopold.gbedo@ucao.bj', '$2b$10$Q/im6ERUq6rPWF32EbDM0.gbtwnE7fOJo.6DP0aG2TrVqHAZcEP1C', 'ETUDIANT', '2025-10-12 09:11:00', 1, NULL, 0, NULL),
('USR-STUDENT-1023', 'marina.gbaguidi@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:12:00', 1, NULL, 0, NULL),
('USR-STUDENT-1024', 'olivier.houssou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:13:00', 1, NULL, 0, NULL),
('USR-STUDENT-1025', 'vanessa.yovo@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:14:00', 1, NULL, 0, NULL),
('USR-STUDENT-1026', 'patrick.zannou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:15:00', 1, NULL, 0, NULL),
('USR-STUDENT-1027', 'rosine.bossou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:16:00', 1, NULL, 0, NULL),
('USR-STUDENT-1028', 'samuel.gbenou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:17:00', 1, NULL, 0, NULL),
('USR-STUDENT-1029', 'therese.degbelo@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:18:00', 1, NULL, 0, NULL),
('USR-STUDENT-1030', 'ulrich.bokpe@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:19:00', 1, NULL, 0, NULL),
('USR-STUDENT-1031', 'agnes.alladaye@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:20:00', 1, NULL, 0, NULL),
('USR-STUDENT-1032', 'benjamin.avocegame@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:21:00', 1, NULL, 0, NULL),
('USR-STUDENT-1033', 'cecile.awokou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:22:00', 1, NULL, 0, NULL),
('USR-STUDENT-1034', 'david.azizou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:23:00', 1, NULL, 0, NULL),
('USR-STUDENT-1035', 'elodie.dansou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:24:00', 1, NULL, 0, NULL),
('USR-STUDENT-1036', 'franck.djidohokpin@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:25:00', 1, NULL, 0, NULL),
('USR-STUDENT-1037', 'geraldine.dotou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:26:00', 1, NULL, 0, NULL),
('USR-STUDENT-1038', 'hugues.ezouhoun@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:27:00', 1, NULL, 0, NULL),
('USR-STUDENT-1039', 'isabelle.gandonou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:28:00', 1, NULL, 0, NULL),
('USR-STUDENT-1040', 'jules.soglo@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:29:00', 1, NULL, 0, NULL);
INSERT INTO `vote_tokens` (`id`, `token`, `userId`, `electionId`, `isUsed`, `createdAt`, `expiresAt`, `usedAt`) VALUES
(1, '4e5d11b6-a75f-11f0-8a8b-a2aa80b4014f', 'USR-STUDENT-1001', 2, 0, '2025-10-12 11:33:42', '2025-10-12 12:33:42', NULL),
(3, '19a08e53-a76a-11f0-8a8b-a2aa80b4014f', 'USR-STUDENT-1001', 4, 1, '2025-10-12 12:50:58', '2025-10-12 13:50:58', '2025-10-12 12:51:03'),
(4, '3b672f94-a801-11f0-8a8b-a2aa80b4014f', 'USR-STUDENT-1021', 4, 1, '2025-10-13 06:52:49', '2025-10-12 18:00:00', NULL),
(5, '3b672fd1-a801-11f0-8a8b-a2aa80b4014f', 'USR-STUDENT-1022', 4, 1, '2025-10-13 06:52:49', '2025-10-12 18:00:00', NULL),
(6, '3b672ff8-a801-11f0-8a8b-a2aa80b4014f', 'USR-STUDENT-1023', 4, 1, '2025-10-13 06:52:49', '2025-10-12 18:00:00', NULL),
(7, '3b673017-a801-11f0-8a8b-a2aa80b4014f', 'USR-STUDENT-1024', 4, 1, '2025-10-13 06:52:49', '2025-10-12 18:00:00', NULL),
(8, '3b673037-a801-11f0-8a8b-a2aa80b4014f', 'USR-STUDENT-1025', 4, 1, '2025-10-13 06:52:49', '2025-10-12 18:00:00', NULL),
(9, '3b673053-a801-11f0-8a8b-a2aa80b4014f', 'USR-STUDENT-1026', 4, 1, '2025-10-13 06:52:49', '2025-10-12 18:00:00', NULL),
(10, '3b673071-a801-11f0-8a8b-a2aa80b4014f', 'USR-STUDENT-1027', 4, 1, '2025-10-13 06:52:49', '2025-10-12 18:00:00', NULL),
(11, '3b67308f-a801-11f0-8a8b-a2aa80b4014f', 'USR-STUDENT-1028', 4, 1, '2025-10-13 06:52:49', '2025-10-12 18:00:00', NULL),
(12, '3b6730bb-a801-11f0-8a8b-a2aa80b4014f', 'USR-STUDENT-1029', 4, 1, '2025-10-13 06:52:49', '2025-10-12 18:00:00', NULL),
(13, '3b6730e6-a801-11f0-8a8b-a2aa80b4014f', 'USR-STUDENT-1030', 4, 1, '2025-10-13 06:52:49', '2025-10-12 18:00:00', NULL);

INSERT INTO `votes` (`id`, `userId`, `electionId`, `candidateId`, `createdAt`, `poidsVote`) VALUES
(1, 'USR-STUDENT-1021', 4, 3, '2025-10-12 12:27:04', 1),
(2, 'USR-STUDENT-1022', 4, 3, '2025-10-12 12:27:04', 1),
(3, 'USR-STUDENT-1023', 4, 3, '2025-10-12 12:27:04', 1),
(4, 'USR-STUDENT-1024', 4, 3, '2025-10-12 12:27:04', 1),
(5, 'USR-STUDENT-1025', 4, 3, '2025-10-12 12:27:04', 1),
(6, 'USR-STUDENT-1026', 4, 4, '2025-10-12 12:27:04', 1),
(7, 'USR-STUDENT-1027', 4, 4, '2025-10-12 12:27:04', 1),
(8, 'USR-STUDENT-1028', 4, 4, '2025-10-12 12:27:04', 1),
(9, 'USR-STUDENT-1029', 4, 5, '2025-10-12 12:27:04', 1),
(10, 'USR-STUDENT-1030', 4, 6, '2025-10-12 12:27:04', 1),
(11, 'USR-STUDENT-1001', 4, 3, '2025-10-12 12:51:03', 1);


/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;