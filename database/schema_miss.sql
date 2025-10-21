-- =============================================
-- SCHEMA POUR MODULE MISS / CONCOURS PUBLIC
-- Système de vote payant avec paiement en ligne
-- =============================================

-- Table des concours (Miss, Mr, etc.)
DROP TABLE IF EXISTS `concours`;
CREATE TABLE `concours` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titre` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `type` enum('MISS','MISTER','TALENT','AUTRE') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'MISS',
  `banniere` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `dateDebut` datetime NOT NULL,
  `dateFin` datetime NOT NULL,
  `dateDebutCandidature` datetime NOT NULL,
  `dateFinCandidature` datetime NOT NULL,
  `prixVote` decimal(10,2) NOT NULL DEFAULT '100.00',
  `devise` varchar(10) COLLATE utf8mb4_general_ci DEFAULT 'XOF',
  `nombreVotesMax` int DEFAULT NULL COMMENT 'Limite de votes par personne (NULL = illimité)',
  `statut` enum('BROUILLON','ACTIF','TERMINE','ARCHIVE') COLLATE utf8mb4_general_ci DEFAULT 'BROUILLON',
  `afficherResultatsTempsReel` tinyint(1) DEFAULT '1',
  `reglements` text COLLATE utf8mb4_general_ci,
  `organisateur` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `contactOrganisateur` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `totalVotes` int DEFAULT '0',
  `totalRevenu` decimal(12,2) DEFAULT '0.00',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `createdBy` varchar(191) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_concours_statut` (`statut`),
  KEY `idx_concours_dates` (`dateDebut`, `dateFin`),
  KEY `idx_concours_type` (`type`),
  KEY `fk_concours_createdBy` (`createdBy`),
  CONSTRAINT `fk_concours_createdBy` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table des candidates/candidats
