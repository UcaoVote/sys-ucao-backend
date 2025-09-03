// services/studentService.js
import pool from '../config/database.js';
import { toInt, generateTemporaryIdentifiant, generateTemporaryPassword } from '../helpers/studentHelpers.js';
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

            const [studentsRows] = await connection.execute(
                studentsQuery,
                [...queryParams, currentLimit, skip]
            );

            const [[totalResult]] = await connection.execute(countQuery, queryParams);
            const total = totalResult.total;

            return {
                students: studentsRows,
                total
            };
        } finally {
            if (connection) await connection.release();
        }
    },

    async getStudentStats(filiere, annee, ecole) {
        let connection;
        try {
            connection = await pool.getConnection();

            let whereConditions = ['u.role = "ETUDIANT"'];
            let queryParams = [];

            if (filiere) {
                whereConditions.push('e.filiere = ?');
                queryParams.push(filiere);
            }
            if (annee) {
                whereConditions.push('e.annee = ?');
                queryParams.push(parseInt(annee));
            }
            if (ecole) {
                whereConditions.push('e.ecole = ?');
                queryParams.push(ecole);
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

            const query = `
                SELECT e.id, u.actif, e.filiere, e.annee, e.ecole 
                FROM etudiants e 
                LEFT JOIN users u ON e.userId = u.id 
                ${whereClause}
            `;

            const [studentsRows] = await connection.execute(query, queryParams);

            return studentsRows;
        } finally {
            if (connection) await connection.release();
        }
    }
};