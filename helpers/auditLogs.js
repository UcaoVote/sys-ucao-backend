// helpers/auditLogs.js

/**
 * Log institutionnel d'une requête de recherche
 * @param {string} keyword - Mot-clé recherché
 * @param {string} userId - ID de l'utilisateur initiateur
 * @param {object} db - Instance Prisma ou MySQL
 * @returns {Promise<void>}
 */
async function logSearchQuery(keyword, userId, db) {
    await db.activity_logs.create({
        data: {
            action: 'RECHERCHE_ETUDIANT',
            details: `Mot-clé: ${keyword}`,
            userId,
            timestamp: new Date()
        }
    });
}

export default logSearchQuery

