// utils/validateQueryParams.js

export function parseIntSafe(value, fallback = 1) {
    const parsed = parseInt(value);
    return isNaN(parsed) ? fallback : parsed;
}

export function parseStringSafe(value, fallback = null) {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

export function parseSearchPattern(value) {
    const pattern = parseStringSafe(value);
    return pattern ? `%${pattern}%` : null;
}

export function buildStudentFilters({ filiere, annee, ecole, status, search }) {
    const whereConditions = ['u.role = "ETUDIANT"'];
    const queryParams = [];

    if (status === 'active') {
        whereConditions.push('u.actif = true');
    } else if (status === 'inactive') {
        whereConditions.push('u.actif = false');
    }

    const filiereVal = parseStringSafe(filiere);
    if (filiereVal) {
        whereConditions.push('e.filiere = ?');
        queryParams.push(filiereVal);
    }

    const anneeVal = parseIntSafe(annee);
    if (anneeVal) {
        whereConditions.push('e.annee = ?');
        queryParams.push(anneeVal);
    }

    const ecoleVal = parseStringSafe(ecole);
    if (ecoleVal) {
        whereConditions.push('e.ecole = ?');
        queryParams.push(ecoleVal);
    }

    const searchVal = parseSearchPattern(search);
    if (searchVal) {
        whereConditions.push(`(
            e.nom LIKE ? OR 
            e.prenom LIKE ? OR 
            e.identifiantTemporaire LIKE ? OR 
            e.matricule LIKE ? OR 
            e.codeInscription LIKE ?
        )`);
        queryParams.push(...Array(5).fill(searchVal));
    }

    const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    return { whereClause, queryParams };
}
