// helpers/studentHelpers.js
export const toInt = (v, def, min, max) => {
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return def;
    return Math.min(Math.max(n, min), max);
};

export const generateTemporaryIdentifiant = () => {
    return `ETU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
};

export const generateTemporaryPassword = () => {
    return Math.random().toString(36).substring(2, 10);
};