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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
