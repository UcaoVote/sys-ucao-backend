import express from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';

const router = express.Router();

// Génère un identifiant temporaire stable
const generateTemporaryIdentifiant = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let identifiant = '';
  for (let i = 0; i < 8; i++) identifiant += chars.charAt(Math.floor(Math.random() * chars.length));
  return `TEMP${identifiant}`;
};

// Validations (inchangées)
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const forbiddenChars = /[<>"'`]/;
  return emailRegex.test(email) && !forbiddenChars.test(email);
};

const validatePassword = (password) =>
  password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password);

const validateText = (text) => !/[<>"'`]/.test(text);

// Logger minimal (inchangé)
const logger = {
  info: (m, d) => console.log(`[INFO] ${m}`, JSON.stringify(d)),
  error: (m, e) => console.error(`[ERROR] ${m}`, { error: e.message, stack: e.stack, at: new Date().toISOString() })
};

// Rate limit (inchangé)
const rateLimit = (options) => {
  const requests = new Map();
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowMs = options.windowMs || 15 * 60 * 1000;
    const max = options.max || 5;
    const entry = requests.get(ip) || { count: 0, startTime: now };
    if (now - entry.startTime > windowMs) {
      requests.set(ip, { count: 1, startTime: now });
      return next();
    }
    if (entry.count >= max) {
      logger.error('Rate limit exceeded', { ip });
      return res.status(429).json({ success: false, message: 'Trop de tentatives. Réessayez plus tard.' });
    }
    entry.count++;
    requests.set(ip, entry);
    next();
  };
};