DROP TABLE IF EXISTS `candidates_concours`;
CREATE TABLE `candidates_concours` (
  `id` int NOT NULL AUTO_INCREMENT,
  `concoursId` int NOT NULL,
  `numero` int NOT NULL COMMENT 'Numéro de dossard',
  `nom` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `prenom` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `age` int DEFAULT NULL,
  `ville` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `profession` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `slogan` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `presentation` text COLLATE utf8mb4_general_ci,
  `photo1` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `photo2` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `photo3` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `videoUrl` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `facebook` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `instagram` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `whatsapp` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `statut` enum('EN_ATTENTE','APPROUVE','REJETE','ELIMINE') COLLATE utf8mb4_general_ci DEFAULT 'EN_ATTENTE',
  `totalVotes` int DEFAULT '0',
  `montantTotal` decimal(10,2) DEFAULT '0.00',
  `ordre` int DEFAULT '0' COMMENT 'Ordre d\'affichage',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_concours_numero` (`concoursId`, `numero`),
  KEY `idx_candidates_concours` (`concoursId`),
  KEY `idx_candidates_statut` (`statut`),
  KEY `idx_candidates_votes` (`totalVotes`),
  CONSTRAINT `fk_candidate_concours` FOREIGN KEY (`concoursId`) REFERENCES `concours` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table des votes payants
DROP TABLE IF EXISTS `votes_miss`;
CREATE TABLE `votes_miss` (
  `id` int NOT NULL AUTO_INCREMENT,
  `concoursId` int NOT NULL,
  `candidateId` int NOT NULL,
  `transactionId` varchar(191) COLLATE utf8mb4_general_ci NOT NULL,
  `montant` decimal(10,2) NOT NULL,
  `devise` varchar(10) COLLATE utf8mb4_general_ci DEFAULT 'XOF',
  `nombreVotes` int DEFAULT '1' COMMENT 'Nombre de votes achetés en une transaction',
  `votantNom` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `votantEmail` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `votantTelephone` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `votantPays` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ipAddress` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `userAgent` text COLLATE utf8mb4_general_ci,
  `methodePaiement` enum('MOBILE_MONEY','CARTE_BANCAIRE','PAYPAL','AUTRE') COLLATE utf8mb4_general_ci NOT NULL,
  `operateurMobileMoney` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'MTN, MOOV, etc.',
  `numeroTransaction` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `statut` enum('EN_ATTENTE','VALIDE','ECHOUE','REMBOURSE') COLLATE utf8mb4_general_ci DEFAULT 'EN_ATTENTE',
  `messageConfirmation` text COLLATE utf8mb4_general_ci,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transactionId` (`transactionId`),
  KEY `idx_votes_miss_concours` (`concoursId`),
  KEY `idx_votes_miss_candidate` (`candidateId`),
  KEY `idx_votes_miss_statut` (`statut`),
  KEY `idx_votes_miss_created` (`createdAt`),
  KEY `idx_votes_miss_email` (`votantEmail`),
  KEY `idx_votes_miss_telephone` (`votantTelephone`),
  CONSTRAINT `fk_vote_miss_concours` FOREIGN KEY (`concoursId`) REFERENCES `concours` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vote_miss_candidate` FOREIGN KEY (`candidateId`) REFERENCES `candidates_concours` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table des transactions de paiement (pour audit et réconciliation)
DROP TABLE IF EXISTS `transactions_paiement`;
CREATE TABLE `transactions_paiement` (
  `id` varchar(191) COLLATE utf8mb4_general_ci NOT NULL,
  `type` enum('VOTE_MISS','TICKET_EVENT') COLLATE utf8mb4_general_ci NOT NULL,
  `referenceId` int DEFAULT NULL COMMENT 'ID du vote ou du ticket',
  `montant` decimal(10,2) NOT NULL,
  `devise` varchar(10) COLLATE utf8mb4_general_ci DEFAULT 'XOF',
  `methodePaiement` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `providerId` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'ID transaction du provider (FedaPay, CinetPay, etc.)',
  `providerName` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `statut` enum('INITIE','EN_COURS','COMPLETE','ECHOUE','ANNULE','REMBOURSE') COLLATE utf8mb4_general_ci DEFAULT 'INITIE',
  `statutProvider` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reponseProvider` text COLLATE utf8mb4_general_ci COMMENT 'Réponse JSON complète du provider',
  `nomPayeur` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `emailPayeur` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `telephonePayeur` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ipAddress` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `metadata` text COLLATE utf8mb4_general_ci COMMENT 'Données additionnelles en JSON',
  `dateInitiation` datetime DEFAULT CURRENT_TIMESTAMP,
  `dateCompletion` datetime DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_transactions_statut` (`statut`),
  KEY `idx_transactions_provider` (`providerId`),
  KEY `idx_transactions_reference` (`referenceId`),
  KEY `idx_transactions_type` (`type`),
  KEY `idx_transactions_email` (`emailPayeur`),
  KEY `idx_transactions_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table de limitation anti-fraude (pour éviter les votes multiples)
DROP TABLE IF EXISTS `vote_limitations`;
CREATE TABLE `vote_limitations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `concoursId` int NOT NULL,
  `identifiant` varchar(255) COLLATE utf8mb4_general_ci NOT NULL COMMENT 'Email, téléphone ou IP',
  `typeIdentifiant` enum('EMAIL','TELEPHONE','IP') COLLATE utf8mb4_general_ci NOT NULL,
  `nombreVotes` int DEFAULT '0',
  `dernierVote` datetime DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_concours_identifiant` (`concoursId`, `identifiant`, `typeIdentifiant`),
  KEY `idx_limitations_concours` (`concoursId`),
  KEY `idx_limitations_identifiant` (`identifiant`),
  CONSTRAINT `fk_limitation_concours` FOREIGN KEY (`concoursId`) REFERENCES `concours` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Indexes pour les performances
CREATE INDEX idx_votes_miss_candidate_statut ON votes_miss(candidateId, statut);
CREATE INDEX idx_candidates_concours_statut ON candidates_concours(concoursId, statut);
CREATE INDEX idx_concours_actif ON concours(statut, dateDebut, dateFin);

-- =============================================
-- DONNÉES DE TEST
-- =============================================

-- Exemple de concours Miss UCAO 2025
INSERT INTO `concours` 
(`titre`, `description`, `type`, `dateDebut`, `dateFin`, `dateDebutCandidature`, `dateFinCandidature`, `prixVote`, `statut`, `afficherResultatsTempsReel`, `organisateur`, `contactOrganisateur`)
VALUES
('Miss UCAO 2025', 
'Élection de Miss UCAO 2025 - La plus belle étudiante de l\'Université Catholique de l\'Afrique de l\'Ouest', 
'MISS',
'2025-11-01 00:00:00',
'2025-11-30 23:59:59',
'2025-10-20 00:00:00',
'2025-10-31 23:59:59',
100.00,
'ACTIF',
1,
'Bureau des Étudiants UCAO',
'bde@ucao.edu');

-- Exemples de candidates (à adapter selon vos besoins)
INSERT INTO `candidates_concours`
(`concoursId`, `numero`, `nom`, `prenom`, `age`, `ville`, `profession`, `slogan`, `presentation`, `photo1`, `statut`, `ordre`)
VALUES
(1, 1, 'ADJIBADE', 'Grace', 21, 'Cotonou', 'Étudiante en Droit', 'Élégance et Intelligence', 'Passionnée par le droit et la mode, je représente la femme africaine moderne.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', 'APPROUVE', 1),
(1, 2, 'KOUDJO', 'Esther', 22, 'Abomey-Calavi', 'Étudiante en Marketing', 'Beauté et Ambition', 'Future marketeuse, je veux inspirer les jeunes filles à poursuivre leurs rêves.', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1', 'APPROUVE', 2),
(1, 3, 'GNAHOUI', 'Sylvie', 20, 'Porto-Novo', 'Étudiante en Informatique', 'Tech & Beauty', 'Geek et fashionista, je prouve qu\'on 'peut être belle et intelligente.', 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e', 'APPROUVE', 3);
