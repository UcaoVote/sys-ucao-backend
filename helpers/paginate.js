// helpers/paginate.js

/**
 * Pagine les résultats d'une requête
 * @param {Array} data - Données à paginer
 * @param {number} page - Page actuelle
 * @param {number} limit - Nombre d'éléments par page
 * @returns {object} - Résultats paginés avec métadonnées
 */
export function paginateResults(data, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const paginated = data.slice(offset, offset + limit);

    return {
        total: data.length,
        page,
        limit,
        pages: Math.ceil(data.length / limit),
        results: paginated
    };
}