router.post('/', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), async (req, res) => {
  console.log("Requête reçue:", req.body);
  let connection;
  try {
    const { email, password, confirmPassword, nom, prenom, filiere, annee, code, matricule, ecole } = req.body;

    // Champs obligatoires (inchangé)
    if (!email || !password || !confirmPassword || !nom || !prenom || !filiere || !annee || !ecole) {
      return res.status(400).json({ success: false, message: 'Tous les champs obligatoires sont requis.' });
    }

    // Validation des mots de passe identiques (inchangé)
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas.' });
    }

    const anneeInt = Number.parseInt(annee, 10);
    if (!Number.isInteger(anneeInt) || anneeInt < 1 || anneeInt > 3) {
      return res.status(400).json({ success: false, message: "L'année doit être entre 1 et 3." });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, message: 'Format email invalide.' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir 8+ caractères, 1 majuscule, 1 chiffre et 1 caractère spécial.'
      });
    }

    // Validation des champs texte (inchangé)
    if (!validateText(nom) || !validateText(prenom) || !validateText(filiere) || !validateText(ecole)) {
      return res.status(400).json({
        success: false,
        message: 'Le nom, prénom, filière et école ne doivent pas contenir de caractères spéciaux.'
      });
    }

    // Récupération d'une connexion depuis le pool
    connection = await pool.getConnection();

    // Email unique
    const [emailExists] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (emailExists.length > 0) {
      return res.status(409).json({ success: false, message: "Cet email est déjà utilisé." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 1ère année : code d'inscription
    if (anneeInt === 1) {
      if (!code) {
        return res.status(400).json({
          success: false,
          message: "Code d'inscription requis pour la 1ère année."
        });
      }

      try {
        // Vérification du code d'inscription
        const [regCodeRows] = await connection.execute(
          'SELECT id, is_used FROM registration_codes WHERE code = ?',
          [code]
        );

        if (regCodeRows.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Ce code d'inscription n'existe pas."
          });
        }

        const regCode = regCodeRows[0];
        if (regCode.is_used) {
          return res.status(409).json({
            success: false,
            message: "Ce code d'inscription a déjà été utilisé."
          });
        }

        const temporaryIdentifiant = generateTemporaryIdentifiant();

        // Début de la transaction
        await connection.beginTransaction();

        try {
          // Insertion de l'utilisateur
          const [userResult] = await connection.execute(
            'INSERT INTO users (email, password, role, temp_password, require_password_change) VALUES (?, ?, ?, ?, ?)',
            [email, hashedPassword, 'ETUDIANT', null, false]
          );

          const userId = userResult.insertId;

          // Insertion de l'étudiant
          await connection.execute(
            `INSERT INTO etudiants 
            (user_id, nom, prenom, identifiant_temporaire, filiere, annee, code_inscription, ecole) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, nom, prenom, temporaryIdentifiant, filiere, anneeInt, code, ecole]
          );

          // Mise à jour du code d'inscription
          await connection.execute(
            'UPDATE registration_codes SET is_used = TRUE, used_by_user_id = ? WHERE code = ?',
            [userId, code]
          );

          // Commit de la transaction
          await connection.commit();

          logger.info('Inscription 1ère année OK', {
            userId: userId,
            email,
            code
          });

          return res.status(201).json({
            success: true,
            message: "Inscription réussie.",
            data: {
              student: {
                id: userId,
                nom: nom,
                prenom: prenom,
                identifiantTemporaire: temporaryIdentifiant,
                filiere: filiere,
                annee: anneeInt,
                ecole: ecole
              }
            }
          });

        } catch (txError) {
          // Rollback en cas d'erreur
          await connection.rollback();
          throw txError;
        }

      } catch (txError) {
        logger.error('Erreur transaction 1A', {
          message: txError.message,
          code: txError.code,
          stack: txError.stack
        });

        return res.status(500).json({
          success: false,
          message: "Erreur interne lors de l'inscription.",
          error: txError.message
        });
      }
    }

    // 2e/3e année : via matricule
    if (anneeInt >= 2 && anneeInt <= 3) {
      if (!matricule) {
        return res.status(400).json({ success: false, message: 'Matricule requis pour les années supérieures.' });
      }

      try {
        // Recherche de l'étudiant par matricule
        const [etuRows] = await connection.execute(
          'SELECT id, user_id, identifiant_temporaire FROM etudiants WHERE matricule = ?',
          [matricule]
        );

        if (etuRows.length === 0) {
          return res.status(404).json({ success: false, message: "Matricule non trouvé. Contactez l'administration." });
        }

        const etuRow = etuRows[0];
        if (etuRow.user_id) {
          return res.status(409).json({ success: false, message: 'Ce matricule est déjà associé à un compte.' });
        }

        const temporaryIdentifiant = etuRow.identifiant_temporaire || generateTemporaryIdentifiant();

        // Début de la transaction
        await connection.beginTransaction();

        try {
          // Insertion de l'utilisateur
          const [userResult] = await connection.execute(
            'INSERT INTO users (email, password, role, temp_password, require_password_change) VALUES (?, ?, ?, ?, ?)',
            [email, hashedPassword, 'ETUDIANT', null, false]
          );

          const userId = userResult.insertId;

          // Mise à jour de l'étudiant
          await connection.execute(
            `UPDATE etudiants 
            SET user_id = ?, nom = ?, prenom = ?, identifiant_temporaire = ?, filiere = ?, annee = ?, ecole = ? 
            WHERE id = ?`,
            [userId, nom, prenom, temporaryIdentifiant, filiere, anneeInt, ecole, etuRow.id]
          );

          // Commit de la transaction
          await connection.commit();

          logger.info('Inscription 2/3A OK', { email, matricule });

          return res.status(201).json({
            success: true,
            message: 'Inscription réussie.',
            data: {
              student: {
                id: userId,
                nom,
                prenom,
                matricule,
                identifiantTemporaire: temporaryIdentifiant,
                filiere,
                annee: anneeInt,
                ecole
              }
            }
          });

        } catch (txError) {
          // Rollback en cas d'erreur
          await connection.rollback();
          throw txError;
        }
      } catch (txError) {
        logger.error('Erreur transaction 2/3A', txError);
        return res.status(500).json({ success: false, message: "Erreur lors de l'association du matricule." });
      }
    }

  } catch (err) {
    logger.error('Erreur inscription', err);
    return res.status(500).json({ success: false, message: 'Une erreur serveur est survenue.' });
  } finally {
    // Libération de la connexion
    if (connection) connection.release();
  }
});

export default router;