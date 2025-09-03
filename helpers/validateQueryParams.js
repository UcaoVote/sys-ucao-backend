// utils/validateQueryParams.js

export function parseIntSafe(value, defaultValue) {
    if (value === null || value === undefined || value === '') {
        return defaultValue;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

export function parseStringSafe(value, fallback = null) {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

export function parseSearchPattern(value) {
    const pattern = parseStringSafe(value);
    return pattern ? `%${pattern}%` : null;
}

export function buildStudentFilters({ filiere, annee, ecole, status, search }) {
    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    if (filiere) {
        whereClause += ' AND e.filiere = ?';
        queryParams.push(filiere);
    }

    if (annee) {
        whereClause += ' AND e.annee = ?';
        queryParams.push(annee);
    }

    if (ecole) {
        whereClause += ' AND e.ecole = ?';
        queryParams.push(ecole);
    }

    if (status) {
        // Convertir le statut string en boolean
        const isActive = status === 'Actif';
        whereClause += ' AND u.actif = ?';
        queryParams.push(isActive);
    }

    if (search) {
        whereClause += ' AND (e.nom LIKE ? OR e.prenom LIKE ? OR e.matricule LIKE ? OR e.codeInscription LIKE ? OR e.identifiantTemporaire LIKE ?)';
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    return { whereClause, queryParams };
}