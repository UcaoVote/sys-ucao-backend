-- Selectionné tous les étudiants par odre alphabétique
--
SELECT 
    e.id, 
    e.matricule, 
    e.nom, 
    e.prenom, 
    e.filiere, 
    e.annee, 
    e.ecole,
    u.email,
    u.actif,
    u.createdAt
FROM etudiants e
INNER JOIN users u ON e.userId = u.id
ORDER BY e.nom, e.prenom;

-- Rechercher un étudiant par nom, prénom ou matricule
SELECT 
    e.id, 
    e.matricule, 
    e.nom, 
    e.prenom, 
    e.filiere, 
    e.annee, 
    e.ecole,
    u.email,
    u.actif
FROM etudiants e
INNER JOIN users u ON e.userId = u.id
WHERE e.nom LIKE '%Dupont%' 
   OR e.prenom LIKE '%Jean%' 
   OR e.matricule LIKE '%MAT2024%';

-- Filtrage
   SELECT 
    e.id, 
    e.matricule, 
    e.nom, 
    e.prenom, 
    e.filiere, 
    e.annee, 
    e.ecole,
    u.email,
    u.actif
FROM etudiants e
INNER JOIN users u ON e.userId = u.id
WHERE e.filiere = 'Informatique' AND e.annee = 2
ORDER BY e.nom, e.prenom;