const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ message: 'Email et mot de passe requis' });

        // Trouver user par email
        const user = await User.findByEmail(email);

        if (!user || user.role !== 'ADMIN') {
            return res.status(400).json({ message: 'Administrateur non trouvé ou rôle invalide' });
        }

        // Vérifier si le compte est actif
        if (!user.actif) {
            return res.status(400).json({ message: 'Compte désactivé' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword)
            return res.status(400).json({ message: 'Mot de passe incorrect' });

        // Vérifier que l'admin existe bien
        const admin = await Admin.findByUserId(user.id);
        if (!admin) {
            return res.status(400).json({ message: 'Profil administrateur incomplet' });
        }

        // Génération du token JWT
        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                requirePasswordChange: user.requirePasswordChange || false
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ message: 'Connexion réussie', token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;