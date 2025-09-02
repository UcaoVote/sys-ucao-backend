const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Admin = require('../models/Admin');

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { email, password, nom, prenom, poste } = req.body;

        if (!email || !password || !nom || !prenom) {
            return res.status(400).json({ message: 'Champs requis manquants' });
        }

        // Vérifier si email déjà pris
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'Email déjà utilisé' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer l'user
        const userId = uuidv4();
        const user = await User.create({
            id: userId,
            email,
            password: hashedPassword,
            role: 'ADMIN'
        });

        // Créer l'admin
        const admin = await Admin.create({
            userId,
            nom,
            prenom,
            poste: poste || ''
        });

        res.status(201).json({ message: 'Admin créé avec succès', adminId: admin.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
});

module.exports = router;