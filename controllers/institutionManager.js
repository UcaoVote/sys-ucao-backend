import pool from '../dbconfig.js';
import createActivityLog from '../controllers/activityManager.js';

//
// Ajouter une école
//
export const addEcole = async (req, res) => {
    const { nom } = req.body;
    if (!nom) return res.status(400).json({ error: 'Nom de l\'école requis' });

    try {
        const [existing] = await pool.execute('SELECT id FROM ecoles WHERE nom = ?', [nom.trim()]);
        if (existing.length > 0) return res.status(409).json({ error: 'École déjà enregistrée' });

        const [result] = await pool.execute(
            'INSERT INTO ecoles (nom, actif, createdAt) VALUES (?, TRUE, NOW())',
            [nom.trim()]
        );

        await activityLogger(req.user.id, `Ajout école "${nom}"`);
        res.status(201).json({ success: true, ecoleId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

//
// Modifier une école
//
export const updateEcole = async (req, res) => {
    const { id } = req.params;
    const { nom } = req.body;
    if (!nom) return res.status(400).json({ error: 'Nom requis' });

    try {
        const [result] = await pool.execute(
            'UPDATE ecoles SET nom = ? WHERE id = ?',
            [nom.trim(), id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'École introuvable' });

        await activityLogger(req.user.id, `Modification école ID ${id} → "${nom}"`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

//
// Activer/désactiver une école
//
export const toggleEcoleActif = async (req, res) => {
    const { id } = req.params;
    const { actif } = req.body;
    if (typeof actif !== 'boolean') return res.status(400).json({ error: 'Valeur actif invalide' });

    try {
        const [result] = await pool.execute(
            'UPDATE ecoles SET actif = ? WHERE id = ?',
            [actif, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'École introuvable' });

        await activityLogger(req.user.id, `${actif ? 'Activation' : 'Désactivation'} école ID ${id}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

//
// Lister toutes les écoles
//
export const getAllEcoles = async (req, res) => {
    const { actif } = req.query;
    let query = 'SELECT * FROM ecoles';
    const params = [];

    if (actif !== undefined) {
        query += ' WHERE actif = ?';
        params.push(actif === 'true' ? 1 : 0);
    }

    try {
        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

//
// Obtenir une école par ID
//
export const getEcoleById = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM ecoles WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'École introuvable' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

//
// Ajouter une filière
//
export const addFiliere = async (req, res) => {
    const { nom, ecoleId } = req.body;
    if (!nom || !ecoleId) return res.status(400).json({ error: 'Nom et école requis' });

    try {
        const [ecole] = await pool.execute('SELECT id FROM ecoles WHERE id = ?', [ecoleId]);
        if (ecole.length === 0) return res.status(404).json({ error: 'École introuvable' });

        const [existing] = await pool.execute(
            'SELECT id FROM filieres WHERE nom = ? AND ecoleId = ?',
            [nom.trim(), ecoleId]
        );
        if (existing.length > 0) return res.status(409).json({ error: 'Filière déjà enregistrée' });

        const [result] = await pool.execute(
            'INSERT INTO filieres (nom, ecoleId, actif, createdAt) VALUES (?, ?, TRUE, NOW())',
            [nom.trim(), ecoleId]
        );

        await activityLogger(req.user.id, `Ajout filière "${nom}" à l'école ID ${ecoleId}`);
        res.status(201).json({ success: true, filiereId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

//
// Modifier une filière
//
export const updateFiliere = async (req, res) => {
    const { id } = req.params;
    const { nom } = req.body;
    if (!nom) return res.status(400).json({ error: 'Nom requis' });

    try {
        const [result] = await pool.execute(
            'UPDATE filieres SET nom = ? WHERE id = ?',
            [nom.trim(), id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Filière introuvable' });

        await activityLogger(req.user.id, `Modification filière ID ${id} → "${nom}"`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

//
// Activer/désactiver une filière
//
export const toggleFiliereActif = async (req, res) => {
    const { id } = req.params;
    const { actif } = req.body;
    if (typeof actif !== 'boolean') return res.status(400).json({ error: 'Valeur actif invalide' });

    try {
        const [result] = await pool.execute(
            'UPDATE filieres SET actif = ? WHERE id = ?',
            [actif, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Filière introuvable' });

        await activityLogger(req.user.id, `${actif ? 'Activation' : 'Désactivation'} filière ID ${id}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

//
// Lister toutes les filières
//
export const getAllFilieres = async (req, res) => {
    const { actif } = req.query;
    let query = 'SELECT * FROM filieres';
    const params = [];

    if (actif !== undefined) {
        query += ' WHERE actif = ?';
        params.push(actif === 'true' ? 1 : 0);
    }

    try {
        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

//
// Obtenir une filière par ID
//
export const getFiliereById = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM filieres WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Filière introuvable' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

//
// Lister les filières d’une école
//
export const getFilieresByEcole = async (req, res) => {
    const { ecoleId } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM filieres WHERE ecoleId = ?',
            [ecoleId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
