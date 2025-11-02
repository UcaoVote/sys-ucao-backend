import bcrypt from 'bcrypt';
import pool from '../database/dbconfig.js';

class UserService {

    // Génère un identifiant temporaire stable
    generateTemporaryIdentifiant() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let identifiant = '';
        for (let i = 0; i < 8; i++) identifiant += chars.charAt(Math.floor(Math.random() * chars.length));
        return `TEMP${identifiant}`;
    }

    // Validations
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        const forbiddenChars = /[<>"'`]/;
        return emailRegex.test(email) && !forbiddenChars.test(email);
    }

    validatePassword(password) {
        return password.length >= 8 &&
            /[A-Z]/.test(password) &&
            /[0-9]/.test(password) &&
            /[!@#$%^&*(),.?":{}|<>]/.test(password);
    }

    validateText(text) {
        return !/[<>"'`]/.test(text);
    }

    validatePhone(phone) {
        // Validation basique pour les numéros internationaux
        return /^[\+]?[0-9\s\-\(\)]{8,}$/.test(phone);
    }

    // Vérifier si l'email existe
    async checkEmailExists(email) {
        let connection;
        try {
            connection = await pool.getConnection();
            const [rows] = await connection.execute(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );
            return rows.length > 0;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Vérifier le matricule
    async validateMatricule(matricule) {
        let connection;
        try {
            connection = await pool.getConnection();
            const [rows] = await connection.execute(
                'SELECT id, userId, identifiantTemporaire FROM etudiants WHERE matricule = ?',
                [matricule]
            );

            if (rows.length === 0) {
                return { valid: false, message: "Matricule non trouvé. Contactez l'administration." };
            }

            if (rows[0].userId) {
                return { valid: false, message: "Ce matricule est déjà associé à un compte." };
            }

            return { valid: true, studentId: rows[0].id, tempId: rows[0].identifiantTemporaire };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Créer un utilisateur
    async createUser(userData) {
        let connection;
        try {
            connection = await pool.getConnection();

            const hashedPassword = await bcrypt.hash(userData.password, 10);

            const [result] = await connection.execute(
                'INSERT INTO users (id, email, password, role, actif, tempPassword, requirePasswordChange) VALUES (UUID(), ?, ?, ?, ?, ?, ?)',
                [userData.email, hashedPassword, 'ETUDIANT', true, null, false]
            );

            const [newUserRows] = await connection.execute(
                'SELECT id FROM users WHERE email = ?',
                [userData.email]
            );

            return newUserRows[0].id;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Mettre à jour un étudiant existant - CORRIGÉ
    async updateStudent(studentData, studentId, userId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const temporaryIdentifiant = studentData.tempId || this.generateTemporaryIdentifiant();

            await connection.execute(
                `UPDATE etudiants
                SET userId = ?, nom = ?, prenom = ?, identifiantTemporaire = ?, filiereId = ?, annee = ?, ecoleId = ?, whatsapp = ?, additional_info = ?
                WHERE id = ?`,
                [
                    userId,
                    studentData.nom,
                    studentData.prenom,
                    temporaryIdentifiant,
                    studentData.filiereId,
                    studentData.annee,
                    studentData.ecoleId,
                    studentData.whatsapp || null,
                    studentData.additionalInfo || null,
                    studentId
                ]
            );

            return temporaryIdentifiant;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Vérifier que la filière appartient à l'école
    async checkFiliereInEcole(filiereId, ecoleId) {
        let connection;
        try {
            connection = await pool.getConnection();
            const [rows] = await connection.execute(
                `SELECT id FROM filieres WHERE id = ? AND ecoleId = ?`,
                [filiereId, ecoleId]
            );
            return rows.length > 0;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Vérifier l'existence des activités
    async validateActivities(activities) {
        if (!activities || activities.length === 0) {
            return { valid: true, validActivities: [] };
        }

        let connection;
        try {
            connection = await pool.getConnection();
            const placeholders = activities.map(() => '?').join(',');
            const [rows] = await connection.execute(
                `SELECT id FROM activities WHERE id IN (${placeholders}) AND actif = TRUE`,
                activities
            );

            const validActivities = rows.map(row => row.id);
            const invalidActivities = activities.filter(id => !validActivities.includes(id));

            if (invalidActivities.length > 0) {
                return {
                    valid: false,
                    message: `Activités invalides: ${invalidActivities.join(', ')}`
                };
            }

            return { valid: true, validActivities };
        } finally {
            if (connection) await connection.release();
        }
    }

}

export default new UserService();