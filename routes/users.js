import axios from 'axios';
import FormData from 'form-data';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import pool from '../database.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Configuration ImgBB
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

// Configuration de Multer pour les avatars
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads/avatars';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  dest: '/tmp/uploads',
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté (JPEG, PNG, GIF uniquement)'));
    }
  }
});

// Récupérer le profil étudiant
router.get('/profile', authenticateToken, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Vérifier le rôle de l'utilisateur
    const [userRows] = await connection.execute(
      `SELECT role FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (userRows.length === 0 || userRows[0].role !== 'ETUDIANT') {
      return res.status(403).json({ message: 'Accès réservé aux étudiants' });
    }

    // Récupérer le profil étudiant
    const [etudiantRows] = await connection.execute(
      `SELECT e.*, u.email, u.role 
       FROM etudiants e 
       INNER JOIN users u ON e.userId = u.id 
       WHERE e.userId = ?`,
      [req.user.id]
    );

    if (etudiantRows.length === 0) {
      return res.status(404).json({ message: 'Profil étudiant non trouvé' });
    }

    const etudiant = etudiantRows[0];

    const profileData = {
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

    res.json(profileData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur' });
  } finally {
    if (connection) connection.release();
  }
});

// Mettre à jour le profil étudiant
router.put('/profile', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { email, nom, prenom, filiere, annee } = req.body;
    connection = await pool.getConnection();

    // Vérifier le rôle de l'utilisateur
    const [userRows] = await connection.execute(
      `SELECT role, email FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (userRows.length === 0 || userRows[0].role !== 'ETUDIANT') {
      return res.status(403).json({ message: 'Accès réservé aux étudiants' });
    }

    const user = userRows[0];

    // Vérifier si l'email est déjà utilisé
    if (email && email !== user.email) {
      const [existingRows] = await connection.execute(
        `SELECT id FROM users WHERE email = ?`,
        [email]
      );

      if (existingRows.length > 0) {
        return res.status(400).json({ message: 'Email déjà utilisé' });
      }

      // Mettre à jour l'email
      await connection.execute(
        `UPDATE users SET email = ? WHERE id = ?`,
        [email, req.user.id]
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
      updateValues.push(req.user.id);
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
      [req.user.id]
    );

    const updatedEtudiant = updatedRows[0];

    res.json({
      message: 'Profil mis à jour avec succès',
      profile: {
        email: email || user.email,
        ...updatedEtudiant
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur' });
  } finally {
    if (connection) connection.release();
  }
});

// Changement de photo de profil
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  let connection;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier téléchargé' });
    }

    // Créer un FormData pour ImgBB
    const formData = new FormData();
    formData.append('image', fs.createReadStream(req.file.path));

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
    fs.unlinkSync(req.file.path);

    if (!response.data.success) {
      throw new Error('Échec de l\'upload vers ImgBB');
    }

    // Mettre à jour l'URL dans la base de données
    const imgbbUrl = response.data.data.url;
    connection = await pool.getConnection();

    await connection.execute(
      `UPDATE etudiants SET photoUrl = ? WHERE userId = ?`,
      [imgbbUrl, req.user.id]
    );

    res.json({
      success: true,
      photoUrl: imgbbUrl,
      message: 'Avatar mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur upload avatar:', error);
    // Nettoyage du fichier temporaire en cas d'erreur
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      message: error.response?.data?.error?.message || 'Erreur lors de l\'upload'
    });
  } finally {
    if (connection) connection.release();
  }
});

// Changer le mot de passe
router.post('/change-password', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    // Vérifier l'utilisateur
    connection = await pool.getConnection();
    const [userRows] = await connection.execute(
      `SELECT password FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const user = userRows[0];

    // Vérifier l'ancien mot de passe
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
    }

    // Hacher et mettre à jour le mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await connection.execute(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword, req.user.id]
    );

    res.json({
      success: true,
      message: 'Mot de passe changé avec succès'
    });

  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({
      message: 'Erreur lors du changement de mot de passe'
    });
  } finally {
    if (connection) connection.release();
  }
});

export default router;