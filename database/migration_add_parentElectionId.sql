-- Migration: Ajout de la colonne parentElectionId pour lier les élections Tour 2 à leur Tour 1
-- Date: 2025-11-05
-- Description: Permet de créer une relation parent-enfant entre élections Tour 1 et Tour 2

-- Note: La colonne parentElectionId existe déjà, on ajoute juste l'index et la contrainte

-- Ajouter un index pour améliorer les performances des requêtes
ALTER TABLE elections 
ADD INDEX idx_elections_parent (parentElectionId);

-- Ajouter une clé étrangère pour assurer l'intégrité référentielle
ALTER TABLE elections 
ADD CONSTRAINT fk_elections_parent 
FOREIGN KEY (parentElectionId) REFERENCES elections (id) 
ON DELETE SET NULL;

-- Vérification
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT, 
    COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'elections' 
AND COLUMN_NAME = 'parentElectionId';
