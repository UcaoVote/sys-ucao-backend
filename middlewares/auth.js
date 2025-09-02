import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

// Configuration de la connexion MySQL
const dbConfig = {
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

/**
 * Middleware d'authentification JWT
 */
export const authenticateToken = async (req, res, next) => {
    let connection;
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                message: 'Token d\'authentification requis'
            });
        }

        // Vérification du token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        connection = await mysql.createConnection(dbConfig);

        // Récupération de l'utilisateur avec ses relations
        const [userRows] = await connection.execute(
            `SELECT u.*, e.id as etudiantId, e.matricule, e.nom as etudiantNom, 
                    e.prenom as etudiantPrenom, a.id as adminId, a.nom as adminNom, 
                    a.prenom as adminPrenom, a.poste
             FROM users u
             LEFT JOIN etudiants e ON u.id = e.userId
             LEFT JOIN admins a ON u.id = a.userId
             WHERE u.id = ?`,
            [decoded.id]
        );

        if (userRows.length === 0) {
            return res.status(401).json({
                message: 'Utilisateur non trouvé'
            });
        }

        const user = userRows[0];

        // Construction des objets etudiant et admin
        const etudiant = user.etudiantId ? {
            id: user.etudiantId,
            matricule: user.matricule,
            nom: user.etudiantNom,
            prenom: user.etudiantPrenom
        } : null;

        const admin = user.adminId ? {
            id: user.adminId,
            nom: user.adminNom,
            prenom: user.adminPrenom,
            poste: user.poste
        } : null;

        // Ajout des informations utilisateur à la requête
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            requirePasswordChange: user.requirePasswordChange,
            etudiant: etudiant,
            admin: admin
        };

        next();
    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        return res.status(401).json({
            message: 'Token invalide ou expiré'
        });
    } finally {
        if (connection) await connection.end();
    }
};

// Les autres middlewares restent inchangés car ils utilisent req.user
// ... (requireRole, requireStudent, requireAdmin, canVote, checkOwnership, checkPasswordChange)

/**
 * Middleware de vérification de rôle
 */
export const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentification requise'
            });
        }

        const userRole = req.user.role;
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                message: 'Permissions insuffisantes'
            });
        }

        next();
    };
};

/**
 * Middleware pour vérifier si l'utilisateur est un étudiant
 */
export const requireStudent = requireRole('ETUDIANT');

/**
 * Middleware pour vérifier si l'utilisateur est un admin
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Middleware pour vérifier si l'utilisateur peut voter
 */
export const canVote = async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'ETUDIANT') {
            return res.status(403).json({
                message: 'Seuls les étudiants peuvent voter',
                code: 'STUDENT_ONLY'
            });
        }

        // Vérifier si l'étudiant a un profil complet
        if (!req.user.etudiant || !req.user.etudiant.matricule) {
            return res.status(400).json({
                message: 'Profil étudiant incomplet',
                code: 'INCOMPLETE_PROFILE'
            });
        }

        next();
    } catch (error) {
        console.error('Erreur vérification vote:', error);
        return res.status(500).json({
            message: 'Erreur lors de la vérification',
            code: 'VOTE_CHECK_ERROR'
        });
    }
};

/**
 * Middleware pour vérifier la propriété de la ressource
 */
export const checkOwnership = (resourceType) => {
    return async (req, res, next) => {
        let connection;
        try {
            const resourceId = parseInt(req.params.id);
            const userId = req.user.id;

            let resource;
            connection = await mysql.createConnection(dbConfig);

            switch (resourceType) {
                case 'election':
                    const [electionRows] = await connection.execute(
                        `SELECT e.*, c.id as candidateId, c.nom as candidateNom, 
                                c.prenom as candidatePrenom, c.description as candidateDescription
                         FROM elections e
                         LEFT JOIN candidates c ON e.id = c.electionId
                         WHERE e.id = ?`,
                        [resourceId]
                    );
                    if (electionRows.length > 0) {
                        resource = {
                            ...electionRows[0],
                            candidates: electionRows.filter(row => row.candidateId).map(row => ({
                                id: row.candidateId,
                                nom: row.candidateNom,
                                prenom: row.candidatePrenom,
                                description: row.candidateDescription
                            }))
                        };
                    }
                    break;
                case 'candidate':
                    const [candidateRows] = await connection.execute(
                        `SELECT * FROM candidates WHERE id = ?`,
                        [resourceId]
                    );
                    resource = candidateRows[0];
                    break;
                case 'vote':
                    const [voteRows] = await connection.execute(
                        `SELECT * FROM votes WHERE id = ?`,
                        [resourceId]
                    );
                    resource = voteRows[0];
                    break;
                default:
                    return res.status(400).json({
                        message: 'Type de ressource non supporté',
                        code: 'UNSUPPORTED_RESOURCE'
                    });
            }

            if (!resource) {
                return res.status(404).json({
                    message: 'Ressource non trouvée',
                    code: 'RESOURCE_NOT_FOUND'
                });
            }

            // Les admins peuvent accéder à toutes les ressources
            if (req.user.role === 'ADMIN') {
                req.resource = resource;
                return next();
            }

            // Vérifier la propriété selon le type
            let isOwner = false;

            switch (resourceType) {
                case 'election':
                    // Les étudiants ne peuvent pas modifier les élections
                    isOwner = false;
                    break;
                case 'candidate':
                    isOwner = resource.userId === userId;
                    break;
                case 'vote':
                    isOwner = resource.userId === userId;
                    break;
            }

            if (!isOwner) {
                return res.status(403).json({
                    message: 'Accès non autorisé à cette ressource',
                    code: 'RESOURCE_ACCESS_DENIED'
                });
            }

            req.resource = resource;
            next();
        } catch (error) {
            console.error('Erreur vérification propriété:', error);
            return res.status(500).json({
                message: 'Erreur lors de la vérification',
                code: 'OWNERSHIP_CHECK_ERROR'
            });
        } finally {
            if (connection) await connection.end();
        }
    };
};

// Middleware pour vérifier si le changement de mot de passe est requis
export const checkPasswordChange = (req, res, next) => {
    if (req.user.requirePasswordChange && req.path !== '/change-password') {
        return res.status(403).json({
            message: 'Vous devez changer votre mot de passe avant de continuer',
            code: 'PASSWORD_CHANGE_REQUIRED',
            requirePasswordChange: true
        });
    }
    next();
};
