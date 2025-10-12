-- ============================================================================
-- SCRIPT DE SIMULATION COMPLÈTE DU SYSTÈME ÉLECTORAL
-- ============================================================================
-- Ce script simule les 3 phases d'élections :
-- PHASE 1 : Élection des Responsables de Salle (L1, L2, L3)
-- PHASE 2 : Élection des Délégués d'École (à partir des Responsables)
-- PHASE 3 : Élection des Délégués d'Université (à partir des Délégués d'École)
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1 : AJOUT D'ÉTUDIANTS SUPPLÉMENTAIRES
-- ============================================================================
-- On continue à partir de USR-STUDENT-1011
-- Ajout d'étudiants de différentes années pour avoir assez de votants
-- TOUS LES ÉTUDIANTS SONT À L'EGEI (ecoleId=1), Informatique Industrielle (filiereId=1)

-- Étudiants L1 (annee = 1) - 10 étudiants
INSERT INTO `users` (`id`, `email`, `password`, `role`, `createdAt`, `actif`) VALUES
('USR-STUDENT-1011', 'emma.azankpo@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:00:00', 1),
('USR-STUDENT-1012', 'daniel.houngbo@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:01:00', 1),
('USR-STUDENT-1013', 'rachel.senou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:02:00', 1),
('USR-STUDENT-1014', 'eric.gangbeto@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:03:00', 1),
('USR-STUDENT-1015', 'sophie.tokpohounon@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:04:00', 1),
('USR-STUDENT-1016', 'boris.akplogan@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:05:00', 1),
('USR-STUDENT-1017', 'fatima.bio@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:06:00', 1),
('USR-STUDENT-1018', 'kevin.dossou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:07:00', 1),
('USR-STUDENT-1019', 'nadia.sagbo@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:08:00', 1),
('USR-STUDENT-1020', 'rodrigue.amoussou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:09:00', 1);

-- Étudiants L2 (annee = 2) - 10 étudiants
INSERT INTO `users` (`id`, `email`, `password`, `role`, `createdAt`, `actif`) VALUES
('USR-STUDENT-1021', 'armelle.adeoti@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:10:00', 1),
('USR-STUDENT-1022', 'leopold.gbedo@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:11:00', 1),
('USR-STUDENT-1023', 'marina.gbaguidi@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:12:00', 1),
('USR-STUDENT-1024', 'olivier.houssou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:13:00', 1),
('USR-STUDENT-1025', 'vanessa.yovo@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:14:00', 1),
('USR-STUDENT-1026', 'patrick.zannou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:15:00', 1),
('USR-STUDENT-1027', 'rosine.bossou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:16:00', 1),
('USR-STUDENT-1028', 'samuel.gbenou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:17:00', 1),
('USR-STUDENT-1029', 'therese.degbelo@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:18:00', 1),
('USR-STUDENT-1030', 'ulrich.bokpe@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:19:00', 1);

-- Étudiants L3 (annee = 3) - 10 étudiants
INSERT INTO `users` (`id`, `email`, `password`, `role`, `createdAt`, `actif`) VALUES
('USR-STUDENT-1031', 'agnes.alladaye@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:20:00', 1),
('USR-STUDENT-1032', 'benjamin.avocegame@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:21:00', 1),
('USR-STUDENT-1033', 'cecile.awokou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:22:00', 1),
('USR-STUDENT-1034', 'david.azizou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:23:00', 1),
('USR-STUDENT-1035', 'elodie.dansou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:24:00', 1),
('USR-STUDENT-1036', 'franck.djidohokpin@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:25:00', 1),
('USR-STUDENT-1037', 'geraldine.dotou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:26:00', 1),
('USR-STUDENT-1038', 'hugues.ezouhoun@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:27:00', 1),
('USR-STUDENT-1039', 'isabelle.gandonou@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:28:00', 1),
('USR-STUDENT-1040', 'jules.soglo@ucao.bj', NULL, 'ETUDIANT', '2025-10-12 09:29:00', 1);

