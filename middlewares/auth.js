// middlewares/auth.js
import jwt from 'jsonwebtoken';
import pool from '../database/dbconfig.js';



/**
 * Middleware d'authentification JWT
 */
export const authenticateToken = async (req, res, next) => {
    let connection;
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: "Token d'authentification requis" });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            console.error('JWT verify error:', err);
            return res.status(401).json({ message: 'Token invalide ou expiré' });
        }

        // decoded doit contenir l'id de l'utilisateur ; tolère id ou userId
        const userIdFromToken = decoded?.id ?? decoded?.userId;
        if (!userIdFromToken) {
            return res.status(401).json({ message: "Token invalide (user id manquant)" });
        }

        connection = await pool.getConnection();

        const [userRows] = await connection.execute(
            `SELECT u.*, e.id as etudiantId, e.matricule, e.nom as etudiantNom, 
              e.prenom as etudiantPrenom, a.id as adminId, a.nom as adminNom, 
              a.prenom as adminPrenom, a.poste
       FROM users u
       LEFT JOIN etudiants e ON u.id = e.userId
       LEFT JOIN admins a ON u.id = a.userId
       WHERE u.id = ?`,
            [userIdFromToken]
        );

        if (!userRows || userRows.length === 0) {
            return res.status(401).json({ message: 'Utilisateur non trouvé' });
        }

        const row = userRows[0];

        // Construire objets etudiant / admin si présents
        const etudiant = row.etudiantId
            ? {
                id: row.etudiantId,
                matricule: row.matricule,
                nom: row.etudiantNom,
                prenom: row.etudiantPrenom,
            }
            : null;

        const admin = row.adminId
            ? {
                id: row.adminId,
                nom: row.adminNom,
                prenom: row.adminPrenom,
                poste: row.poste,
            }
            : null;

        // Attacher req.user - forcer types simples (string/boolean)
        req.user = {
            id: String(row.id),
            email: row.email,
            role: row.role,
            requirePasswordChange: !!row.requirePasswordChange,
            actif: !!row.actif,
            etudiant,
            admin,
        };

        next();
    } catch (error) {
        console.error("Erreur d'authentification:", error);
        return res.status(500).json({ message: "Erreur serveur lors de l'authentification" });
    } finally {
        if (connection) {
            try { await connection.release(); } catch (e) { }
        }
    }
};

/**
 * Middleware de vérification de rôle
 * roles peut être une string ou un tableau de strings (ex: 'ADMIN' ou ['ADMIN','ETUDIANT'])
 */
// middlewares/role.js
export function requireRole(role) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({
                success: false,
                message: "Accès refusé. Droits insuffisants."
            });
        }
        next();
    };
}


export const requireStudent = requireRole('ETUDIANT');
export const requireAdmin = requireRole('ADMIN');

/**
 * Middleware pour vérifier si l'utilisateur peut voter
 */
export const canVote = async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'ETUDIANT') {
            return res.status(403).json({ message: 'Seuls les étudiants peuvent voter', code: 'STUDENT_ONLY' });
        }

        if (!req.user.etudiant || !req.user.etudiant.matricule) {
            return res.status(400).json({ message: 'Profil étudiant incomplet', code: 'INCOMPLETE_PROFILE' });
        }

        next();
    } catch (error) {
        console.error('Erreur vérification vote:', error);
        return res.status(500).json({ message: 'Erreur lors de la vérification', code: 'VOTE_CHECK_ERROR' });
    }
};

/**
 * Middleware pour vérifier la propriété de la ressource
 * resourceType: 'election' | 'candidate' | 'vote'
 */
export const checkOwnership = (resourceType) => {
    return async (req, res, next) => {
        let connection;
        try {
            // Valider id de ressource
            const resourceIdRaw = req.params.id;
            const resourceId = Number.parseInt(resourceIdRaw, 10);
            if (Number.isNaN(resourceId)) {
                return res.status(400).json({ message: 'Identifiant de ressource invalide', code: 'INVALID_RESOURCE_ID' });
            }

            if (!req.user) {
                return res.status(401).json({ message: 'Authentification requise' });
            }

            const userId = String(req.user.id);
            connection = await pool.getConnection();

            let resource = null;

            switch (resourceType) {
                case 'election': {
                    const [rows] = await connection.execute(
                        `SELECT e.*, c.id as candidateId, c.nom as candidateNom, 
                    c.prenom as candidatePrenom, c.description as candidateDescription
             FROM elections e
             LEFT JOIN candidates c ON e.id = c.electionId
             WHERE e.id = ?`,
                        [resourceId]
                    );
                    if (rows && rows.length > 0) {
                        resource = {
                            ...rows[0],
                            candidates: rows.filter(r => r.candidateId).map(r => ({
                                id: r.candidateId,
                                nom: r.candidateNom,
                                prenom: r.candidatePrenom,
                                description: r.candidateDescription,
                            })),
                        };
                    }
                    break;
                }
                case 'candidate': {
                    const [rows] = await connection.execute(`SELECT * FROM candidates WHERE id = ?`, [resourceId]);
                    resource = rows && rows.length > 0 ? rows[0] : null;
                    break;
                }
                case 'vote': {
                    const [rows] = await connection.execute(`SELECT * FROM votes WHERE id = ?`, [resourceId]);
                    resource = rows && rows.length > 0 ? rows[0] : null;
                    break;
                }
                default:
                    return res.status(400).json({ message: 'Type de ressource non supporté', code: 'UNSUPPORTED_RESOURCE' });
            }

            if (!resource) {
                return res.status(404).json({ message: 'Ressource non trouvée', code: 'RESOURCE_NOT_FOUND' });
            }

            // Les admins ont accès à tout
            if (req.user.role === 'ADMIN') {
                req.resource = resource;
                return next();
            }

            // Vérifier la propriété selon le type
            let isOwner = false;
            switch (resourceType) {
                case 'election':
                    // Par défaut, seuls les admins modifient les élections ; étudiants non propriétaires
                    isOwner = false;
                    break;
                case 'candidate':
                case 'vote':
                    // Les tables candidates/votes ont userId en varchar; comparer en string
                    isOwner = String(resource.userId) === userId;
                    break;
            }

            if (!isOwner) {
                return res.status(403).json({ message: "Accès non autorisé à cette ressource", code: 'RESOURCE_ACCESS_DENIED' });
            }

            req.resource = resource;
            next();
        } catch (error) {
            console.error('Erreur vérification propriété:', error);
            return res.status(500).json({ message: 'Erreur lors de la vérification', code: 'OWNERSHIP_CHECK_ERROR' });
        } finally {
            if (connection) {
                try { await connection.release(); } catch (e) { /* ignore */ }
            }
        }
    };
};

/**
 * Middleware pour vérifier si l'utilisateur doit changer son mot de passe
 */
export const checkPasswordChange = (req, res, next) => {
    if (req.user && req.user.requirePasswordChange && req.path !== '/change-password') {
        return res.status(403).json({
            message: 'Vous devez changer votre mot de passe avant de continuer',
            code: 'PASSWORD_CHANGE_REQUIRED',
            requirePasswordChange: true,
        });
    }
    next();
};
