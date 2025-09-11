// helpers/codeHelpers.js
import crypto from 'crypto';

export const toInt = (v, def, min, max) => {
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return def;
    return Math.min(Math.max(n, min), max);
};

export const generateRegistrationCode = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = crypto.randomBytes(8);
    let out = 'UCAO-';
    for (let i = 0; i < 8; i++) {
        if (i === 4) out += '-';
        out += alphabet[buf[i] % alphabet.length];
    }
    return out;
};