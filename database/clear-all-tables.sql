-- ============================================
-- Script SQL pour vider toutes les tables
-- ATTENTION: Cette action est IRRÉVERSIBLE !
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;

-- Vider les tables de liaison et dépendantes (dans l'ordre des dépendances)
DELETE FROM vote_transfers;
DELETE FROM votes;
DELETE FROM vote_tokens;
DELETE FROM election_results;
DELETE FROM election_rounds;
DELETE FROM candidates;
DELETE FROM student_subactivities;
DELETE FROM student_activities;
DELETE FROM subactivities;
DELETE FROM delegues_universite;
DELETE FROM delegues_ecole;
DELETE FROM responsables_salle;
DELETE FROM notifications;
DELETE FROM activity_logs;
DELETE FROM registration_codes;

-- Vider les tables principales
DELETE FROM elections;
DELETE FROM etudiants;
DELETE FROM admins;
DELETE FROM filieres;
DELETE FROM ecoles;
DELETE FROM activities;
DELETE FROM users;

-- Réinitialiser les AUTO_INCREMENT
ALTER TABLE vote_transfers AUTO_INCREMENT = 1;
ALTER TABLE votes AUTO_INCREMENT = 1;
ALTER TABLE vote_tokens AUTO_INCREMENT = 1;
ALTER TABLE election_results AUTO_INCREMENT = 1;
ALTER TABLE election_rounds AUTO_INCREMENT = 1;
ALTER TABLE candidates AUTO_INCREMENT = 1;
ALTER TABLE subactivities AUTO_INCREMENT = 1;
ALTER TABLE delegues_universite AUTO_INCREMENT = 1;
ALTER TABLE delegues_ecole AUTO_INCREMENT = 1;
ALTER TABLE responsables_salle AUTO_INCREMENT = 1;
ALTER TABLE elections AUTO_INCREMENT = 1;
ALTER TABLE etudiants AUTO_INCREMENT = 1;
ALTER TABLE admins AUTO_INCREMENT = 1;
ALTER TABLE filieres AUTO_INCREMENT = 1;
ALTER TABLE ecoles AUTO_INCREMENT = 1;
ALTER TABLE activities AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Base de données vidée avec succès !' as Message;
