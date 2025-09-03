// services/studentService.js
import pool from '../config/database.js';
import { generateTemporaryIdentifiant, generateTemporaryPassword } from '../helpers/studentHelpers.js';
import { parseIntSafe, buildStudentFilters } from '../helpers/validateQueryParams.js';

export const studentService = {
    async updateStudentStatus(studentId, actif) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [etudiantRows] = await connection.execute(
                `SELECT e.*, u.id as userId, u.actif as userActif 
                 FROM etudiants e 
                 LEFT JOIN users u ON e.userId = u.id 
                 WHERE e.id = ?`,
                [parseInt(studentId)]
            );

            if (etudiantRows.length === 0 || !etudiantRows[0].userId) {
                throw new Error('Étudiant non trouvé');
            }

            const etudiant = etudiantRows[0];

            await connection.execute(
                'UPDATE users SET actif = ? WHERE id = ?',
                [actif, etudiant.userId]
            );

            const [updatedUserRows] = await connection.execute(
                `SELECT u.*, e.id as etudiantId, e.nom, e.prenom, e.filiere, e.annee, e.ecole, e.matricule
                 FROM users u 
                 LEFT JOIN etudiants e ON u.id = e.userId 
                 WHERE u.id = ?`,
                [etudiant.userId]
            );

            return updatedUserRows[0];
        } finally {
            if (connection) await connection.release();
        }
    },

    async resetStudentAccess(studentId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [studentRows] = await connection.execute(
                `SELECT e.*, u.email 
                 FROM etudiants e 
                 LEFT JOIN users u ON e.userId = u.id 
                 WHERE e.id = ?`,
                [parseInt(studentId)]
            );

            if (studentRows.length === 0) {
                throw new Error('Étudiant non trouvé');
            }

            const student = studentRows[0];
            const temporaryIdentifiant = generateTemporaryIdentifiant();
            const temporaryPassword = generateTemporaryPassword();
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 7);

            await connection.execute(
                'UPDATE etudiants SET identifiantTemporaire = ? WHERE id = ?',
                [temporaryIdentifiant, parseInt(studentId)]
            );

            await connection.execute(
                'UPDATE users SET password = ?, tempPassword = ?, requirePasswordChange = TRUE, passwordResetExpires = ? WHERE id = ?',
                [temporaryPassword, temporaryPassword, expirationDate, student.userId]
            );

            return {
                temporaryIdentifiant,
                temporaryPassword,
                expirationDate,
                student
            };
        } finally {
            if (connection) await connection.release();
        }
    },

    async findStudentByMatricule(matricule) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [studentRows] = await connection.execute(
                `SELECT e.*, u.email, u.actif, u.createdAt 
                 FROM etudiants e 
                 LEFT JOIN users u ON e.userId = u.id 
                 WHERE e.matricule = ?`,
                [matricule]
            );

            return studentRows[0];
        } finally {
            if (connection) await connection.release();
        }
    },

    async findStudentByCode(code) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [studentRows] = await connection.execute(
                `SELECT e.*, u.email, u.actif, u.createdAt 
                 FROM etudiants e 
                 LEFT JOIN users u ON e.userId = u.id 
                 WHERE e.codeInscription = ?`,
                [code]
            );

            return studentRows[0];
        } finally {
            if (connection) await connection.release();
        }
    },

    async getStudents(page, limit, filiere, annee, ecole, status, search) {
        let connection;
        try {
            connection = await pool.getConnection();

            const currentPage = parseIntSafe(page, 1);
            const currentLimit = parseIntSafe(limit, 10);
            const skip = (currentPage - 1) * currentLimit;

            const { whereClause, queryParams } = buildStudentFilters({ filiere, annee, ecole, status, search });

            const studentsQuery = `
                SELECT e.*, u.email, u.actif 
                FROM etudiants e 
                LEFT JOIN users u ON e.userId = u.id 
                ${whereClause} 
                ORDER BY e.nom ASC, e.prenom ASC 
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT COUNT(*) as total 
                FROM etudiants e 
                LEFT JOIN users u ON e.userId = u.id 
                ${whereClause}
            `;

            console.log('Params SQL:', [...queryParams, currentLimit, skip]);

            // Exécuter la requête de comptage
            const [[totalResult]] = await connection.execute(countQuery, queryParams);
            const total = totalResult.total;

            // Exécuter la requête de sélection avec tous les paramètres
            const [studentsRows] = await connection.execute(
                studentsQuery,
                [...queryParams, currentLimit, skip]
            );

            return {
                students: studentsRows,
                total
            };
        } catch (err) {
            console.error('Erreur dans studentService.getStudents:', err);
            console.error('Paramètres de la requête:', [...queryParams, currentLimit, skip]);
            throw err;
        } finally {
            if (connection) await connection.release();
        }
    },


    // services/studentService.js
    async getStudents(page, limit, filiere, annee, ecole, status, search) {
        let connection;
        let queryParams; // Déclarer queryParams à l'extérieur du try pour qu'il soit accessible dans le catch

        try {
            connection = await pool.getConnection();

            const currentPage = parseIntSafe(page, 1);
            const currentLimit = parseIntSafe(limit, 10);
            const skip = (currentPage - 1) * currentLimit;

            const { whereClause, queryParams: filterParams } = buildStudentFilters({ filiere, annee, ecole, status, search });
            queryParams = filterParams; // Assigner à la variable externe

            const studentsQuery = `
            SELECT e.*, u.email, u.actif 
            FROM etudiants e 
            LEFT JOIN users u ON e.userId = u.id 
            ${whereClause} 
            ORDER BY e.nom ASC, e.prenom ASC 
            LIMIT ? OFFSET ?
        `;

            const countQuery = `
            SELECT COUNT(*) as total 
            FROM etudiants e 
            LEFT JOIN users u ON e.userId = u.id 
            ${whereClause}
        `;

            console.log('Params SQL:', [...queryParams, currentLimit, skip]);

            // D'abord exécuter la requête de comptage
            const [[totalResult]] = await connection.execute(countQuery, queryParams);
            const total = totalResult.total;

            // Ensuite exécuter la requête de sélection
            const [studentsRows] = await connection.execute(
                studentsQuery,
                [...queryParams, currentLimit, skip]
            );

            return {
                students: studentsRows,
                total
            };
        } catch (err) {
            console.error('Erreur dans studentService.getStudents:', err);
            console.error('Paramètres de la requête:', queryParams || 'non définis');
            throw err;
        } finally {
            if (connection) await connection.release();
        }
    }
};