-- Insertion des étudiants dans la table etudiants
-- Étudiants L1
INSERT INTO `etudiants` (`id`, `userId`, `matricule`, `nom`, `prenom`, `annee`, `photoUrl`, `ecoleId`, `filiereId`, `whatsapp`) VALUES
(11, 'USR-STUDENT-1011', 'UCAO-2025-211', 'AZANKPO', 'Emma', 1, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', 1, 1, '+22961001211'),
(12, 'USR-STUDENT-1012', 'UCAO-2025-212', 'HOUNGBO', 'Daniel', 1, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d', 1, 1, '+22961001212'),
(13, 'USR-STUDENT-1013', 'UCAO-2025-213', 'SENOU', 'Rachel', 1, 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80', 1, 1, '+22961001213'),
(14, 'USR-STUDENT-1014', 'UCAO-2025-214', 'GANGBETO', 'Eric', 1, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', 1, 1, '+22961001214'),
(15, 'USR-STUDENT-1015', 'UCAO-2025-215', 'TOKPOHOUNON', 'Sophie', 1, 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f', 1, 1, '+22961001215'),
(16, 'USR-STUDENT-1016', 'UCAO-2025-216', 'AKPLOGAN', 'Boris', 1, 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d', 1, 1, '+22961001216'),
(17, 'USR-STUDENT-1017', 'UCAO-2025-217', 'BIO', 'Fatima', 1, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb', 1, 1, '+22961001217'),
(18, 'USR-STUDENT-1018', 'UCAO-2025-218', 'DOSSOU', 'Kevin', 1, 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef', 1, 1, '+22961001218'),
(19, 'USR-STUDENT-1019', 'UCAO-2025-219', 'SAGBO', 'Nadia', 1, 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df', 1, 1, '+22961001219'),
(20, 'USR-STUDENT-1020', 'UCAO-2025-220', 'AMOUSSOU', 'Rodrigue', 1, 'https://images.unsplash.com/photo-1463453091185-61582044d556', 1, 1, '+22961001220');

-- Étudiants L2
INSERT INTO `etudiants` (`id`, `userId`, `matricule`, `nom`, `prenom`, `annee`, `photoUrl`, `ecoleId`, `filiereId`, `whatsapp`) VALUES
(21, 'USR-STUDENT-1021', 'UCAO-2025-221', 'ADEOTI', 'Armelle', 2, 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe', 1, 1, '+22961001221'),
(22, 'USR-STUDENT-1022', 'UCAO-2025-222', 'GBEDO', 'Leopold', 2, 'https://images.unsplash.com/photo-1504257432389-52343af06ae3', 1, 1, '+22961001222'),
(23, 'USR-STUDENT-1023', 'UCAO-2025-223', 'GBAGUIDI', 'Marina', 2, 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e', 1, 1, '+22961001223'),
(24, 'USR-STUDENT-1024', 'UCAO-2025-224', 'HOUSSOU', 'Olivier', 2, 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce', 1, 1, '+22961001224'),
(25, 'USR-STUDENT-1025', 'UCAO-2025-225', 'YOVO', 'Vanessa', 2, 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6', 1, 1, '+22961001225'),
(26, 'USR-STUDENT-1026', 'UCAO-2025-226', 'ZANNOU', 'Patrick', 2, 'https://images.unsplash.com/photo-1507081323647-4d250478b919', 1, 1, '+22961001226'),
(27, 'USR-STUDENT-1027', 'UCAO-2025-227', 'BOSSOU', 'Rosine', 2, 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91', 1, 1, '+22961001227'),
(28, 'USR-STUDENT-1028', 'UCAO-2025-228', 'GBENOU', 'Samuel', 2, 'https://images.unsplash.com/photo-1489980557514-251d61e3eeb6', 1, 1, '+22961001228'),
(29, 'USR-STUDENT-1029', 'UCAO-2025-229', 'DEGBELO', 'Therese', 2, 'https://images.unsplash.com/photo-1525134479668-1bee5c7c6845', 1, 1, '+22961001229'),
(30, 'USR-STUDENT-1030', 'UCAO-2025-230', 'BOKPE', 'Ulrich', 2, 'https://images.unsplash.com/photo-1503235930437-8c6293ba41f5', 1, 1, '+22961001230');

-- Étudiants L3
INSERT INTO `etudiants` (`id`, `userId`, `matricule`, `nom`, `prenom`, `annee`, `photoUrl`, `ecoleId`, `filiereId`, `whatsapp`) VALUES
(31, 'USR-STUDENT-1031', 'UCAO-2025-231', 'ALLADAYE', 'Agnes', 3, 'https://images.unsplash.com/photo-1517841905240-472988babdf9', 1, 1, '+22961001231'),
(32, 'USR-STUDENT-1032', 'UCAO-2025-232', 'AVOCEGAME', 'Benjamin', 3, 'https://images.unsplash.com/photo-1491349174775-aaafddd81942', 1, 1, '+22961001232'),
(33, 'USR-STUDENT-1033', 'UCAO-2025-233', 'AWOKOU', 'Cecile', 3, 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df', 1, 1, '+22961001233'),
(34, 'USR-STUDENT-1034', 'UCAO-2025-234', 'AZIZOU', 'David', 3, 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea', 1, 1, '+22961001234'),
(35, 'USR-STUDENT-1035', 'UCAO-2025-235', 'DANSOU', 'Elodie', 3, 'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7', 1, 1, '+22961001235'),
(36, 'USR-STUDENT-1036', 'UCAO-2025-236', 'DJIDOHOKPIN', 'Franck', 3, 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d', 1, 1, '+22961001236'),
(37, 'USR-STUDENT-1037', 'UCAO-2025-237', 'DOTOU', 'Geraldine', 3, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', 1, 1, '+22961001237'),
(38, 'USR-STUDENT-1038', 'UCAO-2025-238', 'EZOUHOUN', 'Hugues', 3, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', 1, 1, '+22961001238'),
(39, 'USR-STUDENT-1039', 'UCAO-2025-239', 'GANDONOU', 'Isabelle', 3, 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f', 1, 1, '+22961001239'),
(40, 'USR-STUDENT-1040', 'UCAO-2025-240', 'SOGLO', 'Jules', 3, 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef', 1, 1, '+22961001240');

-- ============================================================================
-- PHASE 1 : ÉLECTION DES RESPONSABLES DE SALLE (PHASE1)
-- ============================================================================
-- 1 nouvelle élection : L2 (id=4) pour EGEI - Informatique Industrielle
-- L'élection aura 4 candidats et 10 votants
-- Le système calculera automatiquement les résultats

-- Créer l'élection L2 pour EGEI - Informatique Industrielle (id=4)
INSERT INTO elections (id, type, titre, description, dateDebut, dateFin, dateDebutCandidature, dateFinCandidature, annee, niveau, isActive, ecoleId, filiereId, createdAt) VALUES
(4, 'SALLE', 'Election Responsable de Salle L2 - EGEI', 'Élection des responsables de salle pour la deuxième année d''Informatique Industrielle', 
'2025-10-10 08:00:00', '2025-10-15 18:00:00', '2025-10-05 08:00:00', '2025-10-09 18:00:00', 
2, 'PHASE1', 1, 1, 1, NOW());

-- Ajouter des candidats pour L2 (4 candidats) - election_id = 4
INSERT INTO candidates (nom, prenom, slogan, programme, motivation, photoUrl, statut, userId, electionId, createdAt) VALUES
('ADJIBADE', 'Leonce', 'Un délégué à votre écoute !', 'Représentation étudiante, communication, organisation d''activités', 'Passionné par le leadership et l''engagement étudiant', 'https://i.ibb.co/rfRS8gH6/imgg.png', 'APPROUVE', 'USR-STUDENT-1001', 4, NOW()),
('GNAHOUI', 'Sylvie', 'Communication et proximité !', 'Communication BDE, activités cohésion, tutorat, ressources pédagogiques', 'Responsable communication BDE, expérience représentation', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1', 'APPROUVE', 'USR-STUDENT-1004', 4, NOW()),
('AHOUANSOU', 'Mathieu', 'Excellence académique !', 'Tutorat C++, groupes d''étude, préparation examens', 'Mentor expérimenté en programmation', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e', 'APPROUVE', 'USR-STUDENT-1007', 4, NOW()),
('ADJOVI', 'Faustin', 'Innovation technologique !', 'Hackathons, projets pratiques, compétitions coding', 'Animateur hackathons, passionné tech', 'https://images.unsplash.com/photo-1521579971123-1192931a1452', 'APPROUVE', 'USR-STUDENT-1009', 4, NOW());

-- Votes pour L2 - EGEI (10 votes pour election_id = 4)
-- Le système calculera automatiquement le gagnant
-- Distribution : Candidat 1 (5 votes), Candidat 2 (3 votes), Candidat 3 (1 vote), Candidat 4 (1 vote)
INSERT INTO votes (userId, electionId, candidateId, poidsVote, createdAt) VALUES
('USR-STUDENT-1021', 4, (SELECT id FROM candidates WHERE userId='USR-STUDENT-1001' AND electionId=4), 1.0, NOW()),
('USR-STUDENT-1022', 4, (SELECT id FROM candidates WHERE userId='USR-STUDENT-1001' AND electionId=4), 1.0, NOW()),
('USR-STUDENT-1023', 4, (SELECT id FROM candidates WHERE userId='USR-STUDENT-1001' AND electionId=4), 1.0, NOW()),
('USR-STUDENT-1024', 4, (SELECT id FROM candidates WHERE userId='USR-STUDENT-1001' AND electionId=4), 1.0, NOW()),
('USR-STUDENT-1025', 4, (SELECT id FROM candidates WHERE userId='USR-STUDENT-1001' AND electionId=4), 1.0, NOW()),
('USR-STUDENT-1026', 4, (SELECT id FROM candidates WHERE userId='USR-STUDENT-1004' AND electionId=4), 1.0, NOW()),
('USR-STUDENT-1027', 4, (SELECT id FROM candidates WHERE userId='USR-STUDENT-1004' AND electionId=4), 1.0, NOW()),
('USR-STUDENT-1028', 4, (SELECT id FROM candidates WHERE userId='USR-STUDENT-1004' AND electionId=4), 1.0, NOW()),
('USR-STUDENT-1029', 4, (SELECT id FROM candidates WHERE userId='USR-STUDENT-1007' AND electionId=4), 1.0, NOW()),
('USR-STUDENT-1030', 4, (SELECT id FROM candidates WHERE userId='USR-STUDENT-1009' AND electionId=4), 1.0, NOW());

-- ============================================================================
-- RÉSUMÉ PHASE 1
-- ============================================================================
-- Élection L2 - EGEI (id=4): 4 candidats, 10 votes
-- - Leonce ADJIBADE : 5 votes
-- - Sylvie GNAHOUI : 3 votes
-- - Mathieu AHOUANSOU : 1 vote
-- - Faustin ADJOVI : 1 vote
-- 
-- Le système calculera automatiquement le gagnant (Leonce ADJIBADE)
-- ============================================================================

-- Vérifier les résultats (requête pour voir les votes)
SELECT 
    e.id AS election_id,
    e.titre,
    e.annee,
    c.nom,
    c.prenom,
    COUNT(v.id) AS votes_recus
FROM elections e
INNER JOIN candidates c ON e.id = c.electionId
LEFT JOIN votes v ON c.id = v.candidateId
WHERE e.id = 4
GROUP BY e.id, c.id
ORDER BY votes_recus DESC;
