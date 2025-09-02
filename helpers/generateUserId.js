// helpers/generateUserId.js
import { v4 as uuidv4 } from 'uuid';

/**
 * Génère un identifiant UUID pour un nouvel utilisateur
 * @returns {string} UUID v4
 */
export function generateUserId() {
    return uuidv4();
}

