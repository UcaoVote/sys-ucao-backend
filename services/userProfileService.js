import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';

// Configuration ImgBB
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

class UserProfileService {

    // Récupérer le profil étudiant
    async getStudentProfile(userId) {
        let connection;
        try {
            connection = await pool.getConnection();

            // Vérifier le rôle de l'utilisateur
            const [userRows] = await connection.execute(
                `SELECT role FROM users WHERE id = ?`,
                [userId]
            );

            if (userRows.length === 0 || userRows[0].role !== 'ETUDIANT') {
                throw new Error('Accès réservé aux étudiants');
            }

            // Récupérer le profil étudiant
            const [etudiantRows] = await connection.execute(
                `SELECT e.*, u.email, u.role 
         FROM etudiants e 
         INNER JOIN users u ON e.userId = u.id 
         WHERE e.userId = ?`,
                [userId]
            );

            if (etudiantRows.length === 0) {
                throw new Error('Profil étudiant non trouvé');
            }

            const etudiant = etudiantRows[0];

            return {
                id: etudiant.userId,
                email: etudiant.email,
                role: etudiant.role,
                matricule: etudiant.matricule,
                codeInscription: etudiant.codeInscription,
                nom: etudiant.nom,
                prenom: etudiant.prenom,
                filiere: etudiant.filiere,
                annee: etudiant.annee,
                photoUrl: etudiant.photoUrl
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Mettre à jour le profil étudiant
    async updateStudentProfile(userId, updateData) {
        let connection;
        try {
            connection = await pool.getConnection();

            const { email, nom, prenom, filiere, annee } = updateData;

            // Vérifier le rôle de l'utilisateur
            const [userRows] = await connection.execute(
                `SELECT role, email FROM users WHERE id = ?`,
                [userId]
            );

            if (userRows.length === 0 || userRows[0].role !== 'ETUDIANT') {
                throw new Error('Accès réservé aux étudiants');
            }

            const user = userRows[0];

            // Vérifier si l'email est déjà utilisé
            if (email && email !== user.email) {
                const [existingRows] = await connection.execute(
                    `SELECT id FROM users WHERE email = ?`,
                    [email]
                );

                if (existingRows.length > 0) {
                    throw new Error('Email déjà utilisé');
                }

                // Mettre à jour l'email
                await connection.execute(
                    `UPDATE users SET email = ? WHERE id = ?`,
                    [email, userId]
                );
            }

            // Mettre à jour le profil étudiant
            const updateFields = [];
            const updateValues = [];

            if (nom) {
                updateFields.push('nom = ?');
                updateValues.push(nom);
            }
            if (prenom) {
                updateFields.push('prenom = ?');
                updateValues.push(prenom);
            }
            if (filiere) {
                updateFields.push('filiere = ?');
                updateValues.push(filiere);
            }
            if (annee) {
                updateFields.push('annee = ?');
                updateValues.push(parseInt(annee));
            }

            if (updateFields.length > 0) {
                updateValues.push(userId);
                await connection.execute(
                    `UPDATE etudiants SET ${updateFields.join(', ')} WHERE userId = ?`,
                    updateValues
                );
            }

            // Récupérer les données mises à jour
            const [updatedRows] = await connection.execute(
                `SELECT e.*, u.email 
         FROM etudiants e 
         INNER JOIN users u ON e.userId = u.id 
         WHERE e.userId = ?`,
                [userId]
            );

            const updatedEtudiant = updatedRows[0];

            return {
                email: email || user.email,
                ...updatedEtudiant
            };
        } finally {
            if (connection) await connection.release();
        }
    }

    // Uploader l'avatar vers ImgBB
    async uploadAvatar(filePath, userId) {
        try {
            // Créer un FormData pour ImgBB
            const formData = new FormData();
            formData.append('image', fs.createReadStream(filePath));

            // Envoyer à ImgBB
            const response = await axios.post(
                `${IMGBB_UPLOAD_URL}?key=${process.env.IMGBB_API_KEY}`,
                formData,
                {
                    headers: formData.getHeaders(),
                    timeout: 10000
                }
            );

            // Supprimer le fichier temporaire après upload
            fs.unlinkSync(filePath);

            if (!response.data.success) {
                throw new Error('Échec de l\'upload vers ImgBB');
            }

            // Mettre à jour l'URL dans la base de données
            let connection;
            try {
                connection = await pool.getConnection();

                const imgbbUrl = response.data.data.url;

                await connection.execute(
                    `UPDATE etudiants SET photoUrl = ? WHERE userId = ?`,
                    [imgbbUrl, userId]
                );

                return imgbbUrl;
            } finally {
                if (connection) await connection.release();
            }

        } catch (error) {
            // Nettoyage du fichier temporaire en cas d'erreur
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            throw error;
        }
    }

    // Changer le mot de passe
    async changePassword(userId, currentPassword, newPassword) {
        let connection;
        try {
            connection = await pool.getConnection();

            // Vérifier l'utilisateur
            const [userRows] = await connection.execute(
                `SELECT password FROM users WHERE id = ?`,
                [userId]
            );

            if (userRows.length === 0) {
                throw new Error('Utilisateur non trouvé');
            }

            const user = userRows[0];

            // Vérifier l'ancien mot de passe
            const validPassword = await bcrypt.compare(currentPassword, user.password);
            if (!validPassword) {
                throw new Error('Mot de passe actuel incorrect');
            }

            // Hacher et mettre à jour le mot de passe
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            await connection.execute(
                `UPDATE users SET password = ? WHERE id = ?`,
                [hashedPassword, userId]
            );

            return true;
        } finally {
            if (connection) await connection.release();
        }
    }
}

export default new UserProfileService();