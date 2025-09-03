import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import pool from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const JWT_EXPIRES_NORMAL = '8h';
const JWT_EXPIRES_TEMP = '1h';

class AuthService {

    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    // Générer un token JWT
    generateToken(payload, expiresIn = JWT_EXPIRES_NORMAL) {
        return jwt.sign(payload, JWT_SECRET, { expiresIn });
    }

    // Vérifier un token JWT
    verifyToken(token) {
        return jwt.verify(token, JWT_SECRET);
    }

    // Trouver un utilisateur par email ou identifiant
    async findUser(identifier) {
        let connection;
        try {
            connection = await pool.getConnection();

            if (identifier.includes('@')) {
                const [userRows] = await connection.execute(
                    'SELECT * FROM users WHERE email = ?',
                    [identifier]
                );
                return userRows[0] || null;
            } else {
                const [studentRows] = await connection.execute(
                    `SELECT u.* FROM users u 
           JOIN etudiants e ON u.id = e.userId 
           WHERE e.identifiantTemporaire = ?`,
                    [identifier]
                );
                return studentRows[0] || null;
            }
        } finally {
            if (connection) await connection.release();
        }
    }

    // Trouver un étudiant par identifiant temporaire
    async findStudentByTempId(identifiantTemporaire) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [studentRows] = await connection.execute(
                `SELECT e.*, u.* FROM etudiants e 
         JOIN users u ON e.userId = u.id 
         WHERE e.identifiantTemporaire = ?`,
                [identifiantTemporaire]
            );

            return studentRows[0] || null;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Vérifier un mot de passe
    async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    // Hasher un mot de passe
    async hashPassword(password) {
        return await bcrypt.hash(password, 10);
    }

    // Récupérer les infos étudiant
    async getStudentInfo(userId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [studentRows] = await connection.execute(
                'SELECT * FROM etudiants WHERE userId = ?',
                [userId]
            );

            return studentRows[0] || {};
        } finally {
            if (connection) await connection.release();
        }
    }

    // Envoyer un email de réinitialisation
    async sendPasswordResetEmail(email, resetToken) {
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

        const mailOptions = {
            from: process.env.EMAIL_FROM || 'no-reply@ucao-uuc.com',
            to: email,
            subject: 'Réinitialisation de votre mot de passe - UCAO-UUC',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color:#800020;">Réinitialisation de mot de passe</h2>
          <p>Bonjour,</p>
          <p>Pour créer un nouveau mot de passe, cliquez sur le bouton ci-dessous :</p>
          <div style="text-align:center; margin:30px 0;">
            <a href="${resetLink}" style="background-color:#800020;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Réinitialiser mon mot de passe</a>
          </div>
          <p>Ce lien est valable pendant <strong>1 heure</strong>.</p>
          <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
        </div>`
        };

        await this.transporter.sendMail(mailOptions);
    }

    // Mettre à jour le mot de passe
    async updatePassword(userId, newPassword) {
        let connection;
        try {
            connection = await pool.getConnection();

            const hashedPassword = await this.hashPassword(newPassword);

            await connection.execute(
                'UPDATE users SET password = ?, tempPassword = NULL, requirePasswordChange = FALSE WHERE id = ?',
                [hashedPassword, userId]
            );
        } finally {
            if (connection) await connection.release();
        }
    }
}

export default new AuthService();