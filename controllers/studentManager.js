import pool from '../dbconfig.js'
// 1. Lister tous les étudiants 
async function getAllStudents() {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                e.id, 
                e.matricule,
                e.nom, 
                e.prenom, 
                f.nom AS nomFiliere,
                ec.nom AS nomEcole,
                e.annee, 
                u.email,
                e.identifiantTemporaire,
                u.tempPassword,
                u.actif,
                u.createdAt
            FROM etudiants e
            INNER JOIN users u ON e.userId = u.id
            LEFT JOIN filieres f ON e.filiereId = f.id
            LEFT JOIN ecoles ec ON e.ecoleId = ec.id
            ORDER BY e.nom, e.prenom
        `);
        return rows;
    } catch (error) {
        console.error('Erreur lors de la récupération des étudiants:', error);
        throw error;
    }
}

// 2. Rechercher un étudiant(Validé après que le seach soit nettoyer)
async function searchStudents(searchTerm) {
    try {
        const likeTerm = `%${String(searchTerm).trim()}%`;

        const [rows] = await pool.execute(`
            SELECT 
                e.id, e.matricule, e.nom, e.prenom,
                f.nom AS nomFiliere,
                ec.nom AS nomEcole,
                e.annee,
                u.email, u.actif
            FROM etudiants e
            INNER JOIN users u ON e.userId = u.id
            LEFT JOIN filieres f ON e.filiereId = f.id
            LEFT JOIN ecoles ec ON e.ecoleId = ec.id
            WHERE e.nom LIKE ? OR e.prenom LIKE ? OR e.matricule LIKE ?
        `, [likeTerm, likeTerm, likeTerm]);

        return rows;
    } catch (error) {
        console.error('Erreur lors de la recherche d\'étudiants:', error);
        throw error;
    }
}

// 3. Filtrer les étudiants par filière et année(validé)
async function getFilteredStudents({ filiereId, annee, ecoleId }) {
    try {
        const conditions = [];
        const values = [];

        if (filiereId) {
            conditions.push('e.filiereId = ?');
            values.push(filiereId);
        }

        if (annee) {
            conditions.push('e.annee = ?');
            values.push(parseInt(annee, 10));
        }

        if (ecoleId) {
            conditions.push('e.ecoleId = ?');
            values.push(ecoleId);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await pool.execute(`
            SELECT 
                e.id, e.matricule, e.nom, e.prenom,
                f.nom AS nomFiliere,
                ec.nom AS nomEcole,
                e.annee,
                u.email, u.actif
            FROM etudiants e
            INNER JOIN users u ON e.userId = u.id
            LEFT JOIN filieres f ON e.filiereId = f.id
            LEFT JOIN ecoles ec ON e.ecoleId = ec.id
            ${whereClause}
            ORDER BY e.nom, e.prenom
        `, values);

        return rows;
    } catch (error) {
        console.error('Erreur lors du filtrage des étudiants:', error);
        throw error;
    }
}

// 4. Ajouter un nouvel étudiant(Validé)
async function addStudent(studentData) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const userId = `etud_${Date.now()}`;
        const sanitize = (val) => val === undefined ? null : val;

        if (!studentData.email || !studentData.password) {
            throw new Error("Email ou mot de passe manquant pour la création de l'utilisateur.");
        }

        // Vérifier que la filière appartient bien à l'école
        const [validFiliere] = await connection.execute(
            `SELECT id FROM filieres WHERE id = ? AND ecoleId = ?`,
            [studentData.filiereId, studentData.ecoleId]
        );

        if (validFiliere.length === 0) {
            throw new Error("La filière sélectionnée n'est pas rattachée à l'école spécifiée.");
        }

        // Insérer dans la table users
        await connection.execute(`
            INSERT INTO users (id, email, password, role, actif)
            VALUES (?, ?, ?, 'ETUDIANT', TRUE)
        `, [
            userId,
            sanitize(studentData.email),
            sanitize(studentData.password)
        ]);

        // Insérer dans la table etudiants
        await connection.execute(`
            INSERT INTO etudiants (
                userId, matricule, nom, prenom,
                filiereId, annee, ecoleId
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            userId,
            sanitize(studentData.matricule),
            sanitize(studentData.nom),
            sanitize(studentData.prenom),
            sanitize(studentData.filiereId),
            sanitize(studentData.annee),
            sanitize(studentData.ecoleId)
        ]);

        await connection.commit();
        return { success: true, message: 'Étudiant ajouté avec succès' };
    } catch (error) {
        await connection.rollback();
        console.error("Erreur lors de l'ajout de l'étudiant:", error);
        throw error;
    } finally {
        connection.release();
    }
}

// 5. Modifier les informations d'un étudiant(Validé)
async function updateStudent(studentId, updates) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Récupérer l'userId de l'étudiant
        const [studentRows] = await connection.execute(
            'SELECT userId FROM etudiants WHERE id = ?',
            [studentId]
        );

        if (studentRows.length === 0) {
            throw new Error('Étudiant non trouvé');
        }

        const userId = studentRows[0].userId;

        // Mettre à jour la table etudiants
        if (Object.keys(updates.student).length > 0) {
            const setClause = Object.keys(updates.student)
                .map(key => `${key} = ?`)
                .join(', ');

            const values = Object.values(updates.student);
            values.push(studentId);

            await connection.execute(
                `UPDATE etudiants SET ${setClause} WHERE id = ?`,
                values
            );
        }

        // Mettre à jour la table users
        if (updates.user && updates.user.email) {
            await connection.execute(
                'UPDATE users SET email = ? WHERE id = ?',
                [updates.user.email, userId]
            );
        }

        await connection.commit();
        return { success: true, message: 'Étudiant modifié avec succès' };
    } catch (error) {
        await connection.rollback();
        console.error('Erreur lors de la modification de l\'étudiant:', error);
        throw error;
    } finally {
        connection.release();
    }
}
// 6. Désactiver/réactiver un compte étudiant(validé)
async function toggleStudentStatus(studentId, isActive) {
    try {
        const [studentRows] = await pool.execute(
            'SELECT userId FROM etudiants WHERE id = ?',
            [studentId]
        );

        if (studentRows.length === 0) {
            throw new Error('Étudiant non trouvé');
        }

        const userId = studentRows[0].userId;

        await pool.execute(
            'UPDATE users SET actif = ? WHERE id = ?',
            [isActive, userId]
        );

        return {
            success: true,
            message: `Compte ${isActive ? 'activé' : 'désactivé'} avec succès`
        };
    } catch (error) {
        console.error('Erreur lors de la modification du statut:', error);
        throw error;
    }
}
// 7. Supprimer un étudiant(validé)
async function deleteStudent(studentId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Récupérer l'userId de l'étudiant
        const [studentRows] = await connection.execute(
            'SELECT userId FROM etudiants WHERE id = ?',
            [studentId]
        );

        if (studentRows.length === 0) {
            throw new Error('Étudiant non trouvé');
        }

        const userId = studentRows[0].userId;

        // Supprimer l'étudiant (cela devrait supprimer l'utilisateur via CASCADE)
        await connection.execute(
            'DELETE FROM etudiants WHERE id = ?',
            [studentId]
        );

        await connection.commit();
        return { success: true, message: 'Étudiant supprimé avec succès' };
    } catch (error) {
        await connection.rollback();
        console.error('Erreur lors de la suppression de l\'étudiant:', error);
        throw error;
    } finally {
        connection.release();
    }
}
// 8. Statistiques par filière
async function getStatsByFiliereAndAnnee() {
    const [rows] = await pool.execute(`
        SELECT 
            f.nom AS nomFiliere,
            e.annee,
            COUNT(*) AS total_etudiants
        FROM etudiants e
        INNER JOIN filieres f ON e.filiereId = f.id
        INNER JOIN users u ON e.userId = u.id
        WHERE u.actif = TRUE
        GROUP BY f.nom, e.annee
        ORDER BY f.nom, e.annee
    `);
    return rows;
}
// 9. Vérifier les étudiants sans compte utilisateur actif
async function getInactiveStudents() {
    try {
        const [rows] = await pool.execute(`
      SELECT 
        e.* 
      FROM etudiants e
      INNER JOIN users u ON e.userId = u.id
      WHERE u.actif = FALSE
    `);
        return rows;
    } catch (error) {
        console.error('Erreur lors de la récupération des étudiants inactifs:', error);
        throw error;
    }
}
// 10. Rapport des étudiants par école et année
async function getReportByEcoleAndAnnee() {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                ec.nom AS nomEcole,
                e.annee,
                COUNT(*) as effectif
            FROM etudiants e
            INNER JOIN ecoles ec ON e.ecoleId = ec.id
            GROUP BY ec.nom, e.annee
            ORDER BY ec.nom, e.annee
        `);
        return rows;
    } catch (error) {
        console.error('Erreur lors de la génération du rapport:', error);
        throw error;
    }
}

export default {
    getAllStudents,
    searchStudents,
    getFilteredStudents,
    addStudent,
    updateStudent,
    toggleStudentStatus,
    deleteStudent,
    getStatsByFiliereAndAnnee,
    getInactiveStudents,
    getReportByEcoleAndAnnee
